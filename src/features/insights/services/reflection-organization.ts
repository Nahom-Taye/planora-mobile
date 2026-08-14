import type { Reflection } from '../../../domain/entities/index.ts';

export function reflectionIdentity(reflection: Pick<Reflection, 'scope' | 'scopeId' | 'periodStart'>) {
  return `${reflection.scope}:${reflection.scopeId ?? ''}:${reflection.periodStart}`;
}

export function organizeReflections(reflections: readonly Reflection[]) {
  const ordered = reflections
    .filter((reflection) => reflection.deletedAt === null)
    .sort(compareReflections);
  const seen = new Set<string>();
  return ordered.filter((reflection) => {
    const key = reflectionIdentity(reflection);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function compareReflections(left: Reflection, right: Reflection) {
  return (
    right.periodStart.localeCompare(left.periodStart) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    left.id.localeCompare(right.id)
  );
}
