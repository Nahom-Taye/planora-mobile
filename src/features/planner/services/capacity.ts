import type { PlanBlock, Task, TimeZone } from '../../../domain/entities/index.ts';
import { durationMinutes } from './calendar-math.ts';

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
    .filter((block) => block.status !== 'cancelled' && !block.deletedAt)
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
      durationMinutes(block.date, block.startTime, block.endTime, timeZone),
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
