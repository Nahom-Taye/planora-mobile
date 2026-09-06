# Startup and account access repair

## Confirmed findings

| Symptom | Evidence and repair |
| --- | --- |
| Unsupported splash customization | The root navigator called setOptions unconditionally. Runtime selection now skips that call only in Expo Go. Configured splash branding and reduced motion remain intact in native builds. |
| Zero-millisecond auth lock warning | Supabase Auth 2.112.0's automatic-refresh tick explicitly uses a zero-timeout lock. Startup enabled that timer alongside restoration. The provider effect also restarted when local repositories became ready. A stable lifecycle now shares restoration, disables the competing SDK timer, schedules bounded foreground/connectivity checks, and uses a justified 45-second normal lock timeout. |
| Network request failure | Both public variables are present, non-placeholder, structurally valid, and embedded in all three exports. The configured project hostname returns ENOTFOUND outside the sandbox while the public control hostname resolves. Health and settings endpoints cannot be reached. This reproduces an external failure that prevents signup and password sign-in; project status and dashboard settings cannot be inferred from DNS alone. |
| Insecure PKCE fallback | The SDK's challenge helper requires browser crypto.subtle and TextEncoder. The native runtime did not supply the required WebCrypto interface. Email signup/recovery now send explicit S256 challenges using the installed Expo Crypto random-byte and SHA-256 APIs. Password sign-in does not generate PKCE. No globals or console functions are patched. |
| Startup stalls and inconsistent account state | Account restoration had no UI deadline; every restoration error triggered local sign-out. SecureStore read errors also removed stored material. Startup now exits account waiting after 1.5 seconds. Retryable failures preserve stored sessions; rejected expired tokens return to safe account entry. |
| Session storage corruption risk | Active chunks were overwritten before the manifest commit. Serialized inactive-slot writes now preserve the previous committed value after interruption, retain legacy reads, and respect native byte limits for Unicode text. |

One application Supabase client and one AccountProvider were found. The SDK also owns an internal token-change subscription. No existing nested Supabase call was found inside the application's auth callback; its original side effect was local account linkage. Repeated lifecycle effects and concurrent automatic refresh were the demonstrated sources of duplicate initialization work. The new callback defers application delivery until outside the auth lock.

The insecure fallback warning alone did not prove that the server rejected signup. The independently reproduced DNS failure prevents both signup and sign-in. Device-specific behavior remains unverified.

## Resulting behavior

Signed-out startup offers Sign in, Create account, and Continue locally. Missing configuration, unavailable accounts, and refresh failures do not gate local planning. Account actions normalize email, validate passwords, reject duplicate taps, expose localized errors and retry/local options, and retain their operation guard if underlying work outlasts the UI deadline.

Foreground/connectivity refresh stops after two consecutive failures. Network cooldowns and server rate limits prevent request storms. A rate-limited refresh retains session material. Readiness and profile work do not block local startup. Retry clears stale errors and restarts bounded refresh. Confirmation resend has a 60-second local cooldown in addition to server limits. Recovery is private, preserves transiently failed code exchange for explicit retry, and supports both the Planora scheme and the current Expo Go callback.

Local identifiers, planning records, explicit synchronization consent, and account isolation remain unchanged. Signing in never enables synchronization. Sign-out clears authentication material without deleting planning data. Native sessions remain in SecureStore; no session material is stored in SQLite.

## Changed files

- app/(auth)/_layout.tsx
- app/_layout.tsx
- docs/AUTH_ARCHITECTURE.md
- docs/AUTH_REPAIR.md
- package.json
- scripts/check-account-service.ts
- src/features/auth/components/auth-scaffold.tsx
- src/features/auth/screens/auth-welcome-screen.tsx
- src/features/auth/screens/check-email-screen.tsx
- src/features/auth/screens/recovery-callback-screen.tsx
- src/features/auth/services/account-client.ts
- src/features/auth/services/account-gateway.ts
- src/features/auth/services/auth-configuration.ts
- src/features/auth/services/auth-error-mapper.ts
- src/features/auth/services/auth-runtime.ts
- src/features/auth/services/auth-state.ts
- src/features/auth/services/auth-types.ts
- src/features/auth/services/pkce.ts
- src/features/auth/services/session-storage-core.ts
- src/features/auth/services/session-storage.ts
- src/features/auth/services/splash-runtime.ts
- src/features/auth/services/supabase-account-gateway.ts
- src/features/localization/catalog-am.ts
- src/features/localization/catalog-ar.ts
- src/features/localization/catalog-es.ts
- src/features/localization/catalog-fr.ts
- src/features/localization/catalogs.ts
- src/features/localization/localization.ts
- src/providers/account-provider.tsx
- tests/auth.test.ts
- tests/phase10.test.ts

