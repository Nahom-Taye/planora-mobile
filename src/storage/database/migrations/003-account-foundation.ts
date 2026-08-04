import { sqlMigration } from './types.ts';

export const accountFoundationMigration = sqlMigration(
  3,
  'account_foundation',
  [
    `ALTER TABLE app_settings ADD COLUMN onboarding_version INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_version >= 0)`,
    `ALTER TABLE app_settings ADD COLUMN onboarding_completed_at TEXT`,
    `CREATE TABLE account_links (
      id TEXT PRIMARY KEY NOT NULL,
      local_profile_id TEXT NOT NULL,
      local_workspace_id TEXT,
      remote_account_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('linked', 'unlinked')),
      linked_at TEXT NOT NULL,
      last_authenticated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision > 0),
      deleted_at TEXT,
      FOREIGN KEY (local_profile_id) REFERENCES user_profiles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (local_workspace_id) REFERENCES workspaces(id) ON UPDATE CASCADE ON DELETE RESTRICT
    )`,
    `CREATE UNIQUE INDEX active_account_link_profile_idx ON account_links(local_profile_id) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX active_account_link_remote_idx ON account_links(remote_account_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX account_links_updated_idx ON account_links(updated_at DESC, id ASC)`,
  ],
);
