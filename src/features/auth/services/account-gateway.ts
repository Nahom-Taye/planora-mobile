import type { AccountProfile } from '../../../domain/entities/account.ts';
import type {
  AccountSession,
  AuthChange,
  RecoveryCallback,
  SignUpInput,
} from './auth-types.ts';

export type SignUpResult = {
  session: AccountSession | null;
  requiresEmailVerification: boolean;
};

export type AccountGateway = {
  restoreSession: () => Promise<AccountSession | null>;
  subscribe: (listener: (change: AuthChange) => void) => () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
  signIn: (email: string, password: string) => Promise<AccountSession>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  sendRecovery: (email: string, redirectTo: string) => Promise<void>;
  consumeCallback: (callback: RecoveryCallback) => Promise<AccountSession>;
  updatePassword: (password: string) => Promise<void>;
  getProfile: () => Promise<AccountProfile | null>;
  saveProfile: (
    profile: Pick<AccountProfile, 'displayName' | 'locale' | 'timeZone'>,
  ) => Promise<AccountProfile>;
};
