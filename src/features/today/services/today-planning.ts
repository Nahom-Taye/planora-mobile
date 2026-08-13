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
  const actionable = tasks.filter(isActionableTask);
  const todayRoutines = routines
    .filter((routine) => isRoutineScheduled(routine, today))
    .sort(compareRoutines);
  const completed = tasks
    .filter(
      (task) =>
        (task.status === 'completed' || task.status === 'cancelled') &&
        (task.dueDate === today ||
          (timeZone &&
            localCalendarDate(
              new Date(task.completedAt ?? task.updatedAt),
              timeZone,
            ) === today)),
    )
    .sort(compareTasks);
  const routineCompletions = todayRoutines.filter((routine) =>
    checkIns.some(
      (checkIn) =>
        checkIn.routineId === routine.id && checkIn.outcome === 'completed',
    ),
  ).length;

  return {
    overdue: actionable
      .filter(
        (task) =>
          task.dueDate !== null && compareCalendarDates(task.dueDate, today) < 0,
      )
      .sort(compareTasks),
    today: actionable
      .filter((task) => task.dueDate === today)
      .sort(compareTasks),
    unscheduled: actionable
      .filter((task) => task.dueDate === null)
      .sort(compareTasks),
    completed,
    routines: todayRoutines,
    checkIns,
    completedCount:
      completed.filter((task) => task.status === 'completed').length +
      routineCompletions,
    totalCount:
      completed.filter((task) => task.status === 'completed').length +
      actionable.filter((task) => !task.dueDate || task.dueDate <= today).length +
      todayRoutines.length,
  };
}

export { compareTasks } from '../../tasks/services/task-organization.ts';
