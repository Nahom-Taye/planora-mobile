import type {
  CalendarDate,
  EntityId,
  EntityMetadata,
  Instant,
} from './common';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type GoalHorizon = 'month' | 'quarter' | 'year' | 'someday';

export type Goal = EntityMetadata & {
  workspaceId: EntityId;
  title: string;
  description: string | null;
  motivation: string | null;
  status: GoalStatus;
  horizon: GoalHorizon;
  targetDate: CalendarDate | null;
  completedAt: Instant | null;
  areaId: EntityId | null;
};

export type MilestoneStatus = 'pending' | 'completed' | 'cancelled';

export type Milestone = EntityMetadata & {
  workspaceId: EntityId;
  goalId: EntityId;
  title: string;
  notes: string | null;
  status: MilestoneStatus;
  targetDate: CalendarDate | null;
  completedAt: Instant | null;
  sortOrder: number;
};
