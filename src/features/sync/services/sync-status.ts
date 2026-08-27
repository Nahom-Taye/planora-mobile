import type { SyncBindingState } from '../../../domain/entities/index.ts';

export type SyncStatusTranslationKey =
  | 'sync.stateLocal'
  | 'sync.stateIdle'
  | 'sync.stateSyncing'
  | 'sync.statePending'
  | 'sync.statePendingOffline'
  | 'sync.stateOffline'
  | 'sync.stateError'
  | 'sync.stateConflict'
  | 'sync.stateRestoring'
  | 'sync.stateAccountMismatch';

export function syncStatusTranslationKey(input: {
  state?: SyncBindingState;
  pending: number;
  busy: boolean;
  online: boolean;
}): SyncStatusTranslationKey {
  if (input.busy || input.state === 'syncing') return 'sync.stateSyncing';
  if (input.state === 'account_mismatch') return 'sync.stateAccountMismatch';
  if (input.state === 'conflict') return 'sync.stateConflict';
  if (input.state === 'restoring') return 'sync.stateRestoring';
  if (input.state === 'error') return 'sync.stateError';
  if (input.pending > 0 && !input.online) return 'sync.statePendingOffline';
  if (input.pending > 0) return 'sync.statePending';
  if (!input.online || input.state === 'offline') return 'sync.stateOffline';
  if (input.state === 'idle') return 'sync.stateIdle';
  return 'sync.stateLocal';
}
