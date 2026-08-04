export type AccountSession = {
  accountId: string;
  email: string;
  emailVerified: boolean;
};

export type AuthStatus =
  | 'restoring'
  | 'local_only'
  | 'signed_out'
  | 'signed_in'
  | 'recovering'
  | 'error';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_unverified'
  | 'email_in_use'
  | 'weak_password'
  | 'network_unavailable'
  | 'rate_limited'
  | 'expired_link'
  | 'service_unavailable'
  | 'unknown';

export type AuthFailure = {
  code: AuthErrorCode;
  message: string;
  recoverable: boolean;
};

export type AuthConfiguration = {
  url: string;
  publishableKey: string;
};

export type AuthConfigurationState =
  | { status: 'ready'; configuration: AuthConfiguration }
  | { status: 'unavailable'; reason: 'missing' | 'invalid' };

export type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  locale: string;
  timeZone: string;
  redirectTo: string;
};

export type AuthChange = {
  event:
    | 'initial'
    | 'signed_in'
    | 'signed_out'
    | 'password_recovery'
    | 'updated';
  session: AccountSession | null;
};

export type RecoveryCallback =
  | {
      kind: 'authorization_code';
      code: string;
      purpose: 'verification' | 'recovery';
    }
  | {
      kind: 'token_hash';
      tokenHash: string;
      purpose: 'verification' | 'recovery';
      otpType: 'email' | 'signup' | 'invite' | 'recovery';
    }
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
      purpose: 'recovery';
    }
  | { kind: 'invalid' };
