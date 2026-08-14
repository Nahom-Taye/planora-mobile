import {
  toInstant,
  type Goal,
  type Milestone,
} from '../../../domain/entities/index.ts';
import type {
  RepositoryScope,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';
import { goalNotFound } from './goal-service.ts';
import type { MilestoneDraft } from './milestone-validation.ts';
import { validateMilestoneDraft } from './milestone-validation.ts';

export class MilestoneValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Milestone details need attention.');
  }
}

export class MilestoneService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  list(workspaceId: string, goalId?: string) {
    return listMilestones(this.repositories, workspaceId, goalId);
  }

  async create(goal: Goal, draft: MilestoneDraft) {
    await this.assertGoal(goal);
    const value = validDraft(draft);
    const existing = await this.list(goal.workspaceId, goal.id);
    const sortOrder = Math.max(0, ...existing.map((item) => item.sortOrder)) + 1024;
    return this.repositories.milestones.create({
      workspaceId: goal.workspaceId,
      goalId: goal.id,
      ...value,
      completedAt: value.status === 'completed' ? toInstant(this.now()) : null,
      sortOrder,
    });
  }

  async update(goal: Goal, milestone: Milestone, draft: MilestoneDraft) {
    await this.assertRelationship(goal, milestone);
    const value = validDraft(draft);
    return this.repositories.milestones.update(milestone.id, {
      expectedRevision: milestone.revision,
      ...value,
      completedAt:
        value.status === 'completed'
          ? milestone.completedAt ?? toInstant(this.now())
          : null,
    });
  }

  async complete(goal: Goal, milestone: Milestone) {
    await this.assertRelationship(goal, milestone);
    return this.repositories.milestones.update(milestone.id, {
      expectedRevision: milestone.revision,
      status: 'completed',
      completedAt: milestone.completedAt ?? toInstant(this.now()),
    });
  }

  async reopen(goal: Goal, milestone: Milestone) {
    await this.assertRelationship(goal, milestone);
    return this.repositories.milestones.update(milestone.id, {
      expectedRevision: milestone.revision,
      status: 'pending',
      completedAt: null,
    });
  }

  async cancel(goal: Goal, milestone: Milestone) {
    await this.assertRelationship(goal, milestone);
    return this.repositories.milestones.update(milestone.id, {
      expectedRevision: milestone.revision,
      status: 'cancelled',
      completedAt: null,
    });
  }

  async softDelete(goal: Goal, milestone: Milestone) {
    await this.assertRelationship(goal, milestone);
    return this.repositories.milestones.softDelete(milestone.id, milestone.revision);
  }

  async reorder(goal: Goal, milestone: Milestone, direction: 'up' | 'down') {
    return this.repositories.transaction(async (repositories) => {
      const currentGoal = await repositories.goals.getById(goal.id);
      const currentMilestone = await repositories.milestones.getById(milestone.id);
      if (
        !currentGoal ||
        !currentMilestone ||
        currentGoal.workspaceId !== goal.workspaceId ||
        currentMilestone.workspaceId !== goal.workspaceId ||
        currentMilestone.goalId !== goal.id
      ) {
        throw goalNotFound();
      }
      if (currentMilestone.revision !== milestone.revision) {
        throw new StorageError(
          'REVISION_CONFLICT',
          'This milestone changed before the order could be saved.',
          true,
        );
      }
      const ordered = await listMilestones(repositories, goal.workspaceId, goal.id);
      const from = ordered.findIndex((item) => item.id === currentMilestone.id);
      const to = direction === 'up' ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= ordered.length) return currentMilestone;
      [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
      let moved = currentMilestone;
      for (let index = 0; index < ordered.length; index += 1) {
        const item = ordered[index];
        const sortOrder = (index + 1) * 1024;
        if (item.sortOrder === sortOrder) continue;
        const updated = await repositories.milestones.update(item.id, {
          expectedRevision:
            item.id === currentMilestone.id ? milestone.revision : item.revision,
          sortOrder,
        });
        if (updated.id === currentMilestone.id) moved = updated;
      }
      return moved;
    });
  }

  private async assertGoal(goal: Goal) {
    const current = await this.repositories.goals.getById(goal.id);
    if (!current || current.workspaceId !== goal.workspaceId) throw goalNotFound();
  }

  private async assertRelationship(goal: Goal, milestone: Milestone) {
    await this.assertGoal(goal);
    const current = await this.repositories.milestones.getById(milestone.id);
    if (
      !current ||
      current.goalId !== goal.id ||
      current.workspaceId !== goal.workspaceId
    ) {
      throw goalNotFound();
    }
  }
}

async function listMilestones(
  repositories: RepositoryScope,
  workspaceId: string,
  goalId?: string,
) {
  const milestones: Milestone[] = [];
  let offset = 0;
  while (true) {
    const page = await repositories.milestones.list({
      filter: { workspaceId, goalId },
      page: { limit: 100, offset },
    });
    milestones.push(...page.items);
    if (page.nextOffset === null) return milestones;
    offset = page.nextOffset;
  }
}

function validDraft(draft: MilestoneDraft) {
  const result = validateMilestoneDraft(draft);
  if (!result.valid) throw new MilestoneValidationError(result.errors);
  return result.value;
}
