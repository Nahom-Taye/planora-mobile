import {
  toInstant,
  type AppSettings,
  type ReminderEntityType,
  type ReminderIntent,
  type TimeZone,
} from '../../../domain/entities/index.ts';
import type {
  EntityRepository,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import type { NotificationDeviceGateway } from './notification-device.ts';
import {
  applyQuietHours,
  calculateReminderOccurrences,
  MAX_SCHEDULED_OCCURRENCES,
  type ReminderSource,
} from './reminder-time.ts';

export type ReconciliationResult = {
  scheduled: number;
  skipped: number;
  errors: number;
};

export class ReminderReconciliationService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly device: NotificationDeviceGateway,
  ) {}

  async reconcile(input: {
    workspaceId: string;
    settings: AppSettings;
    timeZone: TimeZone;
    permissionAllowed: boolean;
    now: Date;
    genericTitle: string;
    genericBody: string;
  }): Promise<ReconciliationResult> {
    const result = { scheduled: 0, skipped: 0, errors: 0 };
    const mappings = await listAll(this.repositories.deviceNotificationSchedules, {
      workspaceId: input.workspaceId,
    });
    for (const mapping of mappings) {
      if (mapping.notificationIdentifier) {
        try {
          await this.device.cancel(mapping.notificationIdentifier);
        } catch {
          await this.repositories.deviceNotificationSchedules.update(mapping.id, {
            expectedRevision: mapping.revision,
            state: 'error',
            reason: 'cancel_failed',
          });
          result.errors += 1;
          continue;
        }
      }
      await this.repositories.deviceNotificationSchedules.softDelete(
        mapping.id,
        mapping.revision,
      );
    }
    if (result.errors > 0) return result;
    if (!input.permissionAllowed) return result;
    let processed = 0;
    const intents = await listAll(this.repositories.reminderIntents, {
      workspaceId: input.workspaceId,
      enabled: true,
    });
    intentLoop: for (const intent of intents) {
      const source = await sourceFor(this.repositories, intent);
      if (!source || source.workspaceId !== input.workspaceId) continue;
      const occurrences = calculateReminderOccurrences(
        intent,
        source,
        input.timeZone,
        input.now,
      );
      for (const occurrence of occurrences) {
        if (processed >= MAX_SCHEDULED_OCCURRENCES) break intentLoop;
        processed += 1;
        const quiet = applyQuietHours(occurrence, input.settings, input.timeZone);
        if (quiet.state === 'skip') {
          await this.repositories.deviceNotificationSchedules.create({
            workspaceId: input.workspaceId,
            reminderIntentId: intent.id,
            occurrenceKey: occurrence.key,
            notificationIdentifier: null,
            scheduledFor: null,
            state: 'skipped',
            reason: quiet.reason,
            sourceRevision: source.revision,
          });
          result.skipped += 1;
          continue;
        }
        const identifier = `planora:${intent.id}:${occurrence.key}`;
        try {
          const nativeIdentifier = await this.device.schedule({
            identifier,
            date: quiet.date,
            entityType: intent.entityType,
            entityId: intent.entityId,
            title: input.settings.notificationTitlesEnabled
              ? source.title
              : input.genericTitle,
            body: input.genericBody,
          });
          await this.repositories.deviceNotificationSchedules.create({
            workspaceId: input.workspaceId,
            reminderIntentId: intent.id,
            occurrenceKey: occurrence.key,
            notificationIdentifier: nativeIdentifier,
            scheduledFor: toInstant(quiet.date),
            state: 'scheduled',
            reason: null,
            sourceRevision: source.revision,
          });
          result.scheduled += 1;
        } catch {
          await this.repositories.deviceNotificationSchedules.create({
            workspaceId: input.workspaceId,
            reminderIntentId: intent.id,
            occurrenceKey: occurrence.key,
            notificationIdentifier: null,
            scheduledFor: toInstant(quiet.date),
            state: 'error',
            reason: 'schedule_failed',
            sourceRevision: source.revision,
          });
          result.errors += 1;
        }
      }
    }
    return result;
  }
}

async function sourceFor(
  repositories: RepositoryStore,
  intent: ReminderIntent,
): Promise<ReminderSource | null> {
  if (intent.entityType === 'task') return repositories.tasks.getById(intent.entityId);
  if (intent.entityType === 'plan_block') return repositories.planBlocks.getById(intent.entityId);
  if (intent.entityType === 'routine') return repositories.routines.getById(intent.entityId);
  return repositories.goals.getById(intent.entityId);
}

async function listAll<TEntity, TFilter>(
  repository: EntityRepository<TEntity, TFilter>,
  filter: TFilter,
) {
  const items: TEntity[] = [];
  let offset = 0;
  while (true) {
    const page = await repository.list({ filter, page: { limit: 100, offset } });
    items.push(...page.items);
    if (page.nextOffset === null) return items;
    offset = page.nextOffset;
  }
}

export function reminderRouteFor(
  entityType: ReminderEntityType,
  entityId: string,
) {
  if (entityType === 'task') return { pathname: '/(tasks)/tasks/[id]' as const, params: { id: entityId } };
  if (entityType === 'plan_block') return { pathname: '/(planner)/blocks/[id]' as const, params: { id: entityId } };
  if (entityType === 'routine') return { pathname: '/(routines)/routines/[id]' as const, params: { id: entityId } };
  return { pathname: '/(goals)/goals/[id]' as const, params: { id: entityId } };
}
