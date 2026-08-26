# Security

## Trust boundaries

SQLite is the immediate planning store. SecureStore holds the authenticated session on supported native platforms, while the browser uses the account library's supported session mechanism. Public Supabase URL and public client configuration are supplied through ignored environment files. Database passwords, service-role keys, signing material, and store credentials do not belong in the application bundle or repository.

Authentication validates recovery links before accepting authorization codes, token hashes, or recovery sessions. Route guards separate onboarding, local-only use, account routes, recovery, and signed-in areas. Notification destinations require a supported entity type, a valid identifier, and an entity in the active workspace. Invalid or stale destinations open a safe fallback.

Synchronization is opt-in and account-scoped. Stable operation identifiers make repeated pushes idempotent. Server revisions and cursors determine remote ordering; device clocks do not advance remote revisions. Push and pull batches are limited to 100 records. Conflicts retain local and remote payloads until the user chooses a resolution. Conflict cleanup filters by workspace, account, and entity identifier and processes bounded pages.

The Supabase migration enables and forces row-level security, applies ownership policies, scopes identities by owner, and restricts function grants. The account-deletion function validates the bearer session before using server-side administration. Privileged credentials remain server-side. Deployment and live two-account verification are still required.

## Recovery and diagnostics

Storage initialization and migration failures show a non-destructive retry path. Feature route groups have recovery boundaries with retry and return actions. Production recovery screens do not show raw stack traces or error messages. Redacted diagnostics contain only allow-listed metadata. No recovery path resets the database automatically.

Remote deletion reports completion only after the request succeeds. Missing configuration, missing schema, network loss, session expiry, permission denial, interrupted export, and invalid routes remain recoverable states that preserve local data.

## Dependency review

The release review ran a non-forced dependency repair and removed the `nanoid` finding by moving the compatible transitive version to 3.3.18. The remaining audit result is 20 findings: 11 moderate and 9 high, with no critical findings.

The affected paths are in the Expo SDK 54 build and development toolchain:

- Expo CLI and Metro reach `image-size` through Metro asset processing.
- Expo Metro configuration reaches `postcss` through build-time CSS processing.
- Expo configuration plugins reach `uuid` through the `xcode` package.
- Higher-level Expo packages are reported because they depend on those paths.

The practical exposure is concentrated on development and build hosts processing project assets, CSS, source maps, and native project metadata. The reported paths are not application code that reads private planning records at runtime, but a malicious or untrusted build input could affect availability or disclose files on a build host. This distinction reduces runtime exposure but does not resolve the build-chain risk.

The registry-proposed complete repair upgrades Expo to SDK 57, which is outside the required SDK 54 release line. No forced repair or incompatible override was applied. These findings remain a release risk and must be reassessed against a supported Expo upgrade path before store release.

## Repository and build controls

`.env.local` remains ignored and untracked. `.env.example` contains placeholders only. EAS profiles define development, internal preview, and store production builds without project identifiers, submission automation, signing material, account identifiers, or service credentials. Native signing and store credentials must be supplied through approved external systems.

The release workflow installs with `npm ci`, runs type checking, lint, tests, catalog validation, Expo Doctor, and the Expo dependency compatibility check. Security audit findings are reported separately because unresolved findings must remain visible.
