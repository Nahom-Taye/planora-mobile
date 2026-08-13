# Planora Phase 5 Architecture

## Scope and boundaries

Phase 5 adds local day and week planning, plan-block workflows, workload cues, bounded recurrence, a compact Today agenda, and a five-language interface foundation. SQLite remains the immediate source of truth. Goals, milestones, insights, reflections, notifications, calendar providers, remote planning synchronization, payments, and premium capabilities are not implemented.

The existing five-tab shell remains intact. Route files only select feature screens. Planner presentation lives under `src/features/planner`, language behavior under `src/features/localization`, and profile planning preferences under `src/features/settings`. Neither route components nor Planner services contain SQL or import the account client.

## Planner data flow

The root lifecycle prepares storage, the completed local profile, and its single personal workspace before mounting planning providers. `PlannerProvider` composes repository-backed plan-block, recurrence, and preference services. It materializes the current bounded recurrence window, reads local blocks and series, derives selected-day and week summaries, and refreshes presentation after successful writes.

Forms return typed drafts to the provider. Services validate and map drafts, repositories enforce revisions and stable identifiers, and the provider refreshes from SQLite after success. A mutation lock prevents duplicate submissions. Validation leaves field content mounted, while revision or storage failures retain the last successful local view and offer refresh and retry.

## Day view

The day view exposes localized previous, next, and Today controls plus a typed compact date input. Its scrollable timeline starts at the earlier of the profile planning-day preference or the first block and continues through the evening or the last scheduled interval. Hour markers, localized wall-clock labels, positioned blocks, explicit status, overlap indicators, and the current-time line provide schedule context.

Every block opens through an ordinary button target. Creating, moving, rescheduling, completing, reopening, cancelling, unlinking, and deleting require no gesture or drag-and-drop. An unscheduled actionable-task tray opens the same block editor with the task already selected.

## Week view

Week boundaries use the active profile's `weekStartsOn` value. Seven localized summaries are presented as mobile-first rows rather than compressed desktop columns. Each row exposes its selected state, block and actionable-task counts, planned time against capacity, and text-plus-icon overload or overlap cues. Selecting a day changes the Planner to day view. Previous, next, and current-week controls use calendar-day arithmetic rather than elapsed UTC durations.

## Task and plan-block semantics

A task due date remains a deadline or intended calendar day. A plan block represents scheduled working time. Scheduling a task creates a linked block without changing its due date, notes, status, completion timestamp, or revision. Rescheduling the block changes only the block. Completing a block and completing its linked task are separate explicit actions.

Only non-deleted pending or in-progress tasks from the active workspace can be newly linked. Only non-archived routines from that workspace can be linked. Existing links remain visible if the linked record later changes state; the block can be explicitly unlinked. A block may reference a task or routine, never both.

## Plan-block lifecycle and rescheduling

Plan blocks require a trimmed title, local calendar date, start time, end time, and IANA time zone. Notes and one local relationship are optional. End time must follow start time, zero-length intervals are rejected, and local times that do not exist during a daylight-saving transition are rejected.

Planned blocks can become completed or cancelled. Completed and cancelled blocks can be reopened as planned. Editing can move a block to another calendar date and replace its local start and end times. Unlinking removes only the relationship. Soft deletion retains the row and metadata. Every mutation supplies the expected revision, so stale views cannot silently overwrite newer work.

## Capacity and overlap rules

Daily capacity is stored in local `AppSettings`, defaults to 480 minutes, and can be configured from 30 through 1,440 minutes. The summary reports total planned minutes, signed remaining capacity, over-capacity state, overlap-pair count, and actionable tasks without a non-cancelled block.

Duration is calculated from local date, local times, and the profile time zone, so daylight-saving transitions use actual elapsed minutes. Cancelled and soft-deleted blocks do not contribute. Completed blocks remain part of the day's planned workload. Overlaps are never rejected silently. Each overlapping pair is detected deterministically by start time, end time, and stable identifier. Overlapping durations are counted separately in the planned total, and the interface explains that rule.

## Recurrence model

