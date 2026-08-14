import type { EntityId, EntityMetadata, Instant } from './common';

export type ReminderEntityType = 'task' | 'plan_block' | 'routine' | 'goal';
export type ReminderTriggerKind = 'relative' | 'absolute';

export type ReminderIntent = EntityMetadata & {
  workspaceId: EntityId;
  entityType: ReminderEntityType;
  entityId: EntityId;
  triggerKind: ReminderTriggerKind;
  offsetMinutes: number | null;
  absoluteAt: Instant | null;
  enabled: boolean;
};

export type NotificationScheduleState = 'scheduled' | 'skipped' | 'error';

export type DeviceNotificationSchedule = EntityMetadata & {
  workspaceId: EntityId;
  reminderIntentId: EntityId;
  occurrenceKey: string;
  notificationIdentifier: string | null;
  scheduledFor: Instant | null;
  state: NotificationScheduleState;
  reason: string | null;
  sourceRevision: number;
};

export type CalendarEventMappingState =
  | 'active'
  | 'missing'
  | 'external_change';

export type DeviceCalendarEvent = EntityMetadata & {
  workspaceId: EntityId;
  planBlockId: EntityId;
  calendarId: string;
  eventId: string;
  sourceRevision: number;
  sourceFingerprint: string;
  state: CalendarEventMappingState;
};
