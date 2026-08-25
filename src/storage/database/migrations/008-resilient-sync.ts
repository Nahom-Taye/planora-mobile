import { sqlMigration } from './types.ts';

const uuidExpression = `lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1,1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))`;

function queueTriggers(table: string, entityType: string, workspace: string, storedEntityType = entityType) {
  const columns = `id, entity_type, entity_id, entity_revision, operation, state, attempt_count, last_attempt_at, error_code, created_at, updated_at, revision, workspace_id, base_revision, account_id, next_attempt_at, sync_order`;
  const values = `${uuidExpression}, '${storedEntityType}', NEW.id, NEW.revision, CASE WHEN NEW.deleted_at IS NULL THEN 'upsert' ELSE 'delete' END, 'pending', 0, NULL, NULL, NEW.updated_at, NEW.updated_at, 1, ${workspace}, COALESCE((SELECT remote_revision FROM sync_entity_states WHERE workspace_id = ${workspace} AND entity_type = '${entityType}' AND entity_id = NEW.id AND deleted_at IS NULL LIMIT 1), 0), (SELECT account_id FROM sync_bindings WHERE workspace_id = ${workspace} AND enabled = 1 AND deleted_at IS NULL LIMIT 1), NULL, ${syncOrder(entityType)}`;
  const guard = `NOT EXISTS (SELECT 1 FROM sync_suppression WHERE workspace_id = ${workspace}) AND EXISTS (SELECT 1 FROM sync_bindings WHERE workspace_id = ${workspace} AND enabled = 1 AND deleted_at IS NULL)`;
  const detail = storedEntityType === entityType ? '' : ` INSERT INTO sync_change_details (local_change_id, portable_entity_type) SELECT id, '${entityType}' FROM local_changes WHERE rowid = last_insert_rowid();`;
  return [
    `CREATE TRIGGER sync_queue_${table}_insert AFTER INSERT ON ${table} WHEN ${guard} BEGIN INSERT INTO local_changes (${columns}) VALUES (${values});${detail} END`,
    `CREATE TRIGGER sync_queue_${table}_update AFTER UPDATE ON ${table} WHEN ${guard} BEGIN INSERT INTO local_changes (${columns}) VALUES (${values});${detail} END`,
  ];
}

function syncOrder(entityType: string) {
  const order = ['workspace', 'area', 'tag', 'routine', 'goal', 'task', 'plan_block_series', 'plan_block', 'routine_check_in', 'milestone', 'goal_routine_link', 'reflection', 'app_settings', 'reminder_intent'];
  return order.indexOf(entityType) + 1_000_000;
}

const workspaceTables = [
  ['tasks', 'task'],
  ['plan_block_series', 'plan_block_series', 'plan_block'],
  ['plan_blocks', 'plan_block'],
  ['routines', 'routine'],
  ['routine_check_ins', 'routine_check_in'],
  ['goals', 'goal'],
  ['milestones', 'milestone'],
  ['goal_routine_links', 'goal_routine_link', 'goal'],
  ['areas', 'area'],
  ['tags', 'tag'],
  ['reflections', 'reflection'],
] as const;

export const resilientSyncMigration = sqlMigration(8, 'resilient_sync', [
  `ALTER TABLE local_changes ADD COLUMN workspace_id TEXT`,
  `ALTER TABLE local_changes ADD COLUMN base_revision INTEGER NOT NULL DEFAULT 0 CHECK (base_revision >= 0)`,
  `ALTER TABLE local_changes ADD COLUMN account_id TEXT`,
  `ALTER TABLE local_changes ADD COLUMN next_attempt_at TEXT`,
  `ALTER TABLE local_changes ADD COLUMN sync_order INTEGER NOT NULL DEFAULT 1000000 CHECK (sync_order >= 0)`,
  `CREATE TABLE sync_bindings (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    remote_workspace_id TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    state TEXT NOT NULL CHECK (state IN ('idle', 'syncing', 'offline', 'error', 'conflict', 'restoring', 'account_mismatch')),
    last_cursor INTEGER NOT NULL DEFAULT 0 CHECK (last_cursor >= 0),
    last_success_at TEXT,
    error_category TEXT,
    restore_cursor INTEGER NOT NULL DEFAULT 0 CHECK (restore_cursor >= 0),
    restore_state TEXT NOT NULL DEFAULT 'idle' CHECK (restore_state IN ('idle', 'running', 'failed')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE TABLE sync_entity_states (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent')),
    entity_id TEXT NOT NULL,
    remote_revision INTEGER NOT NULL CHECK (remote_revision >= 0),
    remote_cursor INTEGER NOT NULL CHECK (remote_cursor >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE TABLE sync_conflicts (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent')),
    entity_id TEXT NOT NULL,
    local_payload_json TEXT NOT NULL,
    remote_payload_json TEXT NOT NULL,
    base_revision INTEGER NOT NULL CHECK (base_revision >= 0),
    local_revision INTEGER NOT NULL CHECK (local_revision > 0),
    remote_revision INTEGER NOT NULL CHECK (remote_revision > 0),
    remote_cursor INTEGER NOT NULL CHECK (remote_cursor >= 0),
    remote_deleted INTEGER NOT NULL CHECK (remote_deleted IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
    resolution TEXT CHECK (resolution IN ('local', 'remote', 'combined')),
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE TABLE sync_diagnostics (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT,
    category TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
    connectivity TEXT NOT NULL CHECK (connectivity IN ('online', 'offline', 'unknown')),
    entity_type TEXT CHECK (entity_type IN ('workspace', 'task', 'plan_block_series', 'plan_block', 'routine', 'routine_check_in', 'goal', 'milestone', 'goal_routine_link', 'area', 'tag', 'reflection', 'app_settings', 'reminder_intent')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE TABLE sync_change_details (
    local_change_id TEXT PRIMARY KEY NOT NULL,
    portable_entity_type TEXT NOT NULL CHECK (portable_entity_type IN ('plan_block_series', 'goal_routine_link', 'reminder_intent')),
    FOREIGN KEY (local_change_id) REFERENCES local_changes(id) ON UPDATE CASCADE ON DELETE CASCADE
  )`,
  `CREATE TABLE sync_suppression (
    workspace_id TEXT PRIMARY KEY NOT NULL,
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX sync_bindings_workspace_idx ON sync_bindings(workspace_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX sync_bindings_account_idx ON sync_bindings(account_id, enabled, updated_at, id) WHERE deleted_at IS NULL`,
  `CREATE UNIQUE INDEX sync_entity_state_identity_idx ON sync_entity_states(workspace_id, entity_type, entity_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX sync_conflicts_open_idx ON sync_conflicts(workspace_id, status, created_at, id) WHERE deleted_at IS NULL`,
  `CREATE INDEX sync_diagnostics_recent_idx ON sync_diagnostics(workspace_id, occurred_at DESC, id) WHERE deleted_at IS NULL`,
  `CREATE INDEX local_changes_sync_queue_idx ON local_changes(workspace_id, account_id, state, next_attempt_at, sync_order, created_at, id)`,
  ...workspaceTables.flatMap(([table, entityType, storedEntityType]) => queueTriggers(table, entityType, 'NEW.workspace_id', storedEntityType)),
  ...queueTriggers('workspaces', 'workspace', 'NEW.id'),
  ...queueTriggers('app_settings', 'app_settings', `(SELECT id FROM workspaces WHERE profile_id = NEW.profile_id AND status = 'active' AND deleted_at IS NULL ORDER BY created_at, id LIMIT 1)`),
  ...queueTriggers('reminder_intents', 'reminder_intent', 'NEW.workspace_id', 'app_settings'),
]);
