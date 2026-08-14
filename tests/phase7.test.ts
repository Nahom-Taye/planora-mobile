import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
  type AppSettings,
  type EntityMetadata,
  type Goal,
  type Milestone,
  type PlanBlock,
  type Reflection,
  type Routine,
  type RoutineCheckIn,
  type Task,
  type UserProfile,
  type Workspace,
} from '../src/domain/entities/index.ts';
import type {
  CreateEntityInput,
  EntityRepository,
  ListOptions,
  RepositoryScope,
  RepositoryStore,
  UpdateEntityInput,
} from '../src/domain/repositories/contracts.ts';
import { buildInsightExplanations, MAX_INSIGHT_EXPLANATIONS } from '../src/features/insights/services/explanation-rules.ts';
import { calculateGoalSummary } from '../src/features/insights/services/goal-summaries.ts';
import { aggregatePeriod, InsightsAggregationService } from '../src/features/insights/services/local-aggregation.ts';
import type { InsightsData } from '../src/features/insights/services/local-aggregation.ts';
import type { PeriodMetrics } from '../src/features/insights/services/metric-definitions.ts';
import {
  calculateInsightsRange,
  localDateForTimestamp,
  normalizeWeeklyPeriod,
} from '../src/features/insights/services/range-calculations.ts';
import {
  ReflectionService,
  ReflectionValidationError,
} from '../src/features/insights/services/reflection-lifecycle.ts';
import { organizeReflections } from '../src/features/insights/services/reflection-organization.ts';
import {
  MAX_REFLECTION_BODY_LENGTH,
  validateReflectionDraft,
} from '../src/features/insights/services/reflection-validation.ts';
import { calculateRoutineSummary } from '../src/features/insights/services/routine-summaries.ts';
import { compareTrendValues } from '../src/features/insights/services/trend-comparisons.ts';
import { calculateWorkloadSignals } from '../src/features/insights/services/workload-signals.ts';
import {
  directionForLanguage,
  formatLocalizedList,
  formatPercentageValue,
  supportedLanguages,
  translationCatalogs,
} from '../src/features/localization/localization.ts';
import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';
import { PlanningPreferencesService } from '../src/features/settings/services/planning-preferences-service.ts';
import { StorageError } from '../src/storage/database/errors.ts';
import { migrations } from '../src/storage/database/migrations/index.ts';
import { insightsReflectionsMigration } from '../src/storage/database/migrations/006-insights-reflections.ts';
import { appSettingsMapper, reflectionMapper } from '../src/storage/mappers/entity-mappers.ts';

const instant = toInstant('2026-08-14T12:00:00.000Z');
const updatedInstant = toInstant('2026-08-14T13:00:00.000Z');
const timeZone = toTimeZone('America/Asuncion');

class MemoryRepository<TEntity extends EntityMetadata>
  implements EntityRepository<TEntity, Record<string, unknown>>
{
  private items: TEntity[];
  private sequence = 0;
  listCalls = 0;

  constructor(seed: TEntity[] = [], private readonly prefix = 'entity') {
    this.items = structuredClone(seed);
  }

  async getById(id: string, includeDeleted = false) {
    return structuredClone(
      this.items.find(
        (item) => item.id === id && (includeDeleted || item.deletedAt === null),
      ) ?? null,
    );
  }

  async list(options: ListOptions<Record<string, unknown>> = {}) {
    this.listCalls += 1;
    const limit = options.page?.limit ?? 50;
    const offset = options.page?.offset ?? 0;
    const items = this.items
      .filter(
        (item) =>
          (options.includeDeleted || item.deletedAt === null) &&
          matchesFilter(item, options.filter),
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id),
      );
    return {
      items: structuredClone(items.slice(offset, offset + limit)),
      nextOffset: offset + limit < items.length ? offset + limit : null,
    };
  }

  async create(input: CreateEntityInput<TEntity>) {
    const value = {
      ...input,
      id: input.id ?? `${this.prefix}-${++this.sequence}`,
      createdAt: instant,
      updatedAt: instant,
      revision: 1,
      deletedAt: null,
    } as TEntity;
    this.items.push(value);
    return structuredClone(value);
  }

  async update(id: string, input: UpdateEntityInput<TEntity>) {
    const index = this.items.findIndex(
      (item) => item.id === id && item.deletedAt === null,
    );
    if (index < 0) throw new StorageError('NOT_FOUND', 'not found', false);
    const current = this.items[index];
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      throw new StorageError('REVISION_CONFLICT', 'revision conflict', true);
    }
    const { expectedRevision, ...changes } = input;
    const value = {
      ...current,
      ...changes,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: updatedInstant,
      revision: current.revision + 1,
      deletedAt: current.deletedAt,
    } as TEntity;
    this.items[index] = value;
    return structuredClone(value);
  }

  async softDelete(id: string, expectedRevision?: number) {
    const current = await this.getById(id);
    if (!current) throw new StorageError('NOT_FOUND', 'not found', false);
    if (
      expectedRevision !== undefined &&
      expectedRevision !== current.revision
    ) {
      throw new StorageError('REVISION_CONFLICT', 'revision conflict', true);
    }
    const index = this.items.findIndex((item) => item.id === id);
    const value = {
      ...current,
      updatedAt: updatedInstant,
      revision: current.revision + 1,
      deletedAt: updatedInstant,
    };
    this.items[index] = value;
    return structuredClone(value);
  }

  snapshot() {
    return structuredClone(this.items);
  }

  restore(items: TEntity[]) {
    this.items = structuredClone(items);
  }
}

