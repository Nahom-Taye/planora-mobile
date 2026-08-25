# Planora Offline Architecture

## Scope

Phase 2 establishes Planora's local domain and persistence foundation. Phases 3 through 9 build on that boundary with planning workflows, optional accounts, reminders, calendar export, and explicitly enabled synchronization.

Local persistence is the immediate source of truth. Future capture and planning actions are expected to read and write locally first, remain available without a network connection, and survive application restarts. A future remote operation must never block a normal local action.

## Domain boundaries

The domain layer contains application concepts and repository contracts. It has no dependency on SQL, database rows, file paths, or Expo lifecycle details.

The storage layer owns SQLite connections, migrations, bound queries, row mapping, repository implementations, and typed storage failures. The provider layer exposes initialization state and repository services to the application. Routes consume screens and hooks rather than storage internals.

## Entity overview

- `UserProfile` stores locale, time-zone, week-start, display, and accessibility preferences.
- `Workspace` is the personal ownership boundary for planning data and a future synchronization scope.
- `Task` models actionable work, lifecycle, priority, optional scheduling, and optional relationships.
- `PlanBlock` represents a calendar-date interval in an explicit time zone.
- `PlanBlockSeries` defines bounded daily or selected-weekday recurrence for independently revisioned plan-block occurrences.
- `Routine` holds a daily or weekly schedule definition in an explicit time zone.
- `RoutineCheckIn` records a routine outcome for one calendar date.
- `Goal` represents a longer-term outcome with lifecycle, horizon, optional target date, explicit progress method, optional manual progress, and an optional linked next action.
- `Milestone` is an ordered, revisioned checkpoint within a goal with pending, completed, or cancelled state.
- `GoalRoutineLink` is a revisioned and soft-deletable many-to-many relationship between a goal and a supporting routine.
- `Area` groups responsibilities or parts of life.
- `Tag` provides lightweight workspace classification.
- `Reflection` stores qualitative notes for a day, week, or goal context.
- `AppSettings` stores device-facing planning, appearance, language, capacity, last-Planner-view, last-Insights-destination, last-Insights-range, reminder privacy, quiet hours, and selected-calendar choices for a profile.
- `ReminderIntent` stores portable, workspace-owned reminder intent for a supported planning entity.
- `DeviceNotificationSchedule` stores only Planora-owned native notification mappings and their reconciliation state.
- `DeviceCalendarEvent` stores only Planora-owned one-way event mappings and source fingerprints for the current device.
- `LocalChange` stores stable operation, revision, deletion, account, retry, and bounded queue metadata for synchronization.
- `SyncBinding` records explicit synchronization consent, account ownership, remote workspace identity, incremental cursors, and recoverable state.
- `SyncEntityState` stores the acknowledged server revision and cursor for one portable entity.
- `SyncConflict` preserves account-scoped local and remote payloads and revisions until explicit resolution.
- `SyncDiagnostic` stores only redacted operational categories and coarse connectivity state.

Persisted domain entities have stable identifiers, creation and update timestamps, and an integer revision. User-owned entities also have nullable deletion timestamps. Status values are closed string unions and optional persisted fields use explicit `null` values.

## Repository responsibilities

Repositories provide typed reads by identifier, deterministic lists, bounded pagination, creation, optimistic updates, and soft deletion. Entity filters expose only relevant domain criteria. SQL statements and row shapes remain inside the storage layer.

Updates compare the expected revision when supplied. A conflicting write returns a typed revision failure instead of overwriting a newer local value. Repository transactions provide one scoped set of repositories for related multi-table writes.

All values entering ordinary reads and writes use bound parameters. Table names, column names, ordering expressions, and migration statements are fixed application definitions.

## Database lifecycle

One storage lifecycle opens `planora.db`, enables foreign-key enforcement, requests write-ahead logging on supported native platforms, applies pending migrations, and then publishes a ready repository store. Repeated initialization calls share the same in-flight operation or return the ready store.

