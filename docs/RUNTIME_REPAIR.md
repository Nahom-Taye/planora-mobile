# Runtime repair verification

## Reproduced causes

The released root layout configured `<Stack initialRouteName="(auth)">`, while its protected guard removed `(auth)` when the account was signed in or recovering. `(auth)` is an immediate filesystem child of the root; there is no `(public)` group. It was missing from the active navigator, rather than nested under another route group. The installed navigation library's `useNavigationBuilder` throws the reported error when validating the initial name against those active screens.

The root navigator was also wrapped in `FeatureErrorBoundary area="today"`. That boundary reported the navigation exception as a Today failure with category `unexpected` and error class `other`. `reportFeatureFailure` deliberately called `console.error`, producing the second development-console message. The runtime test reproduced the navigation exception using the installed route filtering and navigation code. The redacted device message alone cannot identify an additional, separate physical-device Today exception.

Independent legacy-data reproductions found additional failures in `src/storage/mappers/entity-mappers.ts`: `metadataFromRow` evaluated `toInstant(stringValue(row, 'updated_at'))`, and task hydration evaluated `completedAt ? toInstant(completedAt) : null`. Invalid stored text threw `Invalid absolute timestamp.` before Today could apply its display fallback. Optional routine times had the same problem at `toLocalTime(value.time)`. Formatting invalid dates with `Intl.DateTimeFormat(...).format(...)` could also throw. These cases were reproduced with disposable in-memory SQLite records; no physical-device database was opened or modified.

## Resulting behavior

- The always-registered concrete `entry` screen is the root initial route. Its redirect uses current session, local-access, onboarding, and recovery state.
- Signed-out users without a saved local choice reach `/(auth)/welcome`, offering Sign in, Create account, and Continue locally. Local access survives a cold restart. Signing in clears that choice so later sign-out returns to account entry.
- Authentication and onboarding transitions first navigate to the available entry screen. Callback and reset-password routes remain public. Recovery opens reset-password unless the user explicitly chooses local access.
- Task and routine hydration preserves stored timestamp text and revision metadata. Display validation treats unusable optional dates as unavailable, uses a valid legacy update timestamp when completion time is absent or invalid, and keeps tasks with invalid due dates reachable in the unscheduled list. Reads do not rewrite or remove rows.
- Today excludes tombstones and unrelated routine check-ins. Invalid display values render safely across all five catalogs. An unmeasurable block contributes no duration while its agenda record remains available.
- Planning and planner refreshes invalidate stale results on data changes, scope changes, foreground/background transitions, and disposal. Obsolete callbacks cannot initiate a new read for an old scope. Existing data stays visible during a refresh.
- Recoverable diagnostics use redacted warnings. No global console, LogBox, or native-error suppression was added. Feature recovery resets the failed boundary on retry and offers Settings as a safe destination from Today.

## Automated verification

`npm install`, TypeScript, lint, the complete test command, the requested Phase 3/4/9/10 suites, release verification, Doctor, and the Expo dependency check passed. Doctor passed 18 of 18 checks. The test command runs 227 tests: 180 existing tests and 47 runtime regressions. All five translation catalogs passed validation.

| Suite | Passing tests |
| --- | ---: |
| Phase 2 | 6 |
| Phase 3 | 13 |
| Phase 4 | 16 |
| Phase 5 | 17 |
| Phase 6 | 19 |
| Phase 7 | 21 |
| Phase 8 | 14 |
| Phase 9 | 21 |
| Phase 10 | 32 |
| Authentication | 21 |
| Runtime | 47 |

The runtime suite covers the generated route tree and every configured initial route across all 13 navigators; cold route decisions; restoration/loading gates in the actual root component; direct authentication and callback routes; recovery/local access; SQLite timestamp edge cases; normal task completion, editing, deletion and reopening; restored-record reads; revision conflicts; mounted Today refreshes; stale results; planner refresh settling; all five formatting catalogs; and working recovery actions. Network failure, expired-session, synchronization consent, ownership, and request-coalescing coverage remains in the existing suites.

