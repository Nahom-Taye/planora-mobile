import type { PlanBlock, Task, TimeZone } from '../../../domain/entities/index.ts';
import { durationMinutes } from './calendar-math.ts';
import { calendarDateValue, localTimeValue } from '../../today/services/display-values.ts';

export type BlockOverlap = {
  firstId: string;
  secondId: string;
};

export type CapacitySummary = {
  plannedMinutes: number;
  remainingMinutes: number;
  isOverCapacity: boolean;
  overlapCount: number;
  unscheduledTaskCount: number;
};

export function detectOverlaps(blocks: PlanBlock[]): BlockOverlap[] {
  const actionable = blocks
    .filter((block) => block.status !== 'cancelled' && !block.deletedAt && localTimeValue(block.startTime) && localTimeValue(block.endTime))
    .sort(
      (left, right) =>
        left.startTime.localeCompare(right.startTime) ||
        left.endTime.localeCompare(right.endTime) ||
        left.id.localeCompare(right.id),
    );
  const overlaps: BlockOverlap[] = [];

  for (let left = 0; left < actionable.length; left += 1) {
    for (let right = left + 1; right < actionable.length; right += 1) {
      if (actionable[right].startTime >= actionable[left].endTime) break;
      overlaps.push({
        firstId: actionable[left].id,
        secondId: actionable[right].id,
      });
    }
  }

  return overlaps;
}

export function calculateCapacity(
  blocks: PlanBlock[],
  tasks: Task[],
  capacityMinutes: number,
  timeZone: TimeZone,
): CapacitySummary {
  const activeBlocks = blocks.filter(
    (block) => block.status !== 'cancelled' && !block.deletedAt,
  );
  const linkedTaskIds = new Set(
    activeBlocks.flatMap((block) => (block.taskId ? [block.taskId] : [])),
  );
  const plannedMinutes = activeBlocks.reduce(
    (total, block) =>
      total +
      measurableDuration(block, timeZone),
    0,
  );

  return {
    plannedMinutes,
    remainingMinutes: capacityMinutes - plannedMinutes,
    isOverCapacity: plannedMinutes > capacityMinutes,
    overlapCount: detectOverlaps(activeBlocks).length,
    unscheduledTaskCount: tasks.filter(
      (task) =>
        !task.deletedAt &&
        (task.status === 'pending' || task.status === 'in_progress') &&
        !linkedTaskIds.has(task.id),
    ).length,
  };
}

function measurableDuration(block: PlanBlock, timeZone: TimeZone) {
  if (!calendarDateValue(block.date) || !localTimeValue(block.startTime) || !localTimeValue(block.endTime)) return 0;
  try {
    return Math.max(0, durationMinutes(block.date, block.startTime, block.endTime, timeZone));
  } catch {
    return 0;
  }
}
