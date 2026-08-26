import { toInstant } from '../../../domain/entities/common.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { PortableRecordService } from './portable-record-service.ts';

export type ConflictResolutionChoice = 'local' | 'remote' | 'combined';

export class ConflictResolutionService {
  private readonly records: PortableRecordService;

  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.records = new PortableRecordService(repositories);
  }

  async resolve(conflictId: string, accountId: string, choice: ConflictResolutionChoice, combined?: Record<string, unknown>) {
    const conflict = await this.repositories.syncConflicts.getById(conflictId);
    if (!conflict || conflict.accountId !== accountId || conflict.status !== 'open') throw new Error('Conflict unavailable.');
    const remotePayload = parseRecord(conflict.remotePayload);
    if (choice === 'remote') {
      await this.records.apply({
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        workspaceId: conflict.workspaceId,
        revision: conflict.remoteRevision,
        changeCursor: conflict.remoteCursor,
        deleted: conflict.remoteDeleted,
        payload: remotePayload,
      }, conflict.workspaceId);
      await removeConflictingChanges(this.repositories, conflict.workspaceId, conflict.accountId, conflict.entityType, conflict.entityId);
    } else {
      if (choice === 'combined' && combined) {
        await this.records.apply({
          entityType: conflict.entityType,
          entityId: conflict.entityId,
          workspaceId: conflict.workspaceId,
          revision: conflict.remoteRevision,
          changeCursor: conflict.remoteCursor,
          deleted: false,
          payload: combined,
        }, conflict.workspaceId);
      }
      await removeConflictingChanges(this.repositories, conflict.workspaceId, conflict.accountId, conflict.entityType, conflict.entityId);
      const local = await this.records.read(conflict.entityType, conflict.entityId, conflict.workspaceId);
      if (local) {
        const change = await this.repositories.localChanges.create({
          entityType: storedEntityType(conflict.entityType),
          entityId: conflict.entityId,
          entityRevision: local.localRevision,
          operation: local.deleted ? 'delete' : 'upsert',
          state: 'pending',
          attemptCount: 0,
          lastAttemptAt: null,
          errorCode: null,
          workspaceId: conflict.workspaceId,
          baseRevision: conflict.remoteRevision,
          accountId: conflict.accountId,
          nextAttemptAt: null,
          syncOrder: 1_000_000,
        });
        if (conflict.entityType !== change.entityType) await this.repositories.syncControl.setPortableType(change.id, conflict.entityType);
      }
    }
    return this.repositories.syncConflicts.update(conflict.id, {
      status: 'resolved',
      resolution: choice,
      resolvedAt: toInstant(this.now()),
    });
  }
}

function storedEntityType(entityType: import('../../../domain/entities/index.ts').PortableEntityType) {
  if (entityType === 'reminder_intent') return 'app_settings' as const;
  if (entityType === 'plan_block_series') return 'plan_block' as const;
  if (entityType === 'goal_routine_link') return 'goal' as const;
  return entityType;
}

function parseRecord(value: string) {
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Conflict data unavailable.');
  return parsed as Record<string, unknown>;
}

async function removeConflictingChanges(repositories: RepositoryStore, workspaceId: string, accountId: string, entityType: string, entityId: string) {
  const matchingIds: string[] = [];
  let offset = 0;
  do {
    const page = await repositories.localChanges.list({ filter: { workspaceId, accountId, entityId }, page: { limit: 100, offset } });
    for (const change of page.items) {
      const type = (await repositories.syncControl.portableType(change.id)) ?? change.entityType;
      if (type === entityType) matchingIds.push(change.id);
    }
    offset = page.nextOffset ?? 0;
  } while (offset > 0);

  for (const id of matchingIds) await repositories.localChanges.remove(id);
}
