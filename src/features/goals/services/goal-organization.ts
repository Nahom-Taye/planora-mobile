import type { Goal } from '../../../domain/entities/index.ts';

export type GoalFilter = 'current' | 'completed' | 'all';

export type GoalGroups = {
  active: Goal[];
  someday: Goal[];
  paused: Goal[];
  completed: Goal[];
  abandoned: Goal[];
};

export function organizeGoals(
  goals: Goal[],
  query = '',
  filter: GoalFilter = 'current',
): GoalGroups {
  const normalized = query.trim().toLocaleLowerCase();
  const visible = goals.filter((goal) => {
    if (normalized && !`${goal.title} ${goal.description ?? ''} ${goal.motivation ?? ''}`.toLocaleLowerCase().includes(normalized)) {
      return false;
    }
    if (filter === 'completed') return goal.status === 'completed';
    if (filter === 'current') return goal.status === 'active' || goal.status === 'paused';
    return true;
  });

  return {
    active: visible
      .filter((goal) => goal.status === 'active' && goal.horizon !== 'someday')
      .sort(compareGoals),
    someday: visible
      .filter((goal) => goal.status === 'active' && goal.horizon === 'someday')
      .sort(compareGoals),
    paused: visible.filter((goal) => goal.status === 'paused').sort(compareGoals),
    completed: visible.filter((goal) => goal.status === 'completed').sort(compareGoals),
    abandoned: visible.filter((goal) => goal.status === 'abandoned').sort(compareGoals),
  };
}

export function compareGoals(left: Goal, right: Goal) {
  if (left.targetDate && right.targetDate) {
    const date = left.targetDate.localeCompare(right.targetDate);
    if (date) return date;
  } else if (left.targetDate) return -1;
  else if (right.targetDate) return 1;
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}
