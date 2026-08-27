import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { selectNotificationRuntime } from './notification-runtime-selection';

export type NotificationModule = typeof import('expo-notifications');

let notificationModule: Promise<NotificationModule> | null = null;
let handlerConfigured = false;

export function currentNotificationRuntime() {
  return selectNotificationRuntime(
    Platform.OS,
    Constants.executionEnvironment ?? ExecutionEnvironment.Bare,
  );
}

export async function loadNotificationModule(): Promise<NotificationModule | null> {
  if (currentNotificationRuntime() !== 'native') return null;
  notificationModule ??= import('expo-notifications');
  const notifications = await notificationModule;
  if (!handlerConfigured) {
    handlerConfigured = true;
    notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return notifications;
}
