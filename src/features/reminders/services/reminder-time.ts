import type {
  AppSettings,
  CalendarDate,
  Goal,
  PlanBlock,
  ReminderIntent,
  Routine,
  Task,
  TimeZone,
} from '../../../domain/entities/index.ts';
import { toLocalTime } from '../../../domain/entities/index.ts';
import { addCalendarDays, localDateTimeInstant } from '../../planner/services/calendar-math.ts';
import { isRoutineScheduled } from '../../routines/services/routine-service.ts';
import { localCalendarDate } from '../../today/services/local-date.ts';

export const MAX_SCHEDULED_OCCURRENCES = 32;
export const REMINDER_WINDOW_DAYS = 28;

export type ReminderSource = Task | PlanBlock | Routine | Goal;
export type ReminderOccurrence = {
  key: string;
  scheduledAt: Date;
  sourceAt: Date | null;
};

export function calculateReminderOccurrences(
  intent: ReminderIntent,
  source: ReminderSource,
  profileTimeZone: TimeZone,
  now: Date,
) {
  if (!intent.enabled) return [];
  const base: { key: string; sourceAt: Date | null; date: Date }[] =
    intent.triggerKind === 'absolute'
      ? intent.absoluteAt
        ? [{ key: intent.absoluteAt, sourceAt: null, date: new Date(intent.absoluteAt) }]
        : []
      : relativeBases(intent, source, profileTimeZone, now);
  return base
    .map((item) => ({
      key: item.key,
      sourceAt: item.sourceAt,
      scheduledAt:
        intent.triggerKind === 'relative'
          ? new Date(item.date.getTime() - (intent.offsetMinutes ?? 0) * 60_000)
          : item.date,
    }))
    .filter((item) => item.scheduledAt.getTime() > now.getTime())
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime() || left.key.localeCompare(right.key))
    .slice(0, MAX_SCHEDULED_OCCURRENCES);
}

export function applyQuietHours(
  occurrence: ReminderOccurrence,
  settings: AppSettings,
  timeZone: TimeZone,
) {
  if (!settings.quietHoursEnabled || settings.quietHoursStart === settings.quietHoursEnd) {
    return { state: 'schedule' as const, date: occurrence.scheduledAt };
  }
  const local = localDateAndTime(occurrence.scheduledAt, timeZone);
  const start = minutes(settings.quietHoursStart);
  const end = minutes(settings.quietHoursEnd);
  const current = minutes(local.time);
  const inside = start < end ? current >= start && current < end : current >= start || current < end;
  if (!inside) return { state: 'schedule' as const, date: occurrence.scheduledAt };
  const endDate =
    start > end && current >= start ? addCalendarDays(local.date, 1) : local.date;
  const deferred = localDateTimeInstant(endDate, settings.quietHoursEnd, timeZone);
  if (occurrence.sourceAt && deferred.getTime() >= occurrence.sourceAt.getTime()) {
    return { state: 'skip' as const, reason: 'quiet_hours_stale' };
  }
  return { state: 'schedule' as const, date: deferred };
}

function relativeBases(
  intent: ReminderIntent,
  source: ReminderSource,
  profileTimeZone: TimeZone,
  now: Date,
) {
  if (intent.entityType === 'task') {
    const task = source as Task;
    if (!task.dueDate || !task.scheduledTime || !['pending', 'in_progress'].includes(task.status)) return [];
    const date = localDateTimeInstant(task.dueDate, task.scheduledTime, task.timeZone ?? profileTimeZone);
    return [{ key: task.dueDate, sourceAt: date, date }];
  }
  if (intent.entityType === 'plan_block') {
    const block = source as PlanBlock;
    if (block.status !== 'planned') return [];
    const date = localDateTimeInstant(block.date, block.startTime, block.timeZone);
    return [{ key: block.date, sourceAt: date, date }];
  }
  if (intent.entityType === 'goal') {
    const goal = source as Goal;
    if (!goal.targetDate || goal.status !== 'active') return [];
    const date = localDateTimeInstant(goal.targetDate, toLocalTime('09:00'), profileTimeZone);
    return [{ key: goal.targetDate, sourceAt: date, date }];
  }
  const routine = source as Routine;
  if (routine.status !== 'active' || !routine.schedule.time) return [];
  const today = localCalendarDate(now, routine.timeZone);
  return Array.from({ length: REMINDER_WINDOW_DAYS }, (_, index) => addCalendarDays(today, index))
    .filter((date) => isRoutineScheduled(routine, date))
    .map((date) => {
      const instant = localDateTimeInstant(date, routine.schedule.time!, routine.timeZone);
      return { key: date, sourceAt: instant, date: instant };
    });
}

function localDateAndTime(instant: Date, timeZone: TimeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}` as CalendarDate,
    time: `${values.hour}:${values.minute}`,
  };
}

function minutes(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}
