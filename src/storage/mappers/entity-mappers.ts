import type {
  AppSettings,
  DeviceCalendarEvent,
  DeviceNotificationSchedule,
  LocalAccountLink,
  Area,
  EntityMetadata,
  Goal,
  GoalRoutineLink,
  LocalChange,
  Milestone,
  PlanBlock,
  PlanBlockSeries,
  Reflection,
  ReminderIntent,
  Routine,
  RoutineCheckIn,
  Tag,
  Task,
  UserProfile,
  Weekday,
  Workspace,
} from '../../domain/entities/index.ts';
import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
} from '../../domain/entities/common.ts';
import type {
  LocalChangeFilter,
  AccountLinkFilter,
  DeviceCalendarEventFilter,
  DeviceNotificationScheduleFilter,
  GoalRoutineLinkFilter,
  MilestoneFilter,
  PlanBlockFilter,
  PlanBlockSeriesFilter,
  ProfileFilter,
  ReflectionFilter,
  ReminderIntentFilter,
  RoutineCheckInFilter,
  WorkspaceEntityFilter,
  WorkspaceFilter,
} from '../../domain/repositories/contracts.ts';
import { StorageError } from '../database/errors.ts';
import type {
  DatabaseRecord,
  DatabaseRow,
  EntityMapper,
  FilterClause,
} from './types.ts';

const metadataColumns = [
  'id',
  'created_at',
  'updated_at',
  'revision',
  'deleted_at',
] as const;

function stringValue(row: DatabaseRow, key: string): string {
  const value = row[key];

  if (typeof value !== 'string') {
    throw invalidRow();
  }

  return value;
}

function nullableString(row: DatabaseRow, key: string): string | null {
  const value = row[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw invalidRow();
  }

  return value;
}

function numberValue(row: DatabaseRow, key: string): number {
  const value = row[key];

  if (typeof value !== 'number') {
    throw invalidRow();
  }

  return value;
}

function jsonValue(row: DatabaseRow, key: string): unknown {
  try {
    return JSON.parse(stringValue(row, key)) as unknown;
  } catch {
    throw invalidRow();
  }
}

function accessibilityValue(
  row: DatabaseRow,
): UserProfile['accessibility'] {
  const value = jsonValue(row, 'accessibility_json');

  if (!isRecord(value)) {
    throw invalidRow();
  }

  const { reduceMotion, useBoldText, textScale } = value;

  if (
    !isNullableBoolean(reduceMotion) ||
    !isNullableBoolean(useBoldText) ||
    !(
      textScale === null ||
      (typeof textScale === 'number' && Number.isFinite(textScale) && textScale > 0)
    )
  ) {
    throw invalidRow();
  }

  return { reduceMotion, useBoldText, textScale };
}

function routineScheduleValue(row: DatabaseRow): Routine['schedule'] {
  const value = jsonValue(row, 'schedule_json');

  if (!isRecord(value) || (value.kind !== 'daily' && value.kind !== 'weekly')) {
    throw invalidRow();
  }

  const time =
    value.time === null
      ? null
      : typeof value.time === 'string'
        ? toLocalTime(value.time)
        : undefined;

  if (time === undefined) {
    throw invalidRow();
  }

  if (value.kind === 'daily') {
    return { kind: 'daily', time };
  }

  if (
    !Array.isArray(value.weekdays) ||
    value.weekdays.some(
      (weekday) =>
        typeof weekday !== 'number' ||
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6,
    )
  ) {
    throw invalidRow();
  }

  return {
    kind: 'weekly',
    time,
    weekdays: [...new Set(value.weekdays)] as Weekday[],
  };
}

function nullableNumber(row: DatabaseRow, key: string): number | null {
  const value = row[key];

  if (value === null) return null;
  if (typeof value !== 'number') throw invalidRow();
  return value;
}

