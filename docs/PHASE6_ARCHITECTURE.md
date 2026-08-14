# Planora Phase 6 Architecture

## Scope and boundaries

Phase 6 delivers a local, mobile-first Goals and milestones experience. It includes goal creation and editing, explicit lifecycle actions, ordered milestones, four progress methods, task relationships, supporting-routine relationships, focused detail screens, and compact Today and Planner context. SQLite remains the immediate source of truth.

Insights, reflections, notifications, remote planning synchronization, calendar-provider connections, payments, subscriptions, sharing, collaboration, and Phase 7 behavior are outside this phase. Route components contain no SQL and do not import the account client.

## Module structure and data flow

Thin routes under `app/(goals)` select screens from `src/features/goals/screens`. Focused components own forms, headers, sections, choices, and accessible progress presentation. Services under `src/features/goals/services` own validation, organization, deterministic progress, goal lifecycle, milestone lifecycle and ordering, task links, routine links, and compact task context.

`GoalProvider` is mounted after the planning provider has an active workspace. It creates workspace-scoped services, reads goals, milestones, tasks, routines, routine check-ins, and relationship rows from repositories, and refreshes derived presentation after successful writes. A mutation lock prevents duplicate submissions. Validation and storage errors keep form state mounted, and recoverable read failures retain a refresh action.

## Goal lifecycle

A goal requires a trimmed title. Description, motivation, target date, and area are optional. Every goal has a month, quarter, year, or someday horizon; active, paused, completed, or abandoned status; and an explicit progress method.

Create, edit, pause, resume, complete, reopen, abandon, and soft-delete operations supply the current revision. Completion is always a user action and records `completedAt`. Reopening clears that timestamp. Pausing and abandoning also clear a stale completion timestamp. Completing all milestones only presents a gentle completion suggestion; it never changes goal state automatically. Goal lifecycle actions do not alter task status, task timing, plan blocks, routine definitions, or routine check-ins.

## Progress methods

Progress calculation is a pure, deterministic module with four modes:

- Milestone progress divides completed milestones by pending plus completed milestones. Cancelled and soft-deleted milestones are excluded. No countable milestone produces “Not started.”
- Linked-task progress divides completed linked tasks by pending, in-progress, plus completed linked tasks. Cancelled and soft-deleted tasks are excluded.
- Manual progress accepts and stores an integer from zero through one hundred. One hundred percent does not complete the goal.
- No numeric progress presents status and available context without inventing a score.

Numeric modes expose a localized percentage, completed and total counts when applicable, and a text-labelled progress bar. All modes can show status, next milestone or next action, horizon, and target-date context. Changing the selected method updates goal fields only; it never deletes milestones, task links, routine links, or history.

## Milestones and ordering

Milestones require a trimmed title and may include notes and a target date. Pending, completed, and cancelled states are explicit. Completion records `completedAt`; reopening and cancellation clear it. Editing, completion, reopening, cancellation, reordering, and soft deletion all use optimistic revisions.

Ordering is deterministic by normalized sort position and stable identifier. Move up and Move down buttons provide a screen-reader-accessible alternative to drag gestures. A move verifies active workspace and goal ownership, rejects cross-goal input, normalizes every affected row, and writes the full sequence inside one repository transaction. Any revision failure rolls back the complete reorder. Cancelled milestones remain visible and ordered but do not contribute to progress; deleted milestones are excluded from normal reads.

## Goal-task relationships

The nullable `Task.goalId` keeps one task associated with at most one goal. A goal can create a new task with its relationship set, link an existing actionable task, unlink a task, open the established task editor, and select one linked actionable task as its next action. Only non-deleted tasks from the active workspace may be linked.

Linking changes only `goalId`. Unlinking clears only `goalId` and, when relevant, the goal's next-action pointer in the same transaction. Due dates, due times, priority, notes, lifecycle state, completion timestamp, and scheduled blocks remain unchanged. Goal completion never completes tasks. Task lists, Today, task editing, and Planner selection use a compact derived goal label without duplicating repository rules or crowding their existing hierarchy.

## Supporting-routine relationships

`GoalRoutineLink` is an explicit many-to-many local entity, so one active routine may support multiple goals. Linking verifies that both records belong to the active workspace and that the routine is not archived or deleted. Unlinking soft-deletes only the relationship row. It never deletes or edits the routine and never changes prior check-ins.

