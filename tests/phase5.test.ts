import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
  type AppSettings,
  type EntityMetadata,
  type PlanBlock,
  type PlanBlockSeries,
  type Routine,
  type Task,
} from '../src/domain/entities/index.ts';
import type {
  CreateEntityInput,
  ListOptions,
  RepositoryScope,
  RepositoryStore,
  UpdateEntityInput,
} from '../src/domain/repositories/contracts.ts';
import {
  validateTranslationCatalogs,
} from '../src/features/localization/catalog-validation.ts';
import {
  createTranslator,
  directionForLanguage,
  formatCalendarDateValue,
  formatDurationValue,
  formatLocalizedList,
  resolveLanguage,
  supportedLanguages,
  translationCatalogs,
} from '../src/features/localization/localization.ts';
import {
  calculateCapacity,
  detectOverlaps,
} from '../src/features/planner/services/capacity.ts';
import {
  calendarWeek,
  durationMinutes,
  localDateTimeInstant,
  startOfLocalWeek,
} from '../src/features/planner/services/calendar-math.ts';
import {
  PlanBlockService,
  PlanBlockValidationError,
} from '../src/features/planner/services/plan-block-service.ts';
import { validatePlanBlockDraft } from '../src/features/planner/services/plan-block-validation.ts';
import {
  blocksForDate,
  weekSummaries,
} from '../src/features/planner/services/planner-organization.ts';
import {
  RECURRENCE_WINDOW_DAYS,
  RecurrenceService,
  recurrenceDates,
} from '../src/features/planner/services/recurrence.ts';
import { formatRoutineScheduleLabel } from '../src/features/routines/services/routine-organization.ts';
import { PlanningPreferencesService } from '../src/features/settings/services/planning-preferences-service.ts';
import { plannerLocalizationMigration } from '../src/storage/database/migrations/004-planner-localization.ts';
import { StorageError } from '../src/storage/database/errors.ts';
import {
  appSettingsMapper,
  planBlockMapper,
  planBlockSeriesMapper,
} from '../src/storage/mappers/entity-mappers.ts';

const instant = toInstant('2026-08-09T12:00:00.000Z');
const timeZone = toTimeZone('America/Asuncion');

function withUnavailableListFormat<T>(check: () => T) {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'ListFormat');
  Object.defineProperty(Intl, 'ListFormat', {
    configurable: true,
    value: undefined,
    writable: true,
  });
  try {
    return check();
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'ListFormat', descriptor);
    else Reflect.deleteProperty(Intl, 'ListFormat');
  }
}

class MemoryRepository<TEntity extends EntityMetadata> {
  nextId = 1;

  constructor(readonly records: TEntity[] = []) {}

  async getById(id: string, includeDeleted = false) {
    return this.records.find((record) => record.id === id && (includeDeleted || !record.deletedAt)) ?? null;
  }

  async list(options?: ListOptions<Record<string, unknown>>) {
    const filter = options?.filter ?? {};
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
    const offset = options?.page?.offset ?? 0;
    const limit = options?.page?.limit ?? 50;
    return {
      items: matching.slice(offset, offset + limit),
      nextOffset: offset + limit < matching.length ? offset + limit : null,
    };
  }

