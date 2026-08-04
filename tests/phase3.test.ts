import assert from 'node:assert/strict';
import test from 'node:test';

import { toInstant, toLocalTime } from '../src/domain/entities/index.ts';
import type { RepositoryStore } from '../src/domain/repositories/contracts.ts';
import { AccountLinkService } from '../src/features/account/services/account-link-service.ts';
import { validateAuthConfiguration } from '../src/features/auth/services/auth-configuration.ts';
import { mapAuthError } from '../src/features/auth/services/auth-error-mapper.ts';
import {
  initialAuthState,
  reduceAuthState,
} from '../src/features/auth/services/auth-state.ts';
import { mapProfileRow } from '../src/features/auth/services/profile-mapper.ts';
import { parseRecoveryUrl } from '../src/features/auth/services/recovery-link.ts';
import { canAccessRoute } from '../src/features/auth/services/route-access.ts';
import {
  createGuardedSessionStorage,
  createMemoryStorage,
} from '../src/features/auth/services/session-storage-core.ts';
import {
  OnboardingService,
  isOnboardingComplete,
} from '../src/features/onboarding/services/onboarding-service.ts';
import { migrations } from '../src/storage/database/migrations/index.ts';
import { accountLinkMapper } from '../src/storage/mappers/entity-mappers.ts';

test('onboarding completion persists its current version', async () => {
  let settings: Record<string, unknown> | null = null;
  const repositories = {
    appSettings: {
      list: async () => ({ items: settings ? [settings] : [], nextOffset: null }),
      create: async (input: Record<string, unknown>) => {
        settings = {
          ...input,
          id: 'settings-1',
          createdAt: '2026-08-04T12:00:00.000Z',
          updatedAt: '2026-08-04T12:00:00.000Z',
          revision: 1,
          deletedAt: null,
        };
        return settings;
      },
    },
    userProfiles: {
      create: async (input: Record<string, unknown>) => ({
        ...input,
        id: 'profile-1',
        createdAt: '2026-08-04T12:00:00.000Z',
        updatedAt: '2026-08-04T12:00:00.000Z',
        revision: 1,
        deletedAt: null,
      }),
    },
    transaction: async (operation: (scope: unknown) => Promise<unknown>) =>
      operation(repositories),
  } as unknown as RepositoryStore;
  const service = new OnboardingService(
    repositories,
    () => new Date('2026-08-04T12:00:00.000Z'),
    () => ({ locale: 'en-US', timeZone: 'UTC' as never }),
  );

  assert.equal(await service.isComplete(), false);
  await service.complete();
  const persistedSettings = settings as Record<string, unknown> | null;
  assert.ok(persistedSettings);
  assert.equal(isOnboardingComplete(persistedSettings as never), true);
  assert.equal(persistedSettings.onboardingVersion, 1);
});

test('configuration validation supports ready and local-only startup', () => {
  assert.deepEqual(validateAuthConfiguration({}), {
    status: 'unavailable',
    reason: 'missing',
  });
  assert.equal(
    validateAuthConfiguration({
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value-with-safe-length',
    }).status,
    'ready',
  );
  assert.equal(
    validateAuthConfiguration({
      EXPO_PUBLIC_SUPABASE_URL: 'http://project.supabase.co',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value-with-safe-length',
    }).status,
    'unavailable',
  );
});

test('authentication restoration and state changes are deterministic', () => {
  const session = {
    accountId: 'account-1',
    email: 'person@example.test',
    emailVerified: true,
  };
  const restored = reduceAuthState(initialAuthState, {
    type: 'restored',
    session,
  });
  assert.equal(restored.status, 'signed_in');
  const signedOut = reduceAuthState(restored, {
    type: 'changed',
    change: { event: 'signed_out', session: null },
  });
  assert.equal(signedOut.status, 'signed_out');
  assert.equal(signedOut.session, null);
  assert.equal(
    reduceAuthState(initialAuthState, {
      type: 'configuration_unavailable',
    }).status,
    'local_only',
  );
});

test('corrupt stored sessions are removed safely', async () => {
  const backing = createMemoryStorage();
  const storage = createGuardedSessionStorage(backing);
  await backing.setItem('sb-project-auth-token', 'not-json');
  assert.equal(await storage.getItem('sb-project-auth-token'), null);
  assert.equal(await backing.getItem('sb-project-auth-token'), null);
});

