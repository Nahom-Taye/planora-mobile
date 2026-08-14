import type {
  Routine,
  RoutineCheckIn,
} from '../../../domain/entities/index.ts';
import { isRoutineScheduled } from '../../routines/services/routine-service.ts';
import {
  dateWithinPeriod,
  datesInPeriod,
  type InsightsPeriod,
} from './range-calculations.ts';

export type RoutineInsight = {
  routineId: string;
  title: string;
  scheduled: number;
  completed: number;
  skipped: number;
  pending: number;
};

export type RoutineSummary = {
  scheduled: number;
  completed: number;
  skipped: number;
  pending: number;
  items: RoutineInsight[];
};

export function calculateRoutineSummary(
  routines: readonly Routine[],
  checkIns: readonly RoutineCheckIn[],
  period: InsightsPeriod,
): RoutineSummary {
  const periodCheckIns = checkIns.filter(
    (checkIn) =>
      checkIn.deletedAt === null && dateWithinPeriod(checkIn.date, period),
  );
  const items = routines
    .filter((routine) => routine.deletedAt === null && routine.status === 'active')
    .map((routine) => {
      const scheduledDates = datesInPeriod(period).filter((date) =>
        isRoutineScheduled(routine, date),
      );
      const scheduledSet = new Set(scheduledDates);
      const outcomes = periodCheckIns.filter(
        (checkIn) =>
          checkIn.routineId === routine.id &&
          scheduledSet.has(checkIn.date) &&
          checkIn.outcome !== 'missed',
      );
      const completed = outcomes.filter(
        (checkIn) => checkIn.outcome === 'completed',
      ).length;
      const skipped = outcomes.filter(
        (checkIn) => checkIn.outcome === 'skipped',
      ).length;
      const recordedDates = new Set(outcomes.map((checkIn) => checkIn.date));
      return {
        routineId: routine.id,
        title: routine.title,
        scheduled: scheduledDates.length,
        completed,
        skipped,
        pending: scheduledDates.filter((date) => !recordedDates.has(date)).length,
      };
    })
    .sort(
      (left, right) =>
        right.scheduled - left.scheduled ||
        left.title.localeCompare(right.title) ||
        left.routineId.localeCompare(right.routineId),
    );

  return {
    scheduled: items.reduce((total, item) => total + item.scheduled, 0),
    completed: items.reduce((total, item) => total + item.completed, 0),
    skipped: items.reduce((total, item) => total + item.skipped, 0),
    pending: items.reduce((total, item) => total + item.pending, 0),
    items,
  };
}
