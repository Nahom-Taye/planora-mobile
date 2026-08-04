import type {
  CalendarDate,
  EntityId,
  EntityMetadata,
  Instant,
  LocalTime,
  TimeZone,
} from './common';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export type Task = EntityMetadata & {
  workspaceId: EntityId;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: CalendarDate | null;
  scheduledTime: LocalTime | null;
  timeZone: TimeZone | null;
  completedAt: Instant | null;
  areaId: EntityId | null;
  goalId: EntityId | null;
  parentTaskId: EntityId | null;
};

export type PlanBlockStatus = 'planned' | 'completed' | 'cancelled';

export type PlanBlock = EntityMetadata & {
  workspaceId: EntityId;
  date: CalendarDate;
  startTime: LocalTime;
  endTime: LocalTime;
  timeZone: TimeZone;
  title: string;
  notes: string | null;
  status: PlanBlockStatus;
  taskId: EntityId | null;
  routineId: EntityId | null;
};
