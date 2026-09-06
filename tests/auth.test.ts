import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAccountClientFactory } from '../src/features/auth/services/account-client.ts';
import { createAccountTransport, RefreshSchedule, SingleFlight, withDeadline, lockTimeoutMs, startAccountLifecycle } from '../src/features/auth/services/auth-runtime.ts';
import type { AccountGateway } from '../src/features/auth/services/account-gateway.ts';
import { createAtomicChunkStorage, createGuardedSessionStorage, createMemoryStorage } from '../src/features/auth/services/session-storage-core.ts';
import { createPkce } from '../src/features/auth/services/pkce.ts';
import { configureSplash } from '../src/features/auth/services/splash-runtime.ts';
import { mapAuthError } from '../src/features/auth/services/auth-error-mapper.ts';
import { initialAuthState, reduceAuthState } from '../src/features/auth/services/auth-state.ts';
import { validateAuthConfiguration } from '../src/features/auth/services/auth-configuration.ts';
import { resolveOpeningDestination } from '../src/features/auth/services/app-entry.ts';

const crypto = {
  randomBytes: async (count: number) => new Uint8Array(randomBytes(count)),
  sha256Base64: async (value: string) => createHash('sha256').update(value).digest('base64'),
};
const pause = (ms = 10) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const configuration = () => ({ url: `https://${randomUUID()}.supabase.co`, publishableKey: randomBytes(32).toString('hex') });
const sessionKey = (url: string) => `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
const storedSession = (expired = false) => {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const user = { id: randomUUID(), email: '', email_confirmed_at: new Date().toISOString() };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp })}.${randomBytes(32).toString('base64url')}`, refresh_token: randomBytes(32).toString('hex'), expires_at: exp, expires_in: 3600, token_type: 'bearer', user };
};

test('one application client and one application subscription survive repeated initialization', async () => {
  const storage = createMemoryStorage();
  const factory = createAccountClientFactory({ storage, crypto, fetch: async () => { throw new Error('Unexpected request'); } });
  const config = configuration();
  const first = factory(config);
  const second = factory({ ...config });
  assert.equal(first.client, second.client);
  assert.equal(first.gateway, second.gateway);
  const internals = first.client.auth as unknown as { stateChangeEmitters: Map<string, unknown>; lockAcquireTimeout: number; autoRefreshToken: boolean };
  const baseline = internals.stateChangeEmitters.size;
  const old = first.gateway.subscribe(() => undefined);
  const current = first.gateway.subscribe(() => undefined);
  assert.equal(internals.stateChangeEmitters.size, baseline + 1);
  old();
  assert.equal(internals.stateChangeEmitters.size, baseline + 1);
  current();
  assert.equal(internals.stateChangeEmitters.size, baseline);
  assert.equal(internals.lockAcquireTimeout, lockTimeoutMs);
  assert.equal(internals.autoRefreshToken, false);
  assert.throws(() => factory(configuration()), /configuration changed/);
  await first.gateway.restoreSession();
});

test('concurrent restoration uses one flight and callbacks execute outside the auth lock', async () => {
  const config = configuration();
  const storage = createMemoryStorage();
  await storage.setItem(sessionKey(config.url), JSON.stringify(storedSession()));
  const { client, gateway } = createAccountClientFactory({ storage, crypto, fetch: async () => { throw new Error('Unexpected request'); } })(config);
  const first = gateway.restoreSession();
  assert.equal(first, gateway.restoreSession());
  const results = await Promise.all(Array.from({ length: 30 }, () => gateway.restoreSession()));
  assert.ok(results.every((result) => result?.accountId === results[0]?.accountId));
  let callbackFinished = false;
  const unsubscribe = gateway.subscribe(() => {
    assert.equal((client.auth as unknown as { lockAcquired: boolean }).lockAcquired, false);
    void client.auth.getSession().then(() => { callbackFinished = true; });
  });
  await pause();
  assert.equal(callbackFinished, true);
  unsubscribe();
});

test('startup timeout and missing configuration both leave local planning accessible', async () => {
  await assert.rejects(withDeadline(new Promise(() => undefined), 5), /timeout/);
  assert.equal(validateAuthConfiguration({}).status, 'unavailable');
  for (const event of [
    { type: 'configuration_unavailable' as const },
    { type: 'failed' as const, message: mapAuthError(new Error('Device offline')).message },
  ]) {
    const state = reduceAuthState(initialAuthState, event);
    assert.notEqual(state.status, 'restoring');
    assert.equal(resolveOpeningDestination({ accountStatus: state.status, hasSession: false, continuedLocally: false, onboardingComplete: true }), 'account_entry');
    assert.equal(resolveOpeningDestination({ accountStatus: state.status, hasSession: false, continuedLocally: true, onboardingComplete: true }), 'tabs');
  }
});

