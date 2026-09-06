# Planora Authentication Architecture

## Authentication boundaries

Phase 3 adds an optional account boundary without changing the offline planning boundary. Phase 4 changes the signed-out cold-launch presentation, and Phase 5 localizes account entry and recovery. Phase 9 adds a separate, explicitly enabled planning-synchronization boundary. Route components use provider hooks and feature services. They do not import the Supabase client or SQL. The account gateway owns authentication calls, the synchronization gateway owns remote planning procedures, the account provider owns application session state, and SQLite repositories own local linkage and planning.

The authentication boundary contains a minimal account profile. When and only when the user explicitly enables synchronization, the planning boundary may send the active workspace, tasks, plan blocks, routines, check-ins, goals, milestones, areas, tags, reflections, portable settings, and reminder intent. Sessions, email addresses, local account links, device notification schedules, calendar mappings, native identifiers, diagnostics, and conflict metadata are never portable planning payloads.

## Local-only mode

After branded initialization, a valid saved session opens the appropriate onboarding or main route. A signed-out cold launch opens the account-entry form. Continue locally grants access for the current application process and opens onboarding when incomplete or the main tabs when complete. The choice is intentionally not persisted, so a later signed-out cold launch offers account entry again. Backgrounding does not reset the in-memory local choice.

Account configuration, connectivity, sign-in, email verification, and synchronization availability never prevent the user from choosing local access. When public account configuration is missing or invalid, account and synchronization actions explain that they are unavailable while Continue locally remains active. Signing in alone never uploads local planning.

Account headings, fields, validation, confirmation dialogs, recovery instructions, and accessibility labels resolve through the active local profile language. Authored provider errors map to local catalog entries without logging addresses, passwords, callback material, or session values. Changing the interface language does not modify the remote profile locale or send a language preference to the account provider.

## Session lifecycle

One immutable client factory serves the account and synchronization gateways. One application subscription dispatches state outside the authentication lock. Supabase also owns its internal token-change subscription. Repository initialization does not recreate the application subscription. Concurrent restoration and profile session lookups share one promise.

Startup stops waiting for accounts after 1.5 seconds and offers Sign in, Create account, and Continue locally. A separate readiness request never gates local navigation. Late restoration may recover account access. Network failures retain persisted sessions; rejected expired refresh tokens clear authentication material without touching planning records. Unavailable secure storage is distinguished from corrupt stored data.

Supabase 2.112 uses a zero-millisecond lock attempt in its automatic-refresh tick. The application disables that timer and schedules session checks only in the foreground with connectivity. The schedule shares restoration, stops after two consecutive failures, and resumes on foreground, reconnection, or explicit retry. A successful signed-out result stops the schedule. Account operations pause scheduled refresh. The normal process-lock timeout is 45 seconds: longer than the SDK refresh retry window of 30 seconds plus bounded network overhead. No zero-timeout tick is invoked.

Connectivity checks and requests each have a six-second deadline. Request bodies are consumed before the deadline ends. A failed network request opens a ten-second cooldown; refresh requests allow one actual network attempt per 35-second failure window, preventing SDK backoff from producing a request storm. Account actions have a 45-second UI deadline and a single-flight guard that stays held until underlying work settles. Subscriptions, timers, and AppState/network listeners are cleaned up.

## Secure-storage strategy

Android and iOS store authentication material with Expo SecureStore, separately from SQLite. Per-key serialization prevents concurrent readers from observing writes. An inactive slot receives chunks before an atomic manifest switch; interrupted writes leave the prior committed slot readable. Each chunk contains at most 450 Unicode code points, within the native byte limit even for non-ASCII profile metadata, without splitting surrogate pairs. At most 64 chunks are accepted. The legacy numbered manifest remains readable and migrates on the next successful write. There are no persisted locks. Corrupt session objects are rejected; transient read failures do not delete stored credentials.

Web uses bounded browser local storage because SecureStore protection is unavailable there. Browser scripts running in the same origin can access that storage, so web session persistence does not provide protection equivalent to Android keystore or iOS keychain storage. Passwords are never persisted by Planora on any platform.

## Environment configuration

The client accepts only these public Expo variables:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The URL must use HTTPS and the Supabase project hostname. Placeholder, missing, or malformed values produce local-only mode. A service-role key, database password, signing key, or other privileged value must never be placed in the mobile application.

## Route protection

Expo Router route groups separate onboarding, public account screens, main tabs, task editors, routine editors, protected account screens, and recovery callbacks. Protected routes use runtime session and local-entry state for navigation control. Main and editor routes require onboarding completion plus a valid session or the current-process Continue locally choice. Account profile routes require an active account session.

Client route protection is not authorization. The database policies remain responsible for every remote profile operation.

## Profile schema

The remote `public.profiles` table contains the authenticated user identifier, display name, locale, time zone, creation timestamp, and update timestamp. A signup trigger creates the minimum profile. Update triggers maintain the timestamp and reject ownership changes.

The Phase 3 profile migration contains no planning tables. Phase 9 adds a separate owner-scoped remote planning migration with forced Row Level Security, an operation ledger, an incremental change journal, and authenticated procedures. The two migrations remain ordered and independently deployable.

