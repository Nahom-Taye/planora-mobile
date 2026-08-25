import type { LocalChange, PortableEntityType, RemotePlanningRecord, SyncBinding } from '../../../domain/entities/index.ts';
import { toInstant } from '../../../domain/entities/common.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { PortableRecordService, retryDelayMs } from './portable-record-service.ts';
import { SyncGatewayError, type SyncGateway } from './sync-gateway.ts';

export type SyncRunResult = { pushed: number; pulled: number; conflicts: number; pending: number };

export class SyncCancelledError extends Error {
  constructor() {
    super('sync_cancelled');
  }
}

export class SyncEngine {
  private readonly records: PortableRecordService;

  constructor(
    private readonly repositories: RepositoryStore,
    private readonly gateway: SyncGateway,
    private readonly now: () => Date = () => new Date(),
    private readonly random: () => number = Math.random,
  ) {
    this.records = new PortableRecordService(repositories);
  }

  async run(workspaceId: string, accountId: string, isCurrentAccount: () => boolean = () => true): Promise<SyncRunResult> {
    ensureCurrentAccount(isCurrentAccount);
    const binding = await activeBinding(this.repositories, workspaceId);
    if (!binding || !binding.enabled) return { pushed: 0, pulled: 0, conflicts: 0, pending: 0 };
    if (binding.accountId !== accountId) {
      await this.repositories.syncBindings.update(binding.id, { enabled: false, state: 'account_mismatch', errorCategory: 'account_mismatch' });
      return { pushed: 0, pulled: 0, conflicts: 0, pending: await pendingCount(this.repositories, workspaceId, accountId) };
    }
    await this.repositories.syncBindings.update(binding.id, { state: 'syncing', errorCategory: null });
    try {
      const pushed = await this.pushBatch(binding, accountId, isCurrentAccount);
      const pullResult = await this.pullBatch(binding, isCurrentAccount);
      ensureCurrentAccount(isCurrentAccount);
      const conflicts = (await this.repositories.syncConflicts.list({ filter: { workspaceId, accountId, status: 'open' }, page: { limit: 100, offset: 0 } })).items.length;
      const restoring = binding.restoreState === 'running' && pullResult.batchFull;
      const state = conflicts ? 'conflict' : restoring ? 'restoring' : 'idle';
      await this.repositories.syncBindings.update(binding.id, {
        state,
        errorCategory: null,
        lastSuccessAt: toInstant(this.now()),
        restoreState: restoring ? 'running' : 'idle',
      });
      return { pushed, pulled: pullResult.pulled, conflicts, pending: await pendingCount(this.repositories, workspaceId, accountId) };
    } catch (error) {
      if (error instanceof SyncCancelledError) throw error;
      const category = error instanceof SyncGatewayError ? error.category : 'remote';
      const state = category === 'offline' ? 'offline' : 'error';
      await this.repositories.syncBindings.update(binding.id, { state, errorCategory: category });
      await this.repositories.syncDiagnostics.create({
        workspaceId,
        category,
        occurredAt: toInstant(this.now()),
        attemptCount: 1,
        connectivity: category === 'offline' ? 'offline' : 'unknown',
        entityType: null,
      });
      throw error;
    }
  }

  private async pushBatch(binding: SyncBinding, accountId: string, isCurrentAccount: () => boolean) {
    const queue = await this.repositories.localChanges.list({
      filter: { workspaceId: binding.workspaceId, accountId },
      page: { limit: 50, offset: 0 },
    });
    const selected = new Map<string, LocalChange>();
    for (const change of queue.items) {
      const type = (await this.repositories.syncControl.portableType(change.id)) ?? change.entityType;
      const key = `${type}:${change.entityId}`;
      const previous = selected.get(key);
      if (previous) await this.repositories.localChanges.remove(previous.id);
      selected.set(key, change);
    }
    let pushed = 0;
    for (const change of [...selected.values()].filter((item) => due(item, this.now()))) {
      ensureCurrentAccount(isCurrentAccount);
      const entityType = (await this.repositories.syncControl.portableType(change.id)) ?? change.entityType as PortableEntityType;
      const record = await this.records.read(entityType, change.entityId, binding.workspaceId);
      if (!record) {
        await this.repositories.localChanges.remove(change.id);
        continue;
      }
      await this.repositories.localChanges.update(change.id, {
        state: 'processing',
        lastAttemptAt: toInstant(this.now()),
        attemptCount: change.attemptCount + 1,
      });
      try {
        const result = await this.gateway.push({
          operationId: change.id,
          accountId,
          baseRevision: change.baseRevision,
          remoteWorkspaceId: binding.remoteWorkspaceId,
          record,
        });
        ensureCurrentAccount(isCurrentAccount);
        if (result.status === 'conflict') {
          await this.saveConflict(binding, change, record.payload, result.remote);
        } else {
          await saveState(this.repositories, binding.workspaceId, entityType, change.entityId, result.revision, result.changeCursor);
          await this.repositories.localChanges.remove(change.id);
          pushed += 1;
        }
      } catch (error) {
        const category = error instanceof SyncGatewayError ? error.category : 'remote';
        const attemptCount = change.attemptCount + 1;
        await this.repositories.localChanges.update(change.id, {
          state: 'failed',
          errorCode: category,
          nextAttemptAt: toInstant(new Date(this.now().getTime() + retryDelayMs(attemptCount, this.random()))),
        });
        throw error;
      }
    }
    return pushed;
  }