  async create(input: CreateEntityInput<TEntity>) {
    const seriesOccurrence = input as Record<string, unknown>;
    if (
      seriesOccurrence.seriesId &&
      seriesOccurrence.occurrenceDate &&
      this.records.some((record) => {
        const value = record as TEntity & Record<string, unknown>;
        return value.seriesId === seriesOccurrence.seriesId && value.occurrenceDate === seriesOccurrence.occurrenceDate;
      })
    ) {
      throw new StorageError('WRITE_FAILED', 'duplicate occurrence', true);
    }
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
    if (index < 0) throw new StorageError('NOT_FOUND', 'missing', false);
    const existing = this.records[index];
    if (input.expectedRevision !== undefined && input.expectedRevision !== existing.revision) {
      throw new StorageError('REVISION_CONFLICT', 'changed', true);
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
  blocks?: PlanBlock[];
  series?: PlanBlockSeries[];
  tasks?: Task[];
  routines?: Routine[];
  settings?: AppSettings[];
} = {}) {
  const repositories = {
    planBlocks: new MemoryRepository(seed.blocks),
    planBlockSeries: new MemoryRepository(seed.series),
    tasks: new MemoryRepository(seed.tasks),
    routines: new MemoryRepository(seed.routines),
    appSettings: new MemoryRepository(seed.settings),
  };
  const empty = new MemoryRepository<EntityMetadata>();
  const scope = {
    ...repositories,
    userProfiles: empty,
    workspaces: empty,
    routineCheckIns: empty,
    goals: empty,
    milestones: empty,
    areas: empty,
    tags: empty,
    reflections: empty,
    accountLinks: empty,
    localChanges: empty,
  } as unknown as RepositoryScope;
  const store = {
    ...scope,
    transaction: async <TResult>(operation: (value: RepositoryScope) => Promise<TResult>) => {
      const snapshots = Object.values(repositories).map((repository) => structuredClone(repository.records));
      try {
        return await operation(scope);
      } catch (error) {
        Object.values(repositories).forEach((repository, index) => {
          repository.records.splice(0, repository.records.length, ...snapshots[index] as never[]);
        });
        throw error;
      }
    },
  } as RepositoryStore;
  return { store, repositories };
}

function metadata(id: string) {
  return { id, createdAt: instant, updatedAt: instant, revision: 1, deletedAt: null };
}

function task(id = 'task-1', workspaceId = 'workspace-1'): Task {
  return {
    ...metadata(id),
    workspaceId,
    title: 'Prepare outline',
    notes: 'Keep task content intact',
    status: 'pending',
    priority: 'high',
    dueDate: toCalendarDate('2026-08-12'),
    scheduledTime: null,
    timeZone,
    completedAt: null,
    areaId: null,
    goalId: null,
    parentTaskId: null,
  };
}

function block(
  id: string,
  startTime: string,
  endTime: string,
  changes: Partial<PlanBlock> = {},
): PlanBlock {
  return {
    ...metadata(id),
    workspaceId: 'workspace-1',
    date: toCalendarDate('2026-08-09'),
    startTime: toLocalTime(startTime),
    endTime: toLocalTime(endTime),
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

function recurrenceDraft() {
  return {
    title: 'Focus block',
    notes: 'Protected local work',
    startDate: '2026-08-09',
    startTime: '09:00',
    endTime: '10:00',
    frequency: 'daily' as const,
    interval: 1,
    weekdays: [],
    endDate: '',
    taskId: null,
    routineId: null,
  };
}

test('plan-block validation trims values and rejects invalid, zero-length, and nonexistent local times', () => {
  const valid = validatePlanBlockDraft({
    title: '  Deep work  ', notes: '  Notes  ', date: '2026-08-09', startTime: '09:00', endTime: '10:15', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  assert.equal(valid.valid && valid.value.title, 'Deep work');
  assert.equal(valid.valid && valid.value.notes, 'Notes');
  const zero = validatePlanBlockDraft({
    title: 'Block', notes: '', date: '2026-08-09', startTime: '09:00', endTime: '09:00', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  assert.equal(zero.valid, false);
  const missing = validatePlanBlockDraft({
    title: 'Block', notes: '', date: '2026-03-08', startTime: '02:30', endTime: '03:30', status: 'planned', taskId: null, routineId: null,
  }, toTimeZone('America/New_York'));
  assert.equal(missing.valid, false);
});

test('plan-block CRUD is revision-safe and soft deletion preserves the row', async () => {
  const { store, repositories } = createStore();
  const service = new PlanBlockService(store);
  const created = await service.create('workspace-1', {
    title: '  First block ', notes: '', date: '2026-08-09', startTime: '08:00', endTime: '09:00', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  const updated = await service.update(created, {
    title: 'Moved block', notes: 'Retained', date: '2026-08-10', startTime: '10:00', endTime: '11:30', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  assert.equal(updated.date, '2026-08-10');
  await assert.rejects(() => service.complete(created), (error: unknown) => error instanceof StorageError && error.code === 'REVISION_CONFLICT');
  const completed = await service.complete(updated);
  const reopened = await service.reopen(completed);
  const cancelled = await service.cancel(reopened);
  assert.equal(cancelled.status, 'cancelled');
  await service.softDelete(cancelled);
  assert.equal(await repositories.planBlocks.getById(created.id), null);
  assert.ok((await repositories.planBlocks.getById(created.id, true))?.deletedAt);
});

test('task scheduling preserves task deadlines and rejects cross-workspace or inactive links', async () => {
  const linked = task();
  const completedTask = { ...task('task-2'), status: 'completed' as const };
  const foreign = task('task-3', 'workspace-2');
  const { store } = createStore({ tasks: [linked, completedTask, foreign] });
  const service = new PlanBlockService(store);
  const scheduled = await service.scheduleTask('workspace-1', linked, {
    date: '2026-08-09', startTime: '13:00', endTime: '14:00', status: 'planned', title: '', notes: '',
  }, timeZone);
  assert.equal(scheduled.taskId, linked.id);
  assert.equal(linked.dueDate, '2026-08-12');
  assert.equal(linked.status, 'pending');
  await assert.rejects(() => service.scheduleTask('workspace-1', completedTask, {
    date: '2026-08-09', startTime: '14:00', endTime: '15:00', status: 'planned',
  }, timeZone), PlanBlockValidationError);
  await assert.rejects(() => service.scheduleTask('workspace-1', foreign, {
    date: '2026-08-09', startTime: '15:00', endTime: '16:00', status: 'planned',
  }, timeZone), PlanBlockValidationError);
});

test('day ordering and week boundaries are deterministic for profile week starts', () => {
  const items = [
    block('z', '10:00', '11:00', { status: 'completed' }),
    block('b', '09:00', '10:00'),
    block('a', '09:00', '09:30'),
    block('c', '07:00', '08:00', { status: 'cancelled' }),
  ];
  assert.deepEqual(blocksForDate(items, toCalendarDate('2026-08-09')).map((item) => item.id), ['a', 'b', 'z', 'c']);
  assert.equal(startOfLocalWeek(toCalendarDate('2026-08-09'), 1), '2026-08-03');
  assert.equal(startOfLocalWeek(toCalendarDate('2026-08-09'), 0), '2026-08-09');
  assert.deepEqual(calendarWeek(toCalendarDate('2026-08-09'), 1), ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09']);
  const summaries = weekSummaries(toCalendarDate('2026-08-09'), 0, items, [task()], 60, timeZone);
  assert.equal(summaries[0].date, '2026-08-09');
  assert.equal(summaries[0].isOverCapacity, true);
});

test('duration, overlaps, and capacity handle DST and exclude cancelled blocks', () => {
  const newYork = toTimeZone('America/New_York');
  assert.equal(durationMinutes(toCalendarDate('2026-11-01'), toLocalTime('01:30'), toLocalTime('02:30'), newYork), 120);
  assert.throws(() => localDateTimeInstant(toCalendarDate('2026-03-08'), toLocalTime('02:30'), newYork));
  const blocks = [
    block('a', '09:00', '11:00', { taskId: 'task-1' }),
    block('b', '10:00', '12:00'),
    block('c', '10:30', '11:30', { status: 'cancelled' }),
  ];
  assert.deepEqual(detectOverlaps(blocks), [{ firstId: 'a', secondId: 'b' }]);
  const summary = calculateCapacity(blocks, [task(), task('task-2')], 180, timeZone);
  assert.equal(summary.plannedMinutes, 240);
  assert.equal(summary.remainingMinutes, -60);
  assert.equal(summary.isOverCapacity, true);
  assert.equal(summary.overlapCount, 1);
  assert.equal(summary.unscheduledTaskCount, 1);
});

test('transactions roll back interrupted multi-record operations', async () => {
  const { store, repositories } = createStore();
  await assert.rejects(() => store.transaction(async (scope) => {
    await scope.planBlockSeries.create({
      workspaceId: 'workspace-1', title: 'Series', notes: null, startDate: toCalendarDate('2026-08-09'), startTime: toLocalTime('09:00'), endTime: toLocalTime('10:00'), timeZone, frequency: 'daily', interval: 1, weekdays: [], endDate: null, taskId: null, routineId: null, status: 'active',
    });
    await scope.planBlocks.create({
      workspaceId: 'workspace-1', title: 'Occurrence', notes: null, date: toCalendarDate('2026-08-09'), startTime: toLocalTime('09:00'), endTime: toLocalTime('10:00'), timeZone, status: 'planned', taskId: null, routineId: null, seriesId: null, occurrenceDate: null, isRecurrenceException: false,
    });
    throw new Error('interrupted');
  }));
  assert.equal(repositories.planBlockSeries.records.length, 0);
  assert.equal(repositories.planBlocks.records.length, 0);
});

test('recurrence generation is bounded and idempotent across restarts and deleted occurrences', async () => {
  const { store, repositories } = createStore();
  const firstService = new RecurrenceService(store);
  const created = await firstService.create('workspace-1', recurrenceDraft(), timeZone);
  assert.equal(created.occurrences.length, RECURRENCE_WINDOW_DAYS);
  const restarted = new RecurrenceService(store);
  const repeated = await restarted.materializeWindow('workspace-1', toCalendarDate('2026-08-09'), toCalendarDate('2026-10-03'));
  assert.equal(repeated.length, 0);
  await repositories.planBlocks.softDelete(created.occurrences[0].id, created.occurrences[0].revision);
  const afterDelete = await restarted.materializeWindow('workspace-1', toCalendarDate('2026-08-09'), toCalendarDate('2026-10-03'));
  assert.equal(afterDelete.length, 0);
  await assert.rejects(() => restarted.materializeWindow('workspace-1', toCalendarDate('2026-08-09'), toCalendarDate('2026-10-04')), PlanBlockValidationError);
});

test('weekly recurrence respects interval and selected weekdays', () => {
  const dates = recurrenceDates({
    startDate: toCalendarDate('2026-08-03'), endDate: null, frequency: 'weekly', interval: 2, weekdays: [1, 3],
  }, toCalendarDate('2026-08-03'), toCalendarDate('2026-08-30'));
  assert.deepEqual(dates, ['2026-08-03', '2026-08-05', '2026-08-17', '2026-08-19']);
});

test('editing one occurrence keeps its series while editing future preserves completed history', async () => {
  const { store, repositories } = createStore();
  const recurrence = new RecurrenceService(store);
  const service = new PlanBlockService(store);
  const created = await recurrence.create('workspace-1', { ...recurrenceDraft(), endDate: '2026-08-13' }, timeZone);
  const first = await service.complete(created.occurrences[0]);
  const exception = await service.update(created.occurrences[1], {
    title: 'Exception', notes: '', date: '2026-08-10', startTime: '11:00', endTime: '12:00', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  assert.equal(exception.seriesId, created.series.id);
  assert.equal(exception.isRecurrenceException, true);
  const future = await recurrence.editFuture(created.series, { ...recurrenceDraft(), title: 'New future', endDate: '2026-08-16' }, toCalendarDate('2026-08-12'), timeZone);
  assert.equal((await repositories.planBlocks.getById(first.id, true))?.status, 'completed');
  assert.equal((await repositories.planBlocks.getById(created.occurrences[3].id, true))?.deletedAt !== null, true);
  assert.equal(future.occurrences.every((item) => item.title === 'New future'), true);
  assert.notEqual(future.series.id, created.series.id);
});

test('language resolution, fallback, catalogs, Unicode, and RTL are deterministic', () => {
  assert.deepEqual(supportedLanguages, ['en', 'am', 'es', 'fr', 'ar']);
  assert.equal(resolveLanguage('system', 'es-PY'), 'es');
  assert.equal(resolveLanguage('system', 'de-DE'), 'en');
  assert.equal(resolveLanguage('am', 'fr-FR'), 'am');
  assert.equal(directionForLanguage('ar'), 'rtl');
  assert.equal(directionForLanguage('am'), 'ltr');
  assert.deepEqual(validateTranslationCatalogs(), []);
  assert.equal(createTranslator('es')('tabs.today'), 'Hoy');
  assert.equal(createTranslator('ar')('tabs.today'), translationCatalogs.ar.tabs.today);
  assert.match(translationCatalogs.am.tabs.today, /[\u1200-\u137F]/u);
  assert.match(translationCatalogs.ar.tabs.today, /[\u0600-\u06FF]/u);
});

test('localized dates, durations, interpolation, and pluralization avoid raw keys', () => {
  const english = createTranslator('en');
  const spanish = createTranslator('es');
  assert.match(formatCalendarDateValue('2026-08-09', 'fr', { month: 'long', day: 'numeric' }), /août/u);
  assert.equal(formatDurationValue(1, 'en', english), '1 minute');
  assert.equal(formatDurationValue(90, 'es', spanish), '1 hora y 30 minutos');
  assert.equal(english('today.progress', { completed: 2, total: 3 }), '2 of 3 complete');
  for (const language of supportedLanguages) {
    assert.equal(createTranslator(language)('tabs.planner').includes('tabs.planner'), false);
  }
});

test('duration formatting stays localized when the runtime has no list formatter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'ListFormat');
  withUnavailableListFormat(() => {
    const cases = [
      { language: 'en' as const, locale: 'en', minute: '1 minute', duration: '1 hour and 30 minutes' },
      { language: 'am' as const, locale: 'am-ET', minute: '1 ደቂቃ', duration: '1 ሰዓት እና 30 ደቂቃዎች' },
      { language: 'es' as const, locale: 'es', minute: '1 minuto', duration: '1 hora y 30 minutos' },
      { language: 'fr' as const, locale: 'fr', minute: '1 minute', duration: '1 heure et 30 minutes' },
      { language: 'ar' as const, locale: 'ar', minute: '1 دقيقة', duration: '1 ساعة و30 دقيقة' },
    ];
    for (const item of cases) {
      const translate = createTranslator(item.language);
      assert.doesNotThrow(() => formatDurationValue(90, item.locale, translate));
      assert.equal(formatDurationValue(1, item.locale, translate), item.minute);
      assert.equal(formatDurationValue(90, item.locale, translate), item.duration);
      assert.equal(formatDurationValue(90, item.locale, translate).includes('common.'), false);
    }
  });
  assert.equal(
    Object.getOwnPropertyDescriptor(Intl, 'ListFormat')?.value,
    descriptor?.value,
  );
});

test('routine weekday lists use localized fallback conjunctions without a list formatter', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'ListFormat');
  withUnavailableListFormat(() => {
    assert.equal(formatLocalizedList([], 'en'), '');
    assert.equal(formatLocalizedList(['Monday'], 'en'), 'Monday');
    assert.equal(formatLocalizedList(['Monday', 'Wednesday'], 'en'), 'Monday and Wednesday');
    assert.equal(formatLocalizedList(['Monday', 'Wednesday', 'Friday'], 'en'), 'Monday, Wednesday, and Friday');
    assert.equal(formatLocalizedList(['ሰኞ', 'ረቡዕ'], 'am-ET'), 'ሰኞ እና ረቡዕ');
    assert.equal(formatLocalizedList(['lunes', 'miércoles'], 'es'), 'lunes y miércoles');
    assert.equal(formatLocalizedList(['lundi', 'mercredi'], 'fr'), 'lundi et mercredi');
    assert.equal(formatLocalizedList(['الاثنين', 'الأربعاء'], 'ar'), 'الاثنين والأربعاء');

    const weeklyRoutine: Routine = {
      ...metadata('routine-list-format'),
      workspaceId: 'workspace-1',
      title: 'Routine',
      notes: null,
      schedule: { kind: 'weekly', weekdays: [1, 3, 5], time: toLocalTime('08:00') },
      timeZone,
      status: 'active',
    };
    for (const language of supportedLanguages) {
      const locale = language === 'am' ? 'am-ET' : language;
      const label = formatRoutineScheduleLabel(weeklyRoutine, {
        everyDay: createTranslator(language)('routines.everyDay'),
        formatDate: (date) => formatCalendarDateValue(date, locale, { weekday: 'short' }),
        formatList: (items) => formatLocalizedList(items, locale),
        formatTime: (time) => time,
      });
      assert.equal(label.includes('routines.'), false);
      assert.equal(label.length > 0, true);
    }
  });
  assert.equal(
    Object.getOwnPropertyDescriptor(Intl, 'ListFormat')?.value,
    descriptor?.value,
  );
});

test('language, capacity, and Planner view preferences persist revision-safely', async () => {
  const settings: AppSettings = {
    ...metadata('settings-1'), profileId: 'profile-1', themePreference: 'system', defaultTab: 'today', planningDayStartsAt: toLocalTime('06:00'), languagePreference: 'system', dailyPlanningCapacityMinutes: 480, plannerView: 'day', insightsView: 'summary', insightsRange: '7d', notificationTitlesEnabled: false, quietHoursEnabled: false, quietHoursStart: toLocalTime('22:00'), quietHoursEnd: toLocalTime('07:00'), deviceCalendarId: null, deviceCalendarName: null, onboardingVersion: 1, onboardingCompletedAt: instant,
  };
  const { store } = createStore({ settings: [settings] });
  const service = new PlanningPreferencesService(store);
  const language = await service.setLanguage(settings, 'am');
  const capacity = await service.setCapacity(language, 360);
  const view = await service.setPlannerView(capacity, 'week');
  assert.equal((await service.get('profile-1'))?.languagePreference, 'am');
  assert.equal(view.dailyPlanningCapacityMinutes, 360);
  assert.equal(view.plannerView, 'week');
  await assert.rejects(() => service.setPlannerView(settings, 'week'), (error: unknown) => error instanceof StorageError && error.code === 'REVISION_CONFLICT');
});

test('schedule changes update Today day grouping without changing unrelated records', async () => {
  const original = block('move-me', '09:00', '10:00');
  const other = block('other', '11:00', '12:00');
  const { store } = createStore({ blocks: [original, other] });
  const service = new PlanBlockService(store);
  const moved = await service.update(original, {
    title: original.title, notes: '', date: '2026-08-10', startTime: '13:00', endTime: '14:00', status: 'planned', taskId: null, routineId: null,
  }, timeZone);
  const all = await service.list('workspace-1', toCalendarDate('2026-08-09'), toCalendarDate('2026-08-10'));
  assert.deepEqual(blocksForDate(all, toCalendarDate('2026-08-09')).map((item) => item.id), ['other']);
  assert.deepEqual(blocksForDate(all, toCalendarDate('2026-08-10')).map((item) => item.id), [moved.id]);
  assert.equal(other.revision, 1);
});

test('migration 4 is forward-only, defaults existing settings, and adds ownership and uniqueness constraints', async () => {
  assert.equal(plannerLocalizationMigration.version, 4);
  const statements: string[] = [];
  await plannerLocalizationMigration.migrate({
    executeStatic: async (sql: string) => {
      statements.push(sql);
    },
  } as never);
  const sql = statements.join('\n');
  assert.match(sql, /language_preference TEXT NOT NULL DEFAULT 'system'/);
  assert.match(sql, /daily_planning_capacity_minutes INTEGER NOT NULL DEFAULT 480/);
  assert.match(sql, /planner_view TEXT NOT NULL DEFAULT 'day'/);
  assert.match(sql, /FOREIGN KEY \(workspace_id\) REFERENCES workspaces/);
  assert.match(sql, /CREATE UNIQUE INDEX plan_block_series_occurrence_idx/);
  assert.doesNotMatch(sql, /INSERT INTO (tasks|plan_blocks|plan_block_series)/i);
});

test('Phase 5 rows map every settings, block, and recurrence field', () => {
  const series: PlanBlockSeries = {
    ...metadata('series-1'), workspaceId: 'workspace-1', title: 'Weekly focus', notes: 'Local', startDate: toCalendarDate('2026-08-09'), startTime: toLocalTime('09:00'), endTime: toLocalTime('10:00'), timeZone, frequency: 'weekly', interval: 2, weekdays: [1, 4], endDate: toCalendarDate('2026-10-01'), taskId: null, routineId: 'routine-1', status: 'active',
  };
  const occurrence = block('occurrence-1', '09:00', '10:00', {
    seriesId: series.id,
    occurrenceDate: toCalendarDate('2026-08-10'),
    isRecurrenceException: true,
  });
  const settings: AppSettings = {
    ...metadata('settings-1'), profileId: 'profile-1', themePreference: 'dark', defaultTab: 'planner', planningDayStartsAt: toLocalTime('07:00'), languagePreference: 'fr', dailyPlanningCapacityMinutes: 390, plannerView: 'week', insightsView: 'trends', insightsRange: '4w', notificationTitlesEnabled: true, quietHoursEnabled: true, quietHoursStart: toLocalTime('21:30'), quietHoursEnd: toLocalTime('06:30'), deviceCalendarId: 'calendar-1', deviceCalendarName: 'Personal', onboardingVersion: 1, onboardingCompletedAt: instant,
  };
  assert.deepEqual(planBlockSeriesMapper.fromRow(planBlockSeriesMapper.toRow(series)), series);
  assert.deepEqual(planBlockMapper.fromRow(planBlockMapper.toRow(occurrence)), occurrence);
  assert.deepEqual(appSettingsMapper.fromRow(appSettingsMapper.toRow(settings)), settings);
});