function weekdayArray(row: DatabaseRow, key: string): Weekday[] {
  const value = jsonValue(row, key);

  if (
    !Array.isArray(value) ||
    value.some(
      (weekday) =>
        typeof weekday !== 'number' ||
        !Number.isInteger(weekday) ||
        weekday < 0 ||
        weekday > 6,
    )
  ) {
    throw invalidRow();
  }

  return [...new Set(value)].sort((left, right) => left - right) as Weekday[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function invalidRow() {
  return new StorageError(
    'INVALID_DATA',
    'Stored local data could not be read safely.',
    false,
  );
}

function metadataFromRow(row: DatabaseRow): EntityMetadata {
  const deletedAt = nullableString(row, 'deleted_at');

  return {
    id: stringValue(row, 'id'),
    createdAt: toInstant(stringValue(row, 'created_at')),
    updatedAt: toInstant(stringValue(row, 'updated_at')),
    revision: numberValue(row, 'revision'),
    deletedAt: deletedAt ? toInstant(deletedAt) : null,
  };
}

function metadataToRow(entity: EntityMetadata): DatabaseRecord {
  return {
    id: entity.id,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    revision: entity.revision,
    deleted_at: entity.deletedAt,
  };
}

function clauses(entries: [string, unknown][]): FilterClause[] {
  return entries
    .filter((entry): entry is [string, string | number] =>
      ['string', 'number'].includes(typeof entry[1]),
    )
    .map(([column, value]) => ({ sql: `${column} = ?`, parameters: [value] }));
}

const noFilters = () => [];

export const userProfileMapper: EntityMapper<
  UserProfile,
  Record<string, never>
> = {
  table: 'user_profiles',
  columns: [
    ...metadataColumns,
    'display_name',
    'locale',
    'time_zone',
    'week_starts_on',
    'accessibility_json',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    display_name: entity.displayName,
    locale: entity.locale,
    time_zone: entity.timeZone,
    week_starts_on: entity.weekStartsOn,
    accessibility_json: JSON.stringify(entity.accessibility),
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    displayName: nullableString(row, 'display_name'),
    locale: stringValue(row, 'locale'),
    timeZone: toTimeZone(stringValue(row, 'time_zone')),
    weekStartsOn: numberValue(row, 'week_starts_on') as UserProfile['weekStartsOn'],
    accessibility: accessibilityValue(row),
  }),
  buildFilters: noFilters,
};

export const workspaceMapper: EntityMapper<Workspace, WorkspaceFilter> = {
  table: 'workspaces',
  columns: [...metadataColumns, 'profile_id', 'name', 'kind', 'status'],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    profile_id: entity.profileId,
    name: entity.name,
    kind: entity.kind,
    status: entity.status,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    profileId: stringValue(row, 'profile_id'),
    name: stringValue(row, 'name'),
    kind: stringValue(row, 'kind') as Workspace['kind'],
    status: stringValue(row, 'status') as Workspace['status'],
  }),
  buildFilters: (filter) =>
    clauses([
      ['profile_id', filter?.profileId],
      ['status', filter?.status],
    ]),
};

