import * as Network from 'expo-network';
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
import { AppState } from 'react-native';

import type { SyncBinding, SyncConflict } from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';
import { readAuthConfiguration } from '@/features/auth/services/auth-configuration';
import { getSupabaseClient } from '@/features/auth/services/supabase-account-gateway';
import { ConflictResolutionService, type ConflictResolutionChoice } from '@/features/sync/services/conflict-resolution';
import { confirmationMatches, DataControlService } from '@/features/sync/services/data-control';
import { PlanningExportService } from '@/features/sync/services/planning-export';
import { SupabaseSyncGateway } from '@/features/sync/services/supabase-sync-gateway';
import { SyncActivationService, type SyncActivationMode } from '@/features/sync/services/sync-activation';
import { AutomaticSyncCoordinator, automaticRetryDelay, type AutomaticSyncReason } from '@/features/sync/services/automatic-sync';
import { SyncCancelledError, SyncEngine, type SyncRunResult } from '@/features/sync/services/sync-engine';
import { subscribeLocalDataChanges } from '@/storage/repositories/local-data-change-signal';

import { useAccount } from './account-provider';
import { useWorkspace } from './workspace-provider';
import { useReminders } from './reminder-provider';

type SyncContextValue = ReturnType<typeof useSyncValue>;
const SyncContext = createContext<SyncContextValue | undefined>(undefined);

