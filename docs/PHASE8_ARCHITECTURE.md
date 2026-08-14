# Planora Phase 8 Architecture

## Scope and boundaries

Phase 8 adds opt-in local reminders and optional one-way export of eligible plan blocks to a writable device calendar. SQLite remains the source of truth. Reminder intent is portable planning data, while native notification identifiers and device calendar mappings remain local to the device.

Phase 8 does not add remote push notifications, push tokens, calendar import, two-way calendar synchronization, remote planning synchronization, telemetry, payments, subscriptions, sharing, collaboration, or background execution guarantees.

## Module structure

Portable reminder intent, device notification mapping, and device calendar mapping are typed domain entities with repository contracts and explicit SQLite row mappers. `ReminderProvider` coordinates permission reads, foreground reconciliation, notification response validation, calendar selection, and recoverable device-operation state. Routes remain thin and contain no SQL or account-client access.

Pure services under `src/features/reminders/services` own validation, occurrence calculation, quiet-hours policy, permission normalization, reconciliation, and notification destination validation. Services under `src/features/calendar/services` own writable-calendar discovery, event fingerprints, one-way export, update decisions, and mapped removal. Screens and settings components consume those boundaries without implementing persistence.

## Permission behavior

Notification and calendar permissions are never requested during startup, onboarding, or ordinary screen entry. Startup and app foregrounding only read current operating-system state. Permission requests follow an explicit reminder, export, or connection action after the interface explains what access enables.

Notification state distinguishes unavailable, undetermined, allowed, denied, and blocked outcomes. Calendar state uses the same recoverable model. Denied or revoked notification permission prevents new schedules and removes only Planora's recorded schedule mappings. A blocked state offers the operating-system settings action. Web presents calendar export as mobile-only.

Android uses the `planora-reminders` channel with default importance, private lock-screen visibility, and no custom sound or vibration pattern. The application requests no push token and adds no exact-alarm permission. Delivery time remains subject to operating-system scheduling behavior.

## Reminder intent and occurrence rules

Each active workspace can have at most one non-deleted reminder intent for a given supported entity. Supported sources are tasks, plan blocks, routines, and goals. Relative reminders use the source's applicable local date, wall-clock time, and IANA time zone. Absolute reminders store a validated timestamp. Reminder edits use optimistic revisions and active-workspace ownership checks.

Task reminders require a due date, scheduled time, and actionable state. Plan-block reminders require a planned block. Goal reminders require an active goal with a target date and use 09:00 in the profile time zone as the target-day reference. Routine occurrences apply the established routine schedule and time-zone rules.

Reconciliation considers at most 32 future occurrences in total from a 28-local-day routine window, including quiet-hours skips and recoverable schedule failures. Past occurrences, disabled intents, completed or inactive sources, cancelled blocks, and deleted records are omitted. Entity and reminder changes trigger a fresh bounded reconciliation. Foregrounding re-reads permission and time-zone state before reconciliation. Only identifiers present in Planora's mapping table are cancelled. A failed cancellation prevents replacement scheduling until a later reconciliation can safely clear the old mapping.

## Quiet hours and privacy

Quiet hours use profile-local wall-clock boundaries. Equal start and end values disable deferral. A reminder inside quiet hours moves to the next quiet-hours end when that time remains before the source event. If the deferred time reaches or passes the source event, the occurrence is skipped as stale and its reason is retained for display. Overnight ranges advance the end to the following local calendar day. Daylight-saving changes use the established local-date and local-time conversion service.

Notification content is generic by default. An explicit setting allows source titles on the device notification. Payloads contain only a fixed version, allow-listed entity type, and UUID. They never contain notes, reflection bodies, arbitrary routes, account data, credentials, or tokens.

## Notification navigation

Foreground, background, and cold-start responses enter one validation path. The payload version and entity type must match the allow-list, the identifier must be a UUID, and the referenced record must still be non-deleted in the active workspace. Valid responses open the appropriate editor or detail screen. Malformed, missing, deleted, and inaccessible destinations open a safe fallback with a localized explanation. Arbitrary route strings are ignored.

## Device calendar interoperability

Calendar connection lists only calendars the operating system reports as modifiable. The chosen calendar identifier and display name are device settings. An eligible plan block is exported with its local date, local times, IANA time zone, optional notes, and a source fingerprint. The resulting native event identifier is stored only in the device mapping table.

Updating an export first reads the mapped native event. A missing event becomes a recoverable `missing` state. A changed title, notes, time, time zone, or all-day state becomes an `external_change` state. Planora does not overwrite either state automatically. The user must explicitly recreate or replace the event. Removal offers separate choices to keep the external event while removing the mapping or to delete that mapped event as well. Unrelated calendar events are never read for import or modified.

## Migration 7

Migration 7 is forward-only, atomic through the existing migration runner, additive, seed-free, and safe for existing databases. It appends notification title privacy, quiet-hours, and selected-calendar settings. It creates reminder intent, device notification schedule, and device calendar event tables with workspace ownership, entity constraints, foreign keys, revision metadata, soft deletion, deterministic indexes, and active uniqueness rules.

Native notification identifiers and calendar identifiers are separated from portable reminder intent. Migration 7 does not backfill schedules, request permissions, create reminders, or write calendar events. Released migrations 1–6 remain byte-for-byte unchanged.

## Offline, privacy, and recovery

Reminder intent and preference changes remain available offline. Native scheduling and calendar operations are attempted only on supported devices and surface bounded errors without changing planning records. Reconciliation may be retried from Settings. Revoked permissions, missing events, external calendar edits, unsupported platforms, and missing records have distinct recoverable states.

No planning content is transmitted. There is no remote notification service, remote calendar service, tracking identifier, hidden analytics, or behavioral advertising. Notification and calendar access state, native identifiers, and event mappings remain device-local. SQLite storage is not described as encrypted.

## Localization and accessibility

All Phase 8 permission explanations, reminder controls, statuses, quiet-hours fields, privacy controls, calendar actions, conflicts, fallbacks, errors, confirmations, labels, and hints exist in English, Amharic, Spanish, French, and Arabic with matching catalog structures and placeholders. Dates and times use local formatters, and user-created source content is not translated.

Controls use text labels, selected and disabled states, 48-pixel minimum targets where practical, scalable layouts, keyboard-safe forms, and screen-reader descriptions. Meaning never depends on color. Existing light and dark themes, Arabic RTL layout, and bundled Arabic and Ethiopic fonts remain active. Automated checks do not certify physical permission dialogs, real delivery, calendar writes, screen readers, visual quality, or fluent translation review.

## Testing and limitations

`test:phase8` covers reminder validation and lifecycle, workspace ownership, restart persistence, local-time occurrence calculation, bounded recurrence, quiet-hours deferral and stale skips, privacy-preserving content, mapped cancellation, revoked permission, permission normalization, notification destination validation, calendar conflict decisions, mapping persistence, row mappers, migration 7 structure, and all five catalogs.

Operating systems may defer or suppress local notifications. Planora does not promise exact delivery and does not request exact-alarm access. Reconciliation runs on supported app lifecycle events rather than an unbounded background loop. Calendar export is one-way and requires the application to be opened for later changes to reconcile. Physical-device delivery, cold-start navigation, permission behavior, time-zone changes, daylight-saving transitions, and calendar modification remain explicit manual checks.
