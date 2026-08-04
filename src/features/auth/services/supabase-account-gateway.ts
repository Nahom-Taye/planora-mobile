import 'react-native-url-polyfill/auto';

import {
  createClient,
  processLock,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import type { AccountProfile } from '../../../domain/entities/account.ts';
import { authSessionStorage } from './session-storage.ts';
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

let cachedGateway: AccountGateway | null = null;
let cachedConfiguration = '';

export function createSupabaseAccountGateway(
  configuration: AuthConfiguration,
): AccountGateway {
  const configurationKey = `${configuration.url}|${configuration.publishableKey}`;

  if (cachedGateway && cachedConfiguration === configurationKey) {
    return cachedGateway;
  }

  const client = createClient<Database>(
    configuration.url,
    configuration.publishableKey,
    {
      auth: {
        storage: authSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: processLock,
      },
    },
  );

  cachedGateway = new SupabaseAccountGateway(client);
  cachedConfiguration = configurationKey;
  return cachedGateway;
}

class SupabaseAccountGateway implements AccountGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async restoreSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      await this.client.auth.signOut({ scope: 'local' });
      return null;
    }
    return mapSession(data.session);
  }

  subscribe(listener: (change: AuthChange) => void) {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      listener({ event: mapEvent(event), session: mapSession(session) });
    });
    return () => data.subscription.unsubscribe();
  }

  startAutoRefresh() {
    this.client.auth.startAutoRefresh();
  }

  stopAutoRefresh() {
    this.client.auth.stopAutoRefresh();
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const session = mapSession(data.session);
    if (!session) throw new Error('Session unavailable.');
    return session;
  }

  async signUp(input: SignUpInput) {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: input.redirectTo,
        data: {
          display_name: input.displayName,
          locale: input.locale,
          time_zone: input.timeZone,
        },
      },
    });
    if (error) throw error;
    return {
      session: mapSession(data.session),
      requiresEmailVerification: data.session === null,
    };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  async sendRecovery(email: string, redirectTo: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  }

  async consumeCallback(callback: RecoveryCallback) {
    if (callback.kind === 'invalid') {
      throw new Error('Invalid recovery link.');
    }

    if (callback.kind === 'authorization_code') {
      const { data, error } = await this.client.auth.exchangeCodeForSession(
        callback.code,
      );
      if (error) throw error;
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
