# Planora Phase 7 Architecture

## Scope and boundaries

Phase 7 replaces the Insights placeholder with local Summary, Trends, and Reflections destinations. It adds transparent task, plan-block, routine, goal, milestone, and reflection summaries; deterministic comparisons; calm rule-based explanations; and revision-safe daily, weekly, and goal reflections. SQLite remains the source of truth, and all calculations remain on the device.

Phase 7 adds no notifications, reminders, calendar-provider connection, analytics service, telemetry, remote planning synchronization, payment, subscription, sharing, collaboration, productivity score, leaderboard, punitive streak, diagnosis, prediction, or Phase 8 behavior. Thin route files contain no SQL and do not import the account client.

## Module structure and data flow

`InsightsProvider` sits after workspace, localization, goal, and planner providers. It obtains the active profile, workspace, settings, and repository store; loads workspace-scoped records; derives a fresh snapshot; exposes distinct loading, ready, partial, and recoverable-error states; and refreshes after reflection changes or screen focus. Derived metrics are not persisted or cached across source mutations.

Services under `src/features/insights/services` separate range calculations, paginated local aggregation, metric types, task summaries, workload signals, routine summaries, goal context, comparisons, explanation rules, reflection validation, reflection identity, and reflection lifecycle. Screen and chart components consume calculated values and localized text. Routes under `app/(insights)` only select the reflection editor screen.

The aggregation service reads every page at a fixed page size until `nextOffset` is null. Tasks, plan blocks, routines, routine check-ins, goals, milestones, and reflections are loaded independently, filtered by active workspace, and ordered deterministically by their repositories. Normal repository reads exclude soft-deleted records. Missing optional relationships yield absent context rather than a failed aggregate.

## Ranges and calendar rules

Supported ranges are the last 7, 28, or 84 local calendar days, ending on the profile's current local date. The previous period ends one calendar day before the current start and contains exactly the same number of calendar days. The interface states that the current period includes today and may change while the previous equal-length period is complete.

Absolute completion timestamps are converted through the profile IANA time zone before period comparison. Calendar dates remain calendar dates, and local dates are never produced by slicing UTC timestamp strings. Weekly reflections normalize to the profile's `weekStartsOn`. Weekday workload order starts with that same profile preference. Plan-block duration continues to use the Phase 5 date, local-time, IANA-time-zone, and daylight-saving calculation.

## Metric definitions

Tasks completed are non-deleted tasks currently marked completed whose `completedAt` local date falls in the selected period. Actionable remaining is the current count of non-deleted pending and in-progress tasks. The task completion ratio is:

```text
completed task events in period
──────────────────────────────────────────────────────────────────────
completed task events in period + current actionable tasks due in period
```

The numerator and denominator are displayed directly. A zero denominator appears as `0/0`; no percentage or historical state is invented. Overdue, pending, in-progress, active-goal-linked, completion-by-day, and completion-by-priority values are factual counts from the same records. Current task state is labelled as current state, not as an event that was historically recorded.

Planned time is the sum of every non-cancelled, non-deleted block duration in the selected period. Completed plan-block time includes only blocks explicitly marked completed. Overlapping durations remain counted separately in planned time, and overlap count is the number of overlapping block pairs per local day. Capacity usage compares each day's planned minutes with the existing configured daily capacity; a day is over capacity only when planned minutes are greater than capacity. Unscheduled actionable tasks are current pending or in-progress tasks that have no non-cancelled, non-deleted plan block. Weekday distribution sums the selected period's planned minutes by profile-ordered weekday.

Routine scheduled opportunities apply each current, non-deleted active routine schedule to every date in both periods. Completed and skipped counts require explicit non-deleted check-ins on scheduled dates. Pending is a scheduled opportunity without a completed or skipped check-in. The explicit completion ratio is completed divided by scheduled opportunities and is shown as a numerator and denominator. A legacy `missed` foundation value remains open in this Phase 7 presentation rather than being turned into a failure label. Historical routine schedule versions are not inferred.

Goal context counts current non-deleted active goals, milestone and linked-task completion timestamps inside the period, target dates within the forward length of the selected range, active goals without a current actionable next action, and goal reflections whose period starts inside the range. Each goal's displayed progress calls the Phase 6 progress service and preserves milestone, linked-task, manual, or non-numeric semantics.

Reflection count includes non-deleted daily, weekly, and goal reflections whose `periodStart` falls in the range. It is not an edit-event count and does not infer activity from body content or mood.

## Trend comparisons and explanations

Every trend exposes exact current and previous values plus the absolute difference. A percentage difference is shown only when the previous value is greater than zero. A trend requires at least two recorded observations across the two periods; otherwise its direction is `insufficient`. Eligible results are more, similar, or less. The system makes no causal, personal, or statistical-significance claim.

The explanation engine is pure and rule-based. Rules run in stable order: over-capacity days, overlapping block pairs, high-priority actionable tasks, then the routine check-in comparison. At most four statements are returned. If no eligible fact exists, the engine explains that recorded activity is insufficient. It does not read reflection bodies, task titles, notes, email addresses, or profile content.

