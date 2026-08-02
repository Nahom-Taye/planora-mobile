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

## Planned feature list

The following list describes intended direction, not functionality included in Phase 1.

- A focused Today view for priorities, tasks, routines, and time blocks.
- A Planner for day and week organization, rescheduling, and capacity awareness.
- Tasks with status, priority, due dates, notes, recurrence, and lightweight grouping.
- Goals connected to milestones, habits, and next actions.
- Routines and habit check-ins with flexible schedules and non-punitive streaks.
- Search, filters, quick capture, and reusable planning templates.
- Insight summaries for completion patterns, workload balance, and reflections.
- Configurable reminders and notification quiet hours.
- Cross-device accounts and sync through a future backend phase.
- Data export, account deletion, privacy controls, and transparent sync status.
- Optional paid capabilities only after the core experience is stable and useful.

## Navigation map

```text
Planora
├── Today
│   ├── Daily overview
│   ├── Quick capture
│   └── Item detail (future)
├── Planner
│   ├── Day view
│   ├── Week view
│   └── Schedule editor (future)
├── Goals
│   ├── Goal list
│   ├── Goal detail
│   └── Milestones (future)
├── Insights
│   ├── Summary
│   ├── Trends
│   └── Reflections (future)
└── Settings
    ├── Appearance and accessibility
    ├── Planning preferences
    ├── Notifications (future)
    ├── Account and sync (future)
    └── Privacy and data controls (future)
```

The five primary destinations remain visible in bottom navigation. Creation and detail flows should be presented within the relevant destination, using stacks or sheets where platform conventions support them.

## Core future data entities

These are domain concepts for future design and do not define a Phase 1 database schema.

- **UserProfile:** display preferences, locale, time zone, week start, and accessibility settings.
- **Workspace:** the personal data boundary and future sync scope.
- **Task:** an actionable item with lifecycle, priority, timing, and optional project or goal relationship.
- **PlanBlock:** a scheduled interval that can reference a task, routine, or free-form intention.
- **Routine:** a recurring behavior definition with schedule and completion policy.
- **RoutineCheckIn:** a dated record of a routine outcome, skip, or note.
- **Goal:** a longer-term outcome with status, horizon, motivation, and progress method.
- **Milestone:** an ordered checkpoint belonging to a goal.
- **Area:** an optional life or responsibility category used for organization.
- **Tag:** a lightweight user-defined classification.
- **Reflection:** a dated qualitative note attached to a day, week, goal, or insight period.
- **Reminder:** a user-configured delivery rule for an eligible entity.
- **SyncRecord:** local metadata used to reconcile offline changes with the future remote source.

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
3. **Onboarding and account foundation:** Introduce optional onboarding, secure authentication, profiles, session handling, and backend authorization policies. Supabase may be evaluated and integrated here; it is not part of Phase 1.
4. **Today and task workflows:** Implement quick capture, task lifecycle, priorities, daily planning, routines, and accessible editing flows.
5. **Planner and scheduling:** Add day and week planning, plan blocks, capacity cues, recurrence rules, and resilient rescheduling.
6. **Goals and milestones:** Connect outcomes to milestones, routines, and actionable work with flexible progress models.
7. **Insights and reflection:** Deliver privacy-conscious summaries, trend explanations, workload signals, and qualitative reflections without manipulative scoring.
8. **Reminders and integrations:** Add opt-in notifications, quiet hours, deep links, calendar interoperability where appropriate, and robust permission education.
9. **Sync quality and premium capabilities:** Harden multi-device reconciliation, export and deletion, observability, restore flows, and only then introduce clearly valuable optional paid capabilities.
10. **Release hardening and launch:** Complete accessibility audits, privacy and security review, performance profiling, recovery testing, store assets, beta feedback, production monitoring, and staged Android/iOS release.

Each phase requires its own acceptance criteria and verification plan before work begins. Phase 1 intentionally excludes storage, Supabase, authentication, notifications, payments, and complete business workflows.
