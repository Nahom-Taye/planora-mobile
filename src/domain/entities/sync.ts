import type { EntityId, EntityMetadata, Instant } from './common';

export type PortableEntityType =
  | 'workspace'
  | 'task'
  | 'plan_block_series'
  | 'plan_block'
  | 'routine'
  | 'routine_check_in'
  | 'goal'
  | 'milestone'
  | 'goal_routine_link'
  | 'area'
  | 'tag'
  | 'reflection'
  | 'app_settings'
  | 'reminder_intent';

export type SyncBindingState =
  | 'idle'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'conflict'
  | 'restoring'
  | 'account_mismatch';

export type SyncBinding = EntityMetadata & {
  workspaceId: EntityId;
  accountId: string;
  remoteWorkspaceId: EntityId;
  enabled: boolean;
  state: SyncBindingState;
  lastCursor: number;
  lastSuccessAt: Instant | null;
  errorCategory: string | null;
  restoreCursor: number;
  restoreState: 'idle' | 'running' | 'failed';
};

export type SyncEntityState = EntityMetadata & {
  workspaceId: EntityId;
  entityType: PortableEntityType;
  entityId: EntityId;
  remoteRevision: number;
  remoteCursor: number;
};

export type SyncConflict = EntityMetadata & {
  workspaceId: EntityId;
  accountId: string;
  entityType: PortableEntityType;
  entityId: EntityId;
  localPayload: string;
  remotePayload: string;
  baseRevision: number;
  localRevision: number;
  remoteRevision: number;
  remoteCursor: number;
  remoteDeleted: boolean;
  status: 'open' | 'resolved';
  resolution: 'local' | 'remote' | 'combined' | null;
  resolvedAt: Instant | null;
};

export type SyncDiagnostic = EntityMetadata & {
  workspaceId: EntityId | null;
  category: string;
  occurredAt: Instant;
  attemptCount: number;
  connectivity: 'online' | 'offline' | 'unknown';
  entityType: PortableEntityType | null;
};

export type PortableRecord = {
  entityType: PortableEntityType;
  entityId: EntityId;
  workspaceId: EntityId;
  localRevision: number;
  deleted: boolean;
  payload: Record<string, unknown>;
};

export type RemotePlanningRecord = {
  entityType: PortableEntityType;
  entityId: EntityId;
  workspaceId: EntityId;
  revision: number;
  changeCursor: number;
  deleted: boolean;
  payload: Record<string, unknown>;
};

export type RemotePlanningChange = Omit<RemotePlanningRecord, 'payload'>;

export type SyncPushResult =
  | { status: 'applied'; revision: number; changeCursor: number }
  | { status: 'conflict'; remote: RemotePlanningRecord };
