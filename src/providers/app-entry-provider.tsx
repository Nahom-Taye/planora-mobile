import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { resolveOpeningDestination } from '@/features/auth/services/app-entry';
import { authSessionStorage } from '@/features/auth/services/session-storage';
import { withDeadline } from '@/features/auth/services/auth-runtime';
import { reportFeatureFailure } from '@/features/recovery/services/redacted-diagnostics';

import { useAccount } from './account-provider';
import { useOnboarding } from './onboarding-provider';

type AppEntryContextValue = {
  continuedLocally: boolean;
  accessGranted: boolean;
  destination: ReturnType<typeof resolveOpeningDestination>;
  continueLocally: () => void;
};

const AppEntryContext = createContext<AppEntryContextValue | undefined>(
  undefined,
);

export function AppEntryProvider({ children }: PropsWithChildren) {
  const account = useAccount();
  const onboarding = useOnboarding();
  const [continuedLocally, setContinuedLocally] = useState(false);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const hadSession = useRef(false);

  useEffect(() => {
    let active = true;
    void withDeadline(authSessionStorage.getItem('planora.local-access'), 3000).then((value) => {
      if (active) setContinuedLocally(value === 'enabled');
    }).catch((error: unknown) => reportFeatureFailure('startup', error)).finally(() => {
      if (active) setPreferenceReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (account.session) {
      hadSession.current = true;
      setContinuedLocally(false);
      void authSessionStorage.setItem('planora.local-access', 'disabled').catch((error: unknown) => reportFeatureFailure('startup', error));
      return;
    }

    if (hadSession.current && account.status !== 'restoring') {
      hadSession.current = false;
      setContinuedLocally(false);
    }
  }, [account.session, account.status]);

  const continueLocally = useCallback(() => {
    setContinuedLocally(true);
    void authSessionStorage.setItem('planora.local-access', 'enabled').catch((error: unknown) => reportFeatureFailure('startup', error));
  }, []);
  const onboardingComplete = onboarding.status === 'complete';
  const destination = preferenceReady ? resolveOpeningDestination({
    accountStatus: account.status,
    hasSession: Boolean(account.session),
    continuedLocally,
    onboardingComplete,
  }) : 'loading';
  const value = useMemo<AppEntryContextValue>(
    () => ({
      continuedLocally,
      accessGranted: Boolean(account.session) || continuedLocally,
      destination,
      continueLocally,
    }),
    [account.session, continueLocally, continuedLocally, destination],
  );

  return (
    <AppEntryContext.Provider value={value}>
      {children}
    </AppEntryContext.Provider>
  );
}

export function useAppEntry() {
  const value = useContext(AppEntryContext);
  if (!value) throw new Error('useAppEntry must be used within AppEntryProvider.');
  return value;
}
