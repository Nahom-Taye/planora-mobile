import type { Routine } from '../../../domain/entities/index.ts';

export type RoutineGroups = {
  active: Routine[];
  paused: Routine[];
  archived: Routine[];
};

type RoutineScheduleFormatters = {
  everyDay: string;
  formatDate: (date: string) => string;
  formatList: (items: readonly string[]) => string;
  formatTime: (time: string) => string;
};

export function groupRoutines(routines: Routine[]): RoutineGroups {
  return {
    active: routines
      .filter((routine) => routine.status === 'active')
      .sort(compareRoutines),
    paused: routines
      .filter((routine) => routine.status === 'paused')
      .sort(compareRoutines),
    archived: routines
      .filter((routine) => routine.status === 'archived')
      .sort(compareRoutines),
  };
}

export function compareRoutines(left: Routine, right: Routine) {
  return (
    compareNullableTime(left.schedule.time, right.schedule.time) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function formatRoutineScheduleLabel(
  routine: Routine,
  formatters: RoutineScheduleFormatters,
) {
  const days =
    routine.schedule.kind === 'daily'
      ? formatters.everyDay
      : formatters.formatList(
          routine.schedule.weekdays.map((day) =>
            formatters.formatDate(`2024-01-${String(7 + day).padStart(2, '0')}`),
          ),
        );
  return routine.schedule.time
    ? `${days} · ${formatters.formatTime(routine.schedule.time)}`
    : days;
}

function compareNullableTime(left: string | null, right: string | null) {
  if (left && right) return left.localeCompare(right);
  if (left) return -1;
  if (right) return 1;
  return 0;
}