test('offline transport sends no requests and network failure cooldown prevents storms', async () => {
  let online = false;
  let requests = 0;
  const fetcher = createAccountTransport(async () => { requests++; throw new Error('Network request failed'); }, async () => online);
  await assert.rejects(fetcher('https://service.invalid'), /offline/);
  assert.equal(requests, 0);
  online = true;
  await assert.rejects(fetcher('https://service.invalid'), /network/);
  await assert.rejects(fetcher('https://service.invalid'), /network/);
  assert.equal(requests, 1);
});

test('retryable session refresh preserves stored material', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const config = configuration();
  const storage = createGuardedSessionStorage(createMemoryStorage());
  const value = JSON.stringify(storedSession(true));
  await storage.setItem(sessionKey(config.url), value);
  let requests = 0;
  const { gateway } = createAccountClientFactory({
    storage, crypto,
    fetch: createAccountTransport(async () => { requests++; return new Response('{}', { status: 503 }); }, async () => true),
  })(config);
  let settled = false;
  const result = gateway.restoreSession().catch((error) => { settled = true; return error; });
  for (let index = 0; index < 100 && !settled; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    context.mock.timers.tick(500);
  }
  await result;
  assert.equal(settled, true);
  assert.equal(requests, 1);
  assert.equal(await storage.getItem(sessionKey(config.url)), value);
});

test('invalid expired refresh tokens clear only session material', async () => {
  const config = configuration();
  const storage = createGuardedSessionStorage(createMemoryStorage());
  await storage.setItem(sessionKey(config.url), JSON.stringify(storedSession(true)));
  await storage.setItem('local-planning-sentinel', 'preserved');
  const { gateway } = createAccountClientFactory({
    storage, crypto, fetch: async () => new Response(JSON.stringify({ code: 'refresh_token_not_found', message: 'Invalid refresh token' }), { status: 400, headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' } }),
  })(config);
  await assert.rejects(gateway.restoreSession());
  assert.equal(await storage.getItem(sessionKey(config.url)), null);
  assert.equal(await storage.getItem('local-planning-sentinel'), 'preserved');
});

test('rate-limited refresh retains the session and makes only one request', async (context) => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const config = configuration();
  const storage = createMemoryStorage();
  const value = JSON.stringify(storedSession(true));
  await storage.setItem(sessionKey(config.url), value);
  let requests = 0;
  const { gateway } = createAccountClientFactory({
    storage, crypto,
    fetch: createAccountTransport(async () => {
      requests++;
      return new Response(JSON.stringify({ code: 'over_request_rate_limit' }), { status: 429, headers: { 'Retry-After': '60' } });
    }, async () => true),
  })(config);
  let settled = false;
  let failure: unknown;
  const result = gateway.restoreSession().catch((error) => { failure = error; settled = true; });
  for (let index = 0; index < 100 && !settled; index++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
    context.mock.timers.tick(500);
  }
  await result;
  assert.equal(mapAuthError(failure).code, 'rate_limited');
  assert.equal(requests, 1);
  assert.equal(await storage.getItem(sessionKey(config.url)), value);
});

test('atomic secure chunks preserve the previous value after interrupted writes and serialize readers', async () => {
  const backing = createMemoryStorage();
  let fail = false;
  const storage = createAtomicChunkStorage({
    ...backing,
    async setItem(key, value) {
      if (fail && key.includes('.b.1')) throw new Error('Write interrupted');
      await backing.setItem(key, value);
    },
  });
  const previous = randomBytes(1600).toString('hex');
  await storage.setItem('session', previous);
  fail = true;
  await assert.rejects(storage.setItem('session', randomBytes(1600).toString('hex')));
  assert.equal(await storage.getItem('session'), previous);
  fail = false;
  const next = randomBytes(1600).toString('hex');
  const write = storage.setItem('session', next);
  const read = storage.getItem('session');
  await write;
  assert.equal(await read, next);
  await storage.removeItem('session');
  assert.equal(await storage.getItem('session'), null);
});

test('unavailable secure storage is not mistaken for corruption and legacy chunks still restore', async () => {
  let removed = 0;
  const storage = createGuardedSessionStorage({
    getItem: async () => { throw new Error('Temporarily unavailable'); },
    setItem: async () => undefined,
    removeItem: async () => { removed++; },
  });
  await assert.rejects(storage.getItem('sb-project-auth-token'), /storage unavailable/);
  assert.equal(removed, 0);
  const backing = createMemoryStorage();
  await backing.setItem('legacy.manifest', '2');
  await backing.setItem('legacy.0', 'first');
  await backing.setItem('legacy.1', 'second');
  assert.equal(await createAtomicChunkStorage(backing).getItem('legacy'), 'firstsecond');
});

test('native chunks respect byte limits and never split Unicode surrogate pairs', async () => {
  const backing = createMemoryStorage();
  const value = 'é😀'.repeat(1000);
  const storage = createAtomicChunkStorage({
    ...backing,
    async setItem(key, chunk) {
      assert.ok(Buffer.byteLength(chunk, 'utf8') <= 1800);
      assert.equal(chunk.isWellFormed(), true);
      await backing.setItem(key, chunk);
    },
  });
  await storage.setItem('session', value);
  assert.equal(await storage.getItem('session'), value);
});

test('sign-up repeated taps send one S256 request and confirmation remains explicit', async () => {
  const config = configuration();
  const storage = createMemoryStorage();
  let requests = 0;
  let challenge: string | null = null;
  const { gateway } = createAccountClientFactory({
    storage, crypto, fetch: async (_url, init) => {
      requests++;
      const body = JSON.parse(String(init?.body));
      challenge = body.code_challenge;
      assert.equal(body.code_challenge_method, 's256');
      await pause();
      return new Response('{}', { status: 200 });
    },
  })(config);
  const operations = new SingleFlight();
  const input = { email: ` ${randomUUID()}@example.invalid `, password: randomBytes(32).toString('hex'), displayName: '', locale: 'en', timeZone: 'UTC', redirectTo: 'planora://callback?flow=verification' };
  const results = await Promise.all(Array.from({ length: 10 }, () => operations.run(() => gateway.signUp(input))));
  assert.equal(requests, 1);
  assert.equal(results.filter((result) => result !== null).length, 1);
  assert.equal(results[0]?.requiresEmailVerification, true);
  const verifier = JSON.parse((await storage.getItem(`${sessionKey(config.url)}-code-verifier`))!);
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));
  await assert.rejects(gateway.resendConfirmation(input.email, input.redirectTo), (error: { status: number }) => error.status === 429);
});

