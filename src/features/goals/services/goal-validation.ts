import {
  toCalendarDate,
  type GoalHorizon,
  type GoalProgressMethod,
  type GoalStatus,
} from '../../../domain/entities/index.ts';

export type GoalDraft = {
  title: string;
  description: string;
  motivation: string;
  horizon: GoalHorizon;
  targetDate: string;
  status: GoalStatus;
  areaId: string | null;
  progressMethod: GoalProgressMethod;
  manualProgress: string;
};

export type ValidGoalDraft = {
  title: string;
  description: string | null;
  motivation: string | null;
  horizon: GoalHorizon;
  targetDate: ReturnType<typeof toCalendarDate> | null;
  status: GoalStatus;
  areaId: string | null;
  progressMethod: GoalProgressMethod;
  manualProgress: number;
};

export function validateGoalDraft(
  draft: GoalDraft,
): { valid: true; value: ValidGoalDraft } | { valid: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const description = draft.description.trim();
  const motivation = draft.motivation.trim();
  const targetDate = optionalDate(draft.targetDate, errors);
  const manualProgress = Number(draft.manualProgress);

  if (!title) errors.title = 'Enter a goal title.';
  else if (title.length > 200) errors.title = 'Use 200 characters or fewer.';
  if (description.length > 4000) errors.description = 'Use 4,000 characters or fewer.';
  if (motivation.length > 4000) errors.motivation = 'Use 4,000 characters or fewer.';
  if (!Number.isInteger(manualProgress) || manualProgress < 0 || manualProgress > 100) {
    errors.manualProgress = 'Enter a whole percentage from 0 through 100.';
  }

  if (Object.keys(errors).length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      title,
      description: description || null,
      motivation: motivation || null,
      horizon: draft.horizon,
      targetDate,
      status: draft.status,
      areaId: draft.areaId,
      progressMethod: draft.progressMethod,
      manualProgress,
    },
  };
}

function optionalDate(value: string, errors: Record<string, string>) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return toCalendarDate(trimmed);
  } catch {
    errors.targetDate = 'Use a valid date in YYYY-MM-DD format.';
    return null;
  }
}
