import type {
  CalendarDate,
  EntityId,
  EntityMetadata,
  Instant,
  LocalTime,
  TimeZone,
  Weekday,
} from './common';

export type RoutineSchedule =
  | { kind: 'daily'; time: LocalTime | null }
  | { kind: 'weekly'; weekdays: Weekday[]; time: LocalTime | null };

export type RoutineStatus = 'active' | 'paused' | 'archived';

export type Routine = EntityMetadata & {
  workspaceId: EntityId;
  title: string;
  notes: string | null;
  schedule: RoutineSchedule;
  timeZone: TimeZone;
  status: RoutineStatus;
};

export type RoutineCheckInOutcome = 'completed' | 'skipped' | 'missed';

export type RoutineCheckIn = EntityMetadata & {
  workspaceId: EntityId;
  routineId: EntityId;
  date: CalendarDate;
  outcome: RoutineCheckInOutcome;
  recordedAt: Instant;
  note: string | null;
};
