import type {
  DeviceCalendarEvent,
  PlanBlock,
} from '../../../domain/entities/index.ts';
import type { RepositoryStore } from '../../../domain/repositories/contracts.ts';
import { localDateTimeInstant } from '../../planner/services/calendar-math.ts';
import type {
  CalendarDeviceGateway,
  CalendarEventInput,
  DeviceCalendarEventSnapshot,
} from './calendar-device.ts';

export class CalendarMappingConflict extends Error {
  constructor(readonly kind: 'missing' | 'external_change') {
    super('The mapped calendar event needs a decision.');
  }
}

export class CalendarInteropService {
  constructor(
    private readonly repositories: RepositoryStore,
    private readonly device: CalendarDeviceGateway,
  ) {}

  listWritableCalendars() {
    return this.device.listWritable();
  }

  async mappingFor(workspaceId: string, planBlockId: string) {
    const page = await this.repositories.deviceCalendarEvents.list({
      filter: { workspaceId, planBlockId },
      page: { limit: 1, offset: 0 },
    });
    return page.items[0] ?? null;
  }

  async exportBlock(block: PlanBlock, calendarId: string, force = false) {
    if (block.deletedAt || block.status === 'cancelled') {
      throw new Error('This plan block is not available for calendar export.');
    }
    const input = eventInput(block);
    const fingerprint = eventFingerprint(input);
    const mapping = await this.mappingFor(block.workspaceId, block.id);
    if (!mapping) {
      const eventId = await this.device.createEvent(calendarId, input);
      return this.repositories.deviceCalendarEvents.create({
        workspaceId: block.workspaceId,
        planBlockId: block.id,
        calendarId,
        eventId,
        sourceRevision: block.revision,
        sourceFingerprint: fingerprint,
        state: 'active',
      });
    }
    const event = await this.device.getEvent(mapping.eventId);
    if (!event) {
      const changed = await this.repositories.deviceCalendarEvents.update(mapping.id, {
        expectedRevision: mapping.revision,
        state: 'missing',
      });
      if (!force) throw new CalendarMappingConflict('missing');
      const eventId = await this.device.createEvent(calendarId, input);
      return this.repositories.deviceCalendarEvents.update(changed.id, {
        expectedRevision: changed.revision,
        calendarId,
        eventId,
        sourceRevision: block.revision,
        sourceFingerprint: fingerprint,
        state: 'active',
      });
    }
    if (eventFingerprint(event) !== mapping.sourceFingerprint && !force) {
      await this.repositories.deviceCalendarEvents.update(mapping.id, {
        expectedRevision: mapping.revision,
        state: 'external_change',
      });
      throw new CalendarMappingConflict('external_change');
    }
    await this.device.updateEvent(mapping.eventId, input);
    const current = await this.repositories.deviceCalendarEvents.getById(mapping.id);
    if (!current) throw new Error('The calendar mapping is unavailable.');
    return this.repositories.deviceCalendarEvents.update(current.id, {
      expectedRevision: current.revision,
      calendarId: mapping.calendarId,
      sourceRevision: block.revision,
      sourceFingerprint: fingerprint,
      state: 'active',
    });
  }

  async removeMapping(mapping: DeviceCalendarEvent, removeEvent: boolean) {
    if (removeEvent) {
      const event = await this.device.getEvent(mapping.eventId);
      if (event) await this.device.deleteEvent(mapping.eventId);
    }
    const current = await this.repositories.deviceCalendarEvents.getById(mapping.id);
    if (!current) return;
    await this.repositories.deviceCalendarEvents.softDelete(
      current.id,
      current.revision,
    );
  }
}

export function eventInput(block: PlanBlock): CalendarEventInput {
  return {
    title: block.title,
    notes: block.notes ?? undefined,
    startDate: localDateTimeInstant(block.date, block.startTime, block.timeZone),
    endDate: localDateTimeInstant(block.date, block.endTime, block.timeZone),
    timeZone: block.timeZone,
    allDay: false,
  };
}

export function eventFingerprint(
  event: CalendarEventInput | DeviceCalendarEventSnapshot,
) {
  return JSON.stringify({
    title: event.title,
    notes: event.notes ?? null,
    start: event.startDate.toISOString(),
    end: event.endDate.toISOString(),
    timeZone: event.timeZone,
    allDay: event.allDay,
  });
}