test('sign-in repeated taps send one request without unnecessary PKCE generation', async () => {
  let requests = 0;
  let hashes = 0;
  const { gateway } = createAccountClientFactory({
    storage: createMemoryStorage(), crypto: { ...crypto, sha256Base64: async (value) => { hashes++; return crypto.sha256Base64(value); } },
    fetch: async () => { requests++; await pause(); return new Response(JSON.stringify(storedSession()), { status: 200 }); },
  })(configuration());
  const operations = new SingleFlight();
  const email = `${randomUUID()}@example.invalid`;
  const password = randomBytes(32).toString('hex');
  const results = await Promise.all(Array.from({ length: 10 }, () => operations.run(() => gateway.signIn(email, password))));
  assert.equal(requests, 1);
  assert.equal(hashes, 0);
  assert.equal(results.filter(Boolean).length, 1);
});

test('PKCE matches SHA-256 and rejects unavailable secure hashing', async () => {
  const result = await createPkce(crypto);
  assert.equal(result.challenge, createHash('sha256').update(result.verifier).digest('base64url'));
  assert.equal(result.verifier.length, 64);
  await assert.rejects(createPkce({ ...crypto, sha256Base64: async () => '' }), /cryptography/);
});

test('refresh scheduling stops after two failures and resumes only when restarted', async () => {
  let calls = 0;
  const schedule = new RefreshSchedule(async () => { calls++; throw new Error('Offline'); }, 5);
  schedule.start();
  schedule.start();
  await pause(40);
  assert.equal(calls, 2);
  schedule.stop();
  await pause();
  assert.equal(calls, 2);
  schedule.start();
  await pause(40);
  schedule.stop();
  assert.equal(calls, 4);
});

test('email, rate limit, service, and network failures remain distinguishable', () => {
  assert.equal(mapAuthError({ code: 'email_not_confirmed' }).code, 'email_unverified');
  assert.equal(mapAuthError({ code: 'over_email_send_rate_limit' }).code, 'rate_limited');
  assert.equal(mapAuthError({ code: 'signup_disabled' }).code, 'service_unavailable');
  assert.equal(mapAuthError({ code: 'invalid_credentials' }).code, 'invalid_credentials');
  assert.equal(mapAuthError(new Error('Network request failed')).code, 'network_unavailable');
  const state = reduceAuthState(initialAuthState, { type: 'restored', session: { accountId: randomUUID(), email: '', emailVerified: true } });
  assert.equal(reduceAuthState(state, { type: 'failed', message: 'Offline' }).status, 'signed_in');
});

test('Expo Go skips only splash customization and native builds retain it', () => {
  const calls: unknown[] = [];
  configureSplash(true, false, (options) => calls.push(options));
  assert.equal(calls.length, 0);
  configureSplash(false, false, (options) => calls.push(options));
  configureSplash(false, true, (options) => calls.push(options));
  assert.deepEqual(calls, [{ duration: 300, fade: true }, { duration: 0, fade: false }]);
});

