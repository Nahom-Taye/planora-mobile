import type { AuthFailure } from './auth-types.ts';

type ErrorLike = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
};

const failures: Record<AuthFailure['code'], AuthFailure> = {
  invalid_credentials: {
    code: 'invalid_credentials',
    message: 'The email or password was not accepted. Check both and try again.',
    recoverable: true,
  },
  email_unverified: {
    code: 'email_unverified',
    message: 'Confirm your email before signing in, then try again.',
    recoverable: true,
  },
  email_in_use: {
    code: 'email_in_use',
    message: 'This email cannot be used for a new account. Try signing in instead.',
    recoverable: true,
  },
  weak_password: {
    code: 'weak_password',
    message: 'Choose a stronger password with at least eight characters.',
    recoverable: true,
  },
  network_unavailable: {
    code: 'network_unavailable',
    message: 'Planora could not reach the account service. Check your connection and try again.',
    recoverable: true,
  },
  rate_limited: {
    code: 'rate_limited',
    message: 'Too many attempts were made. Wait a moment, then try again.',
    recoverable: true,
  },
  expired_link: {
    code: 'expired_link',
    message: 'This recovery link is no longer valid. Request a new link and try again.',
    recoverable: true,
  },
  service_unavailable: {
    code: 'service_unavailable',
    message: 'Account services are temporarily unavailable. Your local data is unaffected.',
    recoverable: true,
  },
  unknown: {
    code: 'unknown',
    message: 'Something went wrong with the account request. Your local data is unaffected.',
    recoverable: true,
  },
};

export function mapAuthError(error: unknown): AuthFailure {
  const value = isErrorLike(error) ? error : {};
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  const code = typeof value.code === 'string' ? value.code.toLowerCase() : '';
  const status = typeof value.status === 'number' ? value.status : 0;

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('offline')
  ) {
    return failures.network_unavailable;
  }

  if (status === 429 || message.includes('rate limit')) {
    return failures.rate_limited;
  }

  if (message.includes('invalid login') || code === 'invalid_credentials') {
    return failures.invalid_credentials;
  }

  if (message.includes('email not confirmed')) {
    return failures.email_unverified;
  }

  if (message.includes('already registered') || code === 'user_already_exists') {
    return failures.email_in_use;
  }

  if (message.includes('password') && (message.includes('weak') || status === 422)) {
    return failures.weak_password;
  }

  if (message.includes('expired') || message.includes('invalid token')) {
    return failures.expired_link;
  }

  if (status >= 500) {
    return failures.service_unavailable;
  }

  return failures.unknown;
}

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === 'object' && value !== null;
}
