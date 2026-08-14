import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
  type AppSettings,
  type DeviceCalendarEvent,
  type DeviceNotificationSchedule,
  type EntityMetadata,
  type Goal,
  type PlanBlock,
  type ReminderIntent,
  type Routine,
  type Task,
  type UserProfile,
  type Workspace,
} from '../src/domain/entities/index.ts';
import type { RepositoryScope, RepositoryStore } from '../src/domain/repositories/contracts.ts';
import {
  CalendarInteropService,
  CalendarMappingConflict,
  eventFingerprint,
  eventInput,
} from '../src/features/calendar/services/calendar-interop.ts';
import type {
  CalendarDeviceGateway,
  CalendarEventInput,
  DeviceCalendarEventSnapshot,
} from '../src/features/calendar/services/calendar-device.ts';
import { translationCatalogs } from '../src/features/localization/localization.ts';
import { normalizePermissionState } from '../src/features/reminders/services/permission-state.ts';
import {
  parseNotificationDestination,
  resolveNotificationDestination,
} from '../src/features/reminders/services/notification-navigation.ts';
import type {
  NotificationDeviceGateway,
  NotificationScheduleRequest,
} from '../src/features/reminders/services/notification-device.ts';
import {
  ReminderLifecycleService,
  ReminderValidationError,
} from '../src/features/reminders/services/reminder-lifecycle.ts';
import { ReminderReconciliationService } from '../src/features/reminders/services/reminder-reconciliation.ts';
import {
  applyQuietHours,
  calculateReminderOccurrences,
  MAX_SCHEDULED_OCCURRENCES,
} from '../src/features/reminders/services/reminder-time.ts';
import { validateReminderDraft } from '../src/features/reminders/services/reminder-validation.ts';
import { remindersCalendarMigration } from '../src/storage/database/migrations/007-reminders-calendar.ts';
import {
  appSettingsMapper,
  deviceCalendarEventMapper,
  deviceNotificationScheduleMapper,
  reminderIntentMapper,
} from '../src/storage/mappers/entity-mappers.ts';

const instant = toInstant('2026-08-14T12:00:00.000Z');
const zone = toTimeZone('America/New_York');

class MemoryRepository<TEntity extends EntityMetadata> {
  private sequence = 0;
  constructor(readonly rows: TEntity[] = []) {}
  async getById(id: string, includeDeleted = false) {
    return this.rows.find((row) => row.id === id && (includeDeleted || row.deletedAt === null)) ?? null;
  }
  async list(options: { filter?: Record<string, unknown>; page?: { limit?: number; offset?: number }; includeDeleted?: boolean } = {}) {
    const filtered = this.rows.filter((row) => {
      if (!options.includeDeleted && row.deletedAt !== null) return false;
      return Object.entries(options.filter ?? {}).every(([key, value]) => value === undefined || (row as unknown as Record<string, unknown>)[key] === value);
    });
    const offset = options.page?.offset ?? 0;
    const limit = options.page?.limit ?? 50;
    return { items: filtered.slice(offset, offset + limit), nextOffset: offset + limit < filtered.length ? offset + limit : null };
  }
  async create(input: Omit<TEntity, keyof EntityMetadata> & { id?: string }) {
    this.sequence += 1;
    const row = { ...input, id: input.id ?? `memory-${this.sequence}`, createdAt: instant, updatedAt: instant, revision: 1, deletedAt: null } as TEntity;
    this.rows.push(row);
    return row;
  }
  async update(id: string, input: Partial<TEntity> & { expectedRevision?: number }) {
    const index = this.rows.findIndex((row) => row.id === id && row.deletedAt === null);
    if (index < 0) throw new Error('missing');
    const current = this.rows[index];
    if (input.expectedRevision !== undefined && input.expectedRevision !== current.revision) throw new Error('revision');
    const { expectedRevision, ...changes } = input;
    const row = { ...current, ...changes, id: current.id, createdAt: current.createdAt, updatedAt: instant, revision: current.revision + 1 } as TEntity;
    this.rows[index] = row;
    return row;
  }
  async softDelete(id: string, expectedRevision?: number) {
    const current = await this.getById(id);
    if (!current || (expectedRevision !== undefined && current.revision !== expectedRevision)) throw new Error('revision');
    return this.update(id, { expectedRevision: current.revision, deletedAt: instant } as Partial<TEntity> & { expectedRevision: number });
  }
}