export const appSettingsMapper: EntityMapper<AppSettings, ProfileFilter> = {
  table: 'app_settings',
  columns: [
    ...metadataColumns,
    'profile_id',
    'theme_preference',
    'default_tab',
    'planning_day_starts_at',
    'language_preference',
    'daily_planning_capacity_minutes',
    'planner_view',
    'insights_view',
    'insights_range',
    'notification_titles_enabled',
    'quiet_hours_enabled',
    'quiet_hours_start',
    'quiet_hours_end',
    'device_calendar_id',
    'device_calendar_name',
    'onboarding_version',
    'onboarding_completed_at',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    profile_id: entity.profileId,
    theme_preference: entity.themePreference,
    default_tab: entity.defaultTab,
    planning_day_starts_at: entity.planningDayStartsAt,
    language_preference: entity.languagePreference,
    daily_planning_capacity_minutes: entity.dailyPlanningCapacityMinutes,
    planner_view: entity.plannerView,
    insights_view: entity.insightsView,
    insights_range: entity.insightsRange,
    notification_titles_enabled: entity.notificationTitlesEnabled ? 1 : 0,
    quiet_hours_enabled: entity.quietHoursEnabled ? 1 : 0,
    quiet_hours_start: entity.quietHoursStart,
    quiet_hours_end: entity.quietHoursEnd,
    device_calendar_id: entity.deviceCalendarId,
    device_calendar_name: entity.deviceCalendarName,
    onboarding_version: entity.onboardingVersion,
    onboarding_completed_at: entity.onboardingCompletedAt,
  }),
  fromRow: (row) => {
    const onboardingCompletedAt = nullableString(
      row,
      'onboarding_completed_at',
    );

    return {
      ...metadataFromRow(row),
      profileId: stringValue(row, 'profile_id'),
      themePreference: stringValue(
        row,
        'theme_preference',
      ) as AppSettings['themePreference'],
      defaultTab: stringValue(row, 'default_tab') as AppSettings['defaultTab'],
      planningDayStartsAt: toLocalTime(
        stringValue(row, 'planning_day_starts_at'),
      ),
      languagePreference: stringValue(
        row,
        'language_preference',
      ) as AppSettings['languagePreference'],
      dailyPlanningCapacityMinutes: numberValue(
        row,
        'daily_planning_capacity_minutes',
      ),
      plannerView: stringValue(row, 'planner_view') as AppSettings['plannerView'],
      insightsView: stringValue(row, 'insights_view') as AppSettings['insightsView'],
      insightsRange: stringValue(row, 'insights_range') as AppSettings['insightsRange'],
      notificationTitlesEnabled:
        numberValue(row, 'notification_titles_enabled') === 1,
      quietHoursEnabled: numberValue(row, 'quiet_hours_enabled') === 1,
      quietHoursStart: toLocalTime(stringValue(row, 'quiet_hours_start')),
      quietHoursEnd: toLocalTime(stringValue(row, 'quiet_hours_end')),
      deviceCalendarId: nullableString(row, 'device_calendar_id'),
      deviceCalendarName: nullableString(row, 'device_calendar_name'),
      onboardingVersion: numberValue(row, 'onboarding_version'),
      onboardingCompletedAt: onboardingCompletedAt
        ? toInstant(onboardingCompletedAt)
        : null,
    };
  },
  buildFilters: (filter) => clauses([['profile_id', filter?.profileId]]),
};

export const accountLinkMapper: EntityMapper<
  LocalAccountLink,
  AccountLinkFilter
> = {
  table: 'account_links',
  columns: [
    ...metadataColumns,
    'local_profile_id',
    'local_workspace_id',
    'remote_account_id',
    'status',
    'linked_at',
    'last_authenticated_at',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    local_profile_id: entity.localProfileId,
    local_workspace_id: entity.localWorkspaceId,
    remote_account_id: entity.remoteAccountId,
    status: entity.status,
    linked_at: entity.linkedAt,
    last_authenticated_at: entity.lastAuthenticatedAt,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    localProfileId: stringValue(row, 'local_profile_id'),
    localWorkspaceId: nullableString(row, 'local_workspace_id'),
    remoteAccountId: stringValue(row, 'remote_account_id'),
    status: stringValue(row, 'status') as LocalAccountLink['status'],
    linkedAt: toInstant(stringValue(row, 'linked_at')),
    lastAuthenticatedAt: toInstant(
      stringValue(row, 'last_authenticated_at'),
    ),
  }),
  buildFilters: (filter) =>
    clauses([
      ['local_profile_id', filter?.localProfileId],
      ['remote_account_id', filter?.remoteAccountId],
      ['status', filter?.status],
    ]),
};

