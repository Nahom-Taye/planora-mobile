import { toCalendarDate, type MilestoneStatus } from '../../../domain/entities/index.ts';

export type MilestoneDraft = {
  title: string;
  notes: string;
  targetDate: string;
  status: MilestoneStatus;
};

export function validateMilestoneDraft(draft: MilestoneDraft) {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const notes = draft.notes.trim();
  let targetDate: ReturnType<typeof toCalendarDate> | null = null;
  if (!title) errors.title = 'Enter a milestone title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';
  if (notes.length > 4000) errors.notes = 'Use 4,000 characters or fewer.';
  if (draft.targetDate.trim()) {
    try {
      targetDate = toCalendarDate(draft.targetDate.trim());
    } catch {
      errors.targetDate = 'Use a valid date in YYYY-MM-DD format.';
    }
  }
  if (Object.keys(errors).length) return { valid: false as const, errors };
  return {
    valid: true as const,
    value: { title, notes: notes || null, targetDate, status: draft.status },
  };
}
