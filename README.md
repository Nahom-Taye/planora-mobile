# Planora

Planora is a calm personal planning and productivity tracker for Android and iOS. The application connects daily focus, forward planning, long-term goals, and personal reflection through a clear mobile experience.

This repository contains the completed Phase 1–8 foundations and the Phase 9 resilient account-synchronization and data-control implementation. Payments, subscriptions, paywalls, collaboration, and premium capabilities remain outside the current scope.

## Foundation features

- Five primary destinations: Today, Planner, Goals, Insights, and Settings
- File-based navigation with Expo Router
- Strict TypeScript configuration
- System-aware light and dark themes
- Indigo, teal, and warm-neutral design tokens
- Reusable screen, card, button, text, empty-state, and section-header components
- Safe-area handling and responsive content widths for phones and larger screens
- Accessible touch targets, semantic colors, scalable typography, and navigation labels
- Original Planora wordmark and branded loading experience
- Android and iOS application identity configuration
- Typed offline domain entities and repository contracts
- Versioned SQLite migrations and parameter-bound repositories
- Recoverable local storage initialization and real Settings status
- Optional three-step onboarding with persisted completion state
- Local-only operation without an account or backend configuration
- Email-and-password account, verification, and recovery foundations
- Secure native session storage separated from the planning database
- Minimal remote profiles with protected account routes and own-row authorization
- Authentication-first cold launch with a clear local-only path
- One idempotent personal workspace for each completed local profile
- Local quick capture, task editing, priorities, due dates, and lifecycle actions
- Time-zone-aware Today grouping, progress, overdue handling, and refresh
- Daily and weekly routines with completed, skipped, corrected, and undone check-ins
- Compact Today dashboard with workload context, next-up time blocks, agenda preview, and quieter completed work
- Day and mobile-first week Planner views with local date navigation and current-time context
- Revision-safe plan-block creation, editing, rescheduling, completion, cancellation, unlinking, and soft deletion
- Task scheduling that keeps task deadlines and lifecycle independent from working-time blocks
- Configurable daily capacity, overlap explanations, and unscheduled-task counts
- Bounded daily and selected-weekday plan-block recurrence with preserved completed history
- Local goal creation, editing, lifecycle actions, search, filtering, and focused detail screens
- Ordered milestones with explicit completion, reopening, cancellation, and accessible move actions
- Milestone, linked-task, manual-percentage, and non-numeric goal progress methods
- Goal-linked tasks and many-to-many supporting routines with workspace-safe local relationships
- Compact goal context in Today, task lists, task editing, and Planner task selection
- Local Insights Summary, Trends, and Reflections destinations with remembered range and destination choices
- Equal-period comparisons for 7-day, 4-week, and 12-week ranges using the profile time zone and week start
- Transparent task, workload, routine, goal, milestone, and reflection summaries without productivity scores
- Daily, weekly, and goal reflections with optional mood labels, revision-safe editing, soft deletion, and offline history
- Deterministic local explanations with documented minimum samples and no analytics transmission
- Opt-in local reminders for tasks, plan blocks, routines, and goals with bounded reconciliation
- Generic notification content by default, optional title display, quiet hours, and safe destination validation
- Optional one-way export of eligible plan blocks to a selected writable device calendar
- Explicit recovery for revoked permissions, missing calendar events, and externally changed calendar events
- English, Amharic, Spanish, French, and Arabic interface catalogs with persisted per-profile selection
- Locale-aware dates, times, numbers, durations, pluralization, and RTL-aware presentation
- Bundled Noto Sans Latin, Arabic, and Ethiopic fonts under the SIL Open Font License
- Explicitly enabled Upload, Merge, and Restore synchronization modes that never start from sign-in alone
- Durable bounded push and pull with stable operation identifiers, server revisions, incremental cursors, retry, reconnect, and cancellation
- Account-switch isolation, preserved conflict copies, explicit conflict resolution, and retained deletion tombstones
- Versioned portable planning export with native identifier and session exclusions
- Exact-confirmation device, cloud, and authenticated account deletion controls
- Safe local-only behavior when public backend configuration or the remote synchronization schema is unavailable

## Requirements

- Node.js LTS
- npm
- Expo Go installed on an Android device or iPhone

## Setup

```bash
git clone https://github.com/Nahom-Taye/planora-mobile.git
cd planora-mobile
npm install
```

Copy `.env.example` to an ignored local environment file only when testing account features:

```bash
cp .env.example .env.local
```

Replace both placeholders with the public project URL and publishable client key from an authorized Supabase project:

```text
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a service-role key, database password, or other privileged credential in an Expo public variable. When these values are absent or invalid, account actions are unavailable on the opening screen while Continue locally remains active.

Apply `supabase/migrations/202608040001_account_profiles.sql` and then `supabase/migrations/202608140001_resilient_sync.sql` through the authorized Supabase migration workflow for the project. Deploy `supabase/functions/delete-account` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` available only in the server function environment. Add `planora://callback` to the allowed authentication redirect URLs. For Expo Go testing, also add the development callback shown by the running application environment. Repository files do not prove that either migration or the function has been deployed.

## Start the application

```bash
npm run start
```

The Expo terminal displays a QR code after the development server starts.

- On Android, open Expo Go and scan the QR code.
- On iPhone, scan the QR code with the Camera application and open it in Expo Go.
- Keep the computer and mobile device on the same network.
- If local network discovery is unavailable, run `npx expo start --tunnel`.

Platform-specific development commands are also available:

```bash
npm run android
npm run ios
npm run web
```

## Project structure

```text
app/                  Route files and navigation layouts
assets/               Local images, fonts, and bundled media
docs/                 Product direction and phased scope
src/
  components/         Reusable brand and interface components
  features/           Feature-owned screens and modules
  hooks/              Shared React hooks
  domain/             Local entities and repository contracts
  providers/          Application lifecycle providers
  storage/            SQLite lifecycle, migrations, mappers, and repositories
  theme/              Themes, semantic colors, and design tokens
  types/              Shared TypeScript types
  utils/              Shared constants and utilities
```

Routes remain thin and delegate presentation to feature modules. Shared visual rules live in the theme and component layers.

Phase 4 feature modules live under `src/features/today`, `src/features/tasks`, `src/features/routines`, and `src/features/workspace`. Phase 5 adds `src/features/planner`, `src/features/localization`, and planning preferences under `src/features/settings`. Phase 6 adds focused goal, milestone, progress, task-link, and routine-link modules under `src/features/goals` with thin routes under `app/(goals)`. Phase 7 adds local Insights and reflection modules. Phase 8 adds local reminder and calendar services under `src/features/reminders` and `src/features/calendar`. Phase 9 adds synchronization services under `src/features/sync`, `SyncProvider`, thin Privacy and Data routes under `app/(sync)`, local migration 8, the remote synchronization migration, and the authenticated account-deletion function. The five-tab shell remains unchanged.

`supabase/migrations/` contains versioned remote profile and owner-scoped planning schema. Authentication sessions do not use SQLite. SQLite remains the immediate source of truth even when synchronization is enabled.

## Verification

Run checks individually:

```bash
npm run typecheck
npm run lint
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase5
npm run test:phase6
npm run test:phase7
npm run test:phase8
npm run test:phase9
npm run validate:translations
npm run doctor
```

Run the complete project check:

```bash
npm run check
```

## Account testing

To test live account behavior, use a non-production Supabase project with email authentication enabled. Verify signup and confirmation, sign-in, restart restoration, sign-out, recovery through the allowed callback, profile editing, incorrect-password behavior, offline startup, and missing-configuration startup. Use two separate identities to confirm profile and planning policy isolation. Use two physical devices to verify explicit Upload, Merge, Restore, conflict, tombstone, reconnect, account-switch, cloud-deletion, and account-deletion behavior. Remove test accounts only when safe and authorized, and never print credentials or session values. These live checks are required and are not claimed by the automated suite.

## Product specification

The product vision and phase scope are documented in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md). Local persistence is described in [docs/OFFLINE_ARCHITECTURE.md](docs/OFFLINE_ARCHITECTURE.md), account boundaries in [docs/AUTH_ARCHITECTURE.md](docs/AUTH_ARCHITECTURE.md), daily workflows in [docs/PHASE4_ARCHITECTURE.md](docs/PHASE4_ARCHITECTURE.md), Planner behavior in [docs/PHASE5_ARCHITECTURE.md](docs/PHASE5_ARCHITECTURE.md), Goals behavior in [docs/PHASE6_ARCHITECTURE.md](docs/PHASE6_ARCHITECTURE.md), Insights and reflections in [docs/PHASE7_ARCHITECTURE.md](docs/PHASE7_ARCHITECTURE.md), reminders and calendar interoperability in [docs/PHASE8_ARCHITECTURE.md](docs/PHASE8_ARCHITECTURE.md), synchronization and data controls in [docs/PHASE9_ARCHITECTURE.md](docs/PHASE9_ARCHITECTURE.md), synchronization risks in [docs/SYNC_THREAT_MODEL.md](docs/SYNC_THREAT_MODEL.md), and language behavior in [docs/LOCALIZATION_ARCHITECTURE.md](docs/LOCALIZATION_ARCHITECTURE.md).