Goal detail shows each linked routine and derives today's pending, completed, or skipped state from the existing routine-check-in history. Routine results never score or complete a goal, and the relationship does not introduce streaks or trend analysis.

## Workspace isolation

Every service is constructed for one active workspace and validates related records before mutation. Task, goal, milestone, routine, and link reads are workspace-scoped. Milestone operations reject another goal or workspace. Goal-task operations reject another workspace or a soft-deleted task. Composite goal-routine foreign keys and service checks reject cross-workspace relationships. Stable identifiers and revisions are preserved through ordering and linking.

## Migration 5 and offline behavior

Migration 5 is additive, atomic, forward-only, non-destructive, and seed-free. It adds `progress_method`, `manual_progress`, and `next_action_task_id` to goals; creates the revisioned and soft-deletable `goal_routine_links` table; creates composite ownership indexes required by workspace-protected foreign keys; and adds query indexes for goal grouping, next actions, task links, routine links, and milestone ordering.

Existing goals receive safe milestone-progress and zero-manual-progress defaults. Released migrations 1–4 are not edited. Normal initialization upgrades an existing database transactionally and never resets it. Every Phase 6 view and mutation operates locally after initialization and survives application restart without a network connection. No planning table or synchronization transport is added remotely.

## Localization and bidirectional layout

Every Phase 6 interface, validation, error, confirmation, and accessibility string is present in the English, Amharic, Spanish, French, and Arabic catalogs with identical keys and placeholders. Dates, counts, numbers, and percentages use the selected locale. User-created titles, descriptions, motivation, notes, task text, and routine text are never translated.

English remains the fallback. Amharic uses Ethiopic Unicode, Arabic selects RTL direction and the bundled Arabic font, and logical row behavior mirrors where appropriate. Localized list behavior retains the Hermes-safe formatter and does not require `Intl.ListFormat` or a network translation service. Automated catalog checks verify structure, placeholders, Unicode, fallback, and formatter regressions; they do not constitute professional linguistic approval.

## Accessibility

Primary and row actions use 48-by-48 logical-pixel targets where practical. Controls expose labels, roles, hints, selected or checked state, and live error updates. Progress has text and an accessibility value as well as a visual bar. Status and target attention are written in text rather than conveyed only by color.

Forms use keyboard-safe scrolling and retain content on error. Milestone ordering requires no drag-and-drop. Destructive lifecycle and deletion operations ask for confirmation. Logical component order supports LTR and RTL reading, scalable text can wrap rather than clip core controls, light and dark theme tokens remain shared, and no goal workflow depends on animation.

## Error recovery

Provider initialization exposes loading, recoverable error, and refresh states. Pull-to-refresh reloads workspace-local entities. Mutations prevent duplicate submissions and map validation, revision conflict, missing-record, and storage failures to bounded localized messages. A conflict never overwrites the newer record silently. Form content remains present after validation or write failure, and the existing database is never reset as a recovery action.

## Testing strategy

`test:phase6` covers goal validation, CRUD, lifecycle timestamps, revisions, soft deletion, filtering, ordering, horizons, target dates, milestone CRUD and states, transactional ordering and rollback, cross-goal rejection, all progress methods, progress-method preservation, task links, task semantic preservation, next action, routine links, routine-history preservation, workspace isolation, Today and Planner context, restart persistence, migration 5, mappers, all five catalogs, Ethiopic and Arabic Unicode, RTL, placeholder parity, and Hermes-safe formatters.

The combined suite retains Phase 2–5 regressions. Project verification also runs TypeScript, lint, catalog validation, Expo Doctor, Android and iOS JavaScript exports, web static rendering, route generation, and an Expo Go development-manifest startup.

## Phase 6 limitations

Phase 6 does not add insight summaries, reflections, trend analysis, streaks, scores, automated goal completion, task-status automation, notifications, provider calendars, remote planning synchronization, sharing, collaboration, payments, subscriptions, or Phase 7 routes. Drag-and-drop milestone ordering is intentionally unnecessary because accessible move actions cover the complete ordering workflow. Physical-device screen-reader, large-text, and native RTL review remain release checks and are not inferred from automated tests or exports.