test('sign-out cleanup removes session material', async () => {
  const backing = createMemoryStorage();
  const storage = createGuardedSessionStorage(backing);
  await storage.setItem('sb-project-auth-token', '{}');
  await storage.removeItem('sb-project-auth-token');
  assert.equal(await storage.getItem('sb-project-auth-token'), null);
});

test('account errors map to private recoverable messages', () => {
  assert.equal(mapAuthError(new Error('Failed to fetch')).code, 'network_unavailable');
  assert.equal(
    mapAuthError({ message: 'Invalid login credentials', status: 400 }).code,
    'invalid_credentials',
  );
  assert.equal(mapAuthError({ status: 503 }).code, 'service_unavailable');
});

test('local account linkage preserves stable local identifiers', async () => {
  let created: Record<string, unknown> | null = null;
  const repositories = {
    appSettings: {
      list: async () => ({
        items: [{ profileId: 'local-profile-1' }],
        nextOffset: null,
      }),
    },
    workspaces: {
      list: async () => ({
        items: [{ id: 'local-workspace-1' }],
        nextOffset: null,
      }),
    },
    accountLinks: {
      list: async () => ({ items: [], nextOffset: null }),
      create: async (input: Record<string, unknown>) => {
        created = input;
        return input;
      },
    },
  } as unknown as RepositoryStore;
  const service = new AccountLinkService(
    repositories,
    () => new Date('2026-08-04T12:00:00.000Z'),
  );

  await service.link('remote-account-1');
  const link = created as Record<string, unknown> | null;
  assert.ok(link);
  assert.equal(link.localProfileId, 'local-profile-1');
  assert.equal(link.localWorkspaceId, 'local-workspace-1');
  assert.equal(link.remoteAccountId, 'remote-account-1');
});

test('account link rows map without exposing database formats', () => {
  const entity = {
    id: 'link-1',
    localProfileId: 'profile-1',
    localWorkspaceId: null,
    remoteAccountId: 'account-1',
    status: 'linked' as const,
    linkedAt: toInstant('2026-08-04T12:00:00.000Z'),
    lastAuthenticatedAt: toInstant('2026-08-04T12:00:00.000Z'),
    createdAt: toInstant('2026-08-04T12:00:00.000Z'),
    updatedAt: toInstant('2026-08-04T12:00:00.000Z'),
    revision: 1,
    deletedAt: null,
  };
  assert.deepEqual(accountLinkMapper.fromRow(accountLinkMapper.toRow(entity)), entity);
});

test('route decisions leave local tabs public and account routes protected', () => {
  assert.equal(canAccessRoute('tabs', true, 'local_only'), true);
  assert.equal(canAccessRoute('account', true, 'signed_out'), false);
  assert.equal(canAccessRoute('account', true, 'signed_in'), true);
  assert.equal(canAccessRoute('tabs', false, 'signed_out'), false);
  assert.equal(canAccessRoute('recovery', false, 'signed_out'), true);
});

test('profile rows map timestamps explicitly', () => {
  const profile = mapProfileRow({
    user_id: 'account-1',
    display_name: 'Casey',
    locale: 'en-US',
    time_zone: 'America/Asuncion',
    created_at: '2026-08-04T08:00:00-04:00',
    updated_at: '2026-08-04T12:30:00.000Z',
  });
  assert.equal(profile.accountId, 'account-1');
  assert.equal(profile.createdAt, '2026-08-04T12:00:00.000Z');
});

test('verification and recovery links preserve callback intent', () => {
  assert.deepEqual(
    parseRecoveryUrl(
      'planora://callback?flow=verification&code=one-time-code',
    ),
    {
    kind: 'authorization_code',
    code: 'one-time-code',
      purpose: 'verification',
    },
  );
  assert.deepEqual(
    parseRecoveryUrl('planora://callback?token_hash=hash&type=recovery'),
    {
      kind: 'token_hash',
      tokenHash: 'hash',
      purpose: 'recovery',
      otpType: 'recovery',
    },
  );
  assert.deepEqual(parseRecoveryUrl('planora://callback?type=other'), {
    kind: 'invalid',
  });
});

test('Phase 3 migration is forward-only after released migrations', () => {
  assert.deepEqual(
    migrations.map((migration) => migration.version),
    [1, 2, 3],
  );
  assert.equal(migrations[2].name, 'account_foundation');
});

test('local settings keep calendar-independent planning time', () => {
  assert.equal(toLocalTime('06:00'), '06:00');
});