type Seed = {
  profiles?: UserProfile[];
  workspaces?: Workspace[];
  settings?: AppSettings[];
  tasks?: Task[];
  blocks?: PlanBlock[];
  routines?: Routine[];
  checkIns?: RoutineCheckIn[];
  goals?: Goal[];
  milestones?: Milestone[];
  reflections?: Reflection[];
};

function createStore(seed: Seed = {}) {
  const repositories = {
    userProfiles: new MemoryRepository(seed.profiles, 'profile'),
    workspaces: new MemoryRepository(seed.workspaces, 'workspace'),
    appSettings: new MemoryRepository(seed.settings, 'settings'),
    tasks: new MemoryRepository(seed.tasks, 'task'),
    planBlocks: new MemoryRepository(seed.blocks, 'block'),
    routines: new MemoryRepository(seed.routines, 'routine'),
    routineCheckIns: new MemoryRepository(seed.checkIns, 'check-in'),
    goals: new MemoryRepository(seed.goals, 'goal'),
    milestones: new MemoryRepository(seed.milestones, 'milestone'),
    reflections: new MemoryRepository(seed.reflections, 'reflection'),
    planBlockSeries: new MemoryRepository([], 'series'),
    goalRoutineLinks: new MemoryRepository([], 'goal-routine'),
    areas: new MemoryRepository([], 'area'),
    tags: new MemoryRepository([], 'tag'),
    accountLinks: new MemoryRepository([], 'account-link'),
    localChanges: new MemoryRepository([], 'local-change'),
  };
  const scope = repositories as unknown as RepositoryScope;
  const allRepositories = Object.values(repositories) as MemoryRepository<EntityMetadata>[];
  const store = {
    ...scope,
    transaction: async <TResult>(
      operation: (value: RepositoryScope) => Promise<TResult>,
    ) => {
      const snapshots = allRepositories.map((repository) => repository.snapshot());
      try {
        return await operation(scope);
      } catch (error) {
        allRepositories.forEach((repository, index) =>
          repository.restore(snapshots[index]),
        );
        throw error;
      }
    },
  } as RepositoryStore;
  return { store, repositories };
}

function matchesFilter(
  entity: EntityMetadata,
  filter: Record<string, unknown> | undefined,
) {
  if (!filter) return true;
  const value = entity as unknown as Record<string, unknown>;
  for (const [key, expected] of Object.entries(filter)) {
    if (expected === undefined) continue;
    if (key === 'fromDate') {
      const date = String(value.date ?? value.periodStart ?? '');
      if (date < String(expected)) return false;
    } else if (key === 'toDate') {
      const date = String(value.date ?? value.periodStart ?? '');
      if (date > String(expected)) return false;
    } else if (value[key] !== expected) return false;
  }
  return true;
}

