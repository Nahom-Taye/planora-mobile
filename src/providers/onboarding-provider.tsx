import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { RepositoryStore } from '@/domain/repositories';
import { OnboardingService } from '@/features/onboarding/services/onboarding-service';

export type OnboardingStatus = 'loading' | 'pending' | 'complete' | 'error';

type OnboardingContextValue = {
  status: OnboardingStatus;
  isReviewing: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  complete: () => Promise<boolean>;
  skip: () => Promise<boolean>;
  beginReview: () => void;
  leaveReview: () => void;
  retry: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

type OnboardingProviderProps = PropsWithChildren<{
  repositories: RepositoryStore | null;
}>;

export function OnboardingProvider({
  children,
  repositories,
}: OnboardingProviderProps) {
  const [status, setStatus] = useState<OnboardingStatus>('loading');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const service = useMemo(
    () => (repositories ? new OnboardingService(repositories) : null),
    [repositories],
  );

  const load = useCallback(async () => {
    if (!service) {
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      setStatus((await service.isComplete()) ? 'complete' : 'pending');
    } catch {
      setStatus('error');
      setErrorMessage(
        'Planora could not read onboarding preferences. Your local data is still available.',
      );
    }
  }, [service]);

  useEffect(() => {
    if (service) void load();
  }, [load, service]);

  const finish = useCallback(async () => {
    if (!service || isSaving) {
      return false;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await service.complete();
      setStatus('complete');
      setIsReviewing(false);
      return true;
    } catch {
      setErrorMessage(
        'Planora could not save this preference. Please try again.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, service]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      status,
      isReviewing,
      isSaving,
      errorMessage,
      complete: finish,
      skip: finish,
      beginReview: () => setIsReviewing(true),
      leaveReview: () => setIsReviewing(false),
      retry: load,
    }),
    [errorMessage, finish, isReviewing, isSaving, load, status],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const value = useContext(OnboardingContext);

  if (!value) {
    throw new Error('useOnboarding must be used within OnboardingProvider.');
  }

  return value;
}