function metadata(id: string): EntityMetadata {
  return { id, createdAt: instant, updatedAt: instant, revision: 1, deletedAt: null };
}

function settings(changes: Partial<AppSettings> = {}): AppSettings {
  return {
    ...metadata('settings-1'), profileId: 'profile-1', themePreference: 'system', defaultTab: 'today', planningDayStartsAt: toLocalTime('06:00'), languagePreference: 'system', dailyPlanningCapacityMinutes: 480, plannerView: 'day', insightsView: 'summary', insightsRange: '7d', notificationTitlesEnabled: false, quietHoursEnabled: false, quietHoursStart: toLocalTime('22:00'), quietHoursEnd: toLocalTime('07:00'), deviceCalendarId: null, deviceCalendarName: null, onboardingVersion: 1, onboardingCompletedAt: instant, ...changes,
  };
}

function workspace(): Workspace {
  return { ...metadata('workspace-1'), profileId: 'profile-1', name: 'Personal', kind: 'personal', status: 'active' };
}

function profile(): UserProfile {
  return { ...metadata('profile-1'), displayName: null, locale: 'en-US', timeZone: zone, weekStartsOn: 1, accessibility: { reduceMotion: null, useBoldText: null, textScale: null } };
}

function task(id = 'task-1', workspaceId = 'workspace-1'): Task {
  return { ...metadata(id), workspaceId, title: 'Prepare notes', notes: null, status: 'pending', priority: 'high', dueDate: toCalendarDate('2026-08-15'), scheduledTime: toLocalTime('10:00'), timeZone: zone, completedAt: null, areaId: null, goalId: null, parentTaskId: null };
}

function block(id = 'block-1'): PlanBlock {
  return { ...metadata(id), workspaceId: 'workspace-1', date: toCalendarDate('2026-08-15'), startTime: toLocalTime('10:00'), endTime: toLocalTime('11:00'), timeZone: zone, title: 'Focus block', notes: 'Bring notes', status: 'planned', taskId: null, routineId: null, seriesId: null, occurrenceDate: null, isRecurrenceException: false };
}

function routine(): Routine {
  return { ...metadata('routine-1'), workspaceId: 'workspace-1', title: 'Review day', notes: null, schedule: { kind: 'daily', time: toLocalTime('19:00') }, timeZone: zone, status: 'active' };
}

function goal(): Goal {
  return { ...metadata('goal-1'), workspaceId: 'workspace-1', areaId: null, title: 'Finish draft', description: null, motivation: null, status: 'active', horizon: 'month', targetDate: toCalendarDate('2026-08-20'), completedAt: null, progressMethod: 'milestones', manualProgress: 0, nextActionTaskId: null };
}

function createStore(seed: { reminders?: ReminderIntent[]; schedules?: DeviceNotificationSchedule[]; mappings?: DeviceCalendarEvent[]; tasks?: Task[]; blocks?: PlanBlock[]; routines?: Routine[]; goals?: Goal[] } = {}) {
  const repositories = {
    userProfiles: new MemoryRepository([profile()]), workspaces: new MemoryRepository([workspace()]), tasks: new MemoryRepository(seed.tasks ?? [task()]), planBlocks: new MemoryRepository(seed.blocks ?? [block()]), planBlockSeries: new MemoryRepository(), routines: new MemoryRepository(seed.routines ?? [routine()]), routineCheckIns: new MemoryRepository(), goals: new MemoryRepository(seed.goals ?? [goal()]), milestones: new MemoryRepository(), goalRoutineLinks: new MemoryRepository(), areas: new MemoryRepository(), tags: new MemoryRepository(), reflections: new MemoryRepository(), appSettings: new MemoryRepository([settings()]), accountLinks: new MemoryRepository(), reminderIntents: new MemoryRepository(seed.reminders ?? []), deviceNotificationSchedules: new MemoryRepository(seed.schedules ?? []), deviceCalendarEvents: new MemoryRepository(seed.mappings ?? []), localChanges: new MemoryRepository(),
  };
  const store = { ...repositories, transaction: async <TResult>(operation: (scope: RepositoryScope) => Promise<TResult>) => operation(store as unknown as RepositoryScope) } as unknown as RepositoryStore;
  return { store, repositories };
}

