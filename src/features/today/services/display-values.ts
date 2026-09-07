import { toCalendarDate, toLocalTime } from '../../../domain/entities/common.ts';

export function calendarDateValue(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    return toCalendarDate(value);
  } catch {
    return null;
  }
}

export function localTimeValue(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    return toLocalTime(value);
  } catch {
    return null;
  }
}

export function instantValue(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  if (!calendarDateValue(value.slice(0, 10)) || !localTimeValue(value.slice(11, 16)) || Number(value.slice(17, 19)) > 59) return null;
  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? instant : null;
}