The branded launch view remains visible until required initialization completes. A genuine failure shows a recoverable screen with plain-language guidance. Retry closes only the failed connection and reopens the existing database. It does not delete, replace, reset, or seed the database.

No private user content is logged by the lifecycle, repositories, or error mapping. User-facing errors do not expose database paths, SQL statements, row values, or schema details.

## Schema migration strategy

Migrations are numbered, forward-only, and contiguous. Applied versions are stored in `schema_migrations`. Every unapplied migration runs in its own transaction and records its version in that same transaction. An interruption therefore leaves either the complete migration and tracking row or neither. Initialization resumes from the last committed version.

Migration definitions contain only fixed schema statements. Failure is surfaced without an automatic destructive reset. Later phases must append migrations and must not edit versions already released.

Migration 4 appends Planner recurrence ownership and indexes plus safe settings defaults for language, daily capacity, and Planner view. It contains no seed records and leaves released migrations 1–3 unchanged.

Migration 5 appends goal progress method, manual progress, and optional next-action fields; creates the goal-routine link table; and adds relationship and filtering indexes. Safe defaults map existing goals to milestone progress at zero. Composite foreign keys protect goal-routine workspace ownership, and the task relationship remains constrained by repository-level active-workspace validation. The migration is atomic, seed-free, forward-only, and non-destructive. Released migrations 1–4 remain unchanged.

Migration 6 appends safe `summary` and `7d` defaults for the remembered Insights destination and range, plus workspace-scoped reflection query indexes. It creates no activity-event table, backfills no behavior, adds no seed data, and leaves released migrations 1–5 unchanged. Duplicate reflection identity is enforced transactionally by the local lifecycle service rather than by an unsafe uniqueness migration over databases that may already contain duplicate foundation records.

Migration 7 appends notification-content privacy, quiet-hours, and selected-calendar settings. It creates portable reminder intent plus device-only notification and calendar mapping tables with ownership constraints, foreign keys, active uniqueness, and reconciliation indexes. It creates no reminders, schedules, calendar events, or seed records and leaves released migrations 1–6 unchanged.

Migration 8 appends workspace, base-revision, account, and retry metadata to `local_changes`; creates synchronization binding, entity-state, conflict, diagnostic, portable-type, and suppression tables; and adds guarded mutation triggers and bounded queue indexes. Triggers enqueue only for an explicitly enabled binding and do not run while a remote record is being applied. Migration 8 is forward-only, additive, seed-free, and does not enable synchronization or upload existing planning. Released migrations 1–7 remain unchanged.

## Date and time conventions

- Absolute events use UTC ISO 8601 timestamps and the `Instant` type.
- Day-based intent uses `CalendarDate` in `YYYY-MM-DD` form and does not imply UTC midnight.
- Wall-clock intent uses `LocalTime` in 24-hour `HH:mm` form.
- Scheduled intervals carry an IANA `TimeZone` so daylight-saving behavior can be resolved deliberately.
- Creation, update, deletion, completion, recording, and retry moments are absolute timestamps.

Domain constructors validate calendar dates, local times, time zones, and absolute timestamps before they cross storage boundaries.

## Identifier strategy

New entities receive UUID values from the maintained Expo cryptography module. Identifiers are generated locally before insertion, remain stable across restarts, and do not depend on network access or database row numbers. Callers may supply an identifier for deterministic imports and isolated tests.

## Transaction expectations

A single-row insert is atomic by SQLite behavior. Optimistic updates use a revision predicate. Multi-entity operations must use `RepositoryStore.transaction`, whose callback receives repositories bound to the transaction connection. Milestone reordering normalizes every affected sort position in one transaction and rolls back the entire move if any revision fails. Unlinking a selected next-action task clears the goal pointer and task relationship in the same transaction.

