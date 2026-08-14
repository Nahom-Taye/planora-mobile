import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
  type EntityMetadata,
  type AppSettings,
  type Routine,
  type RoutineCheckIn,
  type Task,
  type UserProfile,
  type Workspace,
} from '../src/domain/entities/index.ts';
import type {
  CreateEntityInput,
  ListOptions,
  RepositoryScope,
  RepositoryStore,
  UpdateEntityInput,
} from '../src/domain/repositories/contracts.ts';
import { resolveOpeningDestination } from '../src/features/auth/services/app-entry.ts';
import { validateAuthConfiguration } from '../src/features/auth/services/auth-configuration.ts';
import {
  initialAuthState,
  reduceAuthState,
} from '../src/features/auth/services/auth-state.ts';
import { canAccessRoute } from '../src/features/auth/services/route-access.ts';
import {
  RoutineService,
  isRoutineScheduled,
} from '../src/features/routines/services/routine-service.ts';
import { groupRoutines } from '../src/features/routines/services/routine-organization.ts';
import { validateRoutineDraft } from '../src/features/routines/services/routine-validation.ts';
import { TaskService } from '../src/features/tasks/services/task-service.ts';
import { groupTasks } from '../src/features/tasks/services/task-organization.ts';
import { validateTaskDraft } from '../src/features/tasks/services/task-validation.ts';
import {
  localCalendarDate,
  weekdayForDate,
} from '../src/features/today/services/local-date.ts';
import {
  buildTodayPlan,
  compareTasks,
} from '../src/features/today/services/today-planning.ts';
import { WorkspaceService } from '../src/features/workspace/services/workspace-service.ts';

const now = new Date('2026-08-04T12:00:00.000Z');
const instant = toInstant(now);
const timeZone = toTimeZone('America/Asuncion');

class MemoryRepository<TEntity extends EntityMetadata> {
  private nextId = 1;

  constructor(readonly records: TEntity[] = []) {}

  async getById(id: string, includeDeleted = false) {
    return (
      this.records.find(
        (record) => record.id === id && (includeDeleted || !record.deletedAt),
      ) ?? null
    );
  }

  async list(options?: ListOptions<Record<string, unknown>>) {
    const filter = options?.filter ?? {};
    const offset = options?.page?.offset ?? 0;
    const limit = options?.page?.limit ?? 50;
    const matching = this.records.filter((record) => {
      if (!options?.includeDeleted && record.deletedAt) return false;
      const values = record as TEntity & Record<string, unknown>;
      return Object.entries(filter).every(([key, value]) => {
        if (value === undefined) return true;
        if (key === 'fromDate') return String(values.date) >= String(value);
        if (key === 'toDate') return String(values.date) <= String(value);
        return values[key] === value;
      });
    });
    const items = matching.slice(offset, offset + limit);
    return {
      items,
      nextOffset: offset + limit < matching.length ? offset + limit : null,
    };
  }

  async create(input: CreateEntityInput<TEntity>) {
    const created = {
      ...input,
      id: input.id ?? `memory-${this.nextId++}`,
      createdAt: instant,
      updatedAt: instant,
      revision: 1,
      deletedAt: null,
    } as TEntity;
    this.records.push(created);
    return created;
  }

  async update(id: string, input: UpdateEntityInput<TEntity>) {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) throw new Error('missing');
    const existing = this.records[index];
    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== existing.revision
    ) {
      throw new Error('revision_conflict');
    }
    const { expectedRevision, ...changes } = input;
    const updated = {
      ...existing,
      ...changes,
      updatedAt: instant,
      revision: existing.revision + 1,
    } as TEntity;
    this.records[index] = updated;
    return updated;
  }

  async softDelete(id: string, expectedRevision?: number) {
    return this.update(id, {
      expectedRevision,
      deletedAt: instant,
    } as unknown as UpdateEntityInput<TEntity>);
  }
}

