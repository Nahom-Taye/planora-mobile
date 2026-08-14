import type { ReminderEntityType } from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { reminderRouteFor } from './reminder-reconciliation.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES: ReminderEntityType[] = ['task', 'plan_block', 'routine', 'goal'];

export function parseNotificationDestination(data: unknown) {
  if (!isRecord(data) || data.planoraVersion !== 1) return null;
  if (
    typeof data.entityType !== 'string' ||
    !TYPES.includes(data.entityType as ReminderEntityType) ||
    typeof data.entityId !== 'string' ||
    !UUID.test(data.entityId)
  ) {
    return null;
  }
  return {
    entityType: data.entityType as ReminderEntityType,
    entityId: data.entityId,
  };
}

export async function resolveNotificationDestination(
  repositories: RepositoryStore,
  workspaceId: string,
  data: unknown,
) {
  const destination = parseNotificationDestination(data);
  if (!destination) return { ok: false as const, reason: 'malformed' as const };
  const entity =
    destination.entityType === 'task'
      ? await repositories.tasks.getById(destination.entityId)
      : destination.entityType === 'plan_block'
        ? await repositories.planBlocks.getById(destination.entityId)
        : destination.entityType === 'routine'
          ? await repositories.routines.getById(destination.entityId)
          : await repositories.goals.getById(destination.entityId);
  if (!entity || entity.workspaceId !== workspaceId) {
    return { ok: false as const, reason: 'missing' as const };
  }
  return {
    ok: true as const,
    route: reminderRouteFor(destination.entityType, destination.entityId),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
