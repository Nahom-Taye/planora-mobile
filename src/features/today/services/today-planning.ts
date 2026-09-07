import type {
  CalendarDate,
  Routine,
  RoutineCheckIn,
  Task,
  TimeZone,
} from '../../../domain/entities/index.ts';
import { isRoutineScheduled } from '../../routines/services/routine-service.ts';
import { compareRoutines } from '../../routines/services/routine-organization.ts';
import {
  compareTasks,
  isActionableTask,
} from '../../tasks/services/task-organization.ts';

import { compareCalendarDates, localCalendarDate } from './local-date.ts';
import { calendarDateValue, instantValue } from './display-values.ts';

export type TodayPlan = {
  overdue: Task[];
  today: Task[];
  unscheduled: Task[];
  completed: Task[];
  routines: Routine[];
  checkIns: RoutineCheckIn[];
  completedCount: number;
  totalCount: number;
};

export function buildTodayPlan(
  tasks: Task[],
  routines: Routine[],
  checkIns: RoutineCheckIn[],
  today: CalendarDate,
  timeZone?: TimeZone,
): TodayPlan {
  const visibleTasks = tasks.filter((task) => task.deletedAt == null);
  const actionable = visibleTasks.filter((task) =>
    isActionableTask(task) || !['completed', 'cancelled'].includes(task.status),
  );
  const todayCheckIns = checkIns.filter((checkIn) => !checkIn.deletedAt && checkIn.date === today);
  const todayRoutines = routines
    .filter((routine) => !routine.deletedAt && isRoutineScheduled(routine, today))
    .sort(compareRoutines);
  const completed = visibleTasks
    .filter(
      (task) =>
        (task.status === 'completed' || task.status === 'cancelled') &&
        (task.dueDate === today ||
          completionCalendarDate(task, timeZone) === today),
    )
    .sort(compareTasks);
  const routineCompletions = todayRoutines.filter((routine) =>
    todayCheckIns.some(
      (checkIn) =>
        checkIn.routineId === routine.id && checkIn.outcome === 'completed',
    ),
  ).length;

  return {
    overdue: actionable
      .filter(
        (task) =>
          calendarDateValue(task.dueDate) !== null && compareCalendarDates(task.dueDate!, today) < 0,
      )
      .sort(compareTasks),
    today: actionable
      .filter((task) => task.dueDate === today)
      .sort(compareTasks),
    unscheduled: actionable
      .filter((task) => calendarDateValue(task.dueDate) === null)
      .sort(compareTasks),
    completed,
    routines: todayRoutines,
    checkIns: todayCheckIns,
    completedCount:
      completed.filter((task) => task.status === 'completed').length +
      routineCompletions,
    totalCount:
      completed.filter((task) => task.status === 'completed').length +
      actionable.filter((task) => !calendarDateValue(task.dueDate) || task.dueDate! <= today).length +
      todayRoutines.length,
  };
}

function completionCalendarDate(task: Task, timeZone?: TimeZone) {
  if (!timeZone) return null;
  const instant = instantValue(task.completedAt) ?? instantValue(task.updatedAt);
  if (!instant) return null;
  try {
    return localCalendarDate(instant, timeZone);
  } catch {
    return null;
  }
}

export { compareTasks } from '../../tasks/services/task-organization.ts';