function reminder(changes: Partial<ReminderIntent> = {}): ReminderIntent {
  return { ...metadata('reminder-1'), workspaceId: 'workspace-1', entityType: 'plan_block', entityId: 'block-1', triggerKind: 'relative', offsetMinutes: 15, absoluteAt: null, enabled: true, ...changes };
}

test('reminder validation enforces one bounded trigger representation', () => {
  assert.equal(validateReminderDraft({ entityType: 'task', entityId: 'task-1', triggerKind: 'relative', offsetMinutes: 15, absoluteAt: null, enabled: true }).valid, true);
  assert.equal(validateReminderDraft({ entityType: 'task', entityId: 'task-1', triggerKind: 'relative', offsetMinutes: 10081, absoluteAt: null, enabled: true }).valid, false);
  assert.equal(validateReminderDraft({ entityType: 'goal', entityId: 'goal-1', triggerKind: 'absolute', offsetMinutes: null, absoluteAt: 'invalid', enabled: true }).valid, false);
});

test('reminder lifecycle upserts one workspace-owned intent and survives recreation', async () => {
  const { store, repositories } = createStore();
  const service = new ReminderLifecycleService(store);
  const first = await service.save('workspace-1', { entityType: 'task', entityId: 'task-1', triggerKind: 'relative', offsetMinutes: 15, absoluteAt: null, enabled: true });
  const updated = await service.save('workspace-1', { entityType: 'task', entityId: 'task-1', triggerKind: 'relative', offsetMinutes: 60, absoluteAt: null, enabled: false });
  assert.equal(first.id, updated.id);
  assert.equal(repositories.reminderIntents.rows.length, 1);
  assert.equal((await new ReminderLifecycleService(store).getForEntity('workspace-1', 'task', 'task-1'))?.offsetMinutes, 60);
  await assert.rejects(() => service.save('workspace-1', { entityType: 'task', entityId: 'foreign-task', triggerKind: 'relative', offsetMinutes: 15, absoluteAt: null, enabled: true }), ReminderValidationError);
});

test('relative reminders use entity local time and routines stay bounded', () => {
  const planOccurrence = calculateReminderOccurrences(reminder(), block(), zone, new Date(instant));
  assert.equal(planOccurrence.length, 1);
  assert.equal(planOccurrence[0].scheduledAt.toISOString(), '2026-08-15T13:45:00.000Z');
  const routineOccurrences = calculateReminderOccurrences(reminder({ entityType: 'routine', entityId: 'routine-1' }), routine(), zone, new Date(instant));
  assert.equal(routineOccurrences.length <= MAX_SCHEDULED_OCCURRENCES, true);
  assert.equal(routineOccurrences.length, 28);
});

test('quiet hours defer useful reminders and skip stale occurrences deterministically', () => {
  const quiet = settings({ quietHoursEnabled: true, quietHoursStart: toLocalTime('22:00'), quietHoursEnd: toLocalTime('07:00') });
  const deferred = applyQuietHours({ key: 'one', scheduledAt: new Date('2026-08-15T06:00:00Z'), sourceAt: new Date('2026-08-15T13:00:00Z') }, quiet, zone);
  assert.equal(deferred.state, 'schedule');
  if (deferred.state === 'schedule') assert.equal(deferred.date.toISOString(), '2026-08-15T11:00:00.000Z');
  const skipped = applyQuietHours({ key: 'two', scheduledAt: new Date('2026-08-15T06:00:00Z'), sourceAt: new Date('2026-08-15T10:00:00Z') }, quiet, zone);
  assert.deepEqual(skipped, { state: 'skip', reason: 'quiet_hours_stale' });
});

