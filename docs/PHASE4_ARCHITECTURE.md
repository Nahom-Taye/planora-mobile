# Planora Phase 4 Architecture

## Scope

Phase 4 delivers local Today, task, and routine workflows. SQLite remains the immediate source of truth. Phase 5 subsequently refines the Today presentation and adds local Planner context without changing Phase 4 task and routine lifecycle rules. Goal workflows, insights, notifications, remote planning synchronization, payments, and premium capabilities remain outside this phase.

## Startup and account-entry decisions

Storage and onboarding preferences initialize behind the branded launch view. Secure account restoration completes before route selection, so a valid saved session grants application access without an account-entry flash. A signed-out cold launch opens sign-in with create-account, recovery, and Continue locally actions.

Continue locally is held only for the current application process. It survives background transitions but not a cold restart. After local or account access is granted, incomplete onboarding opens first; otherwise the five main tabs open. Sign-out clears session material and returns to account entry without changing SQLite planning records.

Missing or invalid public account configuration disables network account actions. It never disables Continue locally. Recovery callbacks remain in their separate public route group.

## Local workspace lifecycle

After onboarding completion, independently of account or local-entry choice, `WorkspaceService` reads every completed local profile inside one existing repository transaction. For each profile it deterministically chooses the oldest active personal workspace. If none is active, it reactivates the oldest existing workspace or creates a new personal workspace. Any additional active workspace is archived in the same transaction. The current settings profile is returned to the provider.

The operation is idempotent for existing and new installations. It creates no sample tasks, routines, or other production records. Released migrations 1 through 3 remain unchanged because their schema already supports Phase 4.

## Task state transitions

Quick capture creates a trimmed pending task due on the profile's current local calendar date. Expanded creation and editing support notes, priority, pending, in-progress, completed, or cancelled state, optional due date, and optional local time. A time requires a date.

Completion stores an absolute completion timestamp. Reopening returns to pending and clears that timestamp. Cancellation clears completion state. Deletion is confirmed in the interface and uses the existing soft-delete metadata. Every update supplies the entity revision, so a stale form cannot silently overwrite a newer local value.

Today links to a local all-task view so upcoming tasks and inactive task states remain reachable without adding Planner scheduling. The management view groups overdue, today, upcoming, unscheduled, completed, and cancelled records and opens the same revision-safe editor.

## Today grouping and ordering

Pending and in-progress tasks with a due date before today are overdue. Tasks matching today are in Today. Tasks without a due date are in Unscheduled. Completed and cancelled records appear in a quieter section when their due date or local change moment belongs to today. Completed and cancelled tasks never appear overdue.

Actionable tasks sort by in-progress before pending, high through no priority, scheduled time before untimed work, creation timestamp, and stable identifier. Routine ordering uses scheduled time, creation timestamp, and stable identifier. These rules require no inaccessible drag-and-drop interaction.

Progress counts completed tasks and completed routine check-ins against today's actionable and completed tasks plus scheduled routines. Cancelled tasks remain visible but do not increase the completion count or denominator.

The Phase 5 presentation keeps these grouping rules while replacing the original large cards with compact sections. It presents one quick-capture field, a next-up block when available, priority and overdue work before remaining tasks, scheduled routines, a short agenda preview, and a collapsible completed section. All-task, routine, and Planner destinations remain reachable through restrained section actions and one secondary creation menu.

## Routine schedule evaluation

Routines use the existing daily or selected-weekday schedule. Only active routines applicable to the profile's current calendar date appear on Today. Paused and archived routines remain locally retained and editable but do not appear in the daily list.

A routine has at most one non-deleted check-in per routine and calendar date. The released partial unique index enforces this invariant. Completing or skipping updates an existing check-in when present. Undo soft deletes today's check-in, allowing a later corrected check-in without rewriting history. Today can also correct completed to skipped or skipped to completed directly. History remains local.

A local routine management view keeps active, paused, and archived routines reachable and editable. It does not add reminders, streaks, scores, or recurrence features beyond the existing daily and selected-weekday schedule.

## Time-zone behavior

Current day calculations use `Intl.DateTimeFormat` with the local profile's IANA time zone. Calendar-day intent remains a `CalendarDate`, wall-clock intent remains a `LocalTime`, and creation, completion, update, and check-in moments remain absolute timestamps. Phase 4 does not derive local dates by slicing UTC timestamps.

## Offline behavior

Task and routine reads and writes use repository services backed by SQLite. They require no account or connection and survive application restarts. Account operations do not upload, merge, replace, or synchronize planning content. Network or account failure cannot reset the workspace or planning database.

## Accessibility decisions

The Today screen exposes semantic headings, explicit completion and skip wording, checkbox state, live error feedback, and a labeled refresh action. Task priority and state use text in addition to color. Primary controls target at least 48 logical pixels. Forms use persistent labels, keyboard-aware scrolling, dynamic system text, plain validation, and light and dark semantic colors.

## Error recovery

Initialization failures retain the established storage recovery screen. Workspace initialization has a retryable non-destructive state. Today loading and refresh failures use plain language and retain the last successful in-memory plan when available. Failed mutations do not clear forms or local records. Revision conflicts ask the user to refresh and try again.

## Testing strategy

Deterministic Phase 4 tests cover workspace repair and idempotency, quick capture, validation, edits, lifecycle changes, optimistic conflicts, grouping, ordering, time-zone boundaries, routine schedules, unique check-ins, correction and undo, service recreation, workspace isolation, account-first opening, saved sessions, Continue locally, sign-out route access, and missing account configuration. Phase 2 and Phase 3 regression suites remain part of the combined command.

Platform verification covers TypeScript, lint, tests, dependency compatibility, Expo Router generation and static rendering, and Android, iOS JavaScript, and web exports.

## Phase 4 limitations

Phase 4 itself does not include task recurrence, drag-and-drop ordering, reminders, notifications, routine streaks, routine scoring, goals, insights, reflections, planning synchronization, remote planning tables, multi-device restoration, payments, or premium features. Phase 5 plan blocks and recurrence remain separate from routine schedules and do not change the Phase 4 task model. Local SQLite content is not described as encrypted.