export const areaMapper: EntityMapper<
  Area,
  WorkspaceEntityFilter<Area['status']>
> = {
  table: 'areas',
  columns: [...metadataColumns, 'workspace_id', 'name', 'color', 'status'],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    name: entity.name,
    color: entity.color,
    status: entity.status,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    name: stringValue(row, 'name'),
    color: nullableString(row, 'color'),
    status: stringValue(row, 'status') as Area['status'],
  }),
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
    ]),
};

export const goalMapper: EntityMapper<
  Goal,
  WorkspaceEntityFilter<Goal['status']>
> = {
  table: 'goals',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'area_id',
    'title',
    'description',
    'motivation',
    'status',
    'horizon',
    'target_date',
    'completed_at',
    'progress_method',
    'manual_progress',
    'next_action_task_id',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    area_id: entity.areaId,
    title: entity.title,
    description: entity.description,
    motivation: entity.motivation,
    status: entity.status,
    horizon: entity.horizon,
    target_date: entity.targetDate,
    completed_at: entity.completedAt,
    progress_method: entity.progressMethod,
    manual_progress: entity.manualProgress,
    next_action_task_id: entity.nextActionTaskId,
  }),
  fromRow: (row) => {
    const targetDate = nullableString(row, 'target_date');
    const completedAt = nullableString(row, 'completed_at');

    return {
      ...metadataFromRow(row),
      workspaceId: stringValue(row, 'workspace_id'),
      areaId: nullableString(row, 'area_id'),
      title: stringValue(row, 'title'),
      description: nullableString(row, 'description'),
      motivation: nullableString(row, 'motivation'),
      status: stringValue(row, 'status') as Goal['status'],
      horizon: stringValue(row, 'horizon') as Goal['horizon'],
      targetDate: targetDate ? toCalendarDate(targetDate) : null,
      completedAt: completedAt ? toInstant(completedAt) : null,
      progressMethod: stringValue(row, 'progress_method') as Goal['progressMethod'],
      manualProgress: numberValue(row, 'manual_progress'),
      nextActionTaskId: nullableString(row, 'next_action_task_id'),
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
    ]),
};

export const milestoneMapper: EntityMapper<Milestone, MilestoneFilter> = {
  table: 'milestones',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'goal_id',
    'title',
    'notes',
    'status',
    'target_date',
    'completed_at',
    'sort_order',
  ],
  orderBy: 'sort_order ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    goal_id: entity.goalId,
    title: entity.title,
    notes: entity.notes,
    status: entity.status,
    target_date: entity.targetDate,
    completed_at: entity.completedAt,
    sort_order: entity.sortOrder,
  }),
  fromRow: (row) => {
    const targetDate = nullableString(row, 'target_date');
    const completedAt = nullableString(row, 'completed_at');

    return {
      ...metadataFromRow(row),
      workspaceId: stringValue(row, 'workspace_id'),
      goalId: stringValue(row, 'goal_id'),
      title: stringValue(row, 'title'),
      notes: nullableString(row, 'notes'),
      status: stringValue(row, 'status') as Milestone['status'],
      targetDate: targetDate ? toCalendarDate(targetDate) : null,
      completedAt: completedAt ? toInstant(completedAt) : null,
      sortOrder: numberValue(row, 'sort_order'),
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['goal_id', filter?.goalId],
    ]),
};

export const routineMapper: EntityMapper<
  Routine,
  WorkspaceEntityFilter<Routine['status']>
> = {
  table: 'routines',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'title',
    'notes',
    'schedule_json',
    'time_zone',
    'status',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    title: entity.title,
    notes: entity.notes,
    schedule_json: JSON.stringify(entity.schedule),
    time_zone: entity.timeZone,
    status: entity.status,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    title: stringValue(row, 'title'),
    notes: nullableString(row, 'notes'),
    schedule: routineScheduleValue(row),
    timeZone: toTimeZone(stringValue(row, 'time_zone')),
    status: stringValue(row, 'status') as Routine['status'],
  }),
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
    ]),
};