test('reconciliation cancels only mapped identifiers and respects title privacy', async () => {
  const { store, repositories } = createStore({ reminders: [reminder()] });
  const scheduled: NotificationScheduleRequest[] = [];
  const cancelled: string[] = [];
  const device: NotificationDeviceGateway = { schedule: async (request) => { scheduled.push(request); return request.identifier; }, cancel: async (identifier) => { cancelled.push(identifier); } };
  const service = new ReminderReconciliationService(store, device);
  const first = await service.reconcile({ workspaceId: 'workspace-1', settings: settings(), timeZone: zone, permissionAllowed: true, now: new Date('2026-08-14T00:00:00Z'), genericTitle: 'Planora reminder', genericBody: 'Open Planora.' });
  assert.equal(first.scheduled, 1);
  assert.equal(scheduled[0].title, 'Planora reminder');
  const second = await service.reconcile({ workspaceId: 'workspace-1', settings: settings({ notificationTitlesEnabled: true }), timeZone: zone, permissionAllowed: true, now: new Date('2026-08-14T00:00:00Z'), genericTitle: 'Planora reminder', genericBody: 'Open Planora.' });
  assert.equal(second.scheduled, 1);
  assert.equal(scheduled[1].title, 'Focus block');
  assert.deepEqual(cancelled, [repositories.deviceNotificationSchedules.rows[0].notificationIdentifier]);
});

test('revoked permission clears mapped schedules without creating replacements', async () => {
  const mapping: DeviceNotificationSchedule = { ...metadata('schedule-1'), workspaceId: 'workspace-1', reminderIntentId: 'reminder-1', occurrenceKey: '2026-08-15', notificationIdentifier: 'planora-owned', scheduledFor: instant, state: 'scheduled', reason: null, sourceRevision: 1 };
  const { store } = createStore({ reminders: [reminder()], schedules: [mapping] });
  const cancelled: string[] = [];
  const service = new ReminderReconciliationService(store, { schedule: async () => { throw new Error('unexpected'); }, cancel: async (id) => { cancelled.push(id); } });
  const result = await service.reconcile({ workspaceId: 'workspace-1', settings: settings(), timeZone: zone, permissionAllowed: false, now: new Date(), genericTitle: 'Planora', genericBody: 'Open' });
  assert.deepEqual(result, { scheduled: 0, skipped: 0, errors: 0 });
  assert.deepEqual(cancelled, ['planora-owned']);
});

test('reconciliation remains bounded and does not replace a schedule that failed cancellation', async () => {
  const blocks = Array.from({ length: 40 }, (_, index) => block(`block-${index}`));
  const reminders = blocks.map((item, index) => reminder({ id: `reminder-${index}`, entityId: item.id, triggerKind: 'absolute', offsetMinutes: null, absoluteAt: toInstant('2026-08-20T12:00:00.000Z') }));
  const bounded = createStore({ blocks, reminders });
  const scheduled: string[] = [];
  const service = new ReminderReconciliationService(bounded.store, { schedule: async (request) => { scheduled.push(request.identifier); return request.identifier; }, cancel: async () => undefined });
  const result = await service.reconcile({ workspaceId: 'workspace-1', settings: settings(), timeZone: zone, permissionAllowed: true, now: new Date(instant), genericTitle: 'Planora', genericBody: 'Open' });
  assert.equal(result.scheduled, MAX_SCHEDULED_OCCURRENCES);
  assert.equal(scheduled.length, MAX_SCHEDULED_OCCURRENCES);

  const existing: DeviceNotificationSchedule = { ...metadata('schedule-existing'), workspaceId: 'workspace-1', reminderIntentId: reminders[0].id, occurrenceKey: 'absolute', notificationIdentifier: 'planora-owned', scheduledFor: instant, state: 'scheduled', reason: null, sourceRevision: 1 };
  const blocked = createStore({ blocks: [blocks[0]], reminders: [reminders[0]], schedules: [existing] });
  let replacements = 0;
  const blockedResult = await new ReminderReconciliationService(blocked.store, { schedule: async () => { replacements += 1; return 'replacement'; }, cancel: async () => { throw new Error('unavailable'); } }).reconcile({ workspaceId: 'workspace-1', settings: settings(), timeZone: zone, permissionAllowed: true, now: new Date(instant), genericTitle: 'Planora', genericBody: 'Open' });
  assert.deepEqual(blockedResult, { scheduled: 0, skipped: 0, errors: 1 });
  assert.equal(replacements, 0);
  assert.equal(blocked.repositories.deviceNotificationSchedules.rows[0].state, 'error');
});