function metadata(id: string, changes: Partial<EntityMetadata> = {}): EntityMetadata {
  return {
    id,
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
    ...changes,
  };
}

function profile(id = 'profile-1', weekStartsOn: UserProfile['weekStartsOn'] = 1): UserProfile {
  return {
    ...metadata(id),
    displayName: null,
    locale: 'en',
    timeZone,
    weekStartsOn,
    accessibility: { reduceMotion: null, useBoldText: null, textScale: null },
  };
}

function workspace(id = 'workspace-1', profileId = 'profile-1'): Workspace {
  return {
    ...metadata(id),
    profileId,
    name: 'Personal',
    kind: 'personal',
    status: 'active',
  };
}

function settings(changes: Partial<AppSettings> = {}): AppSettings {
  return {
    ...metadata('settings-1'),
    profileId: 'profile-1',
    themePreference: 'system',
    defaultTab: 'today',
    planningDayStartsAt: toLocalTime('06:00'),
    languagePreference: 'system',
    dailyPlanningCapacityMinutes: 480,
    plannerView: 'day',
    insightsView: 'summary',
    insightsRange: '7d',
    onboardingVersion: 1,
    onboardingCompletedAt: instant,
    ...changes,
  };
}

function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: id,
    notes: null,
    status: 'pending',
    priority: 'none',
    dueDate: null,
    scheduledTime: null,
    timeZone,
    completedAt: null,
    areaId: null,
    goalId: null,
    parentTaskId: null,
    ...changes,
  };
}

function block(id: string, changes: Partial<PlanBlock> = {}): PlanBlock {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    date: toCalendarDate('2026-08-14'),
    startTime: toLocalTime('09:00'),
    endTime: toLocalTime('10:00'),
    timeZone,
    title: id,
    notes: null,
    status: 'planned',
    taskId: null,
    routineId: null,
    seriesId: null,
    occurrenceDate: null,
    isRecurrenceException: false,
    ...changes,
  };
}

function routine(id: string, changes: Partial<Routine> = {}): Routine {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: id,
    notes: null,
    schedule: { kind: 'daily', time: null },
    timeZone,
    status: 'active',
    ...changes,
  };
}

function checkIn(id: string, changes: Partial<RoutineCheckIn> = {}): RoutineCheckIn {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    routineId: 'routine-1',
    date: toCalendarDate('2026-08-14'),
    outcome: 'completed',
    recordedAt: instant,
    note: null,
    ...changes,
  };
}

function goal(id: string, changes: Partial<Goal> = {}): Goal {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    title: id,
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

function milestone(id: string, changes: Partial<Milestone> = {}): Milestone {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    goalId: 'goal-1',
    title: id,
    notes: null,
    status: 'pending',
    targetDate: null,
    completedAt: null,
    sortOrder: 1024,
    ...changes,
  };
}

function reflection(id: string, changes: Partial<Reflection> = {}): Reflection {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    scope: 'day',
    scopeId: null,
    periodStart: toCalendarDate('2026-08-14'),
    body: 'A local reflection',
    mood: null,
    ...changes,
  };
}

function emptyData(changes: Partial<InsightsData> = {}): InsightsData {
  return {
    tasks: [],
    blocks: [],
    routines: [],
    checkIns: [],
    goals: [],
    milestones: [],
    reflections: [],
    ...changes,
  };
}

test('range boundaries use exact equal calendar-day periods for every supported range', () => {
  const today = toCalendarDate('2026-08-14');
  assert.deepEqual(calculateInsightsRange(today, '7d', 1).current, {
    start: '2026-08-08',
    end: '2026-08-14',
    dayCount: 7,
    includesToday: true,
  });
  assert.deepEqual(calculateInsightsRange(today, '7d', 1).previous, {
    start: '2026-08-01',
    end: '2026-08-07',
    dayCount: 7,
    includesToday: false,
  });
  assert.equal(calculateInsightsRange(today, '4w', 0).current.dayCount, 28);
  assert.equal(calculateInsightsRange(today, '12w', 6).previous.dayCount, 84);
});