export const routineCheckInMapper: EntityMapper<
  RoutineCheckIn,
  RoutineCheckInFilter
> = {
  table: 'routine_check_ins',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'routine_id',
    'date',
    'outcome',
    'recorded_at',
    'note',
  ],
  orderBy: 'date DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    routine_id: entity.routineId,
    date: entity.date,
    outcome: entity.outcome,
    recorded_at: entity.recordedAt,
    note: entity.note,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    routineId: stringValue(row, 'routine_id'),
    date: toCalendarDate(stringValue(row, 'date')),
    outcome: stringValue(row, 'outcome') as RoutineCheckIn['outcome'],
    recordedAt: toInstant(stringValue(row, 'recorded_at')),
    note: nullableString(row, 'note'),
  }),
  buildFilters: (filter) => {
    const result = clauses([
      ['workspace_id', filter?.workspaceId],
      ['routine_id', filter?.routineId],
    ]);

    if (filter?.fromDate) {
      result.push({ sql: 'date >= ?', parameters: [filter.fromDate] });
    }

    if (filter?.toDate) {
      result.push({ sql: 'date <= ?', parameters: [filter.toDate] });
    }

    return result;
  },
};

export const taskMapper: EntityMapper<
  Task,
  WorkspaceEntityFilter<Task['status']>
> = {
  table: 'tasks',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'title',
    'notes',
    'status',
    'priority',
    'due_date',
    'scheduled_time',
    'time_zone',
    'completed_at',
    'area_id',
    'goal_id',
    'parent_task_id',
  ],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    title: entity.title,
    notes: entity.notes,
    status: entity.status,
    priority: entity.priority,
    due_date: entity.dueDate,
    scheduled_time: entity.scheduledTime,
    time_zone: entity.timeZone,
    completed_at: entity.completedAt,
    area_id: entity.areaId,
    goal_id: entity.goalId,
    parent_task_id: entity.parentTaskId,
  }),
  fromRow: (row) => {
    const dueDate = nullableString(row, 'due_date');
    const scheduledTime = nullableString(row, 'scheduled_time');
    const timeZone = nullableString(row, 'time_zone');
    const completedAt = nullableString(row, 'completed_at');

    return {
      ...metadataFromRow(row),
      workspaceId: stringValue(row, 'workspace_id'),
      title: stringValue(row, 'title'),
      notes: nullableString(row, 'notes'),
      status: stringValue(row, 'status') as Task['status'],
      priority: stringValue(row, 'priority') as Task['priority'],
      dueDate: dueDate ? toCalendarDate(dueDate) : null,
      scheduledTime: scheduledTime ? toLocalTime(scheduledTime) : null,
      timeZone: timeZone ? toTimeZone(timeZone) : null,
      completedAt: completedAt ? toInstant(completedAt) : null,
      areaId: nullableString(row, 'area_id'),
      goalId: nullableString(row, 'goal_id'),
      parentTaskId: nullableString(row, 'parent_task_id'),
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
    ]),
};

export const planBlockMapper: EntityMapper<
  PlanBlock,
  PlanBlockFilter
