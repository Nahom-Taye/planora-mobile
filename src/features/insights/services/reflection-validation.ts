import {
  toCalendarDate,
  type Reflection,
  type ReflectionScope,
  type Weekday,
} from '../../../domain/entities/index.ts';
import { normalizeWeeklyPeriod } from './range-calculations.ts';

export const MAX_REFLECTION_BODY_LENGTH = 8000;

export type ReflectionDraft = {
  scope: ReflectionScope;
  scopeId: string | null;
  periodStart: string;
  body: string;
  mood: Reflection['mood'];
};

export function validateReflectionDraft(
  draft: ReflectionDraft,
  weekStartsOn: Weekday,
) {
  const errors: Record<string, string> = {};
  const body = draft.body.trim();
  let periodStart: ReturnType<typeof toCalendarDate> | null = null;

  if (!body) errors.body = 'Write a reflection before saving.';
  else if (body.length > MAX_REFLECTION_BODY_LENGTH) {
    errors.body = 'Use 8,000 characters or fewer.';
  }
  try {
    periodStart = toCalendarDate(draft.periodStart.trim());
  } catch {
    errors.periodStart = 'Choose a valid reflection date.';
  }
  if (draft.scope === 'goal' && !draft.scopeId) {
    errors.scopeId = 'Choose an available goal from this workspace.';
  }
  if (draft.scope !== 'goal' && draft.scopeId !== null) {
    errors.scopeId = 'This reflection scope does not use an identifier.';
  }
  if (
    draft.mood !== null &&
    !['low', 'steady', 'good', 'great'].includes(draft.mood)
  ) {
    errors.mood = 'Choose an available mood label.';
  }
  if (Object.keys(errors).length || !periodStart) {
    return { valid: false as const, errors };
  }

  return {
    valid: true as const,
    value: {
      scope: draft.scope,
      scopeId: draft.scope === 'goal' ? draft.scopeId : null,
      periodStart:
        draft.scope === 'week'
          ? normalizeWeeklyPeriod(periodStart, weekStartsOn)
          : periodStart,
      body,
      mood: draft.mood,
    },
  };
}
