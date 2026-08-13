import {
  toCalendarDate,
  type CalendarDate,
  type LocalTime,
  type TimeZone,
  type Weekday,
} from '../../../domain/entities/index.ts';

export function addCalendarDays(date: CalendarDate, days: number) {
  const value = dateAtNoonUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return toCalendarDate(value.toISOString().slice(0, 10));
}

export function calendarDaysBetween(
  start: CalendarDate,
  end: CalendarDate,
) {
  return Math.round(
    (dateAtNoonUtc(end).getTime() - dateAtNoonUtc(start).getTime()) /
      86_400_000,
  );
}

export function startOfLocalWeek(
  date: CalendarDate,
  weekStartsOn: Weekday,
) {
  const weekday = dateAtNoonUtc(date).getUTCDay();
  return addCalendarDays(date, -((weekday - weekStartsOn + 7) % 7));
}

export function calendarWeek(
  date: CalendarDate,
  weekStartsOn: Weekday,
) {
  const start = startOfLocalWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index));
}

export function localMinutes(time: LocalTime) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function durationMinutes(
  date: CalendarDate,
  startTime: LocalTime,
  endTime: LocalTime,
  timeZone: TimeZone,
) {
  const start = localDateTimeInstant(date, startTime, timeZone);
  const end = localDateTimeInstant(date, endTime, timeZone);
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

export function localDateTimeInstant(
  date: CalendarDate,
  time: LocalTime,
  timeZone: TimeZone,
) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let epoch = target;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = localParts(new Date(epoch), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
    );
    const adjustment = target - represented;
    if (adjustment === 0) break;
    epoch += adjustment;
  }

  const result = new Date(epoch);
  const resolved = localParts(result, timeZone);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    throw new Error('The local time does not exist in this time zone.');
  }

  return result;
}

function dateAtNoonUtc(date: CalendarDate) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function localParts(instant: Date, timeZone: TimeZone) {
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
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}