> = {
  table: 'plan_blocks',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'date',
    'start_time',
    'end_time',
    'time_zone',
    'title',
    'notes',
    'status',
    'task_id',
    'routine_id',
    'series_id',
    'occurrence_date',
    'recurrence_exception',
  ],
  orderBy: 'date ASC, start_time ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    date: entity.date,
    start_time: entity.startTime,
    end_time: entity.endTime,
    time_zone: entity.timeZone,
    title: entity.title,
    notes: entity.notes,
    status: entity.status,
    task_id: entity.taskId,
    routine_id: entity.routineId,
    series_id: entity.seriesId,
    occurrence_date: entity.occurrenceDate,
    recurrence_exception: entity.isRecurrenceException ? 1 : 0,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    date: toCalendarDate(stringValue(row, 'date')),
    startTime: toLocalTime(stringValue(row, 'start_time')),
    endTime: toLocalTime(stringValue(row, 'end_time')),
    timeZone: toTimeZone(stringValue(row, 'time_zone')),
    title: stringValue(row, 'title'),
    notes: nullableString(row, 'notes'),
    status: stringValue(row, 'status') as PlanBlock['status'],
    taskId: nullableString(row, 'task_id'),
    routineId: nullableString(row, 'routine_id'),
    seriesId: nullableString(row, 'series_id'),
    occurrenceDate: nullableString(row, 'occurrence_date')
      ? toCalendarDate(stringValue(row, 'occurrence_date'))
      : null,
    isRecurrenceException: numberValue(row, 'recurrence_exception') === 1,
  }),
  buildFilters: (filter) => {
    const result = clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
      ['task_id', filter?.taskId],
      ['routine_id', filter?.routineId],
      ['series_id', filter?.seriesId],
    ]);

    if (filter?.fromDate) {
      result.push({ sql: 'date >= ?', parameters: [filter.fromDate] });
    }

    if (filter?.toDate) {
      result.push({ sql: 'date <= ?', parameters: [filter.toDate] });
    }

    return result;
  },
};

export const goalRoutineLinkMapper: EntityMapper<
  GoalRoutineLink,
  GoalRoutineLinkFilter
> = {
  table: 'goal_routine_links',
  columns: [...metadataColumns, 'workspace_id', 'goal_id', 'routine_id'],
  orderBy: 'created_at ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    goal_id: entity.goalId,
    routine_id: entity.routineId,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    goalId: stringValue(row, 'goal_id'),
    routineId: stringValue(row, 'routine_id'),
  }),
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['goal_id', filter?.goalId],
      ['routine_id', filter?.routineId],
    ]),
};

export const planBlockSeriesMapper: EntityMapper<
  PlanBlockSeries,
  PlanBlockSeriesFilter
> = {
  table: 'plan_block_series',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'title',
    'notes',
    'start_date',
    'start_time',
    'end_time',
    'time_zone',
    'frequency',
    'interval_count',
    'weekdays_json',
    'end_date',
    'task_id',
    'routine_id',
    'status',
  ],
  orderBy: 'start_date ASC, start_time ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    title: entity.title,
    notes: entity.notes,
    start_date: entity.startDate,
    start_time: entity.startTime,
    end_time: entity.endTime,
    time_zone: entity.timeZone,
    frequency: entity.frequency,
    interval_count: entity.interval,
    weekdays_json: JSON.stringify(entity.weekdays),
    end_date: entity.endDate,
    task_id: entity.taskId,
    routine_id: entity.routineId,
    status: entity.status,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    title: stringValue(row, 'title'),
    notes: nullableString(row, 'notes'),
    startDate: toCalendarDate(stringValue(row, 'start_date')),
    startTime: toLocalTime(stringValue(row, 'start_time')),
    endTime: toLocalTime(stringValue(row, 'end_time')),
    timeZone: toTimeZone(stringValue(row, 'time_zone')),
    frequency: stringValue(
      row,
      'frequency',
    ) as PlanBlockSeries['frequency'],
    interval: numberValue(row, 'interval_count'),
    weekdays: weekdayArray(row, 'weekdays_json'),
    endDate: nullableString(row, 'end_date')
      ? toCalendarDate(stringValue(row, 'end_date'))
      : null,
    taskId: nullableString(row, 'task_id'),
    routineId: nullableString(row, 'routine_id'),
    status: stringValue(row, 'status') as PlanBlockSeries['status'],
  }),
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['status', filter?.status],
    ]),
};