test('profile week starts and time-zone boundaries are normalized without slicing UTC dates', () => {
  assert.equal(normalizeWeeklyPeriod(toCalendarDate('2026-08-14'), 1), '2026-08-10');
  assert.equal(normalizeWeeklyPeriod(toCalendarDate('2026-08-14'), 0), '2026-08-09');
  assert.equal(
    localDateForTimestamp('2026-08-14T02:00:00.000Z', timeZone),
    '2026-08-13',
  );
  assert.equal(
    localDateForTimestamp(
      '2026-08-14T02:00:00.000Z',
      toTimeZone('Asia/Tokyo'),
    ),
    '2026-08-14',
  );
});

test('task aggregation separates completion events from current state and excludes deleted records', () => {
  const period = calculateInsightsRange(toCalendarDate('2026-08-14'), '7d', 1).current;
  const current = aggregatePeriod(
    emptyData({
      tasks: [
        task('done-high', {
          status: 'completed',
          priority: 'high',
          completedAt: toInstant('2026-08-14T02:00:00.000Z'),
        }),
        task('done-low', {
          status: 'completed',
          priority: 'low',
          completedAt: toInstant('2026-08-12T15:00:00.000Z'),
        }),
        task('overdue', {
          priority: 'high',
          dueDate: toCalendarDate('2026-08-10'),
        }),
        task('progress', {
          status: 'in_progress',
          dueDate: toCalendarDate('2026-08-16'),
        }),
        task('deleted', {
          status: 'completed',
          completedAt: instant,
          deletedAt: instant,
        }),
        task('cancelled', { status: 'cancelled' }),
      ],
    }),
    period,
    toCalendarDate('2026-08-14'),
    timeZone,
    1,
    480,
  );
  assert.equal(current.tasks.completed, 2);
  assert.equal(current.tasks.actionableRemaining, 2);
  assert.equal(current.tasks.completionNumerator, 2);
  assert.equal(current.tasks.completionDenominator, 3);
  assert.equal(current.tasks.overdue, 1);
  assert.equal(current.tasks.pending, 1);
  assert.equal(current.tasks.inProgress, 1);
  assert.deepEqual(
    current.tasks.completedByPriority.map((item) => [item.priority, item.count]),
    [['high', 1], ['medium', 0], ['low', 1], ['none', 0]],
  );
  assert.equal(
    current.tasks.completedByDay.find((item) => item.date === '2026-08-13')?.count,
    1,
  );
});

test('workload totals preserve Phase 5 durations and count overlaps and capacity transparently', () => {
  const period = calculateInsightsRange(toCalendarDate('2026-08-14'), '7d', 1).current;
  const signals = calculateWorkloadSignals(
    [
      block('first', { taskId: 'scheduled', endTime: toLocalTime('11:00') }),
      block('overlap', {
        startTime: toLocalTime('10:30'),
        endTime: toLocalTime('12:00'),
        status: 'completed',
      }),
      block('cancelled', { status: 'cancelled' }),
      block('deleted', { deletedAt: instant }),
    ],
    [task('scheduled'), task('unscheduled'), task('done', { status: 'completed' })],
    period,
    180,
    1,
  );
  assert.equal(signals.plannedMinutes, 210);
  assert.equal(signals.completedMinutes, 90);
  assert.equal(signals.plannedBlockCount, 2);
  assert.equal(signals.completedBlockCount, 1);
  assert.equal(signals.overCapacityDays, 1);
  assert.equal(signals.overlapCount, 1);
  assert.equal(signals.unscheduledActionableTasks, 1);
  assert.equal(signals.days.find((day) => day.date === '2026-08-14')?.plannedMinutes, 210);
  assert.equal(signals.weekdays.reduce((total, day) => total + day.plannedMinutes, 0), 210);
});

test('workload duration remains DST-aware', () => {
  const date = toCalendarDate('2026-11-01');
  const period = { start: date, end: date, dayCount: 1, includesToday: true };
  const signals = calculateWorkloadSignals(
    [
      block('dst', {
        date,
        startTime: toLocalTime('00:30'),
        endTime: toLocalTime('02:30'),
        timeZone: toTimeZone('America/New_York'),
      }),
    ],
    [],
    period,
    480,
    0,
  );
  assert.equal(signals.plannedMinutes, 180);
});