function createStore(seed: {
  profiles?: UserProfile[];
  workspaces?: Workspace[];
  tasks?: Task[];
  routines?: Routine[];
  checkIns?: RoutineCheckIn[];
  settings?: AppSettings[];
} = {}) {
  const repositories = {
    userProfiles: new MemoryRepository(seed.profiles),
    workspaces: new MemoryRepository(seed.workspaces),
    tasks: new MemoryRepository(seed.tasks),
    routines: new MemoryRepository(seed.routines),
    routineCheckIns: new MemoryRepository(seed.checkIns),
    appSettings: new MemoryRepository(seed.settings ?? [
      {
        id: 'settings-1',
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
        createdAt: instant,
        updatedAt: instant,
        revision: 1,
        deletedAt: null,
      },
    ]),
  };
  const store = {
    ...repositories,
    transaction: async <TResult>(
      operation: (scope: RepositoryScope) => Promise<TResult>,
    ) => operation(store as unknown as RepositoryScope),
  } as unknown as RepositoryStore;
  return { store, repositories };
}

function profile(id = 'profile-1'): UserProfile {
  return {
    id,
    displayName: null,
    locale: 'en-US',
    timeZone,
    weekStartsOn: 1,
    accessibility: {
      reduceMotion: null,
      useBoldText: null,
      textScale: null,
    },
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
  };
}

function workspace(
  id = 'workspace-1',
  status: Workspace['status'] = 'active',
  profileId = 'profile-1',
): Workspace {
  return {
    id,
    profileId,
    name: 'Personal',
    kind: 'personal',
    status,
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
  };
}

function settings(id: string, profileId: string): AppSettings {
  return {
    id,
    profileId,
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
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
  };
}

function task(id: string, changes: Partial<Task> = {}): Task {
  return {
    id,
    workspaceId: 'workspace-1',
    title: id,
    notes: null,
    status: 'pending',
    priority: 'none',
    dueDate: toCalendarDate('2026-08-04'),
    scheduledTime: null,
    timeZone,
    completedAt: null,
    areaId: null,
    goalId: null,
    parentTaskId: null,
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
    ...changes,
  };
}

function routine(id: string, changes: Partial<Routine> = {}): Routine {
  return {
    id,
    workspaceId: 'workspace-1',
    title: id,
    notes: null,
    schedule: { kind: 'daily', time: null },
    timeZone,
    status: 'active',
    createdAt: instant,
    updatedAt: instant,
    revision: 1,
    deletedAt: null,
    ...changes,
  };
}

test('personal workspace creation is idempotent and repairs duplicates', async () => {
  const first = workspace('workspace-a');
  const second = { ...workspace('workspace-b'), createdAt: toInstant('2026-08-04T13:00:00Z') };
  const { store, repositories } = createStore({ profiles: [profile()], workspaces: [first, second] });
  const service = new WorkspaceService(store);

  const initial = await service.ensurePersonalWorkspace();
  const repeated = await service.ensurePersonalWorkspace();
  assert.equal(initial.workspace.id, 'workspace-a');
  assert.equal(repeated.workspace.id, 'workspace-a');
  assert.equal(repositories.workspaces.records.filter((item) => item.status === 'active').length, 1);
});

test('workspace initialization covers every completed local profile', async () => {
  const firstSettings = settings('settings-1', 'profile-1');
  const secondSettings = {
    ...settings('settings-2', 'profile-2'),
    updatedAt: toInstant('2026-08-04T11:00:00.000Z'),
  };
  const { store, repositories } = createStore({
    profiles: [profile('profile-1'), profile('profile-2')],
    settings: [firstSettings, secondSettings],
  });
  const service = new WorkspaceService(store);

  assert.equal((await service.ensurePersonalWorkspace()).profile.id, 'profile-1');
  await service.ensurePersonalWorkspace();
  assert.equal(
    repositories.workspaces.records.filter(
      (item) => item.profileId === 'profile-1' && item.status === 'active',
    ).length,
    1,
  );
  assert.equal(
    repositories.workspaces.records.filter(
      (item) => item.profileId === 'profile-2' && item.status === 'active',
    ).length,
    1,
  );
});

