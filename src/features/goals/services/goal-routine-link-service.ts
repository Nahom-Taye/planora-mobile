import type {
  Goal,
  GoalRoutineLink,
  Routine,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';

export class GoalRoutineLinkService {
  constructor(private readonly repositories: RepositoryStore) {}

  async list(workspaceId: string) {
    const links: GoalRoutineLink[] = [];
    let offset = 0;
    while (true) {
      const page = await this.repositories.goalRoutineLinks.list({
        filter: { workspaceId },
        page: { limit: 100, offset },
      });
      links.push(...page.items);
      if (page.nextOffset === null) return links;
      offset = page.nextOffset;
    }
  }

  async link(goal: Goal, routine: Routine) {
    const [currentGoal, currentRoutine] = await Promise.all([
      this.repositories.goals.getById(goal.id),
      this.repositories.routines.getById(routine.id),
    ]);
    if (
      !currentGoal ||
      !currentRoutine ||
      currentGoal.workspaceId !== goal.workspaceId ||
      currentRoutine.workspaceId !== goal.workspaceId ||
      currentRoutine.status !== 'active'
    ) {
      throw relationshipError();
    }
    const existing = await this.repositories.goalRoutineLinks.list({
      filter: {
        workspaceId: goal.workspaceId,
        goalId: goal.id,
        routineId: routine.id,
      },
      page: { limit: 1, offset: 0 },
    });
    if (existing.items[0]) return existing.items[0];
    return this.repositories.goalRoutineLinks.create({
      workspaceId: goal.workspaceId,
      goalId: goal.id,
      routineId: routine.id,
    });
  }

  async unlink(goal: Goal, link: GoalRoutineLink) {
    const currentGoal = await this.repositories.goals.getById(goal.id);
    const currentLink = await this.repositories.goalRoutineLinks.getById(link.id);
    if (
      !currentGoal ||
      !currentLink ||
      currentGoal.workspaceId !== goal.workspaceId ||
      currentLink.workspaceId !== goal.workspaceId ||
      currentLink.goalId !== goal.id
    ) {
      throw relationshipError();
    }
    return this.repositories.goalRoutineLinks.softDelete(link.id, link.revision);
  }
}

function relationshipError() {
  return new StorageError(
    'WRITE_FAILED',
    'Choose an active routine from this workspace.',
    true,
  );
}
