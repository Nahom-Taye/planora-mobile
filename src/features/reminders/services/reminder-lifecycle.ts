import type {
  ReminderEntityType,
  ReminderIntent,
} from '../../../domain/entities/index.ts';
import type {
  RepositoryScope,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';
import {
  validateReminderDraft,
  type ReminderDraft,
} from './reminder-validation.ts';

export class ReminderValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Reminder details need attention.');
  }
}

export class ReminderLifecycleService {
  constructor(private readonly repositories: RepositoryStore) {}

  async getForEntity(
    workspaceId: string,
    entityType: ReminderEntityType,
    entityId: string,
  ) {
    const page = await this.repositories.reminderIntents.list({
      filter: { workspaceId, entityType, entityId },
      page: { limit: 1, offset: 0 },
    });
    return page.items[0] ?? null;
  }

  async save(workspaceId: string, draft: ReminderDraft) {
    return this.repositories.transaction(async (repositories) => {
      const value = validateReminderDraft(draft);
      if (!value.valid) throw new ReminderValidationError(value.errors);
      await validateEntity(repositories, workspaceId, value.value.entityType, value.value.entityId);
      const page = await repositories.reminderIntents.list({
        filter: {
          workspaceId,
          entityType: value.value.entityType,
          entityId: value.value.entityId,
        },
        page: { limit: 2, offset: 0 },
      });
      const existing = page.items[0];
      return existing
        ? repositories.reminderIntents.update(existing.id, {
            expectedRevision: existing.revision,
            ...value.value,
          })
        : repositories.reminderIntents.create({ workspaceId, ...value.value });
    });
  }

  async setEnabled(intent: ReminderIntent, enabled: boolean) {
    return this.repositories.reminderIntents.update(intent.id, {
      expectedRevision: intent.revision,
      enabled,
    });
  }
}

async function validateEntity(
  repositories: RepositoryScope,
  workspaceId: string,
  entityType: ReminderEntityType,
  entityId: string,
) {
  const entity =
    entityType === 'task'
      ? await repositories.tasks.getById(entityId)
      : entityType === 'plan_block'
        ? await repositories.planBlocks.getById(entityId)
        : entityType === 'routine'
          ? await repositories.routines.getById(entityId)
          : await repositories.goals.getById(entityId);
  if (!entity || entity.workspaceId !== workspaceId) {
    throw new ReminderValidationError({
      entityId: 'Choose an available planning item from this workspace.',
    });
  }
  if (
    ('status' in entity && entity.status === 'cancelled') ||
    ('status' in entity && entity.status === 'archived') ||
    ('status' in entity && entity.status === 'abandoned')
  ) {
    throw new StorageError('NOT_FOUND', 'That planning item is no longer active.', false);
  }
}