  private async pullBatch(binding: SyncBinding, isCurrentAccount: () => boolean) {
    ensureCurrentAccount(isCurrentAccount);
    const remote = await this.gateway.pull(binding.remoteWorkspaceId, binding.lastCursor, 100);
    ensureCurrentAccount(isCurrentAccount);
    let lastCursor = binding.lastCursor;
    let pulled = 0;
    for (const record of remote) {
      ensureCurrentAccount(isCurrentAccount);
      const localRecord = await localIdentity(this.repositories, record, binding.workspaceId);
      const pending = await pendingFor(this.repositories, binding.workspaceId, binding.accountId, localRecord.entityType, localRecord.entityId);
      if (pending) {
        const local = await this.records.read(localRecord.entityType, localRecord.entityId, binding.workspaceId);
        await this.saveConflict(binding, pending, local?.payload ?? {}, localRecord);
      } else {
        await this.records.apply(localRecord, binding.workspaceId);
        pulled += 1;
      }
      lastCursor = Math.max(lastCursor, record.changeCursor);
    }
    if (lastCursor !== binding.lastCursor) {
      await this.repositories.syncBindings.update(binding.id, { lastCursor, restoreCursor: lastCursor });
    }
    return { pulled, batchFull: remote.length === 100 };
  }

  private async saveConflict(binding: SyncBinding, change: LocalChange, localPayload: Record<string, unknown>, remote: RemotePlanningRecord) {
    const values = {
      workspaceId: binding.workspaceId,
      accountId: binding.accountId,
      entityType: remote.entityType,
      entityId: remote.entityId,
      localPayload: JSON.stringify(localPayload),
      remotePayload: JSON.stringify(remote.payload),
      baseRevision: change.baseRevision,
      localRevision: change.entityRevision,
      remoteRevision: remote.revision,
      remoteCursor: remote.changeCursor,
      remoteDeleted: remote.deleted,
      status: 'open' as const,
      resolution: null,
      resolvedAt: null,
    };
    const page = await this.repositories.syncConflicts.list({
      filter: { workspaceId: binding.workspaceId, accountId: binding.accountId, entityType: remote.entityType, status: 'open' },
      page: { limit: 100, offset: 0 },
    });
    const existing = page.items.find((conflict) => conflict.entityId === remote.entityId);
    if (existing) await this.repositories.syncConflicts.update(existing.id, values);
    else await this.repositories.syncConflicts.create(values);
    await this.repositories.localChanges.update(change.id, { state: 'failed', errorCode: 'conflict', nextAttemptAt: null });
  }
}

async function localIdentity(repositories: RepositoryStore, record: RemotePlanningRecord, workspaceId: string) {
  if (record.entityType === 'workspace') return { ...record, entityId: workspaceId };
  if (record.entityType === 'app_settings') {
    const workspace = await repositories.workspaces.getById(workspaceId);
    if (!workspace) return record;
    const page = await repositories.appSettings.list({ filter: { profileId: workspace.profileId }, page: { limit: 1, offset: 0 } });
    return page.items[0] ? { ...record, entityId: page.items[0].id } : record;
  }
  return record;
}

function due(change: LocalChange, now: Date) {
  const staleProcessing = change.state === 'processing' && (!change.lastAttemptAt || new Date(change.lastAttemptAt).getTime() <= now.getTime() - 300_000);
  return change.state === 'pending' || staleProcessing || (change.state === 'failed' && change.errorCode !== 'conflict' && (!change.nextAttemptAt || new Date(change.nextAttemptAt).getTime() <= now.getTime()));
}

async function activeBinding(repositories: RepositoryStore, workspaceId: string) {
  return (await repositories.syncBindings.list({ filter: { workspaceId }, page: { limit: 1, offset: 0 } })).items[0] ?? null;
}

async function pendingCount(repositories: RepositoryStore, workspaceId: string, accountId: string) {
  const page = await repositories.localChanges.list({ filter: { workspaceId, accountId }, page: { limit: 100, offset: 0 } });
  return page.items.length;
}

async function pendingFor(repositories: RepositoryStore, workspaceId: string, accountId: string, entityType: PortableEntityType, entityId: string) {
  const page = await repositories.localChanges.list({ filter: { workspaceId, accountId }, page: { limit: 100, offset: 0 } });
  for (const item of page.items) {
    const type = (await repositories.syncControl.portableType(item.id)) ?? item.entityType;
    if (type === entityType && item.entityId === entityId) return item;
  }
  return null;
}

function ensureCurrentAccount(isCurrentAccount: () => boolean) {
  if (!isCurrentAccount()) throw new SyncCancelledError();
}

async function saveState(repositories: RepositoryStore, workspaceId: string, entityType: PortableEntityType, entityId: string, remoteRevision: number, remoteCursor: number) {
  const page = await repositories.syncEntityStates.list({ filter: { workspaceId, entityType, entityId }, page: { limit: 1, offset: 0 } });
  const values = { workspaceId, entityType, entityId, remoteRevision, remoteCursor };
  if (page.items[0]) await repositories.syncEntityStates.update(page.items[0].id, values);
  else await repositories.syncEntityStates.create(values);
}