Reflection creation and editing validate active-workspace ownership, normalize scope identity, check duplicates, and write in one repository transaction. Reflection edits and soft deletion use optimistic revisions, so a stale form cannot overwrite a newer local body or mood value.

Native platforms use an exclusive asynchronous transaction connection. Web uses the supported asynchronous transaction API behind the same repository boundary. Application code must not start raw database transactions.

## Deletion and retention

User-owned records are soft deleted by setting `deletedAt`, incrementing the revision, and retaining the record for recovery and future deletion reconciliation. Normal reads exclude deleted rows unless explicitly requested. Goal deletion does not delete linked tasks or routines. Unlinking a task changes only its nullable goal relationship, and unlinking a routine soft-deletes only the link row, preserving routine history. Foreign keys restrict destructive parent removal, while the task-tag join uses cascading cleanup only for physical maintenance operations.

Phase 8 cancellation and calendar removal affect only recorded Planora mappings and never unrelated operating-system notifications or events. Local planning records remain soft deleted under their established lifecycle. Phase 9 portable export includes those deletion markers but excludes device mappings and sessions. Remote synchronization retains tombstones without automatic age-based cleanup. Clear Device physically removes the selected workspace's planning and synchronization rows only after exact confirmation. Cloud and authenticated account deletion are explicit server operations and never automatic consequences of sign-out.

## Synchronization boundary

SQLite remains the immediate source of truth and local writes never wait for the network. Signing in does not start transport. Upload, Merge, or Restore creates an enabled binding after an explicit user action. Only then do migration 8 triggers enqueue committed portable mutations. Missing configuration, missing remote schema, offline transport, and session expiry leave local planning functional.

Push reads at most 50 queued rows. Pull requests at most 100 server-cursor-ordered changes. Stable operation identifiers provide idempotent retry, server revisions determine conflicts, and server cursors determine incremental progress. Remote application is wrapped in queue suppression. A changed account cancels in-flight local application, account-tagged queue and conflict reads are isolated, and a mismatched binding is disabled.

Base-revision mismatch and inbound changes meeting local pending work preserve both payloads in an explicit conflict record. Silent last-write-wins is not used. Diagnostics store bounded categories rather than private task, goal, routine, plan, or reflection content.

## Error and recovery behavior

Storage failures are mapped to bounded codes for initialization, migration, read, write, missing record, revision conflict, and invalid stored data. Messages are safe for presentation or recovery decisions and do not include private values.

Initialization failures keep the application out of an ambiguous partially ready state. The recovery action retries the deterministic lifecycle against the existing database. Repeated migration application is safe because completed versions are tracked transactionally.

## Testing strategy

Focused tests cover date and time validation, row round trips, migration ordering and idempotency, interrupted migration rollback behavior, bound repository writes, deterministic list ordering, revision updates, and soft deletion. Phase 6 adds deterministic goal and milestone coverage. Phase 7 adds range, aggregation, comparison, explanation, and reflection coverage. Phase 8 adds reminder lifecycle, bounded occurrence, quiet-hours, permission, notification navigation, calendar conflict, mapping, migration 7, and five-catalog coverage. Phase 9 adds migration 8, portable boundaries, retry, conflict, remote ownership, cursor, tombstone, deletion-function, missing-configuration, and catalog coverage. Project checks cover TypeScript, lint rules, dependency compatibility, and platform bundles.

Test data is deterministic and lives only in the test process. Normal application startup creates schema metadata but no profiles, workspaces, tasks, or other fake records.

## Foundation limitations

Phase 2 supplies storage readiness and repository capabilities. Phases 3–9 use that boundary for accounts, local planning, goals, Insights, reflections, reminders, one-way calendar export, optional synchronization, portable export, and deletion controls. Unbounded background jobs, calendar import, remote push notifications, payments, subscriptions, paywalls, collaboration, and automatic database reset remain outside the current implementation.

The local database uses the platform-provided SQLite storage behavior. Phase 2 does not add application-level at-rest encryption, and the interface makes no encryption claim.
