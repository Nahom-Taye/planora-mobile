import type { RecoveryCallback } from './auth-types.ts';

export function parseRecoveryUrl(url: string): RecoveryCallback {
  try {
    const parsed = new URL(url);
    const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const code = parsed.searchParams.get('code');
    const tokenHash = parsed.searchParams.get('token_hash');
    const type = parsed.searchParams.get('type') ?? fragment.get('type');
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    const flow = parsed.searchParams.get('flow');
    const purpose =
      flow === 'verification' || type === 'signup' || type === 'email'
        ? 'verification'
        : 'recovery';

    if (code) {
      return { kind: 'authorization_code', code, purpose };
    }

    if (
      tokenHash &&
      (type === 'recovery' ||
        type === 'email' ||
        type === 'signup' ||
        type === 'invite')
    ) {
      return { kind: 'token_hash', tokenHash, purpose, otpType: type };
    }

    if (accessToken && refreshToken && type === 'recovery') {
      return { kind: 'session', accessToken, refreshToken, purpose: 'recovery' };
    }
  } catch {
    return { kind: 'invalid' };
  }

  return { kind: 'invalid' };
}
