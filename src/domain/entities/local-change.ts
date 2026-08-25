import type { EntityId, Instant } from './common';

export type ChangeEntityType =
  | 'user_profile'
  | 'workspace'
  | 'task'
  | 'plan_block'
  | 'routine'
  | 'routine_check_in'
  | 'goal'
  | 'milestone'
  | 'area'
  | 'tag'
  | 'reflection'
  | 'app_settings';

export type LocalChangeOperation = 'upsert' | 'delete';
export type LocalChangeState = 'pending' | 'processing' | 'failed';

export type LocalChange = {
  id: EntityId;
  createdAt: Instant;
  updatedAt: Instant;
  revision: number;
  entityType: ChangeEntityType;
  entityId: EntityId;
  entityRevision: number;
  operation: LocalChangeOperation;
  state: LocalChangeState;
  attemptCount: number;
  lastAttemptAt: Instant | null;
  errorCode: string | null;
  workspaceId: EntityId | null;
  baseRevision: number;
  accountId: string | null;
  nextAttemptAt: Instant | null;
  syncOrder: number;
};
