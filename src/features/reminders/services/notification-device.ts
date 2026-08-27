import { Platform } from 'react-native';

import type { ReminderEntityType } from '../../../domain/entities/index.ts';
import { loadNotificationModule } from './notification-runtime';

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
    const notifications = await loadNotificationModule();
    if (!notifications) throw new Error('Notifications are unavailable.');
    return notifications.scheduleNotificationAsync({
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
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: request.date,
        channelId: Platform.OS === 'android' ? 'planora-reminders' : undefined,
      },
    });
  },
  async cancel(identifier) {
    const notifications = await loadNotificationModule();
    if (!notifications) return;
    await notifications.cancelScheduledNotificationAsync(identifier);
  },
};
