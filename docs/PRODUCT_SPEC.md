# Planora Product Specification

## Product vision

Planora is a calm, trustworthy personal planning space that helps people decide what matters, turn intentions into realistic plans, and learn from their progress without creating more pressure. It should connect daily action, weekly planning, and longer-term goals in one coherent mobile experience.

The product should feel focused and premium rather than crowded. It should reduce planning friction, respect attention, work reliably through poor connectivity, and make progress understandable without encouraging unhealthy productivity metrics.

## Target users

- Students and early-career professionals balancing deadlines, routines, and personal goals.
- Busy professionals who want a lighter alternative to complex project-management software.
- Freelancers and creators managing several areas of life from one private workspace.
- People building routines who benefit from gentle structure and visible progress.
- Privacy-conscious users who expect core planning to continue without a network connection.

Planora is not intended to replace team project-management, clinical treatment, financial planning, or enterprise workforce-monitoring systems.

## Main problems Planora solves

1. Plans, tasks, routines, and goals are often split across unrelated tools.
2. Traditional task lists provide little help choosing realistic priorities.
3. Long-term goals can become disconnected from today's actions.
4. Overly dense productivity tools add cognitive load and guilt.
5. Many mobile planners degrade or stop working when connectivity is unreliable.
6. Progress data is frequently presented without context, control, or privacy clarity.

## Product capability map

The following list distinguishes the functionality delivered through Phase 9 from later product direction.

- A focused Today view for priorities, local tasks, scheduled routines, next-up blocks, and a compact agenda preview.
- A local day and week Planner with revision-safe time blocks, rescheduling, capacity awareness, overlap explanations, and bounded recurrence.
- Tasks with status, priority, due dates, notes, daily grouping, and optional scheduling into independent working-time blocks.
- Five offline interface languages with profile persistence, locale-aware formatting, bundled script-appropriate fonts, and Arabic RTL support.
- Goals with explicit lifecycle, flexible progress, ordered milestones, supporting routines, and linked next actions.
- Routines and habit check-ins with flexible schedules. Streak presentation remains future work.
- Search, filters, quick capture, and reusable planning templates.
- Local insight summaries, equal-period trends, workload and routine context, calm explanations, and daily, weekly, and goal reflections.
- Opt-in local reminders, notification quiet hours, privacy-preserving content, and safe notification navigation.
- Optional one-way export of eligible plan blocks to a selected writable device calendar.
- Explicitly enabled account synchronization with Upload, Merge, Restore, bounded retry, account-switch isolation, transparent status, and preserved conflicts.
- Portable planning export plus device, cloud, and authenticated account deletion controls.
- Optional paid capabilities only after the core experience is stable and useful.

## Navigation map

```text
Planora
├── Today
│   ├── Daily overview
│   ├── Quick capture
│   └── Task and routine detail
├── Planner
│   ├── Day view
│   ├── Week view
│   └── Time-block and recurrence editor
├── Goals
│   ├── Goal list
│   ├── Goal detail
│   └── Milestones and supporting work
├── Insights
│   ├── Summary
│   ├── Trends
│   └── Reflections
└── Settings
    ├── Appearance and accessibility
    ├── Language and text direction
    ├── Planning preferences
    ├── Reminders, notification privacy, and quiet hours
    ├── Device calendar destination
    ├── Optional account profile and recovery
    ├── Planning synchronization
    └── Privacy and data controls
```

The five primary destinations remain visible in bottom navigation. Creation and detail flows should be presented within the relevant destination, using stacks or sheets where platform conventions support them.

## Core data entities

Phase 2 defines the local domain models and storage. Phases 4–6 expose task, routine, check-in, plan-block, recurrence-series, goal, milestone, and goal-relationship workflows while later feature entities remain foundations only.

- **UserProfile:** display preferences, locale, time zone, week start, and accessibility settings.
- **Workspace:** the personal data boundary and future sync scope.
- **Task:** an actionable item with lifecycle, priority, timing, and optional project or goal relationship.
- **PlanBlock:** a scheduled interval that can reference a task, routine, or free-form intention.
- **PlanBlockSeries:** a bounded local recurrence definition whose occurrences remain independently revisioned.
- **Routine:** a recurring behavior definition with schedule and completion policy.
- **RoutineCheckIn:** a dated record of a routine outcome, skip, or note.
- **Goal:** a longer-term outcome with status, horizon, motivation, and progress method.
- **Milestone:** an ordered checkpoint belonging to a goal.
- **Area:** an optional life or responsibility category used for organization.
- **Tag:** a lightweight user-defined classification.
- **Reflection:** a revisioned qualitative note attached to one local day, normalized local week, or workspace-owned goal.
- **LocalChange:** stable operation, local revision, deletion, account, retry, and queue state for bounded reconciliation.
- **SyncBinding:** explicit local-workspace to account-owned remote-workspace consent and cursor state.
- **SyncEntityState:** acknowledged remote revision and cursor for one portable local entity.
- **SyncConflict:** account-scoped preserved local and remote payloads awaiting an explicit choice.