Android, iOS, and web individual exports passed. A final combined export of the finished source also passed: Android and iOS Hermes bytecode, three web bundles, and 75 static routes. Android and iOS Expo Go manifests and development bundles returned HTTP 200 with SDK 54 and the current entry implementation. The route generator produced the same route structure for Android, iOS, native, and web.

All 11 canonical released migration hashes passed unchanged. No migration, remote schema, RLS policy, synchronization ownership rule, account-isolation rule, or deletion implementation changed. The ordinary-comment, prohibited-reference, environment-value, and tracked-generated-file audits passed. `.env.local` remained ignored and untracked. Temporary exports and verification output are removed before committing.

The configured Supabase URL passed configuration validation, DNS resolution, HTTPS health, and authenticated settings requests. Both endpoints returned HTTP 200; email authentication and sign-up were enabled, with email confirmation required. No credentials, account records, or environment values were printed. An independent comparison with the current dashboard Project URL still requires that URL from the project owner.

## Changed files

```text
app/_layout.tsx
app/entry.tsx
docs/AUTH_ARCHITECTURE.md
docs/PHASE4_ARCHITECTURE.md
docs/RUNTIME_REPAIR.md
package.json
package-lock.json
src/features/auth/components/auth-scaffold.tsx
src/features/auth/screens/auth-welcome-screen.tsx
src/features/auth/screens/check-email-screen.tsx
src/features/auth/screens/create-account-screen.tsx
src/features/auth/screens/recoverable-auth-error-screen.tsx
src/features/auth/screens/recovery-callback-screen.tsx
src/features/auth/screens/reset-password-screen.tsx
src/features/auth/screens/sign-in-screen.tsx
src/features/auth/services/app-entry.ts
src/features/insights/services/range-calculations.ts
src/features/localization/localization.ts
src/features/onboarding/screens/onboarding-screen.tsx
src/features/planner/services/capacity.ts
src/features/recovery/components/feature-error-boundary.tsx
src/features/recovery/services/redacted-diagnostics.ts
src/features/today/screens/today-screen.tsx
src/features/today/services/display-values.ts
src/features/today/services/refresh-generation.ts
src/features/today/services/today-planning.ts
src/providers/app-entry-provider.tsx
src/providers/planner-provider.tsx
src/providers/planning-provider.tsx
src/storage/mappers/entity-mappers.ts
tests/phase4.test.ts
tests/runtime-harness.ts
tests/runtime.test.ts
```

## Device retest still required

No physical-device success or live browser UI success is claimed. Browser automation had no connected browser. Mounted component tests, route generation, development bundles, and static exports do not replace a physical-device test.

1. Update to the repair commit. Keep the installed application and its local data. Start Metro with `npx expo start --go --clear --lan`, or use the already-running server with the updated source. Load the new bundle once while online.
2. Fully close and reopen Planora while signed out. Without a saved local choice, verify account entry offers all three actions and shows neither reported error. Choose Continue locally, complete onboarding if required, then cold-reopen again and verify Today and existing records are available.
3. On a separate fresh installation, verify account entry, incomplete onboarding, skipped/completed onboarding, and local access. Do not clear the existing device's data to simulate first installation.
4. On Today, create and edit a task, complete it, show completed tasks, reopen it, and delete a disposable test task. Background, foreground, fully close, and reopen the app. Verify other existing records and completed timestamps remain intact. Test record restoration only through an existing supported restoration workflow.
5. With the bundle cached, repeat local operations in airplane mode. Restore connectivity. For a workspace that already has explicit synchronization consent, verify automatic synchronization, a synchronized task completion, and subsequent reopening. Verify a workspace without consent does not upload planning data.
6. Sign in with an existing account and repeat cold startup. Open direct sign-in and create-account links, a fresh email-verification callback, and a fresh password-recovery callback. Complete password recovery yourself and verify the correct onboarding or main destination. Check Continue locally from a callback/error screen and retry with an expired link.
7. Check valid restored sessions, expired sessions, and account-service failure without altering database records or manually editing credentials. Test missing Supabase configuration only in a separate development instance. Confirm local access remains available.
8. Repeat startup and the main task lifecycle on Android and iOS, and check the web interface in a connected browser. Exercise all five languages, accessibility navigation, and the existing notification, calendar, goals, insights, export, and privacy flows.
