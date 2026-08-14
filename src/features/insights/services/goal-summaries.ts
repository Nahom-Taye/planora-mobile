import type {
  CalendarDate,
  Goal,
  Milestone,
  Reflection,
  Task,
  TimeZone,
} from '../../../domain/entities/index.ts';
import {
  calculateGoalProgress,
  type GoalProgress,
} from '../../goals/services/goal-progress.ts';
import { addCalendarDays } from '../../planner/services/calendar-math.ts';
import {
  dateWithinPeriod,
  localDateForTimestamp,
  type InsightsPeriod,
} from './range-calculations.ts';

export type GoalInsight = {
  goal: Goal;
  progress: GoalProgress;
  hasNextAction: boolean;
};

export type GoalSummary = {
  activeGoals: number;
  milestonesCompleted: number;
  linkedTasksCompleted: number;
  upcomingTargets: number;
  goalsWithoutNextAction: number;
  goalReflections: number;
  items: GoalInsight[];
};

export function calculateGoalSummary(
  goals: readonly Goal[],
  milestones: readonly Milestone[],
  tasks: readonly Task[],
  reflections: readonly Reflection[],
  period: InsightsPeriod,
  today: CalendarDate,
  timeZone: TimeZone,
): GoalSummary {
  const active = goals.filter(
    (goal) => goal.deletedAt === null && goal.status === 'active',
  );
  const availableGoalIds = new Set(
    goals.filter((goal) => goal.deletedAt === null).map((goal) => goal.id),
  );
  const items = active
    .map((goal) => ({
      goal,
      progress: calculateGoalProgress(
        goal,
        milestones.filter((milestone) => milestone.goalId === goal.id),
        tasks.filter((task) => task.goalId === goal.id),
      ),
      hasNextAction: Boolean(
        goal.nextActionTaskId &&
          tasks.some(
            (task) =>
              task.id === goal.nextActionTaskId &&
              task.goalId === goal.id &&
              task.deletedAt === null &&
              (task.status === 'pending' || task.status === 'in_progress'),
          ),
      ),
    }))
    .sort(
      (left, right) =>
        (left.goal.targetDate ?? '9999-12-31').localeCompare(
          right.goal.targetDate ?? '9999-12-31',
        ) || left.goal.id.localeCompare(right.goal.id),
    );
  const completedInPeriod = (timestamp: string | null) =>
    Boolean(
      timestamp &&
        dateWithinPeriod(localDateForTimestamp(timestamp, timeZone), period),
    );
  const targetEnd = addCalendarDays(today, period.dayCount - 1);

  return {
    activeGoals: active.length,
    milestonesCompleted: milestones.filter(
      (milestone) =>
        milestone.deletedAt === null &&
        availableGoalIds.has(milestone.goalId) &&
        milestone.status === 'completed' &&
        completedInPeriod(milestone.completedAt),
    ).length,
    linkedTasksCompleted: tasks.filter(
      (task) =>
        task.deletedAt === null &&
        task.goalId !== null &&
        availableGoalIds.has(task.goalId) &&
        task.status === 'completed' &&
        completedInPeriod(task.completedAt),
    ).length,
    upcomingTargets: active.filter(
      (goal) =>
        goal.targetDate !== null &&
        goal.targetDate >= today &&
        goal.targetDate <= targetEnd,
    ).length,
    goalsWithoutNextAction: items.filter((item) => !item.hasNextAction).length,
    goalReflections: reflections.filter(
      (reflection) =>
        reflection.deletedAt === null &&
        reflection.scope === 'goal' &&
        reflection.scopeId !== null &&
        availableGoalIds.has(reflection.scopeId) &&
        dateWithinPeriod(reflection.periodStart, period),
    ).length,
    items,
  };
}
