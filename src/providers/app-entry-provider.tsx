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
  const hadSession = useRef(false);

  useEffect(() => {
    if (account.session) {
      hadSession.current = true;
      setContinuedLocally(false);
      return;
    }

    if (hadSession.current && account.status !== 'restoring') {
      hadSession.current = false;
      setContinuedLocally(false);
    }
  }, [account.session, account.status]);

  const continueLocally = useCallback(() => setContinuedLocally(true), []);
  const onboardingComplete = onboarding.status === 'complete';
  const destination = resolveOpeningDestination({
    accountStatus: account.status,
    hasSession: Boolean(account.session),
    continuedLocally,
    onboardingComplete,
  });
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
