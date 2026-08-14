import type { Goal, Milestone, Task } from '../../../domain/entities/index.ts';

export type GoalProgress = {
  method: Goal['progressMethod'];
  percentage: number | null;
  completed: number | null;
  total: number | null;
  state: 'numeric' | 'not_started' | 'context';
};

export function calculateGoalProgress(
  goal: Goal,
  milestones: readonly Milestone[],
  tasks: readonly Task[],
): GoalProgress {
  if (goal.progressMethod === 'none') {
    return { method: 'none', percentage: null, completed: null, total: null, state: 'context' };
  }
  if (goal.progressMethod === 'manual') {
    return {
      method: 'manual',
      percentage: Math.min(100, Math.max(0, goal.manualProgress)),
      completed: null,
      total: null,
      state: 'numeric',
    };
  }
  if (goal.progressMethod === 'milestones') {
    const countable = milestones.filter(
      (milestone) =>
        milestone.goalId === goal.id &&
        milestone.deletedAt === null &&
        milestone.status !== 'cancelled',
    );
    return countedProgress(
      'milestones',
      countable.filter((milestone) => milestone.status === 'completed').length,
      countable.length,
    );
  }
  const countable = tasks.filter(
    (task) =>
      task.goalId === goal.id &&
      task.deletedAt === null &&
      task.status !== 'cancelled',
  );
  return countedProgress(
    'tasks',
    countable.filter((task) => task.status === 'completed').length,
    countable.length,
  );
}

function countedProgress(
  method: 'milestones' | 'tasks',
  completed: number,
  total: number,
): GoalProgress {
  return {
    method,
    percentage: total ? Math.round((completed / total) * 100) : null,
    completed,
    total,
    state: total ? 'numeric' : 'not_started',
  };
}