test('routine summaries count scheduled opportunities and explicit outcomes without punitive scoring', () => {
  const period = {
    start: toCalendarDate('2026-08-10'),
    end: toCalendarDate('2026-08-16'),
    dayCount: 7,
    includesToday: true,
  };
  const summary = calculateRoutineSummary(
    [
      routine('routine-1', {
        schedule: { kind: 'weekly', weekdays: [1, 3], time: null },
      }),
      routine('paused', { status: 'paused' }),
    ],
    [
      checkIn('completed', { date: toCalendarDate('2026-08-10') }),
      checkIn('skipped', {
        date: toCalendarDate('2026-08-12'),
        outcome: 'skipped',
      }),
      checkIn('deleted', {
        date: toCalendarDate('2026-08-12'),
        deletedAt: instant,
      }),
    ],
    period,
  );
  assert.deepEqual(
    {
      scheduled: summary.scheduled,
      completed: summary.completed,
      skipped: summary.skipped,
      pending: summary.pending,
    },
    { scheduled: 2, completed: 1, skipped: 1, pending: 0 },
  );
});

test('legacy missed routine records remain open rather than being relabeled as failure', () => {
  const date = toCalendarDate('2026-08-14');
  const summary = calculateRoutineSummary(
    [routine('routine-1')],
    [checkIn('missed', { outcome: 'missed' })],
    { start: date, end: date, dayCount: 1, includesToday: true },
  );
  assert.deepEqual(
    { completed: summary.completed, skipped: summary.skipped, pending: summary.pending },
    { completed: 0, skipped: 0, pending: 1 },
  );
});

test('goal context reuses selected progress rules and reports milestones tasks targets and reflections', () => {
  const period = calculateInsightsRange(toCalendarDate('2026-08-14'), '7d', 1).current;
  const goals = [
    goal('goal-1', {
      targetDate: toCalendarDate('2026-08-18'),
      nextActionTaskId: 'next',
    }),
    goal('manual', { progressMethod: 'manual', manualProgress: 45 }),
    goal('paused', { status: 'paused' }),
    goal('deleted-goal', { deletedAt: instant }),
  ];
  const summary = calculateGoalSummary(
    goals,
    [
      milestone('done', { status: 'completed', completedAt: instant }),
      milestone('open'),
      milestone('cancelled', { status: 'cancelled' }),
      milestone('deleted-parent-milestone', {
        goalId: 'deleted-goal',
        status: 'completed',
        completedAt: instant,
      }),
    ],
    [
      task('next', { goalId: 'goal-1' }),
      task('linked-done', {
        goalId: 'goal-1',
        status: 'completed',
        completedAt: instant,
      }),
      task('deleted-parent-task', {
        goalId: 'deleted-goal',
        status: 'completed',
        completedAt: instant,
      }),
    ],
    [
      reflection('goal-reflection', { scope: 'goal', scopeId: 'goal-1' }),
      reflection('deleted-goal-reflection', {
        scope: 'goal',
        scopeId: 'deleted-goal',
      }),
    ],
    period,
    toCalendarDate('2026-08-14'),
    timeZone,
  );
  assert.equal(summary.activeGoals, 2);
  assert.equal(summary.milestonesCompleted, 1);
  assert.equal(summary.linkedTasksCompleted, 1);
  assert.equal(summary.upcomingTargets, 1);
  assert.equal(summary.goalsWithoutNextAction, 1);
  assert.equal(summary.goalReflections, 1);
  assert.equal(summary.items.find((item) => item.goal.id === 'goal-1')?.progress.percentage, 50);
  assert.equal(summary.items.find((item) => item.goal.id === 'manual')?.progress.percentage, 45);
});

test('trend comparisons expose exact differences, minimum samples, and safe zero denominators', () => {
  assert.deepEqual(compareTrendValues('tasksCompleted', 4, 2, 6, 2), {
    metric: 'tasksCompleted',
    current: 4,
    previous: 2,
    difference: 2,
    percentage: 100,
    direction: 'more',
    minimumSample: 2,
    sample: 6,
  });
  assert.equal(compareTrendValues('tasksCompleted', 0, 0, 0, 2).direction, 'insufficient');
  assert.equal(compareTrendValues('tasksCompleted', 2, 0, 2, 2).percentage, null);
  assert.equal(compareTrendValues('tasksCompleted', 2, 2, 4, 2).direction, 'similar');
  assert.equal(compareTrendValues('tasksCompleted', 1, 3, 4, 2).direction, 'less');
});