test('startup subscription is independent of local repository readiness and routes keep a safe entry', async () => {
  const provider = await readFile('src/providers/account-provider.tsx', 'utf8');
  const runtime = await readFile('src/features/auth/services/auth-runtime.ts', 'utf8');
  assert.equal((runtime.match(/gateway.subscribe\(/g) ?? []).length, 1);
  assert.match(runtime, /clearTimeout\(startupTimer\)/);
  assert.match(provider, /startAccountLifecycle\(gateway, dispatch\), \[gateway\]/);
  assert.match(provider, /networkSubscription.remove\(\)/);
  const layout = await readFile('app/(auth)/_layout.tsx', 'utf8');
  assert.match(layout, /initialRouteName="welcome"/);
  const factory = await readFile('src/features/auth/services/supabase-account-gateway.ts', 'utf8');
  assert.match(factory, /Crypto.getRandomBytesAsync/);
  assert.doesNotMatch(factory, /globalThis\.|crypto\.subtle\s*=/);
});

test('the application startup lifecycle reaches recoverable entry even if restoration never settles', async () => {
  let state = initialAuthState;
  let subscriptions = 0;
  const gateway = {
    subscribe: () => { subscriptions++; return () => { subscriptions--; }; },
    restoreSession: () => new Promise(() => undefined),
    checkReadiness: async () => { throw new Error('Device offline.'); },
  } as unknown as AccountGateway;
  const stop = startAccountLifecycle(gateway, (event) => { state = reduceAuthState(state, event); }, 5);
  await pause();
  assert.notEqual(state.status, 'restoring');
  assert.equal(subscriptions, 1);
  assert.equal(resolveOpeningDestination({ accountStatus: state.status, hasSession: false, continuedLocally: true, onboardingComplete: true }), 'tabs');
  stop();
  assert.equal(subscriptions, 0);
  startAccountLifecycle(null, (event) => { state = reduceAuthState(state, event); })();
  assert.equal(state.status, 'local_only');
});

test('timed-out operations retain their single-flight guard until underlying work settles', async () => {
  const flight = new SingleFlight();
  let finish!: () => void;
  const operation = flight.run(() => new Promise<void>((resolve) => { finish = resolve; }));
  await assert.rejects(withDeadline(operation, 5), /timeout/);
  assert.equal(flight.isActive, true);
  assert.equal(await flight.run(async () => assert.fail('Duplicate request')), null);
  finish();
  await operation;
  assert.equal(flight.isActive, false);
});

test('recovery uses S256, exchanges the stored verifier, and retains it after a network failure', async () => {
  const config = configuration();
  const storage = createMemoryStorage();
  let failExchange = true;
  let exchanged = false;
  const { gateway } = createAccountClientFactory({
    storage, crypto,
    fetch: async (url, init) => {
      const body = JSON.parse(String(init?.body));
      if (String(url).includes('/recover')) {
        assert.equal(body.code_challenge_method, 's256');
        return new Response('{}');
      }
      assert.match(String(url), /grant_type=pkce/);
      if (failExchange) throw new Error('Network unavailable');
      const verifier = JSON.parse((await storage.getItem(`${sessionKey(config.url)}-code-verifier`))!);
      assert.equal(body.code_verifier, verifier.split('/')[0]);
      exchanged = true;
      return new Response(JSON.stringify(storedSession()));
    },
  })(config);
  await gateway.sendRecovery(`${randomUUID()}@example.invalid`, 'planora://callback?flow=recovery');
  const key = `${sessionKey(config.url)}-code-verifier`;
  const previous = await storage.getItem(key);
  const callback = { kind: 'authorization_code' as const, code: randomUUID(), purpose: 'recovery' as const };
  await assert.rejects(gateway.consumeCallback(callback));
  assert.equal(await storage.getItem(key), previous);
  failExchange = false;
  assert.ok(await gateway.consumeCallback(callback));
  assert.equal(exchanged, true);
  assert.equal(await storage.getItem(key), null);
});

test('recovery does not reveal a nonexistent account and offline sign-out preserves local planning', async () => {
  const config = configuration();
  const storage = createMemoryStorage();
  await storage.setItem(sessionKey(config.url), JSON.stringify(storedSession()));
  await storage.setItem('planning-sentinel', 'preserved');
  const { gateway } = createAccountClientFactory({
    storage, crypto, fetch: async (url) => {
      if (String(url).includes('/recover')) return new Response(JSON.stringify({ code: 'user_not_found' }), { status: 404 });
      throw new Error('Network unavailable');
    },
  })(config);
  await gateway.sendRecovery(`${randomUUID()}@example.invalid`, 'planora://callback?flow=recovery');
  await gateway.signOut();
  assert.equal(await storage.getItem(sessionKey(config.url)), null);
  assert.equal(await storage.getItem('planning-sentinel'), 'preserved');
});