test('quick capture and task state transitions persist with revisions', async () => {
  const { store } = createStore({ profiles: [profile()], workspaces: [workspace()] });
  const service = new TaskService(store, () => now);
  const today = toCalendarDate('2026-08-04');
  const captured = await service.quickCapture('workspace-1', '  Set priorities  ', today, timeZone);
  assert.equal(captured.title, 'Set priorities');
  assert.equal(captured.dueDate, today);
  await assert.rejects(() => service.quickCapture('workspace-1', ' ', today, timeZone));

  const edited = await service.update(captured, {
    title: 'Set calm priorities',
    notes: 'Start with one item.',
    priority: 'high',
    status: 'in_progress',
    dueDate: '',
    scheduledTime: '',
  }, timeZone);
  assert.equal(edited.revision, 2);
  assert.equal(edited.dueDate, null);
  await assert.rejects(() => service.complete(captured));
  const completed = await service.complete(edited);
  assert.equal(completed.status, 'completed');
  const reopened = await service.reopen(completed);
  assert.equal(reopened.completedAt, null);
  const cancelled = await service.cancel(reopened);
  assert.equal(cancelled.status, 'cancelled');
  const removed = await service.softDelete(cancelled);
  assert.ok(removed.deletedAt);
});

test('expanded task validation requires a date for scheduled time', async () => {
  const { store } = createStore();
  const service = new TaskService(store, () => now);
  await assert.rejects(() =>
    service.create(
      'workspace-1',
      {
        title: 'Prepare notes',
        notes: '',
        priority: 'medium',
        status: 'pending',
        dueDate: '',
        scheduledTime: '09:00',
      },
      timeZone,
    ),
  );
});

test('task validation trims text and rejects malformed fields', () => {
  assert.equal(
    validateTaskDraft({
      title: '   ',
      notes: '',
      priority: 'none',
      status: 'pending',
      dueDate: '',
      scheduledTime: '',
    }).valid,
    false,
  );
  assert.equal(
    validateTaskDraft({
      title: 'Plan tomorrow',
      notes: 'x'.repeat(4001),
      priority: 'low',
      status: 'in_progress',
      dueDate: '2026-02-30',
      scheduledTime: '24:00',
    }).valid,
    false,
  );
  assert.deepEqual(
    validateTaskDraft({
      title: '  Plan tomorrow  ',
      notes: '  Keep it small.  ',
      priority: 'medium',
      status: 'pending',
      dueDate: '2026-08-05',
      scheduledTime: '09:15',
    }),
    {
      valid: true,
      value: {
        title: 'Plan tomorrow',
        notes: 'Keep it small.',
        priority: 'medium',
        status: 'pending',
        dueDate: '2026-08-05',
        scheduledTime: '09:15',
      },
    },
  );
});

test('today grouping excludes completed and cancelled tasks from overdue', () => {
  const today = toCalendarDate('2026-08-04');
  const tasks = [
    task('low', { priority: 'low' }),
    task('high', { priority: 'high' }),
    task('overdue', { dueDate: toCalendarDate('2026-08-03') }),
    task('done-overdue', { dueDate: toCalendarDate('2026-08-03'), status: 'completed', completedAt: instant }),
    task('cancelled-overdue', { dueDate: toCalendarDate('2026-08-03'), status: 'cancelled' }),
    task('inbox', { dueDate: null, timeZone: null }),
    task('done-today', { status: 'completed', completedAt: instant }),
  ];
  const plan = buildTodayPlan(tasks, [], [], today, timeZone);
  assert.deepEqual(plan.overdue.map((item) => item.id), ['overdue']);
  assert.deepEqual(plan.today.map((item) => item.id), ['high', 'low']);
  assert.deepEqual(plan.unscheduled.map((item) => item.id), ['inbox']);
  assert.deepEqual(plan.completed.map((item) => item.id), [
    'done-overdue',
    'done-today',
    'cancelled-overdue',
  ]);
});

test('task ordering is stable across status priority time and identifier', () => {
  const ordered = [
    task('b', { priority: 'high' }),
    task('a', { priority: 'high' }),
    task('timed', { priority: 'medium', scheduledTime: '08:00' as never }),
    task('progress', { status: 'in_progress', priority: 'none' }),
  ].sort(compareTasks);
  assert.deepEqual(ordered.map((item) => item.id), ['progress', 'a', 'b', 'timed']);
});

