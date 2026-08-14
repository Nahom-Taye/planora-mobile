import type { Goal, Task } from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';

export class GoalTaskLinkService {
  constructor(private readonly repositories: RepositoryStore) {}

  async link(goal: Goal, task: Task) {
    const [currentGoal, currentTask] = await Promise.all([
      this.repositories.goals.getById(goal.id),
      this.repositories.tasks.getById(task.id),
    ]);
    const pair = requirePair(currentGoal, currentTask, goal.workspaceId);
    if (pair.task.status !== 'pending' && pair.task.status !== 'in_progress') {
      throw relationshipError('Only actionable tasks can be linked.');
    }
    if (pair.task.goalId && pair.task.goalId !== pair.goal.id) {
      throw relationshipError('This task already supports another goal.');
    }
    if (pair.task.goalId === pair.goal.id) return pair.task;
    return this.repositories.tasks.update(pair.task.id, {
      expectedRevision: task.revision,
      goalId: pair.goal.id,
    });
  }

  async unlink(goal: Goal, task: Task) {
    return this.repositories.transaction(async (repositories) => {
      const [currentGoal, currentTask] = await Promise.all([
        repositories.goals.getById(goal.id),
        repositories.tasks.getById(task.id),
      ]);
      const pair = requirePair(currentGoal, currentTask, goal.workspaceId);
      if (pair.task.goalId !== pair.goal.id) {
        throw relationshipError('This task is not linked to the goal.');
      }
      const updatedTask = await repositories.tasks.update(pair.task.id, {
        expectedRevision: task.revision,
        goalId: null,
      });
      if (pair.goal.nextActionTaskId === pair.task.id) {
        await repositories.goals.update(pair.goal.id, {
          expectedRevision: goal.revision,
          nextActionTaskId: null,
        });
      }
      return updatedTask;
    });
  }

  async setNextAction(goal: Goal, task: Task | null) {
    const currentGoal = await this.repositories.goals.getById(goal.id);
    if (!currentGoal || currentGoal.workspaceId !== goal.workspaceId) {
      throw relationshipError('The goal is no longer available.');
    }
    if (task) {
      const currentTask = await this.repositories.tasks.getById(task.id);
      const pair = requirePair(currentGoal, currentTask, goal.workspaceId);
      if (
        pair.task.goalId !== pair.goal.id ||
        (pair.task.status !== 'pending' && pair.task.status !== 'in_progress')
      ) {
        throw relationshipError('Choose an actionable task linked to this goal.');
      }
    }
    return this.repositories.goals.update(currentGoal.id, {
      expectedRevision: goal.revision,
      nextActionTaskId: task?.id ?? null,
    });
  }
}

function requirePair(
  goal: Goal | null,
  task: Task | null,
  workspaceId: string,
): { goal: Goal; task: Task } {
  if (!goal || !task || goal.workspaceId !== workspaceId || task.workspaceId !== workspaceId) {
    throw relationshipError('Choose an available task from this workspace.');
  }
  return { goal, task };
}

function relationshipError(message: string) {
  return new StorageError('WRITE_FAILED', message, true);
}
