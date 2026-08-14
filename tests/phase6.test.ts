import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toTimeZone,
  type Area,
  type EntityMetadata,
  type Goal,
  type GoalRoutineLink,
  type Milestone,
  type Routine,
  type RoutineCheckIn,
  type Task,
} from '../src/domain/entities/index.ts';
import type {
  CreateEntityInput,
  EntityRepository,
  ListOptions,
  RepositoryScope,
  RepositoryStore,
  UpdateEntityInput,
} from '../src/domain/repositories/contracts.ts';
import { directionForLanguage, formatLocalizedList, formatPercentageValue, supportedLanguages, translationCatalogs } from '../src/features/localization/localization.ts';
import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';
import { GoalRoutineLinkService } from '../src/features/goals/services/goal-routine-link-service.ts';
import { organizeGoals } from '../src/features/goals/services/goal-organization.ts';
import { calculateGoalProgress } from '../src/features/goals/services/goal-progress.ts';
import { GoalService } from '../src/features/goals/services/goal-service.ts';
import { availableTasksForGoalLink, goalForTask } from '../src/features/goals/services/goal-task-context.ts';
import { GoalTaskLinkService } from '../src/features/goals/services/goal-task-link-service.ts';
import { validateGoalDraft } from '../src/features/goals/services/goal-validation.ts';
import type { GoalDraft } from '../src/features/goals/services/goal-validation.ts';
import { MilestoneService } from '../src/features/goals/services/milestone-service.ts';
import { validateMilestoneDraft } from '../src/features/goals/services/milestone-validation.ts';
import { TaskService } from '../src/features/tasks/services/task-service.ts';
import { migrations } from '../src/storage/database/migrations/index.ts';
import { goalsMilestonesMigration } from '../src/storage/database/migrations/005-goals-milestones.ts';
import { StorageError } from '../src/storage/database/errors.ts';
import { goalMapper, goalRoutineLinkMapper } from '../src/storage/mappers/entity-mappers.ts';

const instant = toInstant('2026-08-13T12:00:00.000Z');
const later = new Date('2026-08-14T12:00:00.000Z');

class MemoryRepository<
  TEntity extends EntityMetadata,
  TFilter extends Record<string, unknown>,
> implements EntityRepository<TEntity, TFilter> {
  private items: TEntity[];
  private sequence = 0;
  failOnUpdateId: string | null = null;

  constructor(
    seed: TEntity[],
    private readonly prefix: string,
    private readonly matches: (entity: TEntity, filter: TFilter | undefined) => boolean,
    private readonly compare: (left: TEntity, right: TEntity) => number,
  ) {
    this.items = structuredClone(seed);
  }

  async getById(id: string, includeDeleted = false) {
    return this.items.find((item) => item.id === id && (includeDeleted || item.deletedAt === null)) ?? null;
  }

  async list(options: ListOptions<TFilter> = {}) {
    const limit = options.page?.limit ?? 50;
    const offset = options.page?.offset ?? 0;
    const filtered = this.items
      .filter((item) => (options.includeDeleted || item.deletedAt === null) && this.matches(item, options.filter))
      .sort(this.compare);
    return {
      items: filtered.slice(offset, offset + limit),
      nextOffset: offset + limit < filtered.length ? offset + limit : null,
    };
  }

  async create(input: CreateEntityInput<TEntity>) {
    const entity = {
      ...input,
      id: input.id ?? `${this.prefix}-${++this.sequence}`,
      createdAt: instant,
      updatedAt: instant,
      revision: 1,
      deletedAt: null,
    } as TEntity;
    this.items.push(entity);
    return structuredClone(entity);
  }

  async update(id: string, input: UpdateEntityInput<TEntity>) {
    if (this.failOnUpdateId === id) throw new Error('simulated transaction failure');
    const index = this.items.findIndex((item) => item.id === id && item.deletedAt === null);
    if (index < 0) throw new StorageError('NOT_FOUND', 'not found', false);
    const current = this.items[index];
    if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) {
      throw new StorageError('REVISION_CONFLICT', 'revision conflict', true);
    }
    const { expectedRevision, ...changes } = input;
    const entity = {
      ...current,
      ...changes,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: toInstant(later),
      revision: current.revision + 1,
      deletedAt: current.deletedAt,
    } as TEntity;
    this.items[index] = entity;
    return structuredClone(entity);
  }

  async softDelete(id: string, expectedRevision?: number) {
    const current = await this.getById(id);
    if (!current) throw new StorageError('NOT_FOUND', 'not found', false);
    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw new StorageError('REVISION_CONFLICT', 'revision conflict', true);
    }
    const index = this.items.findIndex((item) => item.id === id);
    const removed = {
      ...current,
      updatedAt: toInstant(later),
      revision: current.revision + 1,
      deletedAt: toInstant(later),
    };
    this.items[index] = removed;
    return structuredClone(removed);
  }

  snapshot() {
    return structuredClone(this.items);
  }

  restore(snapshot: TEntity[]) {
    this.items = structuredClone(snapshot);
  }
}

