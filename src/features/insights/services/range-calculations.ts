import type {
  CalendarDate,
  InsightsRange,
  TimeZone,
  Weekday,
} from '../../../domain/entities/index.ts';
import {
  addCalendarDays,
  calendarDaysBetween,
  startOfLocalWeek,
} from '../../planner/services/calendar-math.ts';
import { localCalendarDate } from '../../today/services/local-date.ts';

export type InsightsPeriod = {
  start: CalendarDate;
  end: CalendarDate;
  dayCount: number;
  includesToday: boolean;
};

export type InsightsRangeWindow = {
  key: InsightsRange;
  current: InsightsPeriod;
  previous: InsightsPeriod;
  weekStartsOn: Weekday;
};

export function calculateInsightsRange(
  today: CalendarDate,
  key: InsightsRange,
  weekStartsOn: Weekday,
): InsightsRangeWindow {
  const dayCount = key === '7d' ? 7 : key === '4w' ? 28 : 84;
  const current = periodEnding(today, dayCount, true);
  const previousEnd = addCalendarDays(current.start, -1);
  return {
    key,
    current,
    previous: periodEnding(previousEnd, dayCount, false),
    weekStartsOn,
  };
}

export function normalizeWeeklyPeriod(
  date: CalendarDate,
  weekStartsOn: Weekday,
) {
  return startOfLocalWeek(date, weekStartsOn);
}

export function dateWithinPeriod(date: CalendarDate, period: InsightsPeriod) {
  return date >= period.start && date <= period.end;
}

export function datesInPeriod(period: InsightsPeriod) {
  return Array.from({ length: period.dayCount }, (_, index) =>
    addCalendarDays(period.start, index),
  );
}

export function localDateForTimestamp(timestamp: string, timeZone: TimeZone) {
  return localCalendarDate(new Date(timestamp), timeZone);
}

export function orderedWeekdays(weekStartsOn: Weekday) {
  return Array.from(
    { length: 7 },
    (_, index) => ((weekStartsOn + index) % 7) as Weekday,
  );
}

function periodEnding(
  end: CalendarDate,
  dayCount: number,
  includesToday: boolean,
): InsightsPeriod {
  const start = addCalendarDays(end, -(dayCount - 1));
  if (calendarDaysBetween(start, end) + 1 !== dayCount) {
    throw new Error('The insight period could not be normalized.');
  }
  return { start, end, dayCount, includesToday };
}
