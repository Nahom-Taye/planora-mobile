# Planora Authentication Architecture

## Authentication boundaries

Phase 3 adds an optional account boundary without changing the offline planning boundary. Route components use provider hooks and feature services. They do not import the Supabase client. The account gateway owns provider calls, the account provider owns application session state, and SQLite repositories own local profile linkage.

The remote boundary contains authentication and a minimal account profile only. Tasks, plan blocks, routines, check-ins, goals, milestones, areas, tags, reflections, workspaces, settings, and local change records are not sent remotely.

## Local-only mode

Onboarding may be completed or skipped. Both choices create or update local settings and open the main tabs. Account configuration, connectivity, sign-in, and email verification never gate Today, Planner, Goals, Insights, or Settings.

When public account configuration is missing or invalid, startup resolves to local-only mode. Account actions explain that they are unavailable while local storage remains ready.

## Session lifecycle

One configured client restores its persisted session during application startup and subscribes to authentication state changes. A valid persisted session may restore without a network request. Expired, revoked, corrupt, or unreadable state resolves safely to a signed-out experience without changing the planning database.

Automatic refresh starts only while the application is active and stops when it becomes inactive. Subscriptions and refresh behavior are cleaned up with the provider lifecycle. Duplicate form submissions are rejected while an account operation is active.

## Secure-storage strategy

Android and iOS store authentication session material with Expo SecureStore, separately from SQLite. Values are split into bounded chunks to respect practical platform value limits. The adapter rejects oversized values, clears incomplete or corrupt values, and never logs session content.

Web uses bounded browser local storage because SecureStore protection is unavailable there. Browser scripts running in the same origin can access that storage, so web session persistence does not provide protection equivalent to Android keystore or iOS keychain storage. Passwords are never persisted by Planora on any platform.

## Environment configuration

The client accepts only these public Expo variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The URL must use HTTPS and the Supabase project hostname. Placeholder, missing, or malformed values produce local-only mode. A service-role key, database password, signing key, or other privileged value must never be placed in the mobile application.

## Route protection

Expo Router route groups separate onboarding, public account screens, main tabs, protected account screens, and recovery callbacks. Protected routes use runtime session state for navigation control. The main tabs depend only on onboarding completion. Account profile routes require an active account session.

Client route protection is not authorization. The database policies remain responsible for every remote profile operation.

## Profile schema

The remote `public.profiles` table contains the authenticated user identifier, display name, locale, time zone, creation timestamp, and update timestamp. A signup trigger creates the minimum profile. Update triggers maintain the timestamp and reject ownership changes.

No remote planning-content table or synchronization table is included in Phase 3.

## Row Level Security policies

Row Level Security is enabled and forced for profiles. Public and anonymous access is revoked. The authenticated role receives only select, insert, update, and delete privileges on the profile table. Each operation is constrained to the row whose owner matches the authenticated user. Update checks prevent changing ownership.

The migration is `supabase/migrations/202608040001_account_profiles.sql`. Apply it through an authorized Supabase migration workflow. Policy isolation should be tested with two separate test identities before production use.

## Local account linkage

SQLite migration 3 adds `account_links`. A link associates the stable local profile and optional local workspace with the remote account identifier. It contains link status and timestamps but no email, password, or session material.

Sign-in creates or refreshes the link. Sign-out marks the link as unlinked. Neither operation deletes local data, replaces local identifiers, uploads planning content, merges records, or starts synchronization.

## Deep-link and recovery behavior

The application scheme is `planora`. The production recovery callback is `planora://callback`. Expo Go development uses the callback produced by Expo Linking for the active development URL.

The callback handler accepts a one-time authorization code, verification token hash, recovery token hash, or provider recovery session. Private callback values are consumed in memory and are not written to route parameters, logs, or SQLite. Valid email verification returns to the main application, while valid recovery state opens the password-reset screen. Invalid or expired links lead to a recoverable request-new-link path.

The Supabase project URL configuration must allow the production callback and the development callback used during testing.

## Offline behavior

SQLite remains the immediate source of truth. Local-only startup does not contact the account provider. A previously persisted valid session can restore offline, while profile refresh may wait for connectivity. Network-required account operations return calm, retryable messages. Authentication failures never reset or mutate the planning database.

## Sign-out behavior

Sign-out clears local authentication session material, removes the active account state, and marks the local account link as unlinked. Local profiles, workspaces, and planning records remain on the device. Phase 3 does not implement remote planning-data deletion because it does not upload planning data.

## Privacy limitations

Native secure storage protects session material using platform facilities, but it does not encrypt the Planora SQLite planning database. Web session persistence is accessible to same-origin browser scripts. Phase 3 does not provide remote planning synchronization, multi-device restore, account export, or complete account deletion workflows.

## Testing strategy

Automated tests use mocked boundaries and deterministic values for onboarding completion, configuration validation, authentication state transitions, restoration, corrupt storage recovery, cleanup, error mapping, local-only startup, account linkage, route decisions, profile mapping, callback parsing, migration order, and network-error handling.

A configured test project is required to verify signup, email confirmation, sign-in, restart restoration, sign-out, password recovery, profile updates, incorrect-password behavior, and two-account policy isolation. Test accounts should be removed afterward only when deletion is safe and authorized.

## Phase 3 limitations

Phase 3 provides optional onboarding, email-and-password account foundations, recovery, minimal profiles, route protection, and authorization policies. It does not implement social sign-in, phone sign-in, biometrics, anonymous provider accounts, planning-data synchronization, tasks, planning workflows, goals, insights, notifications, payments, export, or full account deletion.
