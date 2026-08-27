import type { NotificationResponse } from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
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

import {
  CalendarInteropService,
  CalendarMappingConflict,
} from '@/features/calendar/services/calendar-interop';
import { expoCalendarGateway } from '@/features/calendar/services/calendar-device';
import { PlanningPreferencesService } from '@/features/settings/services/planning-preferences-service';
import {
  readCalendarPermission,
  readNotificationPermission,
  requestCalendarPermission,
  requestNotificationPermission,
  type DevicePermissionState,
} from '@/features/reminders/services/device-permissions';
import { resolveNotificationDestination } from '@/features/reminders/services/notification-navigation';
import { expoNotificationGateway } from '@/features/reminders/services/notification-device';
import { loadNotificationModule } from '@/features/reminders/services/notification-runtime';
import {
  ReminderLifecycleService,
  ReminderValidationError,
} from '@/features/reminders/services/reminder-lifecycle';
import { ReminderReconciliationService } from '@/features/reminders/services/reminder-reconciliation';
import type { ReminderDraft } from '@/features/reminders/services/reminder-validation';
import type {
  DeviceCalendarEvent,
  LocalTime,
  PlanBlock,
  ReminderEntityType,
} from '@/domain/entities';
import type { RepositoryStore } from '@/domain/repositories';

import { useGoals } from './goal-provider';
import { useLocalization } from './localization-provider';
import { usePlanner } from './planner-provider';
import { usePlanning } from './planning-provider';
import { useWorkspace } from './workspace-provider';

type ReminderContextValue = ReturnType<typeof useReminderValue>;
const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);

