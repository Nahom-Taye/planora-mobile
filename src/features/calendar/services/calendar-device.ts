import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export type WritableCalendar = { id: string; title: string };
export type CalendarEventInput = {
  title: string;
  notes?: string;
  startDate: Date;
  endDate: Date;
  timeZone: string;
  allDay: boolean;
};
export type DeviceCalendarEventSnapshot = CalendarEventInput & { id: string };

export interface CalendarDeviceGateway {
  listWritable(): Promise<WritableCalendar[]>;
  getEvent(id: string): Promise<DeviceCalendarEventSnapshot | null>;
  createEvent(calendarId: string, event: CalendarEventInput): Promise<string>;
  updateEvent(id: string, event: CalendarEventInput): Promise<void>;
  deleteEvent(id: string): Promise<void>;
}

export const expoCalendarGateway: CalendarDeviceGateway = {
  async listWritable() {
    if (Platform.OS === 'web') return [];
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars
      .filter((calendar) => calendar.allowsModifications)
      .map((calendar) => ({ id: calendar.id, title: calendar.title }))
      .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
  },
  async getEvent(id) {
    if (Platform.OS === 'web') return null;
    try {
      const event = await Calendar.getEventAsync(id);
      return {
        id: event.id,
        title: event.title ?? '',
        notes: event.notes ?? undefined,
        startDate: new Date(event.startDate),
        endDate: new Date(event.endDate),
        timeZone: event.timeZone ?? 'UTC',
        allDay: event.allDay,
      };
    } catch {
      return null;
    }
  },
  createEvent: (calendarId, event) => Calendar.createEventAsync(calendarId, event),
  async updateEvent(id, event) {
    await Calendar.updateEventAsync(id, event);
  },
  async deleteEvent(id) {
    await Calendar.deleteEventAsync(id);
  },
};
