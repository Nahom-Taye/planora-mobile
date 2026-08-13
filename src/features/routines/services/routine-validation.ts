import {
  toLocalTime,
  type LocalTime,
  type RoutineStatus,
  type Weekday,
} from '../../../domain/entities/index.ts';

export type RoutineDraft = {
  title: string;
  notes: string;
  scheduleKind: 'daily' | 'weekly';
  weekdays: Weekday[];
  time: string;
  status: RoutineStatus;
};

export type RoutineValidationResult =
  | {
      valid: true;
      value: {
        title: string;
        notes: string | null;
        scheduleKind: 'daily' | 'weekly';
        weekdays: Weekday[];
        time: LocalTime | null;
        status: RoutineStatus;
      };
    }
  | { valid: false; errors: Record<string, string> };

export function validateRoutineDraft(
  draft: RoutineDraft,
): RoutineValidationResult {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  let time: LocalTime | null = null;

  if (!title) errors.title = 'Enter a routine title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';

  if (notes.length > 4000) errors.notes = 'Use 4,000 characters or fewer.';

  if (draft.scheduleKind === 'weekly' && draft.weekdays.length === 0) {
    errors.weekdays = 'Choose at least one weekday.';
  }

  if (draft.time.trim()) {
    try {
      time = toLocalTime(draft.time.trim());
    } catch {
      errors.time = 'Use a valid time in HH:MM format.';
    }
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title,
      notes: notes || null,
      scheduleKind: draft.scheduleKind,
      weekdays: [...new Set(draft.weekdays)].sort() as Weekday[],
      time,
      status: draft.status,
    },
  };
}
