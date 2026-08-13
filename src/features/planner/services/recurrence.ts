import {
  toCalendarDate,
  toLocalTime,
  type CalendarDate,
  type PlanBlockSeries,
  type RecurrenceFrequency,
  type TimeZone,
  type Weekday,
} from '../../../domain/entities/index.ts';
import type {
  RepositoryScope,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import { weekdayForDate } from '../../today/services/local-date.ts';
import { addCalendarDays, calendarDaysBetween } from './calendar-math.ts';
import { PlanBlockValidationError } from './plan-block-service.ts';

export const RECURRENCE_WINDOW_DAYS = 56;

export type RecurrenceDraft = {
  title: string;
  notes: string;
  startDate: string;
  startTime: string;
  endTime: string;
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: Weekday[];
  endDate: string;
  taskId: string | null;
  routineId: string | null;
};

export class RecurrenceService {
  constructor(private readonly repositories: RepositoryStore) {}

  async create(
    workspaceId: string,
    draft: RecurrenceDraft,
    timeZone: TimeZone,
  ) {
    const value = validateRecurrenceDraft(draft);
    const windowEnd = boundedEnd(value.startDate, value.endDate);

    return this.repositories.transaction(async (scope) => {
      await validateSeriesLinks(
        scope,
        workspaceId,
        value.taskId,
        value.routineId,
      );
      const series = await scope.planBlockSeries.create({
        workspaceId,
        ...value,
        timeZone,
        status: 'active',
      });
      const occurrences = await materializeSeries(
        scope,
        series,
        value.startDate,
        windowEnd,
      );
      return { series, occurrences };
    });
  }

  async materializeWindow(
    workspaceId: string,
    fromDate: CalendarDate,
    toDate: CalendarDate,
  ) {
    assertBoundedWindow(fromDate, toDate);
    return this.repositories.transaction(async (scope) => {
      const page = await scope.planBlockSeries.list({
        filter: { workspaceId, status: 'active' },
        page: { limit: 100, offset: 0 },
      });
      const created = [];
      for (const series of page.items) {
        created.push(
          ...(await materializeSeries(scope, series, fromDate, toDate)),
        );
      }
      return created;
    });
  }

  async editFuture(
    series: PlanBlockSeries,
    draft: RecurrenceDraft,
    effectiveDate: CalendarDate,
    timeZone: TimeZone,
  ) {
    const value = validateRecurrenceDraft({
      ...draft,
      startDate: effectiveDate,
    });
    const windowEnd = boundedEnd(effectiveDate, value.endDate);

    return this.repositories.transaction(async (scope) => {
      const current = await scope.planBlockSeries.getById(series.id);
      if (!current || current.revision !== series.revision) {
        throw new PlanBlockValidationError({
          recurrence: 'This recurrence changed. Refresh and try again.',
        });
      }
      await validateSeriesLinks(
        scope,
        series.workspaceId,
        value.taskId,
        value.routineId,
      );
      const occurrences = await listSeriesOccurrences(scope, series.id, true);

      for (const occurrence of occurrences) {
        if (
          occurrence.status === 'planned' &&
          occurrence.occurrenceDate &&
          occurrence.occurrenceDate >= effectiveDate
        ) {
          await scope.planBlocks.softDelete(
            occurrence.id,
            occurrence.revision,
          );
        }
      }

      if (effectiveDate <= series.startDate) {
        await scope.planBlockSeries.softDelete(series.id, series.revision);
      } else {
        await scope.planBlockSeries.update(series.id, {
          expectedRevision: series.revision,
          endDate: addCalendarDays(effectiveDate, -1),
        });
      }

      const nextSeries = await scope.planBlockSeries.create({
        workspaceId: series.workspaceId,
        ...value,
        startDate: effectiveDate,
        timeZone,
        status: 'active',
      });
      const created = await materializeSeries(
        scope,
        nextSeries,
        effectiveDate,
        windowEnd,
      );
      return { series: nextSeries, occurrences: created };
    });
  }

  async setPaused(series: PlanBlockSeries, paused: boolean) {
    return this.repositories.planBlockSeries.update(series.id, {
      expectedRevision: series.revision,
      status: paused ? 'paused' : 'active',
    });
  }
}

export function recurrenceDates(
  series: Pick<
    PlanBlockSeries,
    'startDate' | 'endDate' | 'frequency' | 'interval' | 'weekdays'
  >,
  fromDate: CalendarDate,
  toDate: CalendarDate,
) {
  assertBoundedWindow(fromDate, toDate);
  const dates: CalendarDate[] = [];
  const first = fromDate > series.startDate ? fromDate : series.startDate;
  const last = series.endDate && series.endDate < toDate ? series.endDate : toDate;

  for (let date = first; date <= last; date = addCalendarDays(date, 1)) {
    const elapsed = calendarDaysBetween(series.startDate, date);
    const matches =
      series.frequency === 'daily'
        ? elapsed % series.interval === 0
        : Math.floor(elapsed / 7) % series.interval === 0 &&
          series.weekdays.includes(weekdayForDate(date));
    if (matches) dates.push(date);
  }

  return dates;
}

export function validateRecurrenceDraft(draft: RecurrenceDraft) {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  let startDate: CalendarDate | null = null;
  let endDate: CalendarDate | null = null;

  if (!title) errors.title = 'Enter a block title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';
  if (notes.length > 4000) errors.notes = 'Use 4,000 characters or fewer.';

  try {
    startDate = toCalendarDate(draft.startDate.trim());
  } catch {
    errors.startDate = 'Use a valid start date.';
  }
  if (draft.endDate.trim()) {
    try {
      endDate = toCalendarDate(draft.endDate.trim());
    } catch {
      errors.endDate = 'Use a valid end date.';
    }
  }
  let startTime = null;
  let endTime = null;
  try {
    startTime = toLocalTime(draft.startTime.trim());
  } catch {
    errors.startTime = 'Use a valid start time.';
  }
  try {
    endTime = toLocalTime(draft.endTime.trim());
  } catch {
    errors.endTime = 'Use a valid end time.';
  }
  if (startTime && endTime && endTime <= startTime) {
    errors.endTime = 'End time must be after start time.';
  }
  if (!Number.isInteger(draft.interval) || draft.interval < 1 || draft.interval > 365) {
    errors.interval = 'Repeat interval must be between 1 and 365.';
  }
  const weekdays = [...new Set(draft.weekdays)].sort(
    (left, right) => left - right,
  );
  if (draft.frequency === 'weekly' && weekdays.length === 0) {
    errors.weekdays = 'Choose at least one weekday.';
  }
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = 'End date cannot be before the start date.';
  }
  if (draft.taskId && draft.routineId) {
    errors.link = 'Link either a task or a routine, not both.';
  }
  if (
    Object.keys(errors).length ||
    !startDate ||
    !startTime ||
    !endTime
  ) {
    throw new PlanBlockValidationError(errors);
  }

  return {
    title,
    notes: notes || null,
    startDate,
    startTime,
    endTime,
    frequency: draft.frequency,
    interval: draft.interval,
    weekdays,
    endDate,
    taskId: draft.taskId,
    routineId: draft.routineId,
  };
}

