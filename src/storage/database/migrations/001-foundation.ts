import { sqlMigration } from './types.ts';

export const foundationMigration = sqlMigration(1, 'foundation', [
  `CREATE TABLE user_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT,
    locale TEXT NOT NULL,
    time_zone TEXT NOT NULL,
    week_starts_on INTEGER NOT NULL CHECK (week_starts_on BETWEEN 0 AND 6),
    accessibility_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT
  )`,
  `CREATE TABLE workspaces (
    id TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('personal')),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE TABLE app_settings (
    id TEXT PRIMARY KEY NOT NULL,
    profile_id TEXT NOT NULL,
    theme_preference TEXT NOT NULL CHECK (theme_preference IN ('system', 'light', 'dark')),
    default_tab TEXT NOT NULL CHECK (default_tab IN ('today', 'planner', 'goals', 'insights')),
    planning_day_starts_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    deleted_at TEXT,
    FOREIGN KEY (profile_id) REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT
  )`,
  `CREATE INDEX workspaces_profile_updated_idx ON workspaces(profile_id, updated_at DESC, id ASC)`,
  `CREATE UNIQUE INDEX active_settings_profile_idx ON app_settings(profile_id) WHERE deleted_at IS NULL`,
]);
