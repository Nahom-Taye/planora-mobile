import { toInstant } from '../../../domain/entities/common.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';

export class AccountLinkService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async link(remoteAccountId: string) {
    const settings = await this.repositories.appSettings.list({
      page: { limit: 1, offset: 0 },
    });
    const localProfileId = settings.items[0]?.profileId;

    if (!localProfileId) {
      throw new Error('Local profile is not ready.');
    }

    const links = await this.repositories.accountLinks.list({
      filter: { localProfileId },
      page: { limit: 1, offset: 0 },
    });
    const existing = links.items[0];
    const timestamp = toInstant(this.now());

    if (existing) {
      return this.repositories.accountLinks.update(existing.id, {
        expectedRevision: existing.revision,
        remoteAccountId,
        status: 'linked',
        lastAuthenticatedAt: timestamp,
      });
    }

    const workspaces = await this.repositories.workspaces.list({
      filter: { profileId: localProfileId, status: 'active' },
      page: { limit: 1, offset: 0 },
    });

    return this.repositories.accountLinks.create({
      localProfileId,
      localWorkspaceId: workspaces.items[0]?.id ?? null,
      remoteAccountId,
      status: 'linked',
      linkedAt: timestamp,
      lastAuthenticatedAt: timestamp,
    });
  }

  async unlink() {
    const links = await this.repositories.accountLinks.list({
      filter: { status: 'linked' },
      page: { limit: 1, offset: 0 },
    });
    const existing = links.items[0];

    if (!existing) return null;

    return this.repositories.accountLinks.update(existing.id, {
      expectedRevision: existing.revision,
      status: 'unlinked',
    });
  }
}