export const tagMapper: EntityMapper<Tag, WorkspaceEntityFilter> = {
  table: 'tags',
  columns: [...metadataColumns, 'workspace_id', 'name', 'color'],
  orderBy: 'updated_at DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    name: entity.name,
    color: entity.color,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    name: stringValue(row, 'name'),
    color: nullableString(row, 'color'),
  }),
  buildFilters: (filter) => clauses([['workspace_id', filter?.workspaceId]]),
};

export const reflectionMapper: EntityMapper<Reflection, ReflectionFilter> = {
  table: 'reflections',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'scope',
    'scope_id',
    'period_start',
    'body',
    'mood',
  ],
  orderBy: 'period_start DESC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    scope: entity.scope,
    scope_id: entity.scopeId,
    period_start: entity.periodStart,
    body: entity.body,
    mood: entity.mood,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    scope: stringValue(row, 'scope') as Reflection['scope'],
    scopeId: nullableString(row, 'scope_id'),
    periodStart: toCalendarDate(stringValue(row, 'period_start')),
    body: stringValue(row, 'body'),
    mood: nullableString(row, 'mood') as Reflection['mood'],
  }),
  buildFilters: (filter) => {
    const result = clauses([
      ['workspace_id', filter?.workspaceId],
      ['scope', filter?.scope],
      ['scope_id', filter?.scopeId],
    ]);

    if (filter?.fromDate) {
      result.push({ sql: 'period_start >= ?', parameters: [filter.fromDate] });
    }

    if (filter?.toDate) {
      result.push({ sql: 'period_start <= ?', parameters: [filter.toDate] });
    }

    return result;
  },
};

export const reminderIntentMapper: EntityMapper<
  ReminderIntent,
  ReminderIntentFilter
> = {
  table: 'reminder_intents',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'entity_type',
    'entity_id',
    'trigger_kind',
    'offset_minutes',
    'absolute_at',
    'enabled',
  ],
  orderBy: 'updated_at ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    trigger_kind: entity.triggerKind,
    offset_minutes: entity.offsetMinutes,
    absolute_at: entity.absoluteAt,
    enabled: entity.enabled ? 1 : 0,
  }),
  fromRow: (row) => {
    const absoluteAt = nullableString(row, 'absolute_at');
    return {
      ...metadataFromRow(row),
      workspaceId: stringValue(row, 'workspace_id'),
      entityType: stringValue(row, 'entity_type') as ReminderIntent['entityType'],
      entityId: stringValue(row, 'entity_id'),
      triggerKind: stringValue(row, 'trigger_kind') as ReminderIntent['triggerKind'],
      offsetMinutes: nullableNumber(row, 'offset_minutes'),
      absoluteAt: absoluteAt ? toInstant(absoluteAt) : null,
      enabled: numberValue(row, 'enabled') === 1,
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['entity_type', filter?.entityType],
      ['entity_id', filter?.entityId],
      ['enabled', filter?.enabled === undefined ? undefined : filter.enabled ? 1 : 0],
    ]),
};

export const deviceNotificationScheduleMapper: EntityMapper<
  DeviceNotificationSchedule,
  DeviceNotificationScheduleFilter
> = {
  table: 'device_notification_schedules',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'reminder_intent_id',
    'occurrence_key',
    'notification_identifier',
    'scheduled_for',
    'state',
    'reason',
    'source_revision',
  ],
  orderBy: 'scheduled_for ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    reminder_intent_id: entity.reminderIntentId,
    occurrence_key: entity.occurrenceKey,
    notification_identifier: entity.notificationIdentifier,
    scheduled_for: entity.scheduledFor,
    state: entity.state,
    reason: entity.reason,
    source_revision: entity.sourceRevision,
  }),
  fromRow: (row) => {
    const scheduledFor = nullableString(row, 'scheduled_for');
    return {
      ...metadataFromRow(row),
      workspaceId: stringValue(row, 'workspace_id'),
      reminderIntentId: stringValue(row, 'reminder_intent_id'),
      occurrenceKey: stringValue(row, 'occurrence_key'),
      notificationIdentifier: nullableString(row, 'notification_identifier'),
      scheduledFor: scheduledFor ? toInstant(scheduledFor) : null,
      state: stringValue(row, 'state') as DeviceNotificationSchedule['state'],
      reason: nullableString(row, 'reason'),
      sourceRevision: numberValue(row, 'source_revision'),
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['reminder_intent_id', filter?.reminderIntentId],
      ['state', filter?.state],
    ]),
};

