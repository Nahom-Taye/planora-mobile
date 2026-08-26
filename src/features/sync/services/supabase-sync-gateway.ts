import type { SupabaseClient } from '@supabase/supabase-js';

import type { PortableEntityType, RemotePlanningRecord } from '../../../domain/entities/index.ts';
import type { Database, Json } from '../../auth/services/database-types.ts';
import { SyncGatewayError, type SyncGateway, type SyncOperation } from './sync-gateway.ts';

const portableEntityTypes: PortableEntityType[] = ['workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent'];

export class SupabaseSyncGateway implements SyncGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async push(operation: SyncOperation) {
    const { data, error } = await this.client.rpc('apply_planning_operation', {
      p_operation_id: operation.operationId,
      p_entity_type: operation.record.entityType,
      p_entity_id: operation.record.entityType === 'workspace' || operation.record.entityType === 'app_settings' ? operation.remoteWorkspaceId : operation.record.entityId,
      p_workspace_id: operation.remoteWorkspaceId,
      p_base_revision: operation.baseRevision,
      p_payload: operation.record.payload as Json,
      p_deleted: operation.record.deleted,
    });
    if (error) throw mapRemoteError(error);
    const row = data?.[0];
    if (!row || (row.status !== 'applied' && row.status !== 'conflict')) throw new SyncGatewayError('invalid_response');
    if (!validRevision(row.applied_revision) || !validCursor(row.applied_cursor)) throw new SyncGatewayError('invalid_response');
    if (row.status === 'applied') return { status: 'applied' as const, revision: row.applied_revision, changeCursor: row.applied_cursor };
    return {
      status: 'conflict' as const,
      remote: {
        entityType: operation.record.entityType,
        entityId: operation.record.entityId,
        workspaceId: operation.record.workspaceId,
        revision: row.applied_revision,
        changeCursor: row.applied_cursor,
        deleted: row.remote_deleted,
        payload: recordPayload(row.remote_payload),
      },
    };
  }

  async listWorkspaces() {
    const { data, error } = await this.client.rpc('list_owned_planning_workspaces', {});
    if (error) throw mapRemoteError(error);
    return (data ?? []).map((row) => {
      if (!validId(row.remote_workspace_id) || !validRevision(row.revision) || !validCursor(row.change_cursor) || typeof row.deleted !== 'boolean') throw new SyncGatewayError('invalid_response');
      return {
        id: row.remote_workspace_id,
        revision: row.revision,
        changeCursor: row.change_cursor,
        deleted: row.deleted,
        payload: recordPayload(row.payload),
      };
    });
  }

  async pull(workspaceId: string, afterCursor: number, limit: number) {
    const { data, error } = await this.client.rpc('pull_planning_changes', {
      p_workspace_id: workspaceId,
      p_after_cursor: afterCursor,
      p_batch_limit: Math.min(100, Math.max(1, limit)),
    });
    if (error) throw mapRemoteError(error);
    return (data ?? []).map((row): RemotePlanningRecord => {
      if (!isPortableEntityType(row.entity_type) || !validId(row.entity_id) || !validId(row.remote_workspace_id) || !validRevision(row.revision) || !validCursor(row.change_cursor) || typeof row.deleted !== 'boolean') throw new SyncGatewayError('invalid_response');
      return {
        entityType: row.entity_type,
        entityId: row.entity_id,
        workspaceId: row.remote_workspace_id,
        revision: row.revision,
        changeCursor: row.change_cursor,
        deleted: row.deleted,
        payload: recordPayload(row.payload),
      };
    });
  }

  async deleteCloudPlanning() {
    const { error } = await this.client.rpc('delete_my_planning_data', {});
    if (error) throw mapRemoteError(error);
  }

  async deleteAccount() {
    const { error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw mapRemoteError(error);
  }
}

function recordPayload(value: Json | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyncGatewayError('invalid_response');
  return value as Record<string, unknown>;
}

export function mapRemoteError(error: { code?: string; message?: string; status?: number }) {
  if (error.status === 401) return new SyncGatewayError('session_expired');
  if (error.code === '42P01' || error.code === '42883' || error.code === 'PGRST202') return new SyncGatewayError('schema_missing');
  const message = error.message?.toLowerCase() ?? '';
  if (error.status === 0 || message.includes('network') || message.includes('failed to fetch')) return new SyncGatewayError('offline');
  return new SyncGatewayError('remote');
}

function isPortableEntityType(value: string): value is PortableEntityType {
  return portableEntityTypes.includes(value as PortableEntityType);
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validCursor(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