test('explanations use stable factual ordering and a bounded display count', () => {
  const period = calculateInsightsRange(toCalendarDate('2026-08-14'), '7d', 1).current;
  const metrics = aggregatePeriod(
    emptyData({
      tasks: [task('high', { priority: 'high' })],
      blocks: [
        block('first', { endTime: toLocalTime('12:00') }),
        block('second', {
          startTime: toLocalTime('10:00'),
          endTime: toLocalTime('13:00'),
        }),
      ],
    }),
    period,
    toCalendarDate('2026-08-14'),
    timeZone,
    1,
    60,
  );
  const trends = [compareTrendValues('routineCheckIns', 4, 2, 6, 2)];
  const explanations = buildInsightExplanations(metrics, trends);
  assert.deepEqual(explanations.map((item) => item.id), [
    'overCapacity',
    'overlap',
    'highPriority',
    'routineMore',
  ]);
  assert.equal(explanations.length, MAX_INSIGHT_EXPLANATIONS);
  assert.deepEqual(
    buildInsightExplanations(emptyMetrics(), []).map((item) => item.id),
    ['insufficient'],
  );
});

test('aggregation paginates without truncation and remains workspace isolated', async () => {
  const tasks = Array.from({ length: 101 }, (_, index) => task(`task-${index}`));
  tasks.push(task('other-workspace', { workspaceId: 'workspace-2' }));
  tasks.push(task('deleted', { deletedAt: instant }));
  const { store, repositories } = createStore({ tasks });
  const data = await new InsightsAggregationService(store).load('workspace-1');
  assert.equal(data.tasks.length, 101);
  assert.equal(data.tasks.some((item) => item.workspaceId !== 'workspace-1'), false);
  assert.equal(data.tasks.some((item) => item.deletedAt !== null), false);
  assert.equal(repositories.tasks.listCalls, 2);
});

test('reflection validation trims only outer whitespace, normalizes weeks, and validates mood and length', () => {
  const valid = validateReflectionDraft(
    {
      scope: 'week',
      scopeId: null,
      periodStart: '2026-08-14',
      body: '  First line\n  second line  ',
      mood: 'steady',
    },
    1,
  );
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.value.periodStart, '2026-08-10');
    assert.equal(valid.value.body, 'First line\n  second line');
    assert.equal(valid.value.mood, 'steady');
  }
  assert.equal(
    validateReflectionDraft(
      { scope: 'day', scopeId: null, periodStart: '2026-08-14', body: ' ', mood: null },
      1,
    ).valid,
    false,
  );
  assert.equal(
    validateReflectionDraft(
      {
        scope: 'day',
        scopeId: null,
        periodStart: '2026-08-14',
        body: 'x'.repeat(MAX_REFLECTION_BODY_LENGTH + 1),
        mood: 'great',
      },
      1,
    ).valid,
    false,
  );
  assert.equal(
    validateReflectionDraft(
      {
        scope: 'day',
        scopeId: null,
        periodStart: 'invalid',
        body: 'Text',
        mood: 'unsupported' as Reflection['mood'],
      },
      1,
    ).valid,
    false,
  );
});