export function ReminderProvider({
  repositories,
  children,
}: PropsWithChildren<{ repositories: RepositoryStore | null }>) {
  const value = useReminderValue(repositories);
  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

function useReminderValue(repositories: RepositoryStore | null) {
  const router = useRouter();
  const workspace = useWorkspace();
  const localization = useLocalization();
  const planning = usePlanning();
  const planner = usePlanner();
  const goals = useGoals();
  const [notificationPermission, setNotificationPermission] =
    useState<DevicePermissionState>('unavailable');
  const [calendarPermission, setCalendarPermission] =
    useState<DevicePermissionState>('unavailable');
  const [schedules, setSchedules] = useState<
    Awaited<ReturnType<RepositoryStore['deviceNotificationSchedules']['list']>>['items']
  >([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [calendarConflict, setCalendarConflict] = useState<
    CalendarMappingConflict['kind'] | null
  >(null);
  const [busy, setBusy] = useState(false);
  const operationActive = useRef(false);
  const handledResponse = useRef<string | null>(null);
  const lifecycle = useMemo(
    () => (repositories ? new ReminderLifecycleService(repositories) : null),
    [repositories],
  );
  const reconciliation = useMemo(
    () =>
      repositories
        ? new ReminderReconciliationService(repositories, expoNotificationGateway)
        : null,
    [repositories],
  );
  const calendar = useMemo(
    () => (repositories ? new CalendarInteropService(repositories, expoCalendarGateway) : null),
    [repositories],
  );
  const preferences = useMemo(
    () => (repositories ? new PlanningPreferencesService(repositories) : null),
    [repositories],
  );
  const sourceSignature = [
    ...planning.tasks,
    ...planning.routines,
    ...planner.blocks,
    ...goals.goals,
  ]
    .map((item) => `${item.id}:${item.revision}`)
    .sort()
    .join('|');

  const refreshPermissions = useCallback(async () => {
    const [notifications, calendars] = await Promise.all([
      readNotificationPermission(),
      readCalendarPermission(),
    ]);
    setNotificationPermission(notifications);
    setCalendarPermission(calendars);
    return notifications;
  }, []);

  const refreshSchedules = useCallback(async () => {
    if (!repositories || !workspace.workspace) return;
    const page = await repositories.deviceNotificationSchedules.list({
      filter: { workspaceId: workspace.workspace.id },
      page: { limit: 100, offset: 0 },
    });
    setSchedules(page.items);
  }, [repositories, workspace.workspace]);

  const reconcile = useCallback(async () => {
    const settings = localization.settings;
    const profile = workspace.profile;
    const activeWorkspace = workspace.workspace;
    if (!reconciliation || !settings || !profile || !activeWorkspace) return null;
    const permission = await readNotificationPermission();
    setNotificationPermission(permission);
    const result = await reconciliation.reconcile({
      workspaceId: activeWorkspace.id,
      settings,
      timeZone: profile.timeZone,
      permissionAllowed: permission === 'allowed',
      now: new Date(),
      genericTitle: localization.t('reminders.genericTitle'),
      genericBody: localization.t('reminders.genericBody'),
    });
    await refreshSchedules();
    return result;
  }, [localization, reconciliation, refreshSchedules, workspace.profile, workspace.workspace]);

  useEffect(() => {
    void refreshPermissions();
  }, [refreshPermissions]);

  useEffect(() => {
    if (workspace.status === 'ready') void reconcile();
  }, [reconcile, sourceSignature, workspace.status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions().then(() => reconcile());
    });
    return () => subscription.remove();
  }, [reconcile, refreshPermissions]);

  const handleResponse = useCallback(
    async (response: NotificationResponse | null) => {
      if (!response || !repositories || !workspace.workspace) return;
      const request = response.notification.request;
      if (handledResponse.current === request.identifier) return;
      handledResponse.current = request.identifier;
      const destination = await resolveNotificationDestination(
        repositories,
        workspace.workspace.id,
        request.content.data,
      );
      router.push(
        destination.ok
          ? (destination.route as Href)
          : ({
              pathname: '/(reminders)/notification-fallback',
              params: { reason: destination.reason },
            } as unknown as Href),
      );
    },
    [repositories, router, workspace.workspace],
  );

  useEffect(() => {
    let disposed = false;
    let subscription: { remove: () => void } | null = null;
    void loadNotificationModule().then((notifications) => {
      if (!notifications || disposed) return;
      void notifications.getLastNotificationResponseAsync().then(handleResponse);
      subscription = notifications.addNotificationResponseReceivedListener(handleResponse);
    });
    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [handleResponse]);

  const run = useCallback(async <TResult,>(operation: () => Promise<TResult>) => {
    if (operationActive.current) return null;
    operationActive.current = true;
    setBusy(true);
    setStatusMessage(null);
    setCalendarConflict(null);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CalendarMappingConflict) setCalendarConflict(error.kind);
      setStatusMessage(
        error instanceof ReminderValidationError
          ? localization.t('reminders.unavailableDescription')
          : localization.t('reminders.reasonSchedule_failed'),
      );
      return null;
    } finally {
      operationActive.current = false;
      setBusy(false);
    }
  }, [localization]);

  const requestNotifications = useCallback(
    () =>
      run(async () => {
        const permission = await requestNotificationPermission({
          name: localization.t('nativePermissions.reminderChannel'),
          description: localization.t('nativePermissions.reminderChannelDescription'),
        });
        setNotificationPermission(permission);
        if (permission === 'allowed') await reconcile();
        return permission;
      }),
    [localization, reconcile, run],
  );
  const requestCalendar = useCallback(
    () =>
      run(async () => {
        const permission = await requestCalendarPermission();
        setCalendarPermission(permission);
        return permission;
      }),
    [run],
  );
  const saveReminder = useCallback(
    (draft: ReminderDraft) =>
      run(async () => {
        if (!lifecycle || !workspace.workspace) throw new Error(localization.t('reminders.unavailableDescription'));
        const intent = await lifecycle.save(workspace.workspace.id, draft);
        await reconcile();
        return intent;
      }),
    [lifecycle, localization, reconcile, run, workspace.workspace],
  );
  const reminderFor = useCallback(
    (entityType: ReminderEntityType, entityId: string) =>
      lifecycle && workspace.workspace
        ? lifecycle.getForEntity(workspace.workspace.id, entityType, entityId)
        : Promise.resolve(null),
    [lifecycle, workspace.workspace],
  );
  const saveReminderPreferences = useCallback(
    (input: {
      notificationTitlesEnabled: boolean;
      quietHoursEnabled: boolean;
      quietHoursStart: LocalTime;
      quietHoursEnd: LocalTime;
    }) =>
      run(async () => {
        if (!preferences || !localization.settings) throw new Error(localization.t('reminders.unavailableDescription'));
        await preferences.setReminderPreferences(localization.settings, input);
        await localization.refresh();
        await reconcile();
      }),
    [localization, preferences, reconcile, run],
  );
  const listCalendars = useCallback(
    () => (calendar ? calendar.listWritableCalendars() : Promise.resolve([])),
    [calendar],
  );
  const selectCalendar = useCallback(
    (selected: { id: string; name: string } | null) =>
      run(async () => {
        if (!preferences || !localization.settings) throw new Error(localization.t('calendar.mobileOnly'));
        await preferences.setDeviceCalendar(localization.settings, selected);
        await localization.refresh();
      }),
    [localization, preferences, run],
  );
  const exportBlock = useCallback(
    (block: PlanBlock, force = false) =>
      run(async () => {
        if (!calendar || !localization.settings?.deviceCalendarId) {
          throw new Error(localization.t('calendar.chooseInSettings'));
        }
        return calendar.exportBlock(block, localization.settings.deviceCalendarId, force);
      }),
    [calendar, localization, run],
  );
  const calendarMappingFor = useCallback(
    (block: PlanBlock) =>
      calendar ? calendar.mappingFor(block.workspaceId, block.id) : Promise.resolve(null),
    [calendar],
  );
  const removeCalendarMapping = useCallback(
    (mapping: DeviceCalendarEvent, removeEvent: boolean) =>
      run(async () => calendar?.removeMapping(mapping, removeEvent)),
    [calendar, run],
  );
  const clearDeviceIntegrations = useCallback(async (removeCalendarEvents: boolean) => {
    if (!repositories || !workspace.workspace) return;
    const workspaceId = workspace.workspace.id;
    let offset = 0;
    while (true) {
      const page = await repositories.deviceNotificationSchedules.list({ filter: { workspaceId }, page: { limit: 100, offset } });
      for (const mapping of page.items) {
        if (mapping.notificationIdentifier) await expoNotificationGateway.cancel(mapping.notificationIdentifier);
      }
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
    if (!removeCalendarEvents) return;
    offset = 0;
    while (true) {
      const page = await repositories.deviceCalendarEvents.list({ filter: { workspaceId }, page: { limit: 100, offset } });
      for (const mapping of page.items) {
        const event = await expoCalendarGateway.getEvent(mapping.eventId);
        if (event) await expoCalendarGateway.deleteEvent(mapping.eventId);
      }
      if (page.nextOffset === null) break;
      offset = page.nextOffset;
    }
  }, [repositories, workspace.workspace]);

  return {
    notificationPermission,
    calendarPermission,
    schedules,
    statusMessage,
    calendarConflict,
    busy,
    refreshPermissions,
    requestNotifications,
    requestCalendar,
    reconcile,
    reminderFor,
    saveReminder,
    saveReminderPreferences,
    listCalendars,
    selectCalendar,
    exportBlock,
    calendarMappingFor,
    removeCalendarMapping,
    clearDeviceIntegrations,
  };
}

export function useReminders() {
  const value = useContext(ReminderContext);
  if (!value) throw new Error('useReminders must be used within ReminderProvider.');
  return value;
}
