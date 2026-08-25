import type { PortableRecord } from '../../../domain/entities/index.ts';

export type PlanningExport = {
  format: 'planora-planning-export';
  version: 1;
  exportedAt: string;
  records: PortableRecord[];
};

export function exportContainsDeviceIdentifiers(value: PlanningExport) {
  return hasExcludedKey(value);
}

const excludedKeys = new Set([
  'accessToken',
  'accountId',
  'calendarId',
  'deviceCalendarId',
  'email',
  'eventId',
  'notificationIdentifier',
  'profileId',
  'refreshToken',
  'remoteAccountId',
  'session',
]);

function hasExcludedKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasExcludedKey);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, entry]) => excludedKeys.has(key) || hasExcludedKey(entry));
}
