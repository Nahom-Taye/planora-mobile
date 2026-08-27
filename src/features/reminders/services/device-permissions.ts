import * as Calendar from 'expo-calendar';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { currentNotificationRuntime, loadNotificationModule } from './notification-runtime';
import { normalizePermissionState } from './permission-state';

export type DevicePermissionState =
  | 'undetermined'
  | 'allowed'
  | 'denied'
  | 'blocked'
  | 'developmentBuildRequired'
  | 'unavailable';

export type NotificationChannelText = {
  name: string;
  description: string;
};

export async function readNotificationPermission(): Promise<DevicePermissionState> {
  const runtime = currentNotificationRuntime();
  if (runtime === 'web') return 'unavailable';
  if (runtime === 'expo_go') return 'developmentBuildRequired';
  try {
    const notifications = await loadNotificationModule();
    return notifications
      ? notificationState(await notifications.getPermissionsAsync(), notifications)
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function requestNotificationPermission(channel: NotificationChannelText): Promise<DevicePermissionState> {
  const runtime = currentNotificationRuntime();
  if (runtime === 'web') return 'unavailable';
  if (runtime === 'expo_go') return 'developmentBuildRequired';
  await ensureReminderChannel(channel);
  try {
    const notifications = await loadNotificationModule();
    return notifications
      ? notificationState(await notifications.requestPermissionsAsync(), notifications)
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function readCalendarPermission(): Promise<DevicePermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    if (!(await Calendar.isAvailableAsync())) return 'unavailable';
    return permissionState(await Calendar.getCalendarPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

export async function requestCalendarPermission(): Promise<DevicePermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    if (!(await Calendar.isAvailableAsync())) return 'unavailable';
    return permissionState(await Calendar.requestCalendarPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

export async function ensureReminderChannel(channel: NotificationChannelText) {
  if (Platform.OS !== 'android') return;
  const notifications = await loadNotificationModule();
  if (!notifications) return;
  await notifications.setNotificationChannelAsync('planora-reminders', {
    name: channel.name,
    description: channel.description,
    importance: notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: notifications.AndroidNotificationVisibility.PRIVATE,
    sound: null,
    vibrationPattern: null,
  });
}

function notificationState(
  response: NotificationPermissionsStatus,
  notifications: NonNullable<Awaited<ReturnType<typeof loadNotificationModule>>>,
): DevicePermissionState {
  const ios = response.ios?.status;
  if (
    response.granted ||
    ios === notifications.IosAuthorizationStatus.AUTHORIZED ||
    ios === notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'allowed';
  }
  if (
    response.status === 'undetermined' ||
    ios === notifications.IosAuthorizationStatus.NOT_DETERMINED
  ) {
    return 'undetermined';
  }
  return response.canAskAgain ? 'denied' : 'blocked';
}

function permissionState(response: {
  granted: boolean;
  status: string;
  canAskAgain: boolean;
}): DevicePermissionState {
  return normalizePermissionState(response);
}
