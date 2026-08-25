import type {
  PortableRecord,
  RemotePlanningRecord,
  SyncPushResult,
} from '../../../domain/entities/index.ts';

export type SyncOperation = {
  operationId: string;
  accountId: string;
  baseRevision: number;
  remoteWorkspaceId: string;
  record: PortableRecord;
};

export type RemoteWorkspace = { id: string; revision: number; changeCursor: number; deleted: boolean; payload: Record<string, unknown> };

export interface SyncGateway {
  push(operation: SyncOperation): Promise<SyncPushResult>;
  listWorkspaces(): Promise<RemoteWorkspace[]>;
  pull(workspaceId: string, afterCursor: number, limit: number): Promise<RemotePlanningRecord[]>;
  deleteCloudPlanning(): Promise<void>;
  deleteAccount(): Promise<void>;
}

export class SyncGatewayError extends Error {
  constructor(readonly category: 'offline' | 'schema_missing' | 'session_expired' | 'remote' | 'invalid_response') {
    super(category);
  }
}