export function SyncProvider({ repositories, children }: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const value = useSyncValue(repositories);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function useSyncValue(repositories: RepositoryStore | null) {
  const account = useAccount();
  const workspace = useWorkspace();
  const reminders = useReminders();
  const configuration = useMemo(readAuthConfiguration, []);
  const gateway = useMemo(() => configuration.status === 'ready'
    ? new SupabaseSyncGateway(getSupabaseClient(configuration.configuration))
    : null, [configuration]);
  const activation = useMemo(() => repositories && gateway ? new SyncActivationService(repositories, gateway) : null, [gateway, repositories]);
  const engine = useMemo(() => repositories && gateway ? new SyncEngine(repositories, gateway) : null, [gateway, repositories]);
  const conflictsService = useMemo(() => repositories ? new ConflictResolutionService(repositories) : null, [repositories]);
  const exporter = useMemo(() => repositories ? new PlanningExportService(repositories) : null, [repositories]);
  const dataControl = useMemo(() => repositories ? new DataControlService(repositories, gateway) : null, [gateway, repositories]);
  const [binding, setBinding] = useState<SyncBinding | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const operation = useRef(false);
  const automaticDeferred = useRef(false);
  const automaticCoordinator = useRef<AutomaticSyncCoordinator | null>(null);
  const automaticLifecycle = useRef(false);
  const activeWorkspaceId = workspace.workspace?.id ?? null;
  const accountId = account.session?.accountId ?? null;
  const activeAccount = useRef(accountId);
  activeAccount.current = accountId;

  const refresh = useCallback(async () => {
    if (!repositories || !activeWorkspaceId) return;
    const [bindingPage, conflictPage, queuePage] = await Promise.all([
      repositories.syncBindings.list({ filter: { workspaceId: activeWorkspaceId }, page: { limit: 1, offset: 0 } }),
      accountId
        ? repositories.syncConflicts.list({ filter: { workspaceId: activeWorkspaceId, accountId, status: 'open' }, page: { limit: 100, offset: 0 } })
        : Promise.resolve({ items: [], nextOffset: null }),
      accountId
        ? repositories.localChanges.list({ filter: { workspaceId: activeWorkspaceId, accountId }, page: { limit: 100, offset: 0 } })
        : Promise.resolve({ items: [], nextOffset: null }),
    ]);
    setBinding(bindingPage.items[0] ?? null);
    setConflicts(conflictPage.items);
    setPending(queuePage.items.length);
  }, [accountId, activeWorkspaceId, repositories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async <T,>(work: () => Promise<T>) => {
    if (operation.current) return null;
    operation.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await work();
      await refresh();
      return result;
    } catch (error) {
      if (!(error instanceof SyncCancelledError)) {
        setMessage(error instanceof Error ? error.message : 'sync_error');
      }
      await refresh().catch(() => undefined);
      return null;
    } finally {
      operation.current = false;
      setBusy(false);
      if (automaticDeferred.current) {
        automaticDeferred.current = false;
        automaticCoordinator.current?.trigger('settled');
      }
    }
  }, [refresh]);

  const synchronize = useCallback((): Promise<SyncRunResult | null> => {
    if (!engine || !activeWorkspaceId || !accountId) return Promise.resolve(null);
    return run(() => engine.run(activeWorkspaceId, accountId, () => activeAccount.current === accountId));
  }, [accountId, activeWorkspaceId, engine, run]);

  const automaticAttempt = useCallback(async (reason: AutomaticSyncReason) => {
    if (!repositories || !activeWorkspaceId || !accountId) return;
    if (operation.current) {
      automaticDeferred.current = true;
      return;
    }
    if (reason === 'queue' || reason === 'settled') {
      const page = await repositories.localChanges.list({
        filter: { workspaceId: activeWorkspaceId, accountId },
        page: { limit: 1, offset: 0 },
      });
      if (page.items.length === 0) {
        await refresh();
        return;
      }
    }
    if (!engine) return;
    await run(() => engine.run(
      activeWorkspaceId,
      accountId,
      () => activeAccount.current === accountId && automaticLifecycle.current,
    ));
    const remaining = await repositories.localChanges.list({
      filter: { workspaceId: activeWorkspaceId, accountId },
      page: { limit: 100, offset: 0 },
    });
    const retryDelay = automaticRetryDelay(remaining.items, Date.now());
    if (retryDelay !== null) {
      automaticCoordinator.current?.triggerAfter('queue', retryDelay);
    }
  }, [accountId, activeWorkspaceId, engine, refresh, repositories, run]);

  useEffect(() => {
    automaticCoordinator.current?.stop();
    automaticCoordinator.current = null;
    automaticLifecycle.current = false;
    if (!binding?.enabled || !accountId || binding.accountId !== accountId) return;
    let active = AppState.currentState === 'active';
    let connected = true;
    let disposed = false;
    automaticLifecycle.current = active && connected;
    const coordinator = new AutomaticSyncCoordinator({
      canRun: () => !disposed && active && connected && activeAccount.current === accountId,
      run: automaticAttempt,
    });
    automaticCoordinator.current = coordinator;
    const unsubscribeChanges = subscribeLocalDataChanges(() => coordinator.trigger('queue'));
    const appSubscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      automaticLifecycle.current = active && connected;
      if (active) coordinator.trigger('foreground');
      else coordinator.suspend();
    });
    const networkSubscription = Network.addNetworkStateListener((state) => {
      const wasConnected = connected;
      connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      automaticLifecycle.current = active && connected;
      setOnline(connected);
      if (!wasConnected && connected) coordinator.trigger('reconnect');
      else if (!connected) coordinator.suspend();
    });
    void Network.getNetworkStateAsync().then((state) => {
      if (disposed) return;
      connected = Boolean(state.isConnected && state.isInternetReachable !== false);
      automaticLifecycle.current = active && connected;
      setOnline(connected);
      if (connected) coordinator.trigger('foreground');
    });
    return () => {
      disposed = true;
      automaticLifecycle.current = false;
      coordinator.stop();
      if (automaticCoordinator.current === coordinator) automaticCoordinator.current = null;
      unsubscribeChanges();
      appSubscription.remove();
      networkSubscription.remove();
    };
  }, [accountId, automaticAttempt, binding?.accountId, binding?.enabled]);

  const enable = useCallback((mode: SyncActivationMode) => {
    if (!activation || !activeWorkspaceId || !accountId) return Promise.resolve(null);
    return run(async () => {
      const next = await activation.enable({ workspaceId: activeWorkspaceId, accountId, mode });
      await engine?.run(activeWorkspaceId, accountId, () => activeAccount.current === accountId);
      return next;
    });
  }, [accountId, activation, activeWorkspaceId, engine, run]);

  const disable = useCallback(() => activeWorkspaceId && activation
    ? run(() => activation.disable(activeWorkspaceId))
    : Promise.resolve(null), [activation, activeWorkspaceId, run]);
  const exportData = useCallback((title: string) => activeWorkspaceId && exporter
    ? run(() => exporter.share(activeWorkspaceId, title))
    : Promise.resolve(null), [activeWorkspaceId, exporter, run]);
  const resolveConflict = useCallback((id: string, choice: ConflictResolutionChoice, combined?: Record<string, unknown>) => conflictsService
    ? run(async () => {
      if (!accountId) throw new Error('session_expired');
      const resolved = await conflictsService.resolve(id, accountId, choice, combined);
      if (activeWorkspaceId) await engine?.run(activeWorkspaceId, accountId, () => activeAccount.current === accountId);
      return resolved;
    })
    : Promise.resolve(null), [accountId, activeWorkspaceId, conflictsService, engine, run]);
  const deleteCloud = useCallback((confirmation: string) => dataControl && accountId
    ? run(() => dataControl.deleteCloud(accountId, confirmation))
    : Promise.resolve(null), [accountId, dataControl, run]);
  const deleteAccount = useCallback((confirmation: string) => dataControl
    ? run(() => dataControl.deleteAccount(confirmation))
    : Promise.resolve(null), [dataControl, run]);
  const clearDevice = useCallback((confirmation: string, removeCalendarEvents: boolean) => activeWorkspaceId && dataControl
    ? run(async () => {
      if (!confirmationMatches(confirmation, 'clear_device')) throw new Error('confirmation_required');
      await reminders.clearDeviceIntegrations(removeCalendarEvents);
      await dataControl.clearDevice(activeWorkspaceId, confirmation);
    })
    : Promise.resolve(null), [activeWorkspaceId, dataControl, reminders, run]);

  return {
    configured: configuration.status === 'ready',
    signedIn: Boolean(accountId),
    binding,
    conflicts,
    pending,
    busy,
    message,
    online,
    refresh,
    synchronize,
    enable,
    disable,
    exportData,
    resolveConflict,
    deleteCloud,
    deleteAccount,
    clearDevice,
  };
}

export function useSync() {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used within SyncProvider.');
  return value;
}
