import type {
  CalendarDate,
  PlanBlock,
  Task,
  Weekday,
} from '../../../domain/entities/index.ts';
import { detectOverlaps } from '../../planner/services/capacity.ts';
import { durationMinutes } from '../../planner/services/calendar-math.ts';
import { weekdayForDate } from '../../today/services/local-date.ts';
import {
  dateWithinPeriod,
  datesInPeriod,
  orderedWeekdays,
  type InsightsPeriod,
} from './range-calculations.ts';

export type WorkloadDay = {
  date: CalendarDate;
  plannedMinutes: number;
  capacityMinutes: number;
  isOverCapacity: boolean;
  overlapCount: number;
  plannedBlockCount: number;
  completedBlockCount: number;
};

export type WeekdayWorkload = {
  weekday: Weekday;
  plannedMinutes: number;
};

export type WorkloadSummary = {
  days: WorkloadDay[];
  plannedMinutes: number;
  completedMinutes: number;
  overCapacityDays: number;
  overlapCount: number;
  plannedBlockCount: number;
  completedBlockCount: number;
  unscheduledActionableTasks: number;
  weekdays: WeekdayWorkload[];
};

export function calculateWorkloadSignals(
  blocks: readonly PlanBlock[],
  tasks: readonly Task[],
  period: InsightsPeriod,
  capacityMinutes: number,
  weekStartsOn: Weekday,
): WorkloadSummary {
  const activeBlocks = blocks.filter(
    (block) => block.deletedAt === null && block.status !== 'cancelled',
  );
  const periodBlocks = activeBlocks.filter((block) =>
    dateWithinPeriod(block.date, period),
  );
  const days = datesInPeriod(period).map((date) => {
    const dayBlocks = periodBlocks.filter((block) => block.date === date);
    const plannedMinutes = totalBlockMinutes(dayBlocks);
    return {
      date,
      plannedMinutes,
      capacityMinutes,
      isOverCapacity: plannedMinutes > capacityMinutes,
      overlapCount: detectOverlaps([...dayBlocks]).length,
      plannedBlockCount: dayBlocks.length,
      completedBlockCount: dayBlocks.filter(
        (block) => block.status === 'completed',
      ).length,
    };
  });
  const linkedTaskIds = new Set(
    activeBlocks.flatMap((block) => (block.taskId ? [block.taskId] : [])),
  );
  const weekdays = orderedWeekdays(weekStartsOn).map((weekday) => ({
    weekday,
    plannedMinutes: days
      .filter((day) => weekdayForDate(day.date) === weekday)
      .reduce((total, day) => total + day.plannedMinutes, 0),
  }));

  return {
    days,
    plannedMinutes: totalBlockMinutes(periodBlocks),
    completedMinutes: totalBlockMinutes(
      periodBlocks.filter((block) => block.status === 'completed'),
    ),
    overCapacityDays: days.filter((day) => day.isOverCapacity).length,
    overlapCount: days.reduce((total, day) => total + day.overlapCount, 0),
    plannedBlockCount: periodBlocks.length,
    completedBlockCount: periodBlocks.filter(
      (block) => block.status === 'completed',
    ).length,
    unscheduledActionableTasks: tasks.filter(
      (task) =>
        task.deletedAt === null &&
        (task.status === 'pending' || task.status === 'in_progress') &&
        !linkedTaskIds.has(task.id),
    ).length,
    weekdays,
  };
}

function totalBlockMinutes(blocks: readonly PlanBlock[]) {
  return blocks.reduce(
    (total, block) =>
      total +
      durationMinutes(
        block.date,
        block.startTime,
        block.endTime,
        block.timeZone,
      ),
    0,
  );
}
