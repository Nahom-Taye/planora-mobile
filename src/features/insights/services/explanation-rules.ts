import type {
  InsightExplanation,
  PeriodMetrics,
  TrendComparison,
} from './metric-definitions.ts';

export const MAX_INSIGHT_EXPLANATIONS = 4;

export function buildInsightExplanations(
  current: PeriodMetrics,
  trends: readonly TrendComparison[],
) {
  const explanations: InsightExplanation[] = [];
  if (current.workload.overCapacityDays > 0) {
    explanations.push({
      id: 'overCapacity',
      value: current.workload.overCapacityDays,
    });
  }
  if (current.workload.overlapCount > 0) {
    explanations.push({ id: 'overlap', value: current.workload.overlapCount });
  }
  if (current.tasks.highPriorityRemaining > 0) {
    explanations.push({
      id: 'highPriority',
      value: current.tasks.highPriorityRemaining,
    });
  }
  const routine = trends.find((trend) => trend.metric === 'routineCheckIns');
  if (routine && routine.direction !== 'insufficient') {
    explanations.push({
      id:
        routine.direction === 'more'
          ? 'routineMore'
          : routine.direction === 'less'
            ? 'routineLess'
            : 'routineSimilar',
      value: routine.current,
    });
  }
  if (explanations.length === 0) {
    explanations.push({ id: 'insufficient', value: 0 });
  }
  return explanations.slice(0, MAX_INSIGHT_EXPLANATIONS);
}
