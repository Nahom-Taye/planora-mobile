import type {
  CalendarDate,
  Goal,
  Milestone,
  PlanBlock,
  Reflection,
  Routine,
  RoutineCheckIn,
  Task,
  TimeZone,
  Weekday,
} from '../../../domain/entities/index.ts';
import type {
  EntityRepository,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import { calculateGoalSummary } from './goal-summaries.ts';
import type {
  CountByPriority,
  PeriodMetrics,
  TaskInsightSummary,
} from './metric-definitions.ts';
import {
  dateWithinPeriod,
  datesInPeriod,
  localDateForTimestamp,
  type InsightsPeriod,
} from './range-calculations.ts';
import { organizeReflections } from './reflection-organization.ts';
import { calculateRoutineSummary } from './routine-summaries.ts';
import { calculateWorkloadSignals } from './workload-signals.ts';

export type InsightsData = {
  tasks: Task[];
  blocks: PlanBlock[];
  routines: Routine[];
  checkIns: RoutineCheckIn[];
  goals: Goal[];
  milestones: Milestone[];
  reflections: Reflection[];
};

export class InsightsAggregationService {
  constructor(private readonly repositories: RepositoryStore) {}

  async load(workspaceId: string): Promise<InsightsData> {
    const [tasks, blocks, routines, checkIns, goals, milestones, reflections] =
      await Promise.all([
        listAll(this.repositories.tasks, { workspaceId }),
        listAll(this.repositories.planBlocks, { workspaceId }),
        listAll(this.repositories.routines, { workspaceId }),
        listAll(this.repositories.routineCheckIns, { workspaceId }),
        listAll(this.repositories.goals, { workspaceId }),
        listAll(this.repositories.milestones, { workspaceId }),
        listAll(this.repositories.reflections, { workspaceId }),
      ]);
    return {
      tasks,
      blocks,
      routines,
      checkIns,
      goals,
      milestones,
      reflections: organizeReflections(reflections),
    };
  }
}

export function aggregatePeriod(
  data: InsightsData,
  period: InsightsPeriod,
  today: CalendarDate,
  timeZone: TimeZone,
  weekStartsOn: Weekday,
  capacityMinutes: number,
): PeriodMetrics {
  return {
    tasks: calculateTaskSummary(data.tasks, data.goals, period, today, timeZone),
    workload: calculateWorkloadSignals(
      data.blocks,
      data.tasks,
      period,
      capacityMinutes,
      weekStartsOn,
    ),
    routines: calculateRoutineSummary(data.routines, data.checkIns, period),
    goals: calculateGoalSummary(
      data.goals,
      data.milestones,
      data.tasks,
      data.reflections,
      period,
      today,
      timeZone,
    ),
    reflectionCount: data.reflections.filter((reflection) =>
      dateWithinPeriod(reflection.periodStart, period),
    ).length,
  };
}

function calculateTaskSummary(
  tasks: readonly Task[],
  goals: readonly Goal[],
  period: InsightsPeriod,
  today: CalendarDate,
  timeZone: TimeZone,
): TaskInsightSummary {
  const available = tasks.filter((task) => task.deletedAt === null);
  const actionable = available.filter(
    (task) => task.status === 'pending' || task.status === 'in_progress',
  );
  const completed = available.filter(
    (task) =>
      task.status === 'completed' &&
      task.completedAt !== null &&
      dateWithinPeriod(localDateForTimestamp(task.completedAt, timeZone), period),
  );
  const dueActionable = actionable.filter(
    (task) => task.dueDate && dateWithinPeriod(task.dueDate, period),
  );
  const activeGoalIds = new Set(
    goals
      .filter((goal) => goal.deletedAt === null && goal.status === 'active')
      .map((goal) => goal.id),
  );
  const priorities: Task['priority'][] = ['high', 'medium', 'low', 'none'];

  return {
    completed: completed.length,
    actionableRemaining: actionable.length,
    completionNumerator: completed.length,
    completionDenominator: completed.length + dueActionable.length,
    overdue: actionable.filter(
      (task) => task.dueDate !== null && task.dueDate < today,
    ).length,
    pending: actionable.filter((task) => task.status === 'pending').length,
    inProgress: actionable.filter((task) => task.status === 'in_progress').length,
    highPriorityRemaining: actionable.filter(
      (task) => task.priority === 'high',
    ).length,
    connectedToActiveGoals: actionable.filter(
      (task) => task.goalId !== null && activeGoalIds.has(task.goalId),
    ).length,
    completedByDay: datesInPeriod(period).map((date) => ({
      date,
      count: completed.filter(
        (task) =>
          task.completedAt !== null &&
          localDateForTimestamp(task.completedAt, timeZone) === date,
      ).length,
    })),
    completedByPriority: priorities.map(
      (priority): CountByPriority => ({
        priority,
        count: completed.filter((task) => task.priority === priority).length,
      }),
    ),
  };
}

export async function listAll<TEntity, TFilter>(
  repository: EntityRepository<TEntity, TFilter>,
  filter: TFilter,
) {
  const items: TEntity[] = [];
  let offset = 0;
  while (true) {
    const page = await repository.list({
      filter,
      page: { limit: 100, offset },
    });
    items.push(...page.items);
    if (page.nextOffset === null) return items;
    offset = page.nextOffset;
  }
}
