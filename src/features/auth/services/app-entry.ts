export type OpeningDestination =
  | 'loading'
  | 'account_entry'
  | 'onboarding'
  | 'tabs';

export type AppEntryInput = {
  accountStatus:
    | 'restoring'
    | 'local_only'
    | 'signed_out'
    | 'signed_in'
    | 'recovering'
    | 'error';
  hasSession: boolean;
  continuedLocally: boolean;
  onboardingComplete: boolean;
};

export function resolveOpeningDestination({
  accountStatus,
  hasSession,
  continuedLocally,
  onboardingComplete,
}: AppEntryInput): OpeningDestination {
  if (accountStatus === 'restoring') return 'loading';
  if (!hasSession && !continuedLocally) return 'account_entry';
  return onboardingComplete ? 'tabs' : 'onboarding';
}
