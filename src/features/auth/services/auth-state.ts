import type { AccountSession, AuthChange, AuthStatus } from './auth-types.ts';

export type AuthState = {
  status: AuthStatus;
  session: AccountSession | null;
  errorMessage: string | null;
};

export type AuthStateEvent =
  | { type: 'configuration_unavailable' }
  | { type: 'restored'; session: AccountSession | null }
  | { type: 'changed'; change: AuthChange }
  | { type: 'failed'; message: string };

export const initialAuthState: AuthState = {
  status: 'restoring',
  session: null,
  errorMessage: null,
};

export function reduceAuthState(
  state: AuthState,
  event: AuthStateEvent,
): AuthState {
  if (event.type === 'configuration_unavailable') {
    return { status: 'local_only', session: null, errorMessage: null };
  }

  if (event.type === 'restored') {
    return sessionState(event.session);
  }

  if (event.type === 'failed') {
    return { ...state, status: 'error', errorMessage: event.message };
  }

  if (event.change.event === 'password_recovery') {
    return {
      status: 'recovering',
      session: event.change.session,
      errorMessage: null,
    };
  }

  return sessionState(event.change.session);
}

function sessionState(session: AccountSession | null): AuthState {
  return {
    status: session ? 'signed_in' : 'signed_out',
    session,
    errorMessage: null,
  };
}