async function materializeSeries(
  scope: RepositoryScope,
  series: PlanBlockSeries,
  fromDate: CalendarDate,
  toDate: CalendarDate,
) {
  const existing = await listSeriesOccurrences(scope, series.id, true);
  const existingDates = new Set(
    existing.flatMap((block) =>
      block.occurrenceDate ? [block.occurrenceDate] : [],
    ),
  );
  const created = [];

  for (const date of recurrenceDates(series, fromDate, toDate)) {
    if (existingDates.has(date)) continue;
    created.push(
      await scope.planBlocks.create({
        workspaceId: series.workspaceId,
        date,
        startTime: series.startTime,
        endTime: series.endTime,
        timeZone: series.timeZone,
        title: series.title,
        notes: series.notes,
        status: 'planned',
        taskId: series.taskId,
        routineId: series.routineId,
        seriesId: series.id,
        occurrenceDate: date,
        isRecurrenceException: false,
      }),
    );
  }

  return created;
}

async function listSeriesOccurrences(
  scope: RepositoryScope,
  seriesId: string,
  includeDeleted: boolean,
) {
  const occurrences = [];
  let offset = 0;
  while (true) {
    const page = await scope.planBlocks.list({
      filter: { seriesId },
      includeDeleted,
      page: { limit: 100, offset },
    });
    occurrences.push(...page.items);
    if (page.nextOffset === null) return occurrences;
    offset = page.nextOffset;
  }
}

async function validateSeriesLinks(
  scope: RepositoryScope,
  workspaceId: string,
  taskId: string | null,
  routineId: string | null,
) {
  if (taskId) {
    const task = await scope.tasks.getById(taskId);
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
    const routine = await scope.routines.getById(routineId);
    if (!routine || routine.workspaceId !== workspaceId || routine.status === 'archived') {
      throw new PlanBlockValidationError({
        routineId: 'Choose an available routine from this workspace.',
      });
    }
  }
}

function boundedEnd(startDate: CalendarDate, endDate: CalendarDate | null) {
  const limit = addCalendarDays(startDate, RECURRENCE_WINDOW_DAYS - 1);
  return endDate && endDate < limit ? endDate : limit;
}

function assertBoundedWindow(fromDate: CalendarDate, toDate: CalendarDate) {
  const days = calendarDaysBetween(fromDate, toDate);
  if (days < 0 || days >= RECURRENCE_WINDOW_DAYS) {
    throw new PlanBlockValidationError({
      recurrence: `Recurrence windows are limited to ${RECURRENCE_WINDOW_DAYS} days.`,
    });
  }
}