## Reflection scopes and lifecycle

A daily reflection uses one validated local calendar date. A weekly reflection is normalized to the profile week start. A goal reflection requires a non-deleted goal in the active workspace. Day and week scopes cannot carry a scope identifier. The deterministic identity is scope, nullable scope identifier, and normalized period start.

Creation and editing validate active-workspace ownership, validate and normalize the identity, detect an existing identity across every repository page, and write inside one repository transaction. Existing foundation duplicates are organized deterministically by newest period and update time, then stable identifier. Editing and soft deletion require the current revision; conflicts do not overwrite newer text. History excludes soft-deleted rows and survives service recreation and application restart.

The body is required after trimming leading and trailing whitespace and is limited to 8,000 characters. Internal whitespace and all other user-authored content remain unchanged and are never translated. Localized reflection questions are optional presentation only and are never copied into stored text.

Mood is optional and limited to Low, Steady, Good, or Great. Users may change or remove it. The label is always written in text, is never inferred, and is not converted into a mental-health, wellbeing, or productivity score. Phase 7 does not aggregate mood because a useful minimum-data rule has not been established.

## Migration 6

Migration 6 is forward-only, transaction-ready, additive, seed-free, and safe for existing databases. It adds `insights_view` with a `summary` default and `insights_range` with a `7d` default to `app_settings`. It adds partial indexes for workspace, scope, scope identifier, period start, update time, and stable identifier on existing reflections.

No activity-event table is added, so the application does not fabricate or backfill past behavior. A database uniqueness constraint is intentionally not introduced over existing reflection rows because unknown foundation duplicates could make an upgrade destructive or fail migration. Transactional lifecycle validation prevents new duplicates, and deterministic organization safely presents any pre-existing duplicates. Released migrations 1–5 remain byte-for-byte unchanged.

## Offline, privacy, and security

All source reads, calculations, selections, and reflection mutations are local. Phase 7 adds no SDK, tracking identifier, advertising hook, remote request, sync queue use, or behavioral transmission. Reflection bodies and planning content are not logged. The account client is absent from Insights routes and services. No privileged credential is introduced, and SQLite content is not described as encrypted.

If an aggregate refresh fails after a successful load, the provider retains the last in-memory snapshot and labels it partial. An initial failure offers a calm retry. Reflection validation retains the form, duplicate and ownership failures are bounded, revision conflicts ask for refresh, and no recovery path resets the database.

## Localization and accessibility

Every Phase 7 title, metric, basis, range, comparison, explanation, reflection question, mood label, empty state, error, confirmation, accessibility label, and hint exists in English, Amharic, Spanish, French, and Arabic with matching structure and placeholders. English remains the fallback. Dates, numbers, percentages, counts, and durations use local formatters; Amharic uses Ethiopic Unicode; Arabic uses RTL layout and its bundled font; and list formatting remains Hermes-safe. User-authored content is never translated. Automated validation does not claim professional linguistic approval.

The destination and range selectors expose labelled selected states and 48-pixel minimum targets. Every metric contains its exact value and calculation basis. Compact bars include a text equivalent and exact value, use theme contrast in light and dark modes, allow wrapping, and do not carry color-only meaning. Forms use the established keyboard-safe screen container, keep a predictable reading order, support text scaling, and confirm reflection deletion. Phase 7 does not depend on motion.

## Testing and verification

`test:phase7` covers exact range and previous-period boundaries, profile week starts, time-zone boundaries, daylight-saving durations, pagination, workspace isolation, deletion exclusion, task and priority counts, completion ratios, workload totals, capacity and overlap signals, block completion, routine opportunities and outcomes, Phase 6 goal progress context, trend thresholds and zero denominators, stable explanation ordering, reflection validation, daily and weekly lifecycle, goal ownership, duplicates, revision conflicts, soft deletion, optional mood, restart persistence, migration 6, mapper coverage, five catalog structures, Ethiopic Unicode, Arabic RTL, placeholder consistency, and Hermes-safe formatting.

The combined suite retains Phase 2–6 regressions. Full verification also runs dependency installation, TypeScript, lint, translation validation, Expo Doctor, Android export, iOS JavaScript export, web static rendering, Expo Router route generation, and Expo Go development-manifest startup.

## Phase 7 limitations

Phase 7 has no activity-event history. It therefore does not claim rescheduling, carry-over, delay, past task state, past routine schedule changes, or reflection edit activity that existing timestamps cannot prove. Current routine schedules are applied consistently to both comparison periods, and this limitation is visible in the interface. Derived data is recalculated from repositories rather than cached persistently.

No mood trend, coaching, diagnosis, prediction, score, streak, notification, calendar integration, remote analytics, sync, export, sharing, collaboration, payment, subscription, or Phase 8 feature is included. Physical-device screen-reader, native RTL, large-text, and visual review remain release checks and are not inferred from automated tests or exports.