test('all-task grouping keeps upcoming and inactive records reachable', () => {
  const today = toCalendarDate('2026-08-04');
  const groups = groupTasks(
    [
      task('overdue', { dueDate: toCalendarDate('2026-08-03') }),
      task('today'),
      task('upcoming', { dueDate: toCalendarDate('2026-08-05') }),
      task('unscheduled', { dueDate: null, timeZone: null }),
      task('complete', { status: 'completed', completedAt: instant }),
      task('cancelled', { status: 'cancelled' }),
    ],
    today,
  );
  assert.deepEqual(groups.overdue.map((item) => item.id), ['overdue']);
  assert.deepEqual(groups.today.map((item) => item.id), ['today']);
  assert.deepEqual(groups.upcoming.map((item) => item.id), ['upcoming']);
  assert.deepEqual(groups.unscheduled.map((item) => item.id), ['unscheduled']);
  assert.deepEqual(groups.completed.map((item) => item.id), ['complete']);
  assert.deepEqual(groups.cancelled.map((item) => item.id), ['cancelled']);
});

test('calendar boundaries and weekdays use local date semantics', () => {
  assert.equal(
    localCalendarDate(new Date('2026-01-01T01:30:00.000Z'), timeZone),
    '2025-12-31',
  );
  assert.equal(
    localCalendarDate(
      new Date('2026-08-04T10:30:00.000Z'),
      toTimeZone('Pacific/Kiritimati'),
    ),
    '2026-08-05',
  );
  assert.equal(
    localCalendarDate(
      new Date('2026-08-04T01:30:00.000Z'),
      toTimeZone('America/Los_Angeles'),
    ),
    '2026-08-03',
  );
  assert.equal(weekdayForDate(toCalendarDate('2026-08-03')), 1);
});

test('daily and weekly routine evaluation and check-ins are deterministic', async () => {
  const weekly = routine('weekly', {
    schedule: { kind: 'weekly', weekdays: [1, 3], time: null },
  });
  const paused = routine('paused', { status: 'paused' });
  assert.equal(isRoutineScheduled(weekly, toCalendarDate('2026-08-03')), true);
  assert.equal(isRoutineScheduled(weekly, toCalendarDate('2026-08-04')), false);
  assert.equal(isRoutineScheduled(paused, toCalendarDate('2026-08-04')), false);

  const { store, repositories } = createStore({ routines: [weekly] });
  const service = new RoutineService(store, () => now);
  const date = toCalendarDate('2026-08-03');
  const completed = await service.checkIn(weekly, date, 'completed');
  const corrected = await service.checkIn(weekly, date, 'skipped');
  assert.equal(completed.id, corrected.id);
  assert.equal(repositories.routineCheckIns.records.length, 1);
  assert.equal(corrected.outcome, 'skipped');
  await service.undoCheckIn(weekly.id, date);
  assert.equal((await service.listCheckIns('workspace-1', date)).length, 0);
  const replacement = await service.checkIn(weekly, date, 'completed');
  assert.notEqual(replacement.id, completed.id);
  assert.equal((await service.listCheckIns('workspace-1', date)).length, 1);
});

test('routine creation and editing preserve schedule and local time zone', async () => {
  const { store } = createStore();
  const service = new RoutineService(store, () => now);
  const created = await service.create(
    'workspace-1',
    {
      title: '  Morning reset ',
      notes: '',
      scheduleKind: 'weekly',
      weekdays: [5, 1, 1],
      time: '07:30',
      status: 'active',
    },
    timeZone,
  );
  assert.deepEqual(
    created.schedule.kind === 'weekly' ? created.schedule.weekdays : [],
    [1, 5],
  );
  const edited = await service.update(
    created,
    {
      title: 'Morning reset',
      notes: 'Pause and prepare.',
      scheduleKind: 'daily',
      weekdays: [],
      time: '',
      status: 'paused',
    },
    timeZone,
  );
  assert.deepEqual(edited.schedule, { kind: 'daily', time: null });
  assert.equal(edited.status, 'paused');
  assert.equal(edited.timeZone, timeZone);
});

