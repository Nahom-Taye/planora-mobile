# Planora

Planora is a calm personal planning and productivity tracker for Android and iOS. The application connects daily focus, forward planning, long-term goals, and personal reflection through a clear mobile experience.

This repository contains the Phase 1 application foundation, Phase 2 offline domain and local storage foundation, and Phase 3 optional onboarding and account foundation. Planning-data synchronization, notifications, payments, and complete planning workflows remain outside the current scope.

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

Never place a service-role key, database password, or other privileged credential in an Expo public variable. When these values are absent, Planora starts normally in local-only mode.

Apply `supabase/migrations/202608040001_account_profiles.sql` through the authorized Supabase migration workflow for the project. Add `planora://callback` to the allowed authentication redirect URLs. For Expo Go testing, also add the development callback shown by the running application environment.

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

`supabase/migrations/` contains versioned remote profile and authorization schema. Authentication sessions do not use SQLite.

## Verification

Run checks individually:

```bash
npm run typecheck
npm run lint
npm run test:phase2
npm run test:phase3
npm run doctor
```

Run the complete project check:

```bash
npm run check
```

## Account testing

To test live account behavior, use a non-production Supabase project with email authentication enabled. Verify signup and confirmation, sign-in, restart restoration, sign-out, recovery through the allowed callback, profile editing, incorrect-password behavior, offline startup, and missing-configuration startup. Use two separate test identities to confirm neither can select, insert, update, or delete the other profile. Remove test accounts only when safe and authorized, and never print credentials or session values.

## Product specification

The product vision and phase scope are documented in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md). Local persistence is described in [docs/OFFLINE_ARCHITECTURE.md](docs/OFFLINE_ARCHITECTURE.md), and optional account boundaries are described in [docs/AUTH_ARCHITECTURE.md](docs/AUTH_ARCHITECTURE.md).