## Row Level Security policies

Row Level Security is enabled and forced for profiles. Public and anonymous access is revoked. The authenticated role receives only select, insert, update, and delete privileges on the profile table. Each operation is constrained to the row whose owner matches the authenticated user. Update checks prevent changing ownership.

The migration is `supabase/migrations/202608040001_account_profiles.sql`. Apply it through an authorized Supabase migration workflow. Policy isolation should be tested with two separate test identities before production use.

## Local account linkage

SQLite migration 3 adds `account_links`. A link associates the stable local profile and optional local workspace with the remote account identifier. It contains link status and timestamps but no email, password, or session material.

Sign-in creates or refreshes the link. Sign-out marks the link as unlinked. Neither operation deletes local data, replaces local identifiers, uploads planning content, merges records, or starts synchronization. An already enabled binding stops when its account no longer matches. A new account must make a fresh Upload, Merge, or Restore choice.

## Deep-link and recovery behavior

Email signup and recovery submit S256 challenges through the public Supabase Auth REST endpoints. Expo Crypto 15.0.9 supplies asynchronous native random bytes and SHA-256; no global cryptography patch or additional polyfill is used. The verifier follows the installed SDK storage contract, including the recovery suffix, so its public code-exchange method completes callbacks. Transient exchange failures restore the verifier for explicit retry. The SDK client does not generate challenges for password sign-in or password-only updates. Its default flow setting is not used to initiate implicit email links: both email-link operations supply S256 explicitly. Email resend shares a 60-second in-process cooldown; server limits may be longer.

This implementation follows the [Expo SDK 54 crypto API](https://docs.expo.dev/versions/v54.0.0/sdk/crypto/), [Supabase Auth REST schema](https://github.com/supabase/auth/blob/master/openapi.yaml), and [Supabase PKCE exchange contract](https://supabase.com/docs/guides/auth/sessions/pkce-flow). SDK upgrades must rerun the verifier/exchange integration tests.

The application scheme is `planora`. The production recovery callback is `planora://callback`. Expo Go development uses the callback produced by Expo Linking for the active development URL.

The callback handler requires the incoming scheme, host, and path to match the callback destination produced for the running application before it accepts a one-time authorization code, verification token hash, recovery token hash, or provider recovery session. Private callback values are consumed in memory and are not written to route parameters, logs, or SQLite. Valid email verification returns to onboarding when needed or the main application, while valid recovery state opens the password-reset screen. Invalid or expired links lead to a recoverable request-new-link path. Continue locally from callback recovery follows the same onboarding decision as the opening screen.

The Supabase project URL configuration must allow the production callback and the development callback used during testing.

## Offline behavior

SQLite remains the immediate source of truth. Account readiness runs independently of local startup and sends no request when connectivity is explicitly unavailable. A previously persisted unexpired session can restore offline. Profile errors do not change local planning. Account errors distinguish credentials, confirmation, rate limits, configuration, service availability, and network failures in all five catalogs. Recovery does not disclose whether an account exists.

Expo Go skips only the unsupported splash customization call, using Constants.executionEnvironment. Development, preview, and production builds retain the configured branded splash and reduced-motion behavior. Console methods and third-party diagnostics are unchanged.

## Sign-out behavior

Sign-out clears local authentication session material, removes the active account state, marks the local account link as unlinked, and returns to account entry. Local profiles, workspaces, and planning records remain on the device. Sign-out is not cloud deletion and is not account deletion. Cloud planning deletion and authenticated account deletion require separate exact-confirmation actions.

## Privacy limitations

Native secure storage protects session material using platform facilities, but it does not encrypt the Planora SQLite planning database. Web session persistence is accessible to same-origin browser scripts. Phase 9 provides optional planning synchronization, restore, portable planning export, cloud deletion, and authenticated account deletion. It does not export session state, provide social identity portability, or make the downloaded export private after it leaves the application.

## Testing strategy

Automated tests use mocked boundaries and deterministic values for onboarding completion, configuration validation, authentication state transitions, restoration, corrupt storage recovery, cleanup, error mapping, local-only startup, account linkage, route decisions, profile mapping, callback parsing, migration order, and network-error handling.

The authentication regression suite additionally exercises the installed client with in-memory transport and ephemeral session fixtures, single-client identity, subscription replacement/cleanup, concurrent restoration, deferred callbacks, offline startup, invalid refresh tokens, retained sessions, atomic chunk writes, repeated taps, S256 email requests and exchange, recovery privacy, offline sign-out, bounded refresh, and Expo Go splash selection. No real account is created by these tests.

A configured test project is required to verify signup, email confirmation, sign-in, restart restoration, sign-out, password recovery, profile updates, incorrect-password behavior, and two-account policy isolation. Test accounts should be removed afterward only when deletion is safe and authorized.

## Current limitations

The account provider remains email and password with recovery and a minimal profile. Social sign-in, phone sign-in, biometrics, anonymous provider accounts, payments, subscriptions, paywalls, and collaboration remain excluded. Applying the Phase 9 remote migration, deploying the account-deletion function, two-account policy testing, and two-device synchronization testing remain manual deployment and release work.
