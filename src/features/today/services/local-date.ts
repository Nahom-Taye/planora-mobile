import {
  toCalendarDate,
  type CalendarDate,
  type TimeZone,
  type Weekday,
} from '../../../domain/entities/index.ts';

export function localCalendarDate(
  instant: Date,
  timeZone: TimeZone,
): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return toCalendarDate(`${values.year}-${values.month}-${values.day}`);
}

export function weekdayForDate(date: CalendarDate): Weekday {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as Weekday;
}

export function formatCalendarDate(
  date: CalendarDate,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function compareCalendarDates(
  left: CalendarDate,
  right: CalendarDate,
) {
  return left.localeCompare(right);
}
