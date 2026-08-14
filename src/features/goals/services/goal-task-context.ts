import type { Goal, Task } from '../../../domain/entities/index.ts';

export function goalForTask(task: Task, goals: readonly Goal[]) {
  if (!task.goalId) return null;
  return (
    goals.find((goal) => goal.id === task.goalId && goal.deletedAt === null) ?? null
  );
}

export function availableTasksForGoalLink(
  tasks: readonly Task[],
  workspaceId: string,
) {
  return tasks.filter(
    (task) =>
      task.workspaceId === workspaceId &&
      task.deletedAt === null &&
      task.goalId === null &&
      (task.status === 'pending' || task.status === 'in_progress'),
  );
}