test('permission normalization distinguishes undetermined denied blocked and allowed', () => {
  assert.equal(normalizePermissionState({ granted: true, status: 'granted', canAskAgain: true }), 'allowed');
  assert.equal(normalizePermissionState({ granted: false, status: 'undetermined', canAskAgain: true }), 'undetermined');
  assert.equal(normalizePermissionState({ granted: false, status: 'denied', canAskAgain: true }), 'denied');
  assert.equal(normalizePermissionState({ granted: false, status: 'denied', canAskAgain: false }), 'blocked');
});

test('notification navigation accepts only allow-listed entity UUID payloads', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const validTask = task(id);
  const { store } = createStore({ tasks: [validTask] });
  assert.deepEqual(parseNotificationDestination({ planoraVersion: 1, entityType: 'task', entityId: id, route: '/settings' }), { entityType: 'task', entityId: id });
  assert.equal(parseNotificationDestination({ planoraVersion: 1, entityType: 'task', entityId: '../settings' }), null);
  assert.equal((await resolveNotificationDestination(store, 'workspace-1', { planoraVersion: 1, entityType: 'task', entityId: id })).ok, true);
  assert.deepEqual(await resolveNotificationDestination(store, 'other', { planoraVersion: 1, entityType: 'task', entityId: id }), { ok: false, reason: 'missing' });
});

class MemoryCalendar implements CalendarDeviceGateway {
  events = new Map<string, DeviceCalendarEventSnapshot>();
  created = 0;
  async listWritable() { return [{ id: 'calendar-1', title: 'Personal' }]; }
  async getEvent(id: string) { return this.events.get(id) ?? null; }
  async createEvent(_calendarId: string, event: CalendarEventInput) { this.created += 1; const id = `event-${this.created}`; this.events.set(id, { id, ...event }); return id; }
  async updateEvent(id: string, event: CalendarEventInput) { this.events.set(id, { id, ...event }); }
  async deleteEvent(id: string) { this.events.delete(id); }
}

test('calendar export records identifiers and requires decisions for external changes', async () => {
  const { store } = createStore();
  const device = new MemoryCalendar();
  const service = new CalendarInteropService(store, device);
  const created = await service.exportBlock(block(), 'calendar-1');
  assert.equal(created.eventId, 'event-1');
  const external = device.events.get('event-1')!;
  device.events.set('event-1', { ...external, title: 'Changed outside' });
  await assert.rejects(() => service.exportBlock(block(), 'calendar-1'), (error: unknown) => error instanceof CalendarMappingConflict && error.kind === 'external_change');
  const replaced = await service.exportBlock(block(), 'calendar-1', true);
  assert.equal(replaced.state, 'active');
  assert.equal(device.events.get('event-1')?.title, 'Focus block');
  const updated = await service.exportBlock(block(), 'calendar-2');
  assert.equal(updated.calendarId, 'calendar-1');
  await service.removeMapping(replaced, false);
  assert.equal(device.events.has('event-1'), true);
});

