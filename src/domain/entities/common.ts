export type EntityId = string;
export type Instant = string & { readonly __kind: 'Instant' };
export type CalendarDate = string & { readonly __kind: 'CalendarDate' };
export type LocalTime = string & { readonly __kind: 'LocalTime' };
export type TimeZone = string & { readonly __kind: 'TimeZone' };

export type EntityMetadata = {
  id: EntityId;
  createdAt: Instant;
  updatedAt: Instant;
  revision: number;
  deletedAt: Instant | null;
};

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function toInstant(value: string | Date): Instant {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid absolute timestamp.');
  }

  return date.toISOString() as Instant;
}

export function toCalendarDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error('Invalid calendar date.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date.');
  }

  return value as CalendarDate;
}

export function toLocalTime(value: string): LocalTime {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Invalid local time.');
  }

  return value as LocalTime;
}

export function toTimeZone(value: string): TimeZone {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return value as TimeZone;
  } catch {
    throw new Error('Invalid time zone.');
  }
}
