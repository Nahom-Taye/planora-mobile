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
import * as Network from 'expo-network';

import type { AccountProfile } from '../domain/entities/account.ts';
import { AccountLinkService } from '../features/account/services/account-link-service.ts';
import type { AccountGateway } from '../features/auth/services/account-gateway.ts';
import { readAuthConfiguration } from '../features/auth/services/auth-configuration.ts';
import { mapAuthError } from '../features/auth/services/auth-error-mapper.ts';
import { startAccountLifecycle, withDeadline, operationTimeoutMs, SingleFlight } from '../features/auth/services/auth-runtime.ts';
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
  const [confirmation, setConfirmation] = useState<{ email: string; redirectTo: string } | null>(null);
  const operations = useRef(new SingleFlight());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const activeAccountId = useRef<string | null>(null);
  activeAccountId.current = state.session?.accountId ?? null;
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
    const accountId = activeAccountId.current;
    if (!accountId) return;
    const nextProfile = await gateway.getProfile().catch(() => null);
    if (activeAccountId.current === accountId) setProfile(nextProfile);
  }, [gateway]);

  const retryAccount = useCallback(async () => operations.current.run(async () => {
    if (!gateway) return;
    setIsBusy(true);
    dispatch({ type: 'clear_error' });
    gateway.stopAutoRefresh();
    try {
      await gateway.checkReadiness();
      const session = await gateway.restoreSession();
      dispatch({ type: 'restored', session });
    } catch (error) {
      dispatch({ type: 'failed', message: mapAuthError(error).message });
    } finally {
      setIsBusy(false);
      void Network.getNetworkStateAsync().then((next) => {
        if (mounted.current && AppState.currentState === 'active' && next.isConnected !== false && next.isInternetReachable !== false) gateway.startAutoRefresh();
      }).catch(() => undefined);
    }
  }), [gateway]);

  useEffect(() => startAccountLifecycle(gateway, dispatch), [gateway]);

  useEffect(() => {
    if (!gateway) return;
    let disposed = false;
    let foreground = AppState.currentState === 'active';
    let online = false;
    const update = () => {
      if (disposed) return;
      if (foreground && online && !operations.current.isActive) gateway.startAutoRefresh();
      else gateway.stopAutoRefresh();
    };

    const handleAppState = (nextState: AppStateStatus) => {
      foreground = nextState === 'active';
      update();
    };
    const networkSubscription = Network.addNetworkStateListener((next) => {
      online = next.isConnected !== false && next.isInternetReachable !== false;
      update();
    });
    void Network.getNetworkStateAsync().then((next) => {
      online = next.isConnected !== false && next.isInternetReachable !== false;
      update();
    }).catch(() => undefined);
    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppState,
    );

    return () => {
      disposed = true;
      gateway.stopAutoRefresh();
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [gateway, state.session?.accountId]);

  useEffect(() => {
    if (onboarding.status === 'complete' && state.session) {
      void safelyLink(state.session.accountId);
    }
  }, [onboarding.status, safelyLink, state.session]);

  useEffect(() => {
    setProfile(null);
    if (state.session?.accountId) void loadProfile();
  }, [loadProfile, state.session?.accountId]);

  const run = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | null> => {
      if (operations.current.isActive) return null;
      setIsBusy(true);
      dispatch({ type: 'clear_error' });
      gateway?.stopAutoRefresh();

      try {
        return await withDeadline(operations.current.run(async () => {
          await gateway?.restoreSession().catch(() => undefined);
          return operation();
        }), operationTimeoutMs);
      } catch (error) {
        const failure = mapAuthError(error);
        dispatch({ type: 'failed', message: failure.message });
        return null;
      } finally {
        setIsBusy(false);
        void Network.getNetworkStateAsync().then((next) => {
          if (!operations.current.isActive && mounted.current && AppState.currentState === 'active' && next.isConnected !== false && next.isInternetReachable !== false) gateway?.startAutoRefresh();
        }).catch(() => undefined);
      }
    },
    [gateway],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<OperationResult> => {
      if (!gateway) return { ok: false };
      const session = await run(() => gateway.signIn(email.trim().toLowerCase(), password));
      if (!session) return { ok: false };
      dispatch({ type: 'restored', session });
      return { ok: true };
    },
    [gateway, run],
  );

  const signUp = useCallback(
    async (input: SignUpInput): Promise<SignUpOperationResult> => {
      if (!gateway) return { ok: false, requiresEmailVerification: false };
      const result = await run(() =>
        gateway.signUp({ ...input, email: input.email.trim().toLowerCase() }),
      );
      if (!result) return { ok: false, requiresEmailVerification: false };
      setConfirmation(result.requiresEmailVerification ? { email: input.email.trim().toLowerCase(), redirectTo: input.redirectTo } : null);
      if (result.session) {
        dispatch({ type: 'restored', session: result.session });
      }
      return {
        ok: true,
        requiresEmailVerification: result.requiresEmailVerification,
      };
    },
    [gateway, run],
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
      setConfirmation(null);
      const result = await run(() =>
        gateway.sendRecovery(email.trim().toLowerCase(), redirectTo),
      );
      return { ok: result !== null };
    },
    [gateway, run],
  );

  const resendConfirmation = useCallback(async () => {
    if (!gateway || !confirmation) return { ok: false };
    const result = await run(async () => {
      await gateway.resendConfirmation(confirmation.email, confirmation.redirectTo);
      return true;
    });
    return { ok: Boolean(result) };
  }, [confirmation, gateway, run]);

  const consumeCallback = useCallback(
    async (
      url: string,
      expectedDestination?: string,
    ): Promise<OperationResult & { purpose: 'verification' | 'recovery' }> => {
      const callback = parseRecoveryUrl(url, expectedDestination);
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
      return { ok: true, purpose };
    },
    [gateway, run],
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
    retryAccount,
    canResendConfirmation: Boolean(confirmation),
    resendConfirmation,
  };
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used within AccountProvider.');
  return value;
}
