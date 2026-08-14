import type {
  PeriodMetrics,
  TrendComparison,
  TrendMetric,
} from './metric-definitions.ts';

export function calculateTrendComparisons(
  current: PeriodMetrics,
  previous: PeriodMetrics,
) {
  return [
    compare(
      'tasksCompleted',
      current.tasks.completed,
      previous.tasks.completed,
      current.tasks.completed + previous.tasks.completed,
      2,
    ),
    compare(
      'plannedMinutes',
      current.workload.plannedMinutes,
      previous.workload.plannedMinutes,
      current.workload.plannedBlockCount + previous.workload.plannedBlockCount,
      2,
    ),
    compare(
      'overCapacityDays',
      current.workload.overCapacityDays,
      previous.workload.overCapacityDays,
      current.workload.plannedBlockCount + previous.workload.plannedBlockCount,
      2,
    ),
    compare(
      'routineCheckIns',
      current.routines.completed + current.routines.skipped,
      previous.routines.completed + previous.routines.skipped,
      current.routines.completed +
        current.routines.skipped +
        previous.routines.completed +
        previous.routines.skipped,
      2,
    ),
    compare(
      'milestonesCompleted',
      current.goals.milestonesCompleted,
      previous.goals.milestonesCompleted,
      current.goals.milestonesCompleted + previous.goals.milestonesCompleted,
      2,
    ),
    compare(
      'reflections',
      current.reflectionCount,
      previous.reflectionCount,
      current.reflectionCount + previous.reflectionCount,
      2,
    ),
  ];
}

export function compareTrendValues(
  metric: TrendMetric,
  current: number,
  previous: number,
  sample: number,
  minimumSample: number,
): TrendComparison {
  return compare(metric, current, previous, sample, minimumSample);
}

function compare(
  metric: TrendMetric,
  current: number,
  previous: number,
  sample: number,
  minimumSample: number,
): TrendComparison {
  const difference = current - previous;
  return {
    metric,
    current,
    previous,
    difference,
    percentage:
      previous > 0 ? Math.round((Math.abs(difference) / previous) * 100) : null,
    direction:
      sample < minimumSample
        ? 'insufficient'
        : difference > 0
          ? 'more'
          : difference < 0
            ? 'less'
            : 'similar',
    minimumSample,
    sample,
  };
}