`PlanBlockSeries` stores explicit workspace ownership, title, notes, local start date and times, time zone, daily or weekly frequency, repeat interval, selected weekdays, optional end date, optional task or routine link, status, revision, timestamps, and soft deletion. Routine schedules remain a separate domain model.

Creation materializes at most 56 calendar days beginning at the series start. Normal refresh materializes only today through 55 days ahead. The unique series-and-occurrence-date index includes deleted occurrence tombstones, preventing restart or undo paths from recreating a deliberately removed occurrence. Repository reads paginate through historical occurrences before generation.

Editing one occurrence updates only that block and marks it as an exception. Editing that occurrence and future work preserves completed historical blocks, soft deletes planned occurrences on or after the effective date, closes or retires the old series, and creates a new revisioned series from the effective date. Deleting one occurrence does not delete its series. Paused series do not materialize until explicitly resumed.

The model does not support unbounded pre-generation, monthly rules, natural-language rules, exceptions that automatically rebase after a series split, or a remote recurrence engine. Historical rows can accumulate locally over long use, while future materialization always remains bounded.

## Today refinement

Today retains Phase 4 task and routine rules while presenting a denser hierarchy: compact brand and localized date, progress and workload summary, one quick-add field, next-up block, high-priority and overdue work, remaining tasks, scheduled routines, a short agenda preview, inbox work, and a quieter collapsible completed section. Small inline empty states replace a full-screen empty card. Tasks, routines, and Planner remain directly reachable, and one restrained menu holds secondary creation actions.

## Time-zone behavior

Calendar dates and local times remain typed separately from absolute timestamps. The current day, current-time line, recurrence weekdays, week boundaries, block duration, and Today grouping use the local profile's IANA time zone. Calendar movement uses calendar arithmetic and never slices a UTC timestamp to infer a local date.

An ambiguous repeated wall time resolves consistently through the platform `Intl` time-zone rules. A nonexistent wall time is rejected. Phase 5 does not expose a separate choice between the first and second instance of an ambiguous repeated time.

## Offline and account behavior

All scheduling, recurrence, capacity, language, task, and routine records remain in SQLite and work without a network connection. Account sign-in and sign-out neither upload nor merge these records. No remote planning schema, background upload, synchronization queue consumer, or calendar-provider connection is added.

## Accessibility

Primary actions target at least 48 logical pixels where practical. Day blocks have complete screen-reader descriptions with time, title, status, and overlap wording. Week summaries expose selected, overload, overlap, task, and block state in text as well as color. Directional icons mirror for Arabic while neutral status and action icons do not. Forms remain keyboard-safe, timeline operations have full button-and-field alternatives, reading order follows logical component order, and layouts use scalable bundled sans-serif typography.

## Migration 4

Forward-only local migration 4 adds language preference, daily capacity, and last Planner view to `app_settings`; creates `plan_block_series`; adds series, occurrence-date, and exception fields to `plan_blocks`; and adds workspace, status, task-link, and occurrence-uniqueness indexes. Existing settings receive safe defaults. The migration creates no task, routine, block, recurrence, or demonstration data. Released migrations 1–3 remain unchanged.

## Testing strategy

Phase 5 tests cover validation, CRUD, revisions, soft deletion, rescheduling, task-link semantics, workspace isolation, deterministic day ordering, week starts, daylight-saving behavior, duration, overlaps, capacity, rollback, recurrence schedules, bounded and idempotent materialization, deleted-occurrence tombstones, historical preservation, one-occurrence exceptions, future-series splits, preference persistence, device-language resolution, all five catalogs, fallback, placeholders, pluralization, localized formatting, Ethiopic and Arabic Unicode, RTL direction, Today regrouping, and migration 4 constraints.

The combined project command retains every Phase 2–4 regression suite. A separate translation command validates key parity, unknown keys, placeholders, raw-key values, and UTF-8 decoding across project-owned text files.

## Phase 5 limitations

Phase 5 does not add drag-and-drop, automatic task completion from a block, task recurrence, monthly or yearly recurrence, reminders, notifications, goals, milestones, insights, reflections, provider calendars, remote planning tables, synchronization, payments, or premium behavior. Visual, physical-device, native RTL, and linguistic approval remain release activities and must not be inferred from automated export and catalog checks.
