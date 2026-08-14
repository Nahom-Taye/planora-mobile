import {
  toInstant,
  type ReminderEntityType,
  type ReminderIntent,
} from '../../../domain/entities/index.ts';

export type ReminderDraft = {
  entityType: ReminderEntityType;
  entityId: string;
  triggerKind: ReminderIntent['triggerKind'];
  offsetMinutes: number | null;
  absoluteAt: string | null;
  enabled: boolean;
};

export function validateReminderDraft(draft: ReminderDraft) {
  const errors: Record<string, string> = {};
  const entityId = draft.entityId.trim();
  let absoluteAt: ReminderIntent['absoluteAt'] = null;
  if (!entityId) errors.entityId = 'Choose an available planning item.';
  if (draft.triggerKind === 'relative') {
    if (
      draft.offsetMinutes === null ||
      !Number.isInteger(draft.offsetMinutes) ||
      draft.offsetMinutes < 0 ||
      draft.offsetMinutes > 10080
    ) {
      errors.offsetMinutes = 'Choose a supported reminder time.';
    }
    if (draft.absoluteAt !== null) errors.absoluteAt = 'Choose one reminder time.';
  } else {
    if (draft.offsetMinutes !== null) errors.offsetMinutes = 'Choose one reminder time.';
    try {
      absoluteAt = toInstant(new Date(draft.absoluteAt ?? ''));
    } catch {
      errors.absoluteAt = 'Choose a valid date and time.';
    }
  }
  if (Object.keys(errors).length) return { valid: false as const, errors };
  return {
    valid: true as const,
    value: {
      entityType: draft.entityType,
      entityId,
      triggerKind: draft.triggerKind,
      offsetMinutes: draft.triggerKind === 'relative' ? draft.offsetMinutes : null,
      absoluteAt: draft.triggerKind === 'absolute' ? absoluteAt : null,
      enabled: draft.enabled,
    },
  };
}
