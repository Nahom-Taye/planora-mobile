import { accountFoundationMigration } from './003-account-foundation.ts';
import { foundationMigration } from './001-foundation.ts';
import { planningMigration } from './002-planning.ts';
import { plannerLocalizationMigration } from './004-planner-localization.ts';
import { goalsMilestonesMigration } from './005-goals-milestones.ts';

export const migrations = [
  foundationMigration,
  planningMigration,
  accountFoundationMigration,
  plannerLocalizationMigration,
  goalsMilestonesMigration,
] as const;

export type { Migration } from './types.ts';