test('daily reflections create edit remove mood soft-delete and survive service recreation', async () => {
  const owner = profile();
  const { store } = createStore({ profiles: [owner], workspaces: [workspace()] });
  const service = new ReflectionService(store);
  const created = await service.create('workspace-1', owner, {
    scope: 'day',
    scopeId: null,
    periodStart: '2026-08-14',
    body: '  Kept locally  ',
    mood: 'good',
  });
  assert.equal(created.body, 'Kept locally');
  assert.equal(created.mood, 'good');
  assert.equal((await new ReflectionService(store).list('workspace-1'))[0].id, created.id);
  const updated = await service.update(created, owner, {
    scope: 'day',
    scopeId: null,
    periodStart: '2026-08-14',
    body: 'Updated locally',
    mood: null,
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.mood, null);
  await service.softDelete(updated);
  assert.deepEqual(await new ReflectionService(store).list('workspace-1'), []);
});

test('reflection identities prevent duplicate daily weekly and goal entries deterministically', async () => {
  const owner = profile();
  const parent = goal('goal-1');
  const { store } = createStore({
    profiles: [owner],
    workspaces: [workspace()],
    goals: [parent],
  });
  const service = new ReflectionService(store);
  await service.create('workspace-1', owner, {
    scope: 'day',
    scopeId: null,
    periodStart: '2026-08-14',
    body: 'Daily',
    mood: null,
  });
  await assert.rejects(
    () =>
      service.create('workspace-1', owner, {
        scope: 'day',
        scopeId: null,
        periodStart: '2026-08-14',
        body: 'Duplicate',
        mood: null,
      }),
    ReflectionValidationError,
  );
  await service.create('workspace-1', owner, {
    scope: 'week',
    scopeId: null,
    periodStart: '2026-08-13',
    body: 'Week',
    mood: null,
  });
  await assert.rejects(
    () =>
      service.create('workspace-1', owner, {
        scope: 'week',
        scopeId: null,
        periodStart: '2026-08-10',
        body: 'Same week',
        mood: null,
      }),
    ReflectionValidationError,
  );
  await service.create('workspace-1', owner, {
    scope: 'goal',
    scopeId: parent.id,
    periodStart: '2026-08-14',
    body: 'Goal',
    mood: 'great',
  });
  assert.equal((await service.list('workspace-1')).length, 3);
});

test('goal reflections reject foreign and deleted goals and inactive workspace ownership', async () => {
  const owner = profile();
  const { store } = createStore({
    profiles: [owner, profile('profile-2')],
    workspaces: [workspace(), workspace('workspace-2', 'profile-2')],
    goals: [
      goal('foreign', { workspaceId: 'workspace-2' }),
      goal('deleted', { deletedAt: instant }),
    ],
  });
  const service = new ReflectionService(store);
  for (const goalId of ['foreign', 'deleted']) {
    await assert.rejects(
      () =>
        service.create('workspace-1', owner, {
          scope: 'goal',
          scopeId: goalId,
          periodStart: '2026-08-14',
          body: 'Not allowed',
          mood: null,
        }),
      ReflectionValidationError,
    );
  }
  await assert.rejects(() =>
    service.create('workspace-2', owner, {
      scope: 'day',
      scopeId: null,
      periodStart: '2026-08-14',
      body: 'Wrong owner',
      mood: null,
    }),
  );
});

test('reflection updates surface revision conflicts and soft deletion preserves stored history safely', async () => {
  const owner = profile();
  const original = reflection('reflection-1');
  const { store, repositories } = createStore({
    profiles: [owner],
    workspaces: [workspace()],
    reflections: [original],
  });
  await repositories.reflections.update(original.id, {
    expectedRevision: 1,
    body: 'Changed elsewhere',
  });
  await assert.rejects(
    () =>
      new ReflectionService(store).update(original, owner, {
        scope: 'day',
        scopeId: null,
        periodStart: '2026-08-14',
        body: 'Stale edit',
        mood: null,
      }),
    (error: unknown) =>
      error instanceof StorageError && error.code === 'REVISION_CONFLICT',
  );
  const current = await repositories.reflections.getById(original.id);
  const removed = await new ReflectionService(store).softDelete(current as Reflection);
  assert.equal(await repositories.reflections.getById(original.id), null);
  assert.equal(
    (await repositories.reflections.getById(original.id, true))?.revision,
    removed.revision,
  );
});

test('reflection history ordering is stable and safely collapses legacy duplicates', () => {
  const reflections = [
    reflection('b', { updatedAt: toInstant('2026-08-14T12:30:00.000Z') }),
    reflection('a'),
    reflection('older', { periodStart: toCalendarDate('2026-08-13') }),
    reflection('deleted', { deletedAt: instant }),
  ];
  assert.deepEqual(organizeReflections(reflections).map((item) => item.id), [
    'b',
    'older',
  ]);
});

test('Insights view and range preferences map and persist revision-safely across service recreation', async () => {
  const original = settings();
  const { store } = createStore({ settings: [original] });
  const service = new PlanningPreferencesService(store);
  const updated = await service.setInsightsPreferences(original, 'reflections', '12w');
  const restored = await new PlanningPreferencesService(store).get('profile-1');
  assert.equal(updated.revision, 2);
  assert.equal(restored?.insightsView, 'reflections');
  assert.equal(restored?.insightsRange, '12w');
  assert.deepEqual(appSettingsMapper.fromRow(appSettingsMapper.toRow(updated)), updated);
});

test('reflection mapping includes scope identifiers and every persisted local field', () => {
  const value = reflection('mapped', {
    scope: 'goal',
    scopeId: 'goal-1',
    mood: 'great',
  });
  assert.deepEqual(reflectionMapper.fromRow(reflectionMapper.toRow(value)), value);
  assert.deepEqual(reflectionMapper.buildFilters({ scopeId: 'goal-1' }), [
    { sql: 'scope_id = ?', parameters: ['goal-1'] },
  ]);
});

test('migration 6 is additive indexed seed-free and defaults existing settings safely', async () => {
  const statements: string[] = [];
  await insightsReflectionsMigration.migrate({
    executeStatic: async (sql) => {
      statements.push(sql);
    },
    run: async () => ({ changes: 1, lastInsertRowId: 0 }),
    first: async () => null,
    all: async () => [],
  });
  const sql = statements.join('\n');
  assert.equal(insightsReflectionsMigration.version, 6);
  assert.equal(insightsReflectionsMigration.name, 'insights_reflections');
  assert.equal(migrations.at(-1)?.version, 6);
  assert.match(sql, /insights_view TEXT NOT NULL DEFAULT 'summary'/);
  assert.match(sql, /insights_range TEXT NOT NULL DEFAULT '7d'/);
  assert.match(sql, /reflections_workspace_scope_period_idx/);
  assert.match(sql, /reflections_workspace_scope_id_idx/);
  assert.doesNotMatch(
    sql,
    /DROP TABLE|DELETE FROM|INSERT INTO|UPDATE\s+\w+\s+SET|CREATE TABLE/i,
  );
});

test('all five Phase 7 catalogs match placeholders Unicode direction and Hermes-safe formatting', () => {
  assert.deepEqual(validateTranslationCatalogs(), []);
  assert.deepEqual(Object.keys(translationCatalogs), supportedLanguages);
  for (const language of supportedLanguages) {
    assert.equal(translationCatalogs[language].insights.heading.length > 0, true);
    assert.equal(translationCatalogs[language].reflections.questionImportant.length > 0, true);
  }
  assert.match(translationCatalogs.am.reflections.questionImportant, /[\u1200-\u137F]/u);
  assert.match(translationCatalogs.ar.insights.heading, /[\u0600-\u06FF]/u);
  assert.equal(directionForLanguage('ar'), 'rtl');
  assert.equal(directionForLanguage('am'), 'ltr');
  assert.equal(formatLocalizedList(['A', 'B'], 'en'), 'A and B');
  assert.doesNotThrow(() => formatPercentageValue(67, 'ar'));
});

function emptyMetrics(): PeriodMetrics {
  return {
    tasks: {
      completed: 0,
      actionableRemaining: 0,
      completionNumerator: 0,
      completionDenominator: 0,
      overdue: 0,
      pending: 0,
      inProgress: 0,
      highPriorityRemaining: 0,
      connectedToActiveGoals: 0,
      completedByDay: [],
      completedByPriority: [],
    },
    workload: {
      days: [],
      plannedMinutes: 0,
      completedMinutes: 0,
      overCapacityDays: 0,
      overlapCount: 0,
      plannedBlockCount: 0,
      completedBlockCount: 0,
      unscheduledActionableTasks: 0,
      weekdays: [],
    },
    routines: {
      scheduled: 0,
      completed: 0,
      skipped: 0,
      pending: 0,
      items: [],
    },
    goals: {
      activeGoals: 0,
      milestonesCompleted: 0,
      linkedTasksCompleted: 0,
      upcomingTargets: 0,
      goalsWithoutNextAction: 0,
      goalReflections: 0,
      items: [],
    },
    reflectionCount: 0,
  };
}
