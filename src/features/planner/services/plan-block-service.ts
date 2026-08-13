import type {
  CalendarDate,
  PlanBlock,
  Task,
  TimeZone,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';
import { detectOverlaps } from './capacity.ts';
import type { PlanBlockDraft } from './plan-block-validation.ts';
import { validatePlanBlockDraft } from './plan-block-validation.ts';

export class PlanBlockValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Plan block details need attention.');
  }
}

export class PlanBlockService {
  constructor(private readonly repositories: RepositoryStore) {}

  async list(
    workspaceId: string,
    fromDate?: CalendarDate,
    toDate?: CalendarDate,
  ) {
    const blocks: PlanBlock[] = [];
    let offset = 0;

    while (true) {
      const page = await this.repositories.planBlocks.list({
        filter: { workspaceId, fromDate, toDate },
        page: { limit: 100, offset },
      });
      blocks.push(...page.items);
      if (page.nextOffset === null) return blocks;
      offset = page.nextOffset;
    }
  }

  async create(
    workspaceId: string,
    draft: PlanBlockDraft,
    timeZone: TimeZone,
  ) {
    const value = validDraft(draft, timeZone);
    await this.validateLinks(workspaceId, value.taskId, value.routineId);
    return this.repositories.planBlocks.create({
      workspaceId,
      ...value,
      timeZone,
      seriesId: null,
      occurrenceDate: null,
      isRecurrenceException: false,
    });
  }

  async scheduleTask(
    workspaceId: string,
    task: Task,
    draft: Omit<PlanBlockDraft, 'title' | 'notes' | 'taskId' | 'routineId'> & {
      title?: string;
      notes?: string;
    },
    timeZone: TimeZone,
  ) {
    if (
      task.workspaceId !== workspaceId ||
      task.deletedAt ||
      (task.status !== 'pending' && task.status !== 'in_progress')
    ) {
      throw new PlanBlockValidationError({
        taskId: 'Choose an available task from this workspace.',
      });
    }

    return this.create(
      workspaceId,
      {
        ...draft,
        title: draft.title?.trim() || task.title,
        notes: draft.notes ?? '',
        taskId: task.id,
        routineId: null,
      },
      timeZone,
    );
  }

  async update(
    block: PlanBlock,
    draft: PlanBlockDraft,
    timeZone: TimeZone,
  ) {
    const value = validDraft(draft, timeZone);
    await this.validateLinks(block.workspaceId, value.taskId, value.routineId);
    return this.repositories.planBlocks.update(block.id, {
      expectedRevision: block.revision,
      ...value,
      timeZone,
      isRecurrenceException: block.seriesId
        ? true
        : block.isRecurrenceException,
    });
  }

  async complete(block: PlanBlock) {
    return this.repositories.planBlocks.update(block.id, {
      expectedRevision: block.revision,
      status: 'completed',
    });
  }

  async reopen(block: PlanBlock) {
    return this.repositories.planBlocks.update(block.id, {
      expectedRevision: block.revision,
      status: 'planned',
    });
  }

  async cancel(block: PlanBlock) {
    return this.repositories.planBlocks.update(block.id, {
      expectedRevision: block.revision,
      status: 'cancelled',
    });
  }

  async unlink(block: PlanBlock) {
    return this.repositories.planBlocks.update(block.id, {
      expectedRevision: block.revision,
      taskId: null,
      routineId: null,
      isRecurrenceException: block.seriesId
        ? true
        : block.isRecurrenceException,
    });
  }

  async softDelete(block: PlanBlock) {
    return this.repositories.planBlocks.softDelete(block.id, block.revision);
  }

  overlapWarnings(blocks: PlanBlock[]) {
    return detectOverlaps(blocks);
  }

  private async validateLinks(
    workspaceId: string,
    taskId: string | null,
    routineId: string | null,
  ) {
    if (taskId) {
      const task = await this.repositories.tasks.getById(taskId);
      if (
        !task ||
        task.workspaceId !== workspaceId ||
        (task.status !== 'pending' && task.status !== 'in_progress')
      ) {
        throw new PlanBlockValidationError({
          taskId: 'Choose an available task from this workspace.',
        });
      }
    }

    if (routineId) {
      const routine = await this.repositories.routines.getById(routineId);
      if (
        !routine ||
        routine.workspaceId !== workspaceId ||
        routine.status === 'archived'
      ) {
        throw new PlanBlockValidationError({
          routineId: 'Choose an available routine from this workspace.',
        });
      }
    }
  }
}

export function revisionConflictMessage(error: unknown) {
  return error instanceof StorageError && error.code === 'REVISION_CONFLICT';
}

function validDraft(draft: PlanBlockDraft, timeZone: TimeZone) {
  const result = validatePlanBlockDraft(draft, timeZone);
  if (!result.valid) throw new PlanBlockValidationError(result.errors);
  return result.value;
}
