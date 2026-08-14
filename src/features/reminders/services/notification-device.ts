import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderEntityType } from '../../../domain/entities/index.ts';

export type NotificationScheduleRequest = {
  identifier: string;
  date: Date;
  entityType: ReminderEntityType;
  entityId: string;
  title: string;
  body: string;
};

export interface NotificationDeviceGateway {
  schedule(request: NotificationScheduleRequest): Promise<string>;
  cancel(identifier: string): Promise<void>;
}

export const expoNotificationGateway: NotificationDeviceGateway = {
  async schedule(request) {
    if (Platform.OS === 'web') throw new Error('Notifications are unavailable.');
    return Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: {
        title: request.title,
        body: request.body,
        sound: false,
        data: {
          planoraVersion: 1,
          entityType: request.entityType,
          entityId: request.entityId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: request.date,
        channelId: Platform.OS === 'android' ? 'planora-reminders' : undefined,
      },
    });
  },
  async cancel(identifier) {
    if (Platform.OS === 'web') return;
    await Notifications.cancelScheduledNotificationAsync(identifier);
  },
};

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