test('routine validation and state grouping remain deterministic', () => {
  assert.equal(
    validateRoutineDraft({
      title: 'Weekly reset',
      notes: '',
      scheduleKind: 'weekly',
      weekdays: [],
      time: '',
      status: 'active',
    }).valid,
    false,
  );
  assert.equal(
    validateRoutineDraft({
      title: 'Daily reset',
      notes: '',
      scheduleKind: 'daily',
      weekdays: [],
      time: '25:00',
      status: 'active',
    }).valid,
    false,
  );
  const groups = groupRoutines([
    routine('archived', { status: 'archived' }),
    routine('active'),
    routine('paused', { status: 'paused' }),
  ]);
  assert.deepEqual(groups.active.map((item) => item.id), ['active']);
  assert.deepEqual(groups.paused.map((item) => item.id), ['paused']);
  assert.deepEqual(groups.archived.map((item) => item.id), ['archived']);
});

test('local records survive service recreation and stay workspace isolated', async () => {
  const { store } = createStore();
  const service = new TaskService(store, () => now);
  await service.quickCapture('workspace-1', 'First workspace', toCalendarDate('2026-08-04'), timeZone);
  await service.quickCapture('workspace-2', 'Second workspace', toCalendarDate('2026-08-04'), timeZone);
  const restarted = new TaskService(store, () => now);
  assert.deepEqual((await restarted.list('workspace-1')).map((item) => item.title), ['First workspace']);
  assert.deepEqual((await restarted.list('workspace-2')).map((item) => item.title), ['Second workspace']);
});

test('authentication-first opening decisions preserve local choice', () => {
  assert.equal(resolveOpeningDestination({ accountStatus: 'restoring', hasSession: false, continuedLocally: false, onboardingComplete: true }), 'loading');
  assert.equal(resolveOpeningDestination({ accountStatus: 'signed_out', hasSession: false, continuedLocally: false, onboardingComplete: true }), 'account_entry');
  assert.equal(resolveOpeningDestination({ accountStatus: 'local_only', hasSession: false, continuedLocally: true, onboardingComplete: false }), 'onboarding');
  assert.equal(resolveOpeningDestination({ accountStatus: 'signed_in', hasSession: true, continuedLocally: false, onboardingComplete: true }), 'tabs');
  assert.equal(canAccessRoute('tabs', true, 'signed_out', true), true);
  assert.equal(canAccessRoute('auth', true, 'signed_out', true), false);
  assert.equal(canAccessRoute('auth', true, 'signed_out'), true);
});

test('saved-session restoration and sign-out return deterministic destinations', () => {
  const session = {
    accountId: 'account-1',
    email: 'person@example.test',
    emailVerified: true,
  };
  const restored = reduceAuthState(initialAuthState, {
    type: 'restored',
    session,
  });
  assert.equal(
    resolveOpeningDestination({
      accountStatus: restored.status,
      hasSession: Boolean(restored.session),
      continuedLocally: false,
      onboardingComplete: true,
    }),
    'tabs',
  );
  const signedOut = reduceAuthState(restored, {
    type: 'changed',
    change: { event: 'signed_out', session: null },
  });
  assert.equal(
    resolveOpeningDestination({
      accountStatus: signedOut.status,
      hasSession: Boolean(signedOut.session),
      continuedLocally: false,
      onboardingComplete: true,
    }),
    'account_entry',
  );
});

test('Continue locally is process-only and missing account configuration stays safe', () => {
  assert.equal(
    resolveOpeningDestination({
      accountStatus: 'signed_out',
      hasSession: false,
      continuedLocally: true,
      onboardingComplete: true,
    }),
    'tabs',
  );
  assert.equal(
    resolveOpeningDestination({
      accountStatus: 'signed_out',
      hasSession: false,
      continuedLocally: false,
      onboardingComplete: true,
    }),
    'account_entry',
  );
  assert.equal(validateAuthConfiguration({}).status, 'unavailable');
  assert.equal(
    validateAuthConfiguration({
      EXPO_PUBLIC_SUPABASE_URL: 'https://your-project-ref.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'your-publishable-key',
    }).status,
    'unavailable',
  );
});