export const deviceCalendarEventMapper: EntityMapper<
  DeviceCalendarEvent,
  DeviceCalendarEventFilter
> = {
  table: 'device_calendar_events',
  columns: [
    ...metadataColumns,
    'workspace_id',
    'plan_block_id',
    'calendar_id',
    'event_id',
    'source_revision',
    'source_fingerprint',
    'state',
  ],
  orderBy: 'updated_at ASC, id ASC',
  toRow: (entity) => ({
    ...metadataToRow(entity),
    workspace_id: entity.workspaceId,
    plan_block_id: entity.planBlockId,
    calendar_id: entity.calendarId,
    event_id: entity.eventId,
    source_revision: entity.sourceRevision,
    source_fingerprint: entity.sourceFingerprint,
    state: entity.state,
  }),
  fromRow: (row) => ({
    ...metadataFromRow(row),
    workspaceId: stringValue(row, 'workspace_id'),
    planBlockId: stringValue(row, 'plan_block_id'),
    calendarId: stringValue(row, 'calendar_id'),
    eventId: stringValue(row, 'event_id'),
    sourceRevision: numberValue(row, 'source_revision'),
    sourceFingerprint: stringValue(row, 'source_fingerprint'),
    state: stringValue(row, 'state') as DeviceCalendarEvent['state'],
  }),
  buildFilters: (filter) =>
    clauses([
      ['workspace_id', filter?.workspaceId],
      ['plan_block_id', filter?.planBlockId],
      ['state', filter?.state],
    ]),
};

export const localChangeMapper: EntityMapper<LocalChange, LocalChangeFilter> = {
  table: 'local_changes',
  columns: [
    'id',
    'created_at',
    'updated_at',
    'revision',
    'entity_type',
    'entity_id',
    'entity_revision',
    'operation',
    'state',
    'attempt_count',
    'last_attempt_at',
    'error_code',
  ],
  orderBy: 'created_at ASC, id ASC',
  toRow: (entity) => ({
    id: entity.id,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    revision: entity.revision,
    entity_type: entity.entityType,
    entity_id: entity.entityId,
    entity_revision: entity.entityRevision,
    operation: entity.operation,
    state: entity.state,
    attempt_count: entity.attemptCount,
    last_attempt_at: entity.lastAttemptAt,
    error_code: entity.errorCode,
  }),
  fromRow: (row) => {
    const lastAttemptAt = nullableString(row, 'last_attempt_at');

    return {
      id: stringValue(row, 'id'),
      createdAt: toInstant(stringValue(row, 'created_at')),
      updatedAt: toInstant(stringValue(row, 'updated_at')),
      revision: numberValue(row, 'revision'),
      entityType: stringValue(row, 'entity_type') as LocalChange['entityType'],
      entityId: stringValue(row, 'entity_id'),
      entityRevision: numberValue(row, 'entity_revision'),
      operation: stringValue(row, 'operation') as LocalChange['operation'],
      state: stringValue(row, 'state') as LocalChange['state'],
      attemptCount: numberValue(row, 'attempt_count'),
      lastAttemptAt: lastAttemptAt ? toInstant(lastAttemptAt) : null,
      errorCode: nullableString(row, 'error_code'),
    };
  },
  buildFilters: (filter) =>
    clauses([
      ['entity_type', filter?.entityType],
      ['state', filter?.state],
    ]),
};