test('calendar missing mappings are recreated only after an explicit force decision', async () => {
  const { store } = createStore();
  const device = new MemoryCalendar();
  const service = new CalendarInteropService(store, device);
  const created = await service.exportBlock(block(), 'calendar-1');
  device.events.delete(created.eventId);
  await assert.rejects(() => service.exportBlock(block(), 'calendar-1'), (error: unknown) => error instanceof CalendarMappingConflict && error.kind === 'missing');
  const recreated = await service.exportBlock(block(), 'calendar-1', true);
  assert.equal(recreated.eventId, 'event-2');
});

test('Phase 8 mappers round trip portable and device-only records', () => {
  const intent = reminder({ absoluteAt: null });
  const schedule: DeviceNotificationSchedule = { ...metadata('schedule-1'), workspaceId: 'workspace-1', reminderIntentId: intent.id, occurrenceKey: '2026-08-15', notificationIdentifier: 'native-1', scheduledFor: instant, state: 'scheduled', reason: null, sourceRevision: 1 };
  const mapping: DeviceCalendarEvent = { ...metadata('mapping-1'), workspaceId: 'workspace-1', planBlockId: 'block-1', calendarId: 'calendar-1', eventId: 'event-1', sourceRevision: 1, sourceFingerprint: eventFingerprint(eventInput(block())), state: 'active' };
  assert.deepEqual(reminderIntentMapper.fromRow(reminderIntentMapper.toRow(intent)), intent);
  assert.deepEqual(deviceNotificationScheduleMapper.fromRow(deviceNotificationScheduleMapper.toRow(schedule)), schedule);
  assert.deepEqual(deviceCalendarEventMapper.fromRow(deviceCalendarEventMapper.toRow(mapping)), mapping);
  const preferences = settings({ notificationTitlesEnabled: true, quietHoursEnabled: true, deviceCalendarId: 'calendar-1', deviceCalendarName: 'Personal' });
  assert.deepEqual(appSettingsMapper.fromRow(appSettingsMapper.toRow(preferences)), preferences);
});

test('migration 7 is additive indexed foreign-key protected and seed-free', async () => {
  assert.equal(remindersCalendarMigration.version, 7);
  const statements: string[] = [];
  await remindersCalendarMigration.migrate({ executeStatic: async (sql: string) => { statements.push(sql); } } as never);
  const sql = statements.join('\n');
  assert.match(sql, /CREATE TABLE reminder_intents/);
  assert.match(sql, /CREATE TABLE device_notification_schedules/);
  assert.match(sql, /CREATE TABLE device_calendar_events/);
  assert.match(sql, /FOREIGN KEY \(workspace_id\) REFERENCES workspaces/);
  assert.match(sql, /FOREIGN KEY \(reminder_intent_id, workspace_id\) REFERENCES reminder_intents\(id, workspace_id\)/);
  assert.match(sql, /FOREIGN KEY \(plan_block_id, workspace_id\) REFERENCES plan_blocks\(id, workspace_id\)/);
  assert.match(sql, /CREATE UNIQUE INDEX reminder_intents_entity_idx/);
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM|INSERT INTO/i);
});

test('all five Phase 8 catalogs match placeholders Unicode and direction', () => {
  const keys = Object.keys(translationCatalogs.en.reminders).sort();
  const calendarKeys = Object.keys(translationCatalogs.en.calendar).sort();
  for (const language of ['en', 'am', 'es', 'fr', 'ar'] as const) {
    assert.deepEqual(Object.keys(translationCatalogs[language].reminders).sort(), keys);
    assert.deepEqual(Object.keys(translationCatalogs[language].calendar).sort(), calendarKeys);
    assert.match(translationCatalogs[language].reminders.reconcileResult, /{{scheduled}}.*{{skipped}}.*{{errors}}/s);
  }
  assert.match(translationCatalogs.am.reminders.title, /[\u1200-\u137F]/u);
  assert.equal(translationCatalogs.ar.settings.directionRestart.length > 0, true);
});
