import type {
  AppSettings,
  UserProfile,
  Workspace,
} from '../../../domain/entities/index.ts';
import type {
  RepositoryScope,
  RepositoryStore,
} from '../../../domain/repositories/contracts.ts';

export type LocalWorkspace = {
  workspace: Workspace;
  profile: UserProfile;
};

export class WorkspaceService {
  constructor(private readonly repositories: RepositoryStore) {}

  async ensurePersonalWorkspace(): Promise<LocalWorkspace> {
    return this.repositories.transaction(async (scope) => {
      const settings = (await listAllSettings(scope)).filter(
        (item) => item.onboardingCompletedAt && item.onboardingVersion > 0,
      );
      const current = settings[0];

      if (!current) {
        throw new Error('Local preferences are not ready.');
      }

      const ensured = new Map<string, Workspace>();
      for (const item of settings) {
        ensured.set(
          item.profileId,
          await ensureWorkspaceForProfile(scope, item.profileId),
        );
      }

      const profile = await scope.userProfiles.getById(current.profileId);
      const workspace = ensured.get(current.profileId);

      if (!profile || !workspace) {
        throw new Error('Local profile is not available.');
      }

      return { workspace, profile };
    });
  }
}

export async function ensureWorkspaceForProfile(
  repositories: RepositoryScope,
  profileId: string,
) {
  const ordered = (await listAllWorkspaces(repositories, profileId)).sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
  let selected = ordered.find((workspace) => workspace.status === 'active');

  if (!selected && ordered[0]) {
    selected = await repositories.workspaces.update(ordered[0].id, {
      expectedRevision: ordered[0].revision,
      status: 'active',
    });
  }

  if (!selected) {
    selected = await repositories.workspaces.create({
      profileId,
      name: 'Personal',
      kind: 'personal',
      status: 'active',
    });
  }

  for (const workspace of ordered) {
    if (workspace.id !== selected.id && workspace.status === 'active') {
      await repositories.workspaces.update(workspace.id, {
        expectedRevision: workspace.revision,
        status: 'archived',
      });
    }
  }

  return selected;
}

async function listAllSettings(repositories: RepositoryScope) {
  const items: AppSettings[] = [];
  let offset = 0;

  while (true) {
    const page = await repositories.appSettings.list({
      page: { limit: 100, offset },
    });
    items.push(...page.items);
    if (page.nextOffset === null) return items;
    offset = page.nextOffset;
  }
}

async function listAllWorkspaces(
  repositories: RepositoryScope,
  profileId: string,
) {
  const items: Workspace[] = [];
  let offset = 0;

  while (true) {
    const page = await repositories.workspaces.list({
      filter: { profileId },
      page: { limit: 100, offset },
    });
    items.push(...page.items);
    if (page.nextOffset === null) return items;
    offset = page.nextOffset;
  }
}
