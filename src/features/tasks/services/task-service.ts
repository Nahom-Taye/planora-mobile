import {
  toInstant,
  type CalendarDate,
  type Task,
  type TimeZone,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import type { TaskDraft } from './task-validation.ts';
import { validateTaskDraft } from './task-validation.ts';

export class TaskValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Task details need attention.');
  }
}

export class TaskService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(workspaceId: string) {
    return listAllTasks(this.repositories, workspaceId);
  }

  async quickCapture(
    workspaceId: string,
    title: string,
    today: CalendarDate,
    timeZone: TimeZone,
  ) {
    const trimmed = title.trim();
    if (!trimmed) throw new TaskValidationError({ title: 'Enter a task title.' });
    if (trimmed.length > 200) {
      throw new TaskValidationError({ title: 'Use 200 characters or fewer.' });
    }

    return this.repositories.tasks.create({
      workspaceId,
      title: trimmed,
      notes: null,
      status: 'pending',
      priority: 'none',
      dueDate: today,
      scheduledTime: null,
      timeZone,
      completedAt: null,
      areaId: null,
      goalId: null,
      parentTaskId: null,
    });
  }

  async create(
    workspaceId: string,
    draft: TaskDraft,
    timeZone: TimeZone,
    goalId: string | null = null,
  ) {
    const value = validDraft(draft);
    if (goalId) {
      const goal = await this.repositories.goals.getById(goalId);
      if (!goal || goal.workspaceId !== workspaceId) {
        throw new TaskValidationError({ goalId: 'Choose an available goal from this workspace.' });
      }
    }
    return this.repositories.tasks.create({
      workspaceId,
      ...value,
      timeZone: value.dueDate ? timeZone : null,
      completedAt:
        value.status === 'completed' ? toInstant(this.now()) : null,
      areaId: null,
      goalId,
      parentTaskId: null,
    });
  }

  async update(task: Task, draft: TaskDraft, timeZone: TimeZone) {
    const value = validDraft(draft);
    const completedAt =
      value.status === 'completed'
        ? task.completedAt ?? toInstant(this.now())
        : null;
    return this.repositories.tasks.update(task.id, {
      expectedRevision: task.revision,
      ...value,
      timeZone: value.dueDate ? timeZone : null,
      completedAt,
    });
  }

  async complete(task: Task) {
    return this.repositories.tasks.update(task.id, {
      expectedRevision: task.revision,
      status: 'completed',
      completedAt: toInstant(this.now()),
    });
  }

  async reopen(task: Task) {
    return this.repositories.tasks.update(task.id, {
      expectedRevision: task.revision,
      status: 'pending',
      completedAt: null,
    });
  }

  async cancel(task: Task) {
    return this.repositories.tasks.update(task.id, {
      expectedRevision: task.revision,
      status: 'cancelled',
      completedAt: null,
    });
  }

  async softDelete(task: Task) {
    return this.repositories.tasks.softDelete(task.id, task.revision);
  }
}

async function listAllTasks(
  repositories: RepositoryStore,
  workspaceId: string,
) {
  const tasks: Task[] = [];
  let offset = 0;

  while (true) {
    const page = await repositories.tasks.list({
      filter: { workspaceId },
      page: { limit: 100, offset },
    });
    tasks.push(...page.items);
    if (page.nextOffset === null) return tasks;
    offset = page.nextOffset;
  }
}

function validDraft(draft: TaskDraft) {
  const result = validateTaskDraft(draft);
  if (!result.valid) throw new TaskValidationError(result.errors);
  return result.value;
}
