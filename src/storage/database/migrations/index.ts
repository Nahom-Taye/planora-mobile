import { accountFoundationMigration } from './003-account-foundation.ts';
import { foundationMigration } from './001-foundation.ts';
import { planningMigration } from './002-planning.ts';

export const migrations = [
  foundationMigration,
  planningMigration,
  accountFoundationMigration,
] as const;

export type { Migration } from './types.ts';
