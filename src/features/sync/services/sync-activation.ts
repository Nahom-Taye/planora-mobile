import type { PortableRecord, SyncBinding } from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { PortableRecordService } from './portable-record-service.ts';
import type { SyncGateway } from './sync-gateway.ts';

export type SyncActivationMode = 'upload' | 'merge' | 'restore';

export class SyncActivationError extends Error {
  constructor(readonly code: 'already_enabled' | 'cloud_workspace_required' | 'cloud_workspace_exists') {
    super(code);
  }
}

export class SyncActivationService {
  private readonly records: PortableRecordService;

  constructor(
    private readonly repositories: RepositoryStore,
    private readonly gateway: SyncGateway,
  ) {
    this.records = new PortableRecordService(repositories);
  }

  async availableCloudWorkspaces() {
    return (await this.gateway.listWorkspaces()).filter((workspace) => !workspace.deleted);
  }

  async enable(input: { workspaceId: string; accountId: string; mode: SyncActivationMode }) {
    const current = (await this.repositories.syncBindings.list({ filter: { workspaceId: input.workspaceId }, page: { limit: 1, offset: 0 } })).items[0];
    if (current?.enabled) throw new SyncActivationError('already_enabled');
    if (current && current.accountId !== input.accountId) await clearRemoteState(this.repositories, input.workspaceId);
    const cloud = await this.availableCloudWorkspaces();
    if (input.mode === 'upload' && cloud.length) throw new SyncActivationError('cloud_workspace_exists');
    const selected = input.mode === 'upload' ? null : cloud[0];
    if (input.mode !== 'upload' && !selected) throw new SyncActivationError('cloud_workspace_required');
    const bindingValues = {
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      remoteWorkspaceId: selected?.id ?? input.workspaceId,
      enabled: true,
      state: input.mode === 'restore' ? 'restoring' as const : 'idle' as const,
      lastCursor: 0,
      lastSuccessAt: null,
      errorCategory: null,
      restoreCursor: 0,
      restoreState: input.mode === 'restore' ? 'running' as const : 'idle' as const,
    };
    const binding = current
      ? await this.repositories.syncBindings.update(current.id, bindingValues)
      : await this.repositories.syncBindings.create(bindingValues);
    if (input.mode !== 'restore') {
      const records = await this.records.snapshot(input.workspaceId);
      await this.enqueueSnapshot(binding, input.mode === 'merge' ? records.filter((record) => record.entityType !== 'workspace') : records);
    }
    return binding;
  }

  async disable(workspaceId: string) {
    const binding = (await this.repositories.syncBindings.list({ filter: { workspaceId }, page: { limit: 1, offset: 0 } })).items[0];
    if (!binding) return null;
    return this.repositories.syncBindings.update(binding.id, { enabled: false, state: 'idle', errorCategory: null });
  }

  private async enqueueSnapshot(binding: SyncBinding, records: PortableRecord[]) {
    for (const [index, record] of records.entries()) {
      const change = await this.repositories.localChanges.create({
        entityType: storedEntityType(record.entityType),
        entityId: record.entityId,
        entityRevision: record.localRevision,
        operation: record.deleted ? 'delete' : 'upsert',
        state: 'pending',
        attemptCount: 0,
        lastAttemptAt: null,
        errorCode: null,
        workspaceId: binding.workspaceId,
        baseRevision: 0,
        accountId: binding.accountId,
        nextAttemptAt: null,
        syncOrder: index,
      });
      if (record.entityType !== change.entityType) await this.repositories.syncControl.setPortableType(change.id, record.entityType);
    }
  }
}

function storedEntityType(entityType: PortableRecord['entityType']) {
  if (entityType === 'reminder_intent') return 'app_settings' as const;
  if (entityType === 'plan_block_series') return 'plan_block' as const;
  if (entityType === 'goal_routine_link') return 'goal' as const;
  return entityType;
}

async function clearRemoteState(repositories: RepositoryStore, workspaceId: string) {
  while (true) {
    const page = await repositories.syncEntityStates.list({ filter: { workspaceId }, page: { limit: 100, offset: 0 } });
    if (!page.items.length) return;
    for (const state of page.items) await repositories.syncEntityStates.softDelete(state.id, state.revision);
  }
}