Every persisted entity should use stable identifiers, creation and update timestamps, and explicit version or conflict metadata where sync requires it. Deletion behavior must be designed before remote synchronization is introduced.

## Offline-first expectations

- Core viewing, capture, editing, completion, and planning must work without connectivity after initial installation.
- The local store is the immediate source for rendering and user interaction; remote synchronization must not block routine actions.
- Changes should be durably queued, retried safely, and visibly reflected in sync status.
- Synchronization operations must be idempotent where possible and resilient to app termination.
- Conflict policy must be explicit per entity and preserve user work. Silent destructive last-write-wins behavior is unacceptable for meaningful text or plans.
- Dates are stored with the correct distinction between local calendar dates, local times, time zones, and absolute timestamps.
- Cached personal data must have documented retention and deletion behavior.
- Offline and degraded-network states need understandable, non-alarming feedback.

## Accessibility requirements

- Meet WCAG 2.2 AA contrast targets for text, controls, focus indicators, and meaningful graphics.
- Provide touch targets of at least 48 by 48 logical pixels where practical, with adequate spacing between adjacent actions.
- Support system text scaling without clipping, hidden actions, or unusable layouts.
- Expose meaningful accessibility labels, roles, states, and reading order to VoiceOver and TalkBack.
- Never rely on color alone to communicate status, priority, completion, or error state.
- Respect reduce-motion, bold-text, high-contrast, and light/dark appearance preferences where the platform exposes them.
- Keep focus predictable in navigation, forms, sheets, validation, and dynamic updates.
- Use plain language, clear recovery instructions, and accessible error summaries.
- Test core journeys with screen readers, large text, keyboard navigation where supported, and common color-vision deficiencies.

## Security and privacy principles

- Collect the minimum personal data needed for an intentional product capability.
- Keep secrets out of the client bundle and repository. Public client configuration must be clearly distinguished from privileged credentials.
- Use secure platform storage for future session material and other sensitive local values.
- Encrypt network traffic and rely on maintained platform cryptography rather than custom schemes.
- Enforce authorization at the data layer; client-side route guards or hidden controls are not security boundaries.
- Apply least privilege to backend roles, third-party services, analytics, and operational access.
- Make consent, retention, export, and deletion behavior understandable and testable.
- Avoid logging task content, reflection text, tokens, or other sensitive payloads.
- Threat-model authentication, sync, sharing, deep links, notifications, exports, and payments before release.
- Maintain dependencies, document incident response, and provide a responsible channel for security reports.

## Ten planned development phases

1. **Application foundation:** Expo and TypeScript setup, Expo Router shell, five primary tabs, design tokens, reusable UI primitives, branded loading, documentation, and automated project checks.
2. **Offline domain and storage:** Define versioned domain models, repositories, migrations, local persistence, seed-free development fixtures, and deterministic offline behavior.
3. **Onboarding and account foundation:** Optional first-run onboarding, local-only access, email-and-password authentication, secure native session storage, minimal account profiles, local account linkage, recovery deep links, and profile authorization policies. Planning content remains local and synchronization is not included.
4. **Today and task workflows:** Deliver local quick capture, revision-safe task lifecycle and priorities, due dates and local times, time-zone-aware Today grouping, daily and selected-weekday routines, check-in correction, and accessible management and editing flows.
5. **Planner and scheduling:** Add day and week planning, plan blocks, capacity cues, recurrence rules, and resilient rescheduling.
6. **Goals and milestones:** Connect outcomes to milestones, routines, and actionable work with flexible progress models.
7. **Insights and reflection:** Deliver privacy-conscious summaries, trend explanations, workload signals, and qualitative reflections without manipulative scoring.
8. **Reminders and integrations:** Add opt-in local notifications, quiet hours, validated navigation, one-way device-calendar interoperability, and robust permission education.
9. **Sync quality and data controls:** Add opt-in multi-device reconciliation, export and deletion, redacted diagnostics, restore flows, conflict preservation, and account-switch isolation. Paid capabilities remain deferred.
10. **Release hardening and launch:** Complete accessibility audits, privacy and security review, performance profiling, recovery testing, store assets, beta feedback, production monitoring, and staged Android/iOS release.

Each phase requires its own acceptance criteria and verification plan before work begins. Phase 9 keeps SQLite as the immediate source of truth and requires explicit activation before planning data leaves the device. Local-only planning remains supported. Remote calendar import, remote push notifications, payments, subscriptions, paywalls, collaboration, and premium capabilities remain excluded.
