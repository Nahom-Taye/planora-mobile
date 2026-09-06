import {
  createClient,
  processLock,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import type { AccountProfile } from '../../../domain/entities/account.ts';
import type { KeyValueStorage } from './session-storage-core.ts';
import { createPkce, type PkceCrypto } from './pkce.ts';
import { lockTimeoutMs, RefreshSchedule, withDeadline, operationTimeoutMs } from './auth-runtime.ts';
import type { AccountGateway } from './account-gateway.ts';
import type {
  AccountSession,
  AuthChange,
  AuthConfiguration,
  RecoveryCallback,
  SignUpInput,
} from './auth-types.ts';
import type { Database } from './database-types.ts';
import { mapProfileRow } from './profile-mapper.ts';
import { mapAuthError } from './auth-error-mapper.ts';
import { validateEmail, validatePassword } from './auth-validation.ts';

export type AccountDependencies = {
  storage: KeyValueStorage;
  fetch: typeof fetch;
  crypto: PkceCrypto;
};

export function createAccountClientFactory(dependencies: AccountDependencies) {
  let client: SupabaseClient<Database> | null = null;
  let gateway: SupabaseAccountGateway | null = null;
  let identity = '';
  return (configuration: AuthConfiguration) => {
    const nextIdentity = `${configuration.url}|${configuration.publishableKey}`;
    if (client && identity !== nextIdentity) throw new Error('Account configuration changed. Restart Planora.');
    if (!client) {
      identity = nextIdentity;
      client = createClient<Database>(configuration.url, configuration.publishableKey, {
        global: { fetch: dependencies.fetch },
        auth: {
          storage: dependencies.storage,
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
          flowType: 'implicit',
          lock: processLock,
          lockAcquireTimeout: lockTimeoutMs,
        },
      });
      gateway = new SupabaseAccountGateway(client, configuration, dependencies);
    }
    return { client, gateway: gateway! };
  };
}

export class SupabaseAccountGateway implements AccountGateway {
  private restoring: Promise<AccountSession | null> | null = null;
  private readonly refresh = new RefreshSchedule(() => this.restoreSession().then((session) => {
    if (session) this.listener?.({ event: 'initial', session });
    return session;
  }).catch((error) => {
    this.listener?.({ event: 'refresh_failed', session: null, errorMessage: mapAuthError(error).message });
    throw error;
  }));
  private unsubscribe: (() => void) | null = null;
  private listener: ((change: AuthChange) => void) | null = null;
  private emailAfter = 0;
  private readiness: Promise<void> | null = null;

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly configuration: AuthConfiguration,
    private readonly dependencies: AccountDependencies,
  ) {}

  restoreSession(): Promise<AccountSession | null> {
    if (this.restoring) return this.restoring;
    const request = this.client.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      return mapSession(data.session);
    });
    this.restoring = withDeadline(request, operationTimeoutMs).finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }

  checkReadiness(): Promise<void> {
    if (this.readiness) return this.readiness;
    this.readiness = this.dependencies.fetch(`${this.configuration.url}/auth/v1/health`, {
      headers: { apikey: this.configuration.publishableKey },
    }).then((response) => {
      if (!response.ok) throw { status: response.status, code: 'service_unavailable' };
    }).finally(() => { this.readiness = null; });
    return this.readiness;
  }

  subscribe(listener: (change: AuthChange) => void) {
    this.unsubscribe?.();
    this.listener = listener;
    let active = true;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (active) listener({ event: mapEvent(event), session: mapSession(session) });
      }, 0);
    });
    const unsubscribe = () => {
      active = false;
      data.subscription.unsubscribe();
      if (this.unsubscribe === unsubscribe) this.unsubscribe = null;
      if (this.listener === listener) this.listener = null;
    };
    this.unsubscribe = unsubscribe;
    return unsubscribe;
  }

  startAutoRefresh() {
    this.refresh.start();
  }

  stopAutoRefresh() {
    this.refresh.stop();
  }

  async signIn(email: string, password: string) {
    const invalid = validateEmail(email);
    if (invalid) throw new Error(invalid);
    if (!password) throw new Error('Enter your password.');
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    const session = mapSession(data.session);
    if (!session) throw new Error('Session unavailable.');
    return session;
  }

  async signUp(input: SignUpInput) {
    const invalid = validateEmail(input.email) ?? validatePassword(input.password);
    if (invalid) throw new Error(invalid);
    const response = await this.sendEmailLink('signup', input.redirectTo, {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      data: { display_name: input.displayName, locale: input.locale, time_zone: input.timeZone },
    });
    let session: AccountSession | null = null;
    if (response.access_token && response.refresh_token) {
      const result = await this.client.auth.setSession({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
      if (result.error) throw result.error;
      session = mapSession(result.data.session);
    }
    return { session, requiresEmailVerification: session === null };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) {
      await this.dependencies.storage.removeItem(`sb-${new URL(this.configuration.url).hostname.split('.')[0]}-auth-token`);
      const cleanup = await this.client.auth.signOut({ scope: 'local' });
      if (cleanup.error) throw cleanup.error;
    }
  }

  async sendRecovery(email: string, redirectTo: string) {
    const invalid = validateEmail(email);
    if (invalid) throw new Error(invalid);
    try {
      await this.sendEmailLink('recover', redirectTo, { email: email.trim().toLowerCase() });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'user_not_found') throw error;
    }
  }

  private async sendEmailLink(endpoint: 'signup' | 'recover', redirectTo: string, body: Record<string, unknown>) {
    if (Date.now() < this.emailAfter) throw { status: 429 };
    this.emailAfter = Date.now() + 60000;
    const pkce = await createPkce(this.dependencies.crypto);
    const storageKey = `sb-${new URL(this.configuration.url).hostname.split('.')[0]}-auth-token-code-verifier`;
    await this.dependencies.storage.setItem(storageKey, JSON.stringify(
      pkce.verifier + (endpoint === 'recover' ? '/recovery' : ''),
    ));
    const response = await this.dependencies.fetch(
      `${this.configuration.url}/auth/v1/${endpoint}?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: 'POST',
        headers: { apikey: this.configuration.publishableKey, 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
        body: JSON.stringify({ ...body, code_challenge: pkce.challenge, code_challenge_method: pkce.method }),
      },
    );
    const result = await response.json();
    if (!response.ok) throw { status: response.status, code: result.code ?? result.error_code, message: result.msg ?? result.message };
    return result as { access_token?: string; refresh_token?: string };
  }

  async resendConfirmation(email: string, redirectTo: string) {
    if (Date.now() < this.emailAfter) throw { status: 429 };
    this.emailAfter = Date.now() + 60000;
    const { error } = await this.client.auth.resend({
      type: 'signup', email, options: { emailRedirectTo: redirectTo },
    });
    if (error) throw error;
  }

  async consumeCallback(callback: RecoveryCallback) {
    if (callback.kind === 'invalid') {
      throw new Error('Invalid recovery link.');
    }

    if (callback.kind === 'authorization_code') {
      const key = `sb-${new URL(this.configuration.url).hostname.split('.')[0]}-auth-token-code-verifier`;
      const stored = await this.dependencies.storage.getItem(key);
      const verifier = stored ? JSON.parse(stored) : null;
      if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}(\/recovery)?$/.test(verifier)) {
        throw new Error('Invalid recovery link.');
      }
      const { data, error } = await this.client.auth.exchangeCodeForSession(
        callback.code,
      );
      if (error) {
        const code = mapAuthError(error).code;
        if (code === 'network_unavailable' || code === 'service_unavailable' || code === 'rate_limited') {
          await this.dependencies.storage.setItem(key, stored!);
        }
        throw error;
      }
      return requiredSession(data.session);
    }

    if (callback.kind === 'token_hash') {
      const { data, error } = await this.client.auth.verifyOtp({
        token_hash: callback.tokenHash,
        type: callback.otpType,
      });
      if (error) throw error;
      return requiredSession(data.session);
    }

    const { data, error } = await this.client.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken,
    });
    if (error) throw error;
    return requiredSession(data.session);
  }

  async updatePassword(password: string) {
    const invalid = validatePassword(password);
    if (invalid) throw new Error(invalid);
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw error;
  }

  async getProfile() {
    const session = await this.requireSession();
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('user_id', session.accountId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapProfileRow(data) : null;
  }

  async saveProfile(
    profile: Pick<AccountProfile, 'displayName' | 'locale' | 'timeZone'>,
  ) {
    const session = await this.requireSession();
    const { data, error } = await this.client
      .from('profiles')
      .upsert(
        {
          user_id: session.accountId,
          display_name: profile.displayName?.trim() ?? '',
          locale: profile.locale,
          time_zone: profile.timeZone,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapProfileRow(data);
  }

  private async requireSession() {
    const session = await this.restoreSession();
    if (!session) throw new Error('Session unavailable.');
    return session;
  }
}

function mapSession(session: Session | null): AccountSession | null {
  return session ? mapUser(session.user) : null;
}

function mapUser(user: User): AccountSession {
  return {
    accountId: user.id,
    email: user.email ?? '',
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

function requiredSession(session: Session | null) {
  const value = mapSession(session);
  if (!value) throw new Error('Session unavailable.');
  return value;
}

function mapEvent(event: string): AuthChange['event'] {
  if (event === 'SIGNED_IN') return 'signed_in';
  if (event === 'SIGNED_OUT') return 'signed_out';
  if (event === 'PASSWORD_RECOVERY') return 'password_recovery';
  if (event === 'USER_UPDATED') return 'updated';
  return 'initial';
}