type Seed = {
  goals?: Goal[];
  milestones?: Milestone[];
  tasks?: Task[];
  routines?: Routine[];
  routineCheckIns?: RoutineCheckIn[];
  areas?: Area[];
  links?: GoalRoutineLink[];
};

function createStore(seed: Seed = {}) {
  const goals = new MemoryRepository(
    seed.goals ?? [],
    'goal',
    (item, filter: { workspaceId?: string; status?: Goal['status'] } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.status || item.status === filter.status),
    (left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
  );
  const milestones = new MemoryRepository(
    seed.milestones ?? [],
    'milestone',
    (item, filter: { workspaceId?: string; goalId?: string } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.goalId || item.goalId === filter.goalId),
    (left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
  const tasks = new MemoryRepository(
    seed.tasks ?? [],
    'task',
    (item, filter: { workspaceId?: string; status?: Task['status'] } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.status || item.status === filter.status),
    (left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
  );
  const routines = new MemoryRepository(
    seed.routines ?? [],
    'routine',
    (item, filter: { workspaceId?: string; status?: Routine['status'] } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.status || item.status === filter.status),
    (left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
  );
  const areas = new MemoryRepository(
    seed.areas ?? [],
    'area',
    (item, filter: { workspaceId?: string; status?: Area['status'] } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.status || item.status === filter.status),
    (left, right) => left.id.localeCompare(right.id),
  );
  const goalRoutineLinks = new MemoryRepository(
    seed.links ?? [],
    'link',
    (item, filter: { workspaceId?: string; goalId?: string; routineId?: string } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.goalId || item.goalId === filter.goalId) &&
      (!filter?.routineId || item.routineId === filter.routineId),
    (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
  );
  const routineCheckIns = new MemoryRepository(
    seed.routineCheckIns ?? [],
    'checkin',
    (item, filter: { workspaceId?: string; routineId?: string; fromDate?: string; toDate?: string } | undefined) =>
      (!filter?.workspaceId || item.workspaceId === filter.workspaceId) &&
      (!filter?.routineId || item.routineId === filter.routineId) &&
      (!filter?.fromDate || item.date >= filter.fromDate) &&
      (!filter?.toDate || item.date <= filter.toDate),
    (left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  const empty = new MemoryRepository<EntityMetadata, Record<string, unknown>>(
    [],
    'empty',
    () => true,
    (left, right) => left.id.localeCompare(right.id),
  );
  const core = {
    goals,
    milestones,
    tasks,
    routines,
    routineCheckIns,
    areas,
    goalRoutineLinks,
    userProfiles: empty,
    workspaces: empty,
    planBlocks: empty,
    planBlockSeries: empty,
    tags: empty,
    reflections: empty,
    appSettings: empty,
    accountLinks: empty,
    localChanges: empty,
  } as unknown as RepositoryScope;
  const repositories = [goals, milestones, tasks, routines, routineCheckIns, areas, goalRoutineLinks];
  const store = {
    ...core,
    transaction: async <TResult>(operation: (scope: RepositoryScope) => Promise<TResult>) => {
      const snapshots = repositories.map((repository) => repository.snapshot());
      try {
        return await operation(core);
      } catch (error) {
        repositories.forEach((repository, index) => repository.restore(snapshots[index] as never));
        throw error;
      }
    },
  } as RepositoryStore;
  return { store, goals, milestones, tasks, routines, routineCheckIns, areas, goalRoutineLinks };
}

function metadata(id: string): EntityMetadata {
  return { id, createdAt: instant, updatedAt: instant, revision: 1, deletedAt: null };
}

function goal(id = 'goal-1', changes: Partial<Goal> = {}): Goal {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: 'Learn calmly',
    description: null,
    motivation: null,
    status: 'active',
    horizon: 'quarter',
    targetDate: null,
    completedAt: null,
    areaId: null,
    progressMethod: 'milestones',
    manualProgress: 0,
    nextActionTaskId: null,
    ...changes,
  };
}

function milestone(id: string, sortOrder: number, changes: Partial<Milestone> = {}): Milestone {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    goalId: 'goal-1',
    title: id,
    notes: null,
    status: 'pending',
    targetDate: null,
    completedAt: null,
    sortOrder,
    ...changes,
  };
}

function task(id = 'task-1', changes: Partial<Task> = {}): Task {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: 'Next task',
    notes: 'Keep this',
    status: 'pending',
    priority: 'high',
    dueDate: toCalendarDate('2026-08-20'),
    scheduledTime: null,
    timeZone: toTimeZone('America/Asuncion'),
    completedAt: null,
    areaId: null,
    goalId: null,
    parentTaskId: null,
    ...changes,
  };
}

function routine(id = 'routine-1', changes: Partial<Routine> = {}): Routine {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: 'Read',
    notes: null,
    schedule: { kind: 'daily', time: null },
    timeZone: toTimeZone('America/Asuncion'),
    status: 'active',
    ...changes,
  };
}

function goalDraft(changes: Partial<GoalDraft> = {}): GoalDraft {
  return { ...baseGoalDraft(), ...changes };
}

function baseGoalDraft(): GoalDraft {
  return {
    title: '  Learn calmly  ',
    description: '  A useful description  ',
    motivation: '  More confidence  ',
    horizon: 'quarter',
    targetDate: '2026-11-01',
    status: 'active',
    areaId: null,
    progressMethod: 'milestones',
    manualProgress: '0',
  };
}

function milestoneDraft(status: Milestone['status'] = 'pending') {
  return { title: '  First step  ', notes: '  Keep moving  ', targetDate: '2026-09-01', status };
}

test('goal and milestone validation trims values and validates dates and manual progress', () => {
  const valid = validateGoalDraft(goalDraft({ progressMethod: 'manual', manualProgress: '42' }));
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.value.title, 'Learn calmly');
    assert.equal(valid.value.manualProgress, 42);
  }
  assert.equal(validateGoalDraft(goalDraft({ title: ' ', manualProgress: '101' })).valid, false);
  assert.equal(validateGoalDraft(goalDraft({ targetDate: '2026-02-30' })).valid, false);
  assert.equal(validateMilestoneDraft({ ...milestoneDraft(), title: ' ' }).valid, false);
});

test('goal CRUD and lifecycle timestamps are explicit and revision-safe', async () => {
  const { store } = createStore();
  const service = new GoalService(store, () => later);
  const created = await service.create('workspace-1', goalDraft());
  assert.equal(created.title, 'Learn calmly');
  assert.equal(created.completedAt, null);
  const updated = await service.update(created, goalDraft({ title: 'Updated goal' }));
  assert.equal(updated.revision, 2);
  const completed = await service.complete(updated);
  assert.equal(completed.completedAt, '2026-08-14T12:00:00.000Z');
  const paused = await service.pause(completed);
  assert.equal(paused.completedAt, null);
  const resumed = await service.resume(paused);
  const recompleted = await service.complete(resumed);
  const reopened = await service.reopen(recompleted);
  assert.equal(reopened.status, 'active');
  assert.equal(reopened.completedAt, null);
  const abandoned = await service.abandon(reopened);
  assert.equal(abandoned.completedAt, null);
});

test('goal revision conflicts are surfaced and soft deletion preserves the row', async () => {
  const original = goal();
  const { store, goals } = createStore({ goals: [original] });
  const service = new GoalService(store, () => later);
  await goals.update(original.id, { expectedRevision: 1, title: 'Changed elsewhere' });
  await assert.rejects(() => service.pause(original), (error: unknown) => error instanceof StorageError && error.code === 'REVISION_CONFLICT');
  const current = await goals.getById(original.id);
  const removed = await service.softDelete(current as Goal);
  assert.equal(await goals.getById(original.id), null);
  assert.equal((await goals.getById(original.id, true))?.revision, removed.revision);
});

test('goal filtering and ordering respect horizon, target date, status, and stable identifiers', () => {
  const items = [
    goal('b', { title: 'B', targetDate: toCalendarDate('2026-10-01') }),
    goal('a', { title: 'A', targetDate: toCalendarDate('2026-09-01') }),
    goal('someday', { horizon: 'someday' }),
    goal('paused', { status: 'paused' }),
    goal('done', { status: 'completed' }),
  ];
  const current = organizeGoals(items);
  assert.deepEqual(current.active.map((item) => item.id), ['a', 'b']);
  assert.deepEqual(current.someday.map((item) => item.id), ['someday']);
  assert.deepEqual(current.paused.map((item) => item.id), ['paused']);
  assert.deepEqual(organizeGoals(items, '', 'completed').completed.map((item) => item.id), ['done']);
  assert.deepEqual(organizeGoals(items, 'learn', 'all').completed.map((item) => item.id), ['done']);
});

test('milestone CRUD completion reopening and cancellation maintain timestamps', async () => {
  const parent = goal();
  const { store } = createStore({ goals: [parent] });
  const service = new MilestoneService(store, () => later);
  const created = await service.create(parent, milestoneDraft());
  assert.equal(created.sortOrder, 1024);
  const completed = await service.complete(parent, created);
  assert.equal(completed.completedAt, '2026-08-14T12:00:00.000Z');
  const reopened = await service.reopen(parent, completed);
  assert.equal(reopened.completedAt, null);
  const cancelled = await service.cancel(parent, reopened);
  assert.equal(cancelled.status, 'cancelled');
  const edited = await service.update(parent, cancelled, milestoneDraft('pending'));
  assert.equal(edited.title, 'First step');
  const removed = await service.softDelete(parent, edited);
  assert.ok(removed.deletedAt);
});

test('milestone reordering is transactional, normalized, and rejects cross-goal movement', async () => {
  const parent = goal();
  const items = [milestone('a', 10), milestone('b', 20), milestone('c', 30)];
  const setup = createStore({ goals: [parent, goal('goal-2')], milestones: items });
  const service = new MilestoneService(setup.store, () => later);
  await service.reorder(parent, items[2], 'up');
  const ordered = await service.list(parent.workspaceId, parent.id);
  assert.deepEqual(ordered.map((item) => item.id), ['a', 'c', 'b']);
  assert.deepEqual(ordered.map((item) => item.sortOrder), [1024, 2048, 3072]);
  await assert.rejects(
    () => service.reorder(parent, { ...ordered[1], revision: ordered[1].revision - 1 }, 'down'),
    (error: unknown) => error instanceof StorageError && error.code === 'REVISION_CONFLICT',
  );
  await assert.rejects(() => service.reorder(goal('goal-2'), ordered[0], 'down'));
  const before = (await service.list(parent.workspaceId, parent.id)).map((item) => [item.id, item.sortOrder]);
  setup.milestones.failOnUpdateId = 'c';
  await assert.rejects(() => service.reorder(parent, ordered[2], 'up'));
  setup.milestones.failOnUpdateId = null;
  assert.deepEqual((await service.list(parent.workspaceId, parent.id)).map((item) => [item.id, item.sortOrder]), before);
});

test('milestone progress excludes cancelled and deleted milestones and handles an empty goal', () => {
  const parent = goal();
  const progress = calculateGoalProgress(parent, [
    milestone('done', 1, { status: 'completed', completedAt: instant }),
    milestone('open', 2),
    milestone('cancelled', 3, { status: 'cancelled' }),
    milestone('deleted', 4, { deletedAt: instant }),
  ], []);
  assert.deepEqual({ completed: progress.completed, total: progress.total, percentage: progress.percentage }, { completed: 1, total: 2, percentage: 50 });
  assert.equal(calculateGoalProgress(parent, [], []).state, 'not_started');
});

test('linked-task manual and no-progress models follow their explicit rules', () => {
  const taskGoal = goal('goal-1', { progressMethod: 'tasks' });
  const taskProgress = calculateGoalProgress(taskGoal, [], [
    task('done', { goalId: taskGoal.id, status: 'completed', completedAt: instant }),
    task('open', { goalId: taskGoal.id }),
    task('cancelled', { goalId: taskGoal.id, status: 'cancelled' }),
  ]);
  assert.deepEqual({ completed: taskProgress.completed, total: taskProgress.total, percentage: taskProgress.percentage }, { completed: 1, total: 2, percentage: 50 });
  assert.equal(calculateGoalProgress(goal('manual', { progressMethod: 'manual', manualProgress: 100 }), [], []).percentage, 100);
  assert.equal(calculateGoalProgress(goal('none', { progressMethod: 'none' }), [], []).percentage, null);
});

test('changing progress methods preserves milestones tasks routines and manual history', async () => {
  const parent = goal('goal-1', { manualProgress: 35 });
  const item = milestone('milestone-1', 1024);
  const linkedTask = task('task-1', { goalId: parent.id });
  const linkedRoutine = routine();
  const link = { ...metadata('link-1'), workspaceId: parent.workspaceId, goalId: parent.id, routineId: linkedRoutine.id };
  const { store } = createStore({ goals: [parent], milestones: [item], tasks: [linkedTask], routines: [linkedRoutine], links: [link] });
  const updated = await new GoalService(store).update(parent, goalDraft({ progressMethod: 'none', manualProgress: '35' }));
  assert.equal(updated.manualProgress, 35);
  assert.equal((await store.milestones.getById(item.id))?.id, item.id);
  assert.equal((await store.tasks.getById(linkedTask.id))?.goalId, parent.id);
  assert.equal((await store.goalRoutineLinks.getById(link.id))?.routineId, linkedRoutine.id);
});

test('task linking unlinking and next-action selection preserve task semantics', async () => {
  const parent = goal();
  const original = task();
  const { store } = createStore({ goals: [parent], tasks: [original] });
  const service = new GoalTaskLinkService(store);
  const linked = await service.link(parent, original);
  assert.equal(linked.goalId, parent.id);
  assert.deepEqual(
    { title: linked.title, notes: linked.notes, dueDate: linked.dueDate, priority: linked.priority, status: linked.status },
    { title: original.title, notes: original.notes, dueDate: original.dueDate, priority: original.priority, status: original.status },
  );
  const selected = await service.setNextAction(parent, linked);
  assert.equal(selected.nextActionTaskId, linked.id);
  const unlinked = await service.unlink(selected, linked);
  assert.equal(unlinked.goalId, null);
  assert.equal((await store.tasks.getById(original.id))?.deletedAt, null);
});

test('creating a task from a goal preserves task workflow semantics and validates ownership', async () => {
  const parent = goal();
  const { store } = createStore({ goals: [parent] });
  const service = new TaskService(store, () => later);
  const created = await service.create('workspace-1', {
    title: 'Goal action', notes: '', status: 'pending', priority: 'medium', dueDate: '2026-08-20', scheduledTime: '',
  }, toTimeZone('America/Asuncion'), parent.id);
  assert.equal(created.goalId, parent.id);
  await assert.rejects(() => service.create('workspace-2', {
    title: 'Wrong workspace', notes: '', status: 'pending', priority: 'none', dueDate: '', scheduledTime: '',
  }, toTimeZone('America/Asuncion'), parent.id));
});

test('goal completion does not complete linked tasks', async () => {
  const parent = goal();
  const linkedTask = task('task-1', { goalId: parent.id });
  const { store } = createStore({ goals: [parent], tasks: [linkedTask] });
  await new GoalService(store, () => later).complete(parent);
  assert.equal((await store.tasks.getById(linkedTask.id))?.status, 'pending');
});

test('goal-routine linking and unlinking preserve routine history', async () => {
  const parent = goal();
  const habit = routine();
  const checkIn: RoutineCheckIn = {
    ...metadata('checkin-1'), workspaceId: parent.workspaceId, routineId: habit.id, date: toCalendarDate('2026-08-13'), outcome: 'completed', recordedAt: instant, note: null,
  };
  const { store } = createStore({ goals: [parent], routines: [habit], routineCheckIns: [checkIn] });
  const service = new GoalRoutineLinkService(store);
  const link = await service.link(parent, habit);
  assert.equal(link.routineId, habit.id);
  await service.unlink(parent, link);
  assert.equal((await store.routines.getById(habit.id))?.status, 'active');
  assert.equal((await store.routineCheckIns.getById(checkIn.id))?.outcome, 'completed');
});

test('goal relationships reject cross-workspace tasks routines and milestones', async () => {
  const parent = goal();
  const otherTask = task('task-other', { workspaceId: 'workspace-2' });
  const otherRoutine = routine('routine-other', { workspaceId: 'workspace-2' });
  const foreignMilestone = milestone('foreign', 1, { workspaceId: 'workspace-2' });
  const { store } = createStore({ goals: [parent], tasks: [otherTask], routines: [otherRoutine], milestones: [foreignMilestone] });
  await assert.rejects(() => new GoalTaskLinkService(store).link(parent, otherTask));
  await assert.rejects(() => new GoalRoutineLinkService(store).link(parent, otherRoutine));
  await assert.rejects(() => new MilestoneService(store).complete(parent, foreignMilestone));
});

test('Today goal context and Planner task selection stay compact and workspace-safe', () => {
  const parent = goal();
  const linked = task('linked', { goalId: parent.id });
  const unlinked = task('unlinked');
  const completed = task('done', { status: 'completed' });
  const other = task('other', { workspaceId: 'workspace-2' });
  assert.equal(goalForTask(linked, [parent])?.title, parent.title);
  assert.equal(goalForTask(unlinked, [parent]), null);
  assert.deepEqual(availableTasksForGoalLink([linked, unlinked, completed, other], parent.workspaceId).map((item) => item.id), ['unlinked']);
});

test('goal data survives service recreation for offline restart persistence', async () => {
  const { store } = createStore();
  const created = await new GoalService(store).create('workspace-1', goalDraft());
  const firstMilestone = await new MilestoneService(store).create(created, milestoneDraft());
  const restartedGoals = new GoalService(store);
  const restartedMilestones = new MilestoneService(store);
  assert.equal((await restartedGoals.list('workspace-1'))[0].id, created.id);
  assert.equal((await restartedMilestones.list('workspace-1', created.id))[0].id, firstMilestone.id);
});

test('migration 5 is additive atomic-ready indexed foreign-key protected and seed-free', async () => {
  const statements: string[] = [];
  await goalsMilestonesMigration.migrate({
    executeStatic: async (sql) => { statements.push(sql); },
    run: async () => ({ changes: 1, lastInsertRowId: 0 }),
    first: async () => null,
    all: async () => [],
  });
  const sql = statements.join('\n');
  assert.equal(goalsMilestonesMigration.version, 5);
  assert.equal(migrations.at(-1)?.version, 5);
  assert.match(sql, /progress_method TEXT NOT NULL DEFAULT 'milestones'/);
  assert.match(sql, /CREATE TABLE goal_routine_links/);
  assert.match(sql, /FOREIGN KEY \(goal_id, workspace_id\)/);
  assert.match(sql, /CREATE UNIQUE INDEX goal_routine_active_idx/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|INSERT INTO/i);
});

test('Phase 6 goal and routine-link rows map every local field', () => {
  const parent = goal('goal-map', { progressMethod: 'manual', manualProgress: 62, nextActionTaskId: 'task-1' });
  const link: GoalRoutineLink = { ...metadata('link-map'), workspaceId: parent.workspaceId, goalId: parent.id, routineId: 'routine-1' };
  assert.deepEqual(goalMapper.fromRow(goalMapper.toRow(parent)), parent);
  assert.deepEqual(goalRoutineLinkMapper.fromRow(goalRoutineLinkMapper.toRow(link)), link);
});

test('all five catalogs preserve Unicode RTL placeholders and Hermes-safe formatters', () => {
  assert.deepEqual(validateTranslationCatalogs(), []);
  assert.deepEqual(Object.keys(translationCatalogs), supportedLanguages);
  assert.match(translationCatalogs.am.goals.heading, /[\u1200-\u137F]/u);
  assert.match(translationCatalogs.ar.goals.heading, /[\u0600-\u06FF]/u);
  assert.equal(directionForLanguage('ar'), 'rtl');
  assert.equal(directionForLanguage('am'), 'ltr');
  assert.equal(formatLocalizedList(['A', 'B'], 'en'), 'A and B');
  assert.doesNotThrow(() => formatPercentageValue(42, 'ar'));
  assert.equal(formatPercentageValue(42, 'es').length > 0, true);
});
