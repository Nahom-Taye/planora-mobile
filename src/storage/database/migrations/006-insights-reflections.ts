import { sqlMigration } from './types.ts';

export const insightsReflectionsMigration = sqlMigration(
  6,
  'insights_reflections',
  [
    `ALTER TABLE app_settings ADD COLUMN insights_view TEXT NOT NULL DEFAULT 'summary' CHECK (insights_view IN ('summary', 'trends', 'reflections'))`,
    `ALTER TABLE app_settings ADD COLUMN insights_range TEXT NOT NULL DEFAULT '7d' CHECK (insights_range IN ('7d', '4w', '12w'))`,
    `CREATE INDEX reflections_workspace_scope_period_idx ON reflections(workspace_id, scope, period_start DESC, updated_at DESC, id ASC) WHERE deleted_at IS NULL`,
    `CREATE INDEX reflections_workspace_scope_id_idx ON reflections(workspace_id, scope_id, period_start DESC, id ASC) WHERE scope_id IS NOT NULL AND deleted_at IS NULL`,
  ],
);
