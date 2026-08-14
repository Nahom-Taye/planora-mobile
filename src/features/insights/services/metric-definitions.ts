import type {
  CalendarDate,
  Reflection,
  TaskPriority,
} from '../../../domain/entities/index.ts';
import type { GoalSummary } from './goal-summaries.ts';
import type { InsightsRangeWindow } from './range-calculations.ts';
import type { RoutineSummary } from './routine-summaries.ts';
import type { WorkloadSummary } from './workload-signals.ts';

export type CountByDate = {
  date: CalendarDate;
  count: number;
};

export type CountByPriority = {
  priority: TaskPriority;
  count: number;
};

export type TaskInsightSummary = {
  completed: number;
  actionableRemaining: number;
  completionNumerator: number;
  completionDenominator: number;
  overdue: number;
  pending: number;
  inProgress: number;
  highPriorityRemaining: number;
  connectedToActiveGoals: number;
  completedByDay: CountByDate[];
  completedByPriority: CountByPriority[];
};

export type PeriodMetrics = {
  tasks: TaskInsightSummary;
  workload: WorkloadSummary;
  routines: RoutineSummary;
  goals: GoalSummary;
  reflectionCount: number;
};

export type InsightsSnapshot = {
  range: InsightsRangeWindow;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  reflections: Reflection[];
  trends: TrendComparison[];
  explanations: InsightExplanation[];
};

export type TrendDirection = 'more' | 'similar' | 'less' | 'insufficient';

export type TrendMetric =
  | 'tasksCompleted'
  | 'plannedMinutes'
  | 'overCapacityDays'
  | 'routineCheckIns'
  | 'milestonesCompleted'
  | 'reflections';

export type TrendComparison = {
  metric: TrendMetric;
  current: number;
  previous: number;
  difference: number;
  percentage: number | null;
  direction: TrendDirection;
  minimumSample: number;
  sample: number;
};

export type ExplanationId =
  | 'overCapacity'
  | 'overlap'
  | 'highPriority'
  | 'routineMore'
  | 'routineSimilar'
  | 'routineLess'
  | 'insufficient';

export type InsightExplanation = {
  id: ExplanationId;
  value: number;
};
