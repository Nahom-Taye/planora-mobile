import { sqlMigration } from './types.ts';

export const goalsMilestonesMigration = sqlMigration(5, 'goals_milestones', [
  `ALTER TABLE goals ADD COLUMN progress_method TEXT NOT NULL DEFAULT 'milestones' CHECK (progress_method IN ('milestones', 'tasks', 'manual', 'none'))`,
  `ALTER TABLE goals ADD COLUMN manual_progress INTEGER NOT NULL DEFAULT 0 CHECK (manual_progress BETWEEN 0 AND 100)`,
  `ALTER TABLE goals ADD COLUMN next_action_task_id TEXT REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE RESTRICT`,
  `CREATE UNIQUE INDEX goals_id_workspace_idx ON goals(id, workspace_id)`,
  `CREATE UNIQUE INDEX routines_id_workspace_idx ON routines(id, workspace_id)`,
  `CREATE TABLE goal_routine_links (
    id TEXT PRIMARY KEY NOT NULL,
    workspace_id TEXT NOT NULL,
    goal_id TEXT NOT NULL,
    routine_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (goal_id, workspace_id) REFERENCES goals(id, workspace_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (routine_id, workspace_id) REFERENCES routines(id, workspace_id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE UNIQUE INDEX goal_routine_active_idx ON goal_routine_links(goal_id, routine_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX goal_routine_workspace_goal_idx ON goal_routine_links(workspace_id, goal_id, created_at, id) WHERE deleted_at IS NULL`,
  `CREATE INDEX goal_routine_workspace_routine_idx ON goal_routine_links(workspace_id, routine_id, created_at, id) WHERE deleted_at IS NULL`,
  `CREATE INDEX goals_workspace_status_horizon_idx ON goals(workspace_id, status, horizon, target_date, id) WHERE deleted_at IS NULL`,
  `CREATE INDEX goals_next_action_idx ON goals(workspace_id, next_action_task_id) WHERE next_action_task_id IS NOT NULL AND deleted_at IS NULL`,
  `CREATE INDEX tasks_workspace_goal_status_idx ON tasks(workspace_id, goal_id, status, id) WHERE goal_id IS NOT NULL AND deleted_at IS NULL`,
  `CREATE INDEX milestones_workspace_goal_status_order_idx ON milestones(workspace_id, goal_id, status, sort_order, id) WHERE deleted_at IS NULL`,
]);
