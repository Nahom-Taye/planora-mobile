import type {
  Reflection,
  UserProfile,
} from '../../../domain/entities/index.ts';
import type {
  RepositoryScope,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';
import { StorageError } from '../../../storage/database/errors.ts';
import {
  organizeReflections,
  reflectionIdentity,
} from './reflection-organization.ts';
import {
  validateReflectionDraft,
  type ReflectionDraft,
} from './reflection-validation.ts';

export class ReflectionValidationError extends Error {
  constructor(readonly errors: Record<string, string>) {
    super('Reflection details need attention.');
  }
}

export class ReflectionService {
  constructor(private readonly repositories: RepositoryStore) {}

  async list(workspaceId: string) {
    const reflections: Reflection[] = [];
    let offset = 0;
    while (true) {
      const page = await this.repositories.reflections.list({
        filter: { workspaceId },
        page: { limit: 100, offset },
      });
      reflections.push(...page.items);
      if (page.nextOffset === null) return organizeReflections(reflections);
      offset = page.nextOffset;
    }
  }

  async create(
    workspaceId: string,
    profile: UserProfile,
    draft: ReflectionDraft,
  ) {
    return this.repositories.transaction(async (repositories) => {
      const value = await this.validValue(
        repositories,
        workspaceId,
        profile,
        draft,
      );
      const existing = await this.findMatching(
        repositories,
        workspaceId,
        value,
      );
      if (existing) {
        throw new ReflectionValidationError({
          duplicate: 'A reflection already exists for this period.',
        });
      }
      return repositories.reflections.create({ workspaceId, ...value });
    });
  }

  async update(
    reflection: Reflection,
    profile: UserProfile,
    draft: ReflectionDraft,
  ) {
    return this.repositories.transaction(async (repositories) => {
      const current = await repositories.reflections.getById(reflection.id);
      if (!current || current.workspaceId !== reflection.workspaceId) {
        throw unavailable();
      }
      const value = await this.validValue(
        repositories,
        reflection.workspaceId,
        profile,
        draft,
      );
      const existing = await this.findMatching(
        repositories,
        reflection.workspaceId,
        value,
      );
      if (existing && existing.id !== reflection.id) {
        throw new ReflectionValidationError({
          duplicate: 'A reflection already exists for this period.',
        });
      }
      return repositories.reflections.update(reflection.id, {
        expectedRevision: reflection.revision,
        ...value,
      });
    });
  }

  async softDelete(reflection: Reflection) {
    const current = await this.repositories.reflections.getById(reflection.id);
    if (!current || current.workspaceId !== reflection.workspaceId) {
      throw unavailable();
    }
    return this.repositories.reflections.softDelete(
      reflection.id,
      reflection.revision,
    );
  }

  private async validValue(
    repositories: RepositoryScope,
    workspaceId: string,
    profile: UserProfile,
    draft: ReflectionDraft,
  ) {
    const workspace = await repositories.workspaces.getById(workspaceId);
    if (
      !workspace ||
      workspace.profileId !== profile.id ||
      workspace.status !== 'active'
    ) {
      throw unavailable();
    }
    const result = validateReflectionDraft(draft, profile.weekStartsOn);
    if (!result.valid) throw new ReflectionValidationError(result.errors);
    if (result.value.scope === 'goal') {
      const goal = await repositories.goals.getById(
        result.value.scopeId ?? '',
      );
      if (!goal || goal.workspaceId !== workspaceId) {
        throw new ReflectionValidationError({
          scopeId: 'Choose an available goal from this workspace.',
        });
      }
    }
    return result.value;
  }

  private async findMatching(
    repositories: RepositoryScope,
    workspaceId: string,
    value: Pick<Reflection, 'scope' | 'scopeId' | 'periodStart'>,
  ) {
    const matches: Reflection[] = [];
    let offset = 0;
    while (true) {
      const page = await repositories.reflections.list({
        filter: {
          workspaceId,
          scope: value.scope,
          scopeId: value.scopeId ?? undefined,
          fromDate: value.periodStart,
          toDate: value.periodStart,
        },
        page: { limit: 100, offset },
      });
      matches.push(...page.items);
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    return (
      organizeReflections(matches).find(
        (reflection) =>
          reflectionIdentity(reflection) === reflectionIdentity(value),
      ) ?? null
    );
  }
}

function unavailable() {
  return new StorageError(
    'NOT_FOUND',
    'The reflection is no longer available.',
    false,
  );
}
