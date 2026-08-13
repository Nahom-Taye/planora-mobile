import {
  toCalendarDate,
  toLocalTime,
  type CalendarDate,
  type LocalTime,
  type PlanBlockStatus,
  type TimeZone,
} from '../../../domain/entities/index.ts';
import { durationMinutes } from './calendar-math.ts';

export type PlanBlockDraft = {
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  status: PlanBlockStatus;
  taskId: string | null;
  routineId: string | null;
};

export type ValidPlanBlockDraft = {
  title: string;
  notes: string | null;
  date: CalendarDate;
  startTime: LocalTime;
  endTime: LocalTime;
  status: PlanBlockStatus;
  taskId: string | null;
  routineId: string | null;
};

export type PlanBlockValidationResult =
  | { valid: true; value: ValidPlanBlockDraft }
  | { valid: false; errors: Record<string, string> };

export function validatePlanBlockDraft(
  draft: PlanBlockDraft,
  timeZone: TimeZone,
): PlanBlockValidationResult {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  let date: CalendarDate | null = null;
  let startTime: LocalTime | null = null;
  let endTime: LocalTime | null = null;

  if (!title) errors.title = 'Enter a block title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';
  if (notes.length > 4000) errors.notes = 'Use 4,000 characters or fewer.';

  try {
    date = toCalendarDate(draft.date.trim());
  } catch {
    errors.date = 'Use a valid date in YYYY-MM-DD format.';
  }

  try {
    startTime = toLocalTime(draft.startTime.trim());
  } catch {
    errors.startTime = 'Use a valid start time in HH:MM format.';
  }

  try {
    endTime = toLocalTime(draft.endTime.trim());
  } catch {
    errors.endTime = 'Use a valid end time in HH:MM format.';
  }

  if (startTime && endTime && endTime <= startTime) {
    errors.endTime = 'End time must be after start time.';
  }

  if (date && startTime && endTime && !errors.endTime) {
    try {
      if (durationMinutes(date, startTime, endTime, timeZone) <= 0) {
        errors.endTime = 'End time must be after start time.';
      }
    } catch {
      errors.startTime = 'Choose a local time that exists on this date.';
    }
  }

  if (draft.taskId && draft.routineId) {
    errors.link = 'Link either a task or a routine, not both.';
  }

  if (Object.keys(errors).length || !date || !startTime || !endTime) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    value: {
      title,
      notes: notes || null,
      date,
      startTime,
      endTime,
      status: draft.status,
      taskId: draft.taskId,
      routineId: draft.routineId,
    },
  };
}
