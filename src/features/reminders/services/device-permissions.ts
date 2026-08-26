import * as Calendar from 'expo-calendar';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { normalizePermissionState } from './permission-state';

export type DevicePermissionState =
  | 'undetermined'
  | 'allowed'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export type NotificationChannelText = {
  name: string;
  description: string;
};

export async function readNotificationPermission(): Promise<DevicePermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    return notificationState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

export async function requestNotificationPermission(channel: NotificationChannelText): Promise<DevicePermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  await ensureReminderChannel(channel);
  try {
    return notificationState(await Notifications.requestPermissionsAsync());
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
  await Notifications.setNotificationChannelAsync('planora-reminders', {
    name: channel.name,
    description: channel.description,
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: null,
    vibrationPattern: null,
  });
}

function notificationState(
  response: Notifications.NotificationPermissionsStatus,
): DevicePermissionState {
  const ios = response.ios?.status;
  if (
    response.granted ||
    ios === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'allowed';
  }
  if (
    response.status === 'undetermined' ||
    ios === Notifications.IosAuthorizationStatus.NOT_DETERMINED
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
