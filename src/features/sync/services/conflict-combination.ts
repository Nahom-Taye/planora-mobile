import type { PortableEntityType } from '../../../domain/entities/index.ts';

const combinableFields: Partial<Record<PortableEntityType, string[]>> = {
  task: ['notes'],
  plan_block: ['notes'],
  routine: ['notes'],
  goal: ['description', 'motivation'],
  milestone: ['notes'],
  routine_check_in: ['note'],
  reflection: ['body'],
};

export function canCombineConflict(entityType: PortableEntityType) {
  return Boolean(combinableFields[entityType]?.length);
}

export function combineConflictPayload(entityType: PortableEntityType, local: string, remote: string) {
  const localPayload = parsePayload(local);
  const remotePayload = parsePayload(remote);
  const result = { ...remotePayload, ...localPayload };
  for (const field of combinableFields[entityType] ?? []) {
    const localValue = localPayload[field];
    const remoteValue = remotePayload[field];
    if (typeof localValue === 'string' && typeof remoteValue === 'string' && localValue && remoteValue && localValue !== remoteValue) {
      result[field] = `${localValue}\n\n${remoteValue}`;
    }
  }
  return result;
}

function parsePayload(value: string) {
  const parsed: unknown = JSON.parse(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}
