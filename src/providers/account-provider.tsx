import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AccountProfile } from '../domain/entities/account.ts';
import { AccountLinkService } from '../features/account/services/account-link-service.ts';
import type { AccountGateway } from '../features/auth/services/account-gateway.ts';
import { readAuthConfiguration } from '../features/auth/services/auth-configuration.ts';
import { mapAuthError } from '../features/auth/services/auth-error-mapper.ts';
import {
  initialAuthState,
  reduceAuthState,
} from '../features/auth/services/auth-state.ts';
import type { SignUpInput } from '../features/auth/services/auth-types.ts';
import { parseRecoveryUrl } from '../features/auth/services/recovery-link.ts';
import { createSupabaseAccountGateway } from '../features/auth/services/supabase-account-gateway.ts';
import { useOnboarding } from './onboarding-provider.tsx';
import { useStorage } from './storage-provider.tsx';

type OperationResult = { ok: true } | { ok: false };
type SignUpOperationResult =
  | { ok: true; requiresEmailVerification: boolean }
  | { ok: false; requiresEmailVerification: false };

type AccountContextValue = ReturnType<typeof useAccountValue>;

const AccountContext = createContext<AccountContextValue | undefined>(
  undefined,
);

export function AccountProvider({ children }: PropsWithChildren) {
  const value = useAccountValue();
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

function useAccountValue() {
  const storage = useStorage();
  const onboarding = useOnboarding();
  const configuration = useMemo(readAuthConfiguration, []);
  const gateway = useMemo<AccountGateway | null>(
    () =>
      configuration.status === 'ready'
        ? createSupabaseAccountGateway(configuration.configuration)
        : null,
    [configuration],
  );
  const [state, dispatch] = useReducer(reduceAuthState, initialAuthState);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const operationActive = useRef(false);
  const linkService = useMemo(
    () =>
      storage.repositories
        ? new AccountLinkService(storage.repositories)
        : null,
    [storage.repositories],
  );

  const safelyLink = useCallback(
    async (accountId: string) => {
      if (!linkService) return;
      await linkService.link(accountId).catch(() => undefined);
    },
    [linkService],
  );

  const loadProfile = useCallback(async () => {
    if (!gateway) return;
    const nextProfile = await gateway.getProfile().catch(() => null);
    setProfile(nextProfile);
  }, [gateway]);

  useEffect(() => {
    if (!gateway) {
      dispatch({ type: 'configuration_unavailable' });
      return;
    }

    let active = true;
    const unsubscribe = gateway.subscribe((change) => {
      if (!active) return;
      dispatch({ type: 'changed', change });
      if (change.session) {
        void safelyLink(change.session.accountId);
      } else {
        setProfile(null);
      }
    });

    void gateway
      .restoreSession()
      .then((session) => {
        if (!active) return;
        dispatch({ type: 'restored', session });
        if (session) {
          void safelyLink(session.accountId);
          void loadProfile();
        }
      })
      .catch(() => {
        if (!active) return;
        dispatch({ type: 'restored', session: null });
      });

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') gateway.startAutoRefresh();
      else gateway.stopAutoRefresh();
    };

    handleAppState(AppState.currentState);
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppState,
    );

    return () => {
      active = false;
      gateway.stopAutoRefresh();
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [gateway, loadProfile, safelyLink]);

  useEffect(() => {
    if (onboarding.status === 'complete' && state.session) {
      void safelyLink(state.session.accountId);
    }
  }, [onboarding.status, safelyLink, state.session]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | null> => {
      if (operationActive.current) return null;
      operationActive.current = true;
      setIsBusy(true);

      try {
        return await operation();
      } catch (error) {
        const failure = mapAuthError(error);
        dispatch({ type: 'failed', message: failure.message });
        return null;
      } finally {
        operationActive.current = false;
        setIsBusy(false);
      }
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<OperationResult> => {
      if (!gateway) return { ok: false };
      const session = await run(() => gateway.signIn(email.trim(), password));
      if (!session) return { ok: false };
      dispatch({ type: 'restored', session });
      await safelyLink(session.accountId);
      void loadProfile();
      return { ok: true };
    },
    [gateway, loadProfile, run, safelyLink],
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<SignUpOperationResult> => {
      if (!gateway) return { ok: false, requiresEmailVerification: false };
      const result = await run(() =>
        gateway.signUp({ ...input, email: input.email.trim() }),
      );
      if (!result) return { ok: false, requiresEmailVerification: false };
      if (result.session) {
        dispatch({ type: 'restored', session: result.session });
        await safelyLink(result.session.accountId);
      }
      return {
        ok: true,
        requiresEmailVerification: result.requiresEmailVerification,
      };
    },
    [gateway, run, safelyLink],
  );

  const signOut = useCallback(async (): Promise<OperationResult> => {
    if (!gateway) return { ok: false };
    const result = await run(async () => {
      await gateway.signOut();
      await linkService?.unlink();
      setProfile(null);
      dispatch({ type: 'restored', session: null });
      return true;
    });
    return { ok: Boolean(result) };
  }, [gateway, linkService, run]);

  const sendRecovery = useCallback(
    async (email: string, redirectTo: string): Promise<OperationResult> => {
      if (!gateway) return { ok: false };
      const result = await run(() =>
        gateway.sendRecovery(email.trim(), redirectTo),
      );
      return { ok: result !== null };
    },
    [gateway, run],
  );

  const consumeCallback = useCallback(
    async (
      url: string,
    ): Promise<OperationResult & { purpose: 'verification' | 'recovery' }> => {
      const callback = parseRecoveryUrl(url);
      const purpose =
        callback.kind === 'invalid' ? 'recovery' : callback.purpose;
      if (!gateway) return { ok: false, purpose };
      const session = await run(() => gateway.consumeCallback(callback));
      if (!session) return { ok: false, purpose };
      dispatch({
        type: 'changed',
        change: {
          event: purpose === 'recovery' ? 'password_recovery' : 'signed_in',
          session,
        },
      });
      await safelyLink(session.accountId);
      return { ok: true, purpose };
    },
    [gateway, run, safelyLink],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<OperationResult> => {
      if (!gateway) return { ok: false };
      const result = await run(() => gateway.updatePassword(password));
      return { ok: result !== null };
    },
    [gateway, run],
  );

  const saveProfile = useCallback(
    async (
      values: Pick<AccountProfile, 'displayName' | 'locale' | 'timeZone'>,
    ): Promise<OperationResult> => {
      if (!gateway) return { ok: false };
      const saved = await run(() => gateway.saveProfile(values));
      if (!saved) return { ok: false };
      setProfile(saved);
      return { ok: true };
    },
    [gateway, run],
  );

  return {
    ...state,
    configured: configuration.status === 'ready',
    profile,
    isBusy,
    signIn,
    signUp,
    signOut,
    sendRecovery,
    consumeCallback,
    updatePassword,
    saveProfile,
    refreshProfile: loadProfile,
  };
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used within AccountProvider.');
  return value;
}