## Verification

The required command set is npm install, typecheck, lint, test, test:phase3, test:phase9, test:phase10, verify:release, doctor, expo install --check, and clean Android/iOS/web exports. Phase 2–10 suites remain in the test command. The new authentication suite contains 21 tests, including singleton/subscription identity, concurrent restoration, callback lock safety, blocked startup, missing configuration, session retention, invalid refresh cleanup, rate limits, interrupted storage, Unicode chunks, repeated taps, S256 requests/exchange, recovery privacy, offline sign-out, and splash selection.

Final release verification passes, including 18/18 doctor checks and complete catalogs in all five languages. Android, iOS, and web export; Router generates 74 static routes. The development manifest reports SDK 54, scheme planora, development mode, and a launch asset. Native notification boundaries remain covered by Phase 10 tests. Runtime tests produce no zero-timeout lock, PKCE fallback, or unsupported splash warnings. Deliberately injected network/token failures can still emit the SDK's own diagnostics; they are not hidden.

All eleven canonical local/Supabase migration hashes remain unchanged. The dependency lockfile is unchanged. Source/configuration comment checks and project reference/path/credential scans report no findings. The environment file remains ignored and untracked; its example remains placeholder-only. Exports and temporary verification files are removed before commit.

Some commands initially failed because sandbox access blocked Expo metadata or Hermes temporary output. Their unrestricted retries passed. Installation reports 28 pre-existing dependency advisories: 19 moderate and 9 high. The supplemental npm audit remains nonzero; its suggested fixes include incompatible Expo upgrades. No dependency or SDK change is included in this repair.

## Service and physical-device follow-up

The immediate blocker is the configured project hostname failing DNS. In the Supabase dashboard, open the intended project and check its status. If paused, restore that project. Compare its Connect dialog Project URL and publishable key with the two local public variables; correct a stale value locally, then restart Metro with a cleared cache. Never put privileged keys in the application.

Once the project resolves, run the redacted checker with Node's env-file option for the local environment file. It reports only configuration status, DNS status, HTTP status, signup-disabled, email-enabled, and email-autoconfirm flags. Authentication settings were not readable during this repair. No claim is made that signup is disabled or email confirmation is misconfigured.

Check Authentication > URL Configuration: allow planora://callback with the verification/recovery query variants, plus the exact development callback produced for the current Expo Go host. Check Authentication > Sign In / Providers > Email only if the returned public settings or a real request shows signup is disabled. Preserve the intended Confirm email policy. Review email rate limits and SMTP configuration only if the service returns an email-delivery or rate-limit error. No dashboard setting, migration, or function was changed.

Physical-device sequence:

1. Start Metro with npm start -- --go --clear and open the project in a compatible SDK 54 Expo Go client on Android. Cold launch while signed out; verify the three entry choices and absence of the splash, zero-timeout lock, and PKCE fallback warnings.
2. Load the app, turn on airplane mode, reload using the cached bundle, and choose Continue locally. Complete onboarding if needed. Create and edit a task, routine, goal, and planner block. Background and resume; verify the records remain available.
3. Restore connectivity. On the account entry screen use Try again. If the service remains unavailable, confirm the error is about connectivity/service availability and local planning still works.
4. With your own email and chosen password, create an account and tap submit repeatedly. Expect one request. If confirmation is required, open the newest email link on the same device and within its validity period. Verify resend waits and safe back navigation.
5. Sign out, sign in with your own existing account, then cold restart. Check restoration, profile access, and unchanged local records. Try an incorrect password and verify the credential-specific message.
6. Request recovery for an address you control. Verify the generic confirmation, callback, password reset, and subsequent sign-in. Do not share the password or callback tokens. Open auth/recovery routes directly and verify back controls or the request-new-link path.
7. Repeat background/foreground and offline/online transitions with a stored session. Confirm bounded retries, retained local records, and recovery after connectivity returns.
8. If you use two accounts, switch between them and verify synchronization remains disabled until explicit consent and never exposes another account's remote workspace. Check local planning survives both sign-outs.

No physical-device signup or sign-in was performed. Browser visual inspection was unavailable because the browser-control runtime exposed no browser. Automated and static verification do not substitute for these device checks.
