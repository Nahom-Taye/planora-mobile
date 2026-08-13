# Planora Offline Architecture

## Scope

Phase 2 establishes Planora's local domain and persistence foundation. It does not add complete planning workflows, accounts, remote services, notifications, or background synchronization.

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
- `Goal` represents a longer-term outcome and optional target date.
- `Milestone` is an ordered checkpoint within a goal.
- `Area` groups responsibilities or parts of life.
- `Tag` provides lightweight workspace classification.
- `Reflection` stores qualitative notes for a day, week, or goal context.
- `AppSettings` stores device-facing planning, appearance, language, capacity, and last-Planner-view choices for a profile.
- `LocalChange` reserves revision and operation metadata for future reconciliation without implementing transport.

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

A single-row insert is atomic by SQLite behavior. Optimistic updates use a revision predicate. Multi-entity operations must use `RepositoryStore.transaction`, whose callback receives repositories bound to the transaction connection.

Native platforms use an exclusive asynchronous transaction connection. Web uses the supported asynchronous transaction API behind the same repository boundary. Application code must not start raw database transactions.

## Deletion and retention

User-owned records are soft deleted by setting `deletedAt`, incrementing the revision, and retaining the record for recovery and future deletion reconciliation. Normal reads exclude deleted rows unless explicitly requested. Foreign keys restrict destructive parent removal, while the task-tag join uses cascading cleanup only for physical maintenance operations.

Phase 2 does not implement purge schedules, export, restoration controls, or remote deletion. Those policies must be defined before any remote service is connected. Local records remain on the device until a future user-facing retention or removal workflow is implemented, or the operating system removes application data.

## Future synchronization boundary

`LocalChange` can describe an entity revision, upsert or deletion operation, queue state, retry count, and non-private error code. It stores no remote credentials and starts no transport. Phase 2 repositories do not automatically enqueue or send changes because conflict policy and remote contracts are intentionally outside this phase.

Future synchronization must read committed local changes, remain idempotent, preserve deletion markers, retain meaningful conflicting user work, and never delay local writes. Private task, goal, routine, or reflection content must not be written to logs.

## Error and recovery behavior

Storage failures are mapped to bounded codes for initialization, migration, read, write, missing record, revision conflict, and invalid stored data. Messages are safe for presentation or recovery decisions and do not include private values.

Initialization failures keep the application out of an ambiguous partially ready state. The recovery action retries the deterministic lifecycle against the existing database. Repeated migration application is safe because completed versions are tracked transactionally.

## Testing strategy

Focused tests cover date and time validation, row round trips, migration ordering and idempotency, interrupted migration rollback behavior, bound repository writes, deterministic list ordering, revision updates, and soft deletion. Project checks cover TypeScript, lint rules, dependency compatibility, and platform bundles.

Test data is deterministic and lives only in the test process. Normal application startup creates schema metadata but no profiles, workspaces, tasks, or other fake records.

## Foundation limitations

Phase 2 supplies storage readiness and repository capabilities. Phases 3–5 use that boundary for accounts, local task and routine workflows, Planner scheduling, recurrence, and settings without adding planning synchronization. Goal, reflection, remote synchronization, background jobs, reminders, payments, imports, exports, database reset controls, and user-facing purge controls remain outside the current implementation.

The local database uses the platform-provided SQLite storage behavior. Phase 2 does not add application-level at-rest encryption, and the interface makes no encryption claim.
