import type {
  CalendarDate,
  PlanBlock,
  Task,
  TimeZone,
  Weekday,
} from '../../../domain/entities/index.ts';
import { calculateCapacity, detectOverlaps } from './capacity.ts';
import { calendarWeek } from './calendar-math.ts';

export function blocksForDate(blocks: PlanBlock[], date: CalendarDate) {
  return blocks
    .filter((block) => block.date === date && !block.deletedAt)
    .sort(
      (left, right) =>
        statusOrder(left.status) - statusOrder(right.status) ||
        left.startTime.localeCompare(right.startTime) ||
        left.endTime.localeCompare(right.endTime) ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id),
    );
}

export function weekSummaries(
  selectedDate: CalendarDate,
  weekStartsOn: Weekday,
  blocks: PlanBlock[],
  tasks: Task[],
  capacityMinutes: number,
  timeZone: TimeZone,
) {
  return calendarWeek(selectedDate, weekStartsOn).map((date) => {
    const dayBlocks = blocksForDate(blocks, date);
    const summary = calculateCapacity(
      dayBlocks,
      tasks.filter((task) => task.dueDate === date),
      capacityMinutes,
      timeZone,
    );
    return {
      date,
      blockCount: dayBlocks.filter((block) => block.status !== 'cancelled').length,
      taskCount: tasks.filter(
        (task) =>
          task.dueDate === date &&
          (task.status === 'pending' || task.status === 'in_progress'),
      ).length,
      ...summary,
    };
  });
}

export function overlapIds(blocks: PlanBlock[]) {
  return new Set(
    detectOverlaps(blocks).flatMap((overlap) => [
      overlap.firstId,
      overlap.secondId,
    ]),
  );
}

function statusOrder(status: PlanBlock['status']) {
  if (status === 'planned') return 0;
  if (status === 'completed') return 1;
  return 2;
}
