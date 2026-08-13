import {
  toCalendarDate,
  toLocalTime,
  type CalendarDate,
  type LocalTime,
  type TaskPriority,
  type TaskStatus,
} from '../../../domain/entities/index.ts';

export type TaskDraft = {
  title: string;
  notes: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  scheduledTime: string;
};

export type ValidTaskDraft = {
  title: string;
  notes: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: CalendarDate | null;
  scheduledTime: LocalTime | null;
};

export type TaskValidationResult =
  | { valid: true; value: ValidTaskDraft }
  | { valid: false; errors: Record<string, string> };

export function validateTaskDraft(draft: TaskDraft): TaskValidationResult {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  let dueDate: CalendarDate | null = null;
  let scheduledTime: LocalTime | null = null;

  if (!title) errors.title = 'Enter a task title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';

  if (notes.length > 4000) errors.notes = 'Use 4,000 characters or fewer.';

  if (draft.dueDate.trim()) {
    try {
      dueDate = toCalendarDate(draft.dueDate.trim());
    } catch {
      errors.dueDate = 'Use a valid date in YYYY-MM-DD format.';
    }
  }

  if (draft.scheduledTime.trim()) {
    try {
      scheduledTime = toLocalTime(draft.scheduledTime.trim());
    } catch {
      errors.scheduledTime = 'Use a valid time in HH:MM format.';
    }
  }

  if (scheduledTime && !dueDate) {
    errors.scheduledTime = 'Choose a due date for a scheduled time.';
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };

  return {
    valid: true,
    value: {
      title,
      notes: notes || null,
      priority: draft.priority,
      status: draft.status,
      dueDate,
      scheduledTime,
    },
  };
}
