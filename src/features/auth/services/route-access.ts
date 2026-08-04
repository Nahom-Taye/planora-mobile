import type { AuthStatus } from './auth-types.ts';

export type RouteArea = 'onboarding' | 'auth' | 'tabs' | 'account' | 'recovery';

export function canAccessRoute(
  area: RouteArea,
  onboardingComplete: boolean,
  authStatus: AuthStatus,
) {
  if (area === 'recovery') {
    return true;
  }

  if (area === 'onboarding') {
    return !onboardingComplete;
  }

  if (!onboardingComplete) {
    return false;
  }

  if (area === 'account') {
    return authStatus === 'signed_in' || authStatus === 'recovering';
  }

  return area === 'tabs' || area === 'auth';
}
