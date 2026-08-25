import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import type { SyncGateway } from './sync-gateway.ts';

export type DestructiveAction = 'clear_device' | 'delete_cloud' | 'delete_account';

export function confirmationMatches(value: string, action: DestructiveAction) {
  const required = action === 'clear_device' ? 'CLEAR' : action === 'delete_cloud' ? 'DELETE CLOUD' : 'DELETE ACCOUNT';
  return value.trim().toUpperCase() === required;
}

export class DataControlService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly gateway: SyncGateway | null,
  ) {}

  async clearDevice(workspaceId: string, confirmation: string) {
    if (!confirmationMatches(confirmation, 'clear_device')) throw new Error('confirmation_required');
    await this.repositories.transaction((scope) => scope.syncControl.clearWorkspace(workspaceId));
  }

  async deleteCloud(accountId: string, confirmation: string) {
    if (!confirmationMatches(confirmation, 'delete_cloud')) throw new Error('confirmation_required');
    if (!this.gateway) throw new Error('remote_unavailable');
    await this.gateway.deleteCloudPlanning();
    await disconnectDeletedCloud(this.repositories, accountId);
  }

  async deleteAccount(confirmation: string) {
    if (!confirmationMatches(confirmation, 'delete_account')) throw new Error('confirmation_required');
    if (!this.gateway) throw new Error('remote_unavailable');
    await this.gateway.deleteAccount();
  }
}

async function disconnectDeletedCloud(repositories: RepositoryStore, accountId: string) {
  const bindings = [];
  let offset: number | null = 0;
  while (offset !== null) {
    const page = await repositories.syncBindings.list({ filter: { accountId }, page: { limit: 100, offset } });
    bindings.push(...page.items);
    offset = page.nextOffset;
  }
  for (const binding of bindings) {
    await repositories.syncBindings.update(binding.id, {
      enabled: false,
      state: 'idle',
      lastCursor: 0,
      restoreCursor: 0,
      restoreState: 'idle',
      errorCategory: null,
    });
    await removeQueue(repositories, binding.workspaceId, accountId);
    await removeEntityStates(repositories, binding.workspaceId);
    await removeOpenConflicts(repositories, binding.workspaceId, accountId);
  }
}

async function removeQueue(repositories: RepositoryStore, workspaceId: string, accountId: string) {
  while (true) {
    const page = await repositories.localChanges.list({ filter: { workspaceId, accountId }, page: { limit: 100, offset: 0 } });
    if (!page.items.length) return;
    for (const change of page.items) await repositories.localChanges.remove(change.id);
  }
}

async function removeEntityStates(repositories: RepositoryStore, workspaceId: string) {
  while (true) {
    const page = await repositories.syncEntityStates.list({ filter: { workspaceId }, page: { limit: 100, offset: 0 } });
    if (!page.items.length) return;
    for (const state of page.items) await repositories.syncEntityStates.softDelete(state.id, state.revision);
  }
}

async function removeOpenConflicts(repositories: RepositoryStore, workspaceId: string, accountId: string) {
  while (true) {
    const page = await repositories.syncConflicts.list({ filter: { workspaceId, accountId, status: 'open' }, page: { limit: 100, offset: 0 } });
    if (!page.items.length) return;
    for (const conflict of page.items) await repositories.syncConflicts.softDelete(conflict.id, conflict.revision);
  }
}
