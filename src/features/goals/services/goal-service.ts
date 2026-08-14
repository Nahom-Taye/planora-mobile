import {
  type Area,
  toInstant,
  type Goal,
  type GoalStatus,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';
import type { GoalDraft } from './goal-validation.ts';
import { validateGoalDraft } from './goal-validation.ts';

export class GoalValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Goal details need attention.');
  }
}

export class GoalService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(workspaceId: string) {
    const goals: Goal[] = [];
    let offset = 0;
    while (true) {
      const page = await this.repositories.goals.list({
        filter: { workspaceId },
        page: { limit: 100, offset },
      });
      goals.push(...page.items);
      if (page.nextOffset === null) return goals;
      offset = page.nextOffset;
    }
  }

  async listAreas(workspaceId: string) {
    const areas: Area[] = [];
    let offset = 0;
    while (true) {
      const page = await this.repositories.areas.list({
        filter: { workspaceId, status: 'active' },
        page: { limit: 100, offset },
      });
      areas.push(...page.items);
      if (page.nextOffset === null) return areas;
      offset = page.nextOffset;
    }
  }

  async create(workspaceId: string, draft: GoalDraft) {
    const value = await this.validDraft(workspaceId, draft);
    return this.repositories.goals.create({
      workspaceId,
      ...value,
      completedAt: value.status === 'completed' ? toInstant(this.now()) : null,
      nextActionTaskId: null,
    });
  }

  async update(goal: Goal, draft: GoalDraft) {
    const value = await this.validDraft(goal.workspaceId, draft);
    return this.repositories.goals.update(goal.id, {
      expectedRevision: goal.revision,
      ...value,
      completedAt:
        value.status === 'completed'
          ? goal.completedAt ?? toInstant(this.now())
          : null,
    });
  }

  complete(goal: Goal) {
    return this.changeStatus(goal, 'completed');
  }

  pause(goal: Goal) {
    return this.changeStatus(goal, 'paused');
  }

  resume(goal: Goal) {
    return this.changeStatus(goal, 'active');
  }

  reopen(goal: Goal) {
    return this.changeStatus(goal, 'active');
  }

  abandon(goal: Goal) {
    return this.changeStatus(goal, 'abandoned');
  }

  softDelete(goal: Goal) {
    return this.repositories.goals.softDelete(goal.id, goal.revision);
  }

  private changeStatus(goal: Goal, status: GoalStatus) {
    return this.repositories.goals.update(goal.id, {
      expectedRevision: goal.revision,
      status,
      completedAt: status === 'completed' ? toInstant(this.now()) : null,
    });
  }

  private async validDraft(workspaceId: string, draft: GoalDraft) {
    const result = validateGoalDraft(draft);
    if (!result.valid) throw new GoalValidationError(result.errors);
    if (result.value.areaId) {
      const area = await this.repositories.areas.getById(result.value.areaId);
      if (!area || area.workspaceId !== workspaceId || area.status !== 'active') {
        throw new GoalValidationError({ areaId: 'Choose an active area from this workspace.' });
      }
    }
    return result.value;
  }
}

export function goalNotFound() {
  return new StorageError('NOT_FOUND', 'The goal is no longer available.', false);
}
