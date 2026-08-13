import type { AuthStatus } from './auth-types.ts';

export type RouteArea = 'onboarding' | 'auth' | 'tabs' | 'account' | 'recovery';

export function canAccessRoute(
  area: RouteArea,
  onboardingComplete: boolean,
  authStatus: AuthStatus,
  continuedLocally = false,
) {
  if (area === 'recovery') {
    return true;
  }

  if (area === 'onboarding') {
    return (continuedLocally || isSignedIn(authStatus)) && !onboardingComplete;
  }

  if (area === 'auth') {
    return !continuedLocally && !isSignedIn(authStatus);
  }

  if (!onboardingComplete || (!continuedLocally && !isSignedIn(authStatus))) {
    return false;
  }

  if (area === 'account') {
    return authStatus === 'signed_in' || authStatus === 'recovering';
  }

  return area === 'tabs';
}

function isSignedIn(authStatus: AuthStatus) {
  return authStatus === 'signed_in' || authStatus === 'recovering';
}
