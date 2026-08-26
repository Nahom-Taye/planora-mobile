# Release checklist

No item in a manual section is considered complete until a named release owner performs it in the required environment and records evidence outside this repository.

## Repository verification

- [ ] `npm ci` succeeds from a clean checkout.
- [ ] `npm run verify:release` succeeds.
- [ ] Every phase test succeeds.
- [ ] Android, iOS JavaScript, and Web exports succeed.
- [ ] Static rendering and typed route generation succeed.
- [ ] Expo Go returns a valid development manifest.
- [ ] `.env.local` is ignored and untracked.
- [ ] No signing files, credentials, logs, exports, screenshots, or build output are tracked.
- [ ] Migrations 1 through 8 match their canonical hashes.
- [ ] The dependency audit is reviewed and unresolved findings are accepted or repaired through a compatible supported upgrade.

## Manual accessibility review

- [ ] VoiceOver: startup, onboarding, authentication, Today, editing, synchronization, conflicts, export, deletion, and settings.
- [ ] TalkBack: the same journeys, including notification and calendar permission denial.
- [ ] Large text: all supported sizes without clipped labels, hidden actions, or unreachable confirmation controls.
- [ ] High contrast: light and dark themes, focus indicators, disabled controls, alerts, charts, and destructive actions.
- [ ] Reduced motion: startup and modal transitions respect the system setting.
- [ ] Keyboard navigation: Web focus order, visible focus, form submission, validation, dialogs, and route recovery.
- [ ] Arabic RTL: navigation, forms, lists, charts, dialogs, tabs, and mixed numeric content.
- [ ] Color vision: status, conflicts, errors, charts, and selections remain understandable without color.
- [ ] Amharic fonts: headings, body text, fields, and longer messages render correctly.

## Manual Supabase review

- [ ] Apply the Phase 9 migration to a non-production project.
- [ ] Deploy the account-deletion server function with privileged credentials stored only in the server environment.
- [ ] Verify row-level security with two accounts and attempted cross-account reads and writes.
- [ ] Verify upload, merge, restore, conflicts, retries, cancellation, and tombstones with two physical devices.
- [ ] Verify account switching while synchronization is idle and active.
- [ ] Verify cloud deletion failure and success.
- [ ] Verify account deletion rejection without authentication and success with a valid session.
- [ ] Repeat the checks in the intended production project before release.

## Manual device integration review

- [ ] Notification permission allowed, denied, blocked, and unavailable states.
- [ ] Notification delivery with generic and title-enabled privacy settings.
- [ ] Reminder navigation from foreground, background, and terminated states.
- [ ] Invalid and removed notification destinations.
- [ ] Calendar permission allowed, denied, blocked, and unavailable states.
- [ ] Calendar create, update, external modification, unlink, and deletion behavior.
- [ ] Export completion, cancellation, interruption, and destination handling.
- [ ] Device, cloud, and account deletion confirmations on Android and iOS.

## Performance and reliability review

Repository lists cap pages at 100 records. Synchronization push and pull batches cap at 100 records. Conflict cleanup uses entity-filtered bounded pages. Planning remains available while remote work retries. Reconnect and foreground reconciliation are guarded against concurrent synchronization runs.

No benchmark numbers are recorded because a representative release device measurement was not performed. Portable export intentionally assembles a complete workspace snapshot and JSON document in memory; unusually large workspaces can therefore increase memory use and export time. Large collection rendering is currently protected by repository page limits, but physical-device profiling with representative data remains required before broad release.

## Store preparation

- [ ] Apple Developer and Google Play Console accounts are available.
- [ ] The application is linked to a real EAS project without committing identifiers or credentials.
- [ ] Preview and production builds are produced and installed manually.
- [ ] Icons, splash screens, notification icon, and dark-theme launch appearance are reviewed on devices.
- [ ] Store descriptions and screenshots are approved for all supported locales.
- [ ] Hosted privacy and support URLs are available.
- [ ] Store privacy, data-safety, age-rating, and export-compliance forms are completed from actual behavior.
- [ ] Fluent-human review is complete for Amharic, Spanish, French, and Arabic.
- [ ] Staged rollout and rollback ownership are assigned.
