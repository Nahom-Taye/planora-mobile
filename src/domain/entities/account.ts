import type { EntityId, EntityMetadata, Instant } from './common';

export type AccountLinkStatus = 'linked' | 'unlinked';

export type LocalAccountLink = EntityMetadata & {
  localProfileId: EntityId;
  localWorkspaceId: EntityId | null;
  remoteAccountId: string;
  status: AccountLinkStatus;
  linkedAt: Instant;
  lastAuthenticatedAt: Instant;
};

export type AccountProfile = {
  accountId: string;
  displayName: string | null;
  locale: string;
  timeZone: string;
  createdAt: Instant;
  updatedAt: Instant;
};
