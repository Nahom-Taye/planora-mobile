# Planora Synchronization Threat Model

## Assets and trust boundaries

The protected assets are planning content, deletion intent, local account separation, authentication sessions, remote ownership, conflict copies, exports, and device integration identifiers. SQLite is trusted as the immediate application data source but is not described as encrypted. Native secure storage holds session material separately. Web session storage has browser-origin limitations. The network, application lifecycle, remote responses, downloaded exports, and operating-system share targets are untrusted boundaries.

The client is not an authorization boundary. Supabase Row Level Security and authenticated server procedures enforce remote ownership. The account-deletion function is a separate privileged boundary. Its service-role credential must exist only in the server function environment.

## Consent and unintended upload

Threat: signing in, restoring a session, opening Settings, or reconnecting could upload private local planning without informed consent.

Controls: no binding is created by authentication. Local mutation triggers require an explicitly enabled binding. Upload, Merge, or Restore is a separate user action. Missing configuration and missing schema fail closed while local planning remains available. Successful cloud deletion disables bindings and clears queued remote state so reconnect cannot silently repopulate the deleted cloud data.

Residual risk: a user who explicitly selects Upload or Merge sends the documented portable data set. The interface and release materials must keep that boundary clear.

## Cross-account exposure

Threat: account switching could display another account's conflicts, send a former account's queue, apply a late pull, reuse remote revisions, or collide with the same portable identifiers owned by another account.

Controls: bindings, queue rows, and conflicts carry account identifiers. Provider reads filter account-specific conflict and pending state. Engine pushes filter by account and verifies the initiating account before and after network boundaries. Mismatched bindings are disabled. Rebinding clears remote revision state. Conflict resolution checks the active account. Remote entity and operation keys include owner identity, policies compare owner to `auth.uid()`, and procedures derive the caller from the session.

Residual risk: local planning itself is device-owned rather than account-owned. A person with device access can explicitly choose to upload that local workspace to a different signed-in account. This is an intentional consent action, not an automatic transfer.

## Duplicate or reordered transport

Threat: app termination, retry, reconnect, or duplicate requests could apply the same mutation more than once, skip a revision, duplicate pulled records, or make device time authoritative.

Controls: each queued mutation has a stable UUID. The server operation ledger is owner-scoped and returns the original revision and cursor when an identifier repeats. Server transactions assign integer revisions and sequence cursors. Pulls are ordered by cursor and bounded. Remote application is suppressed from the outbound queue. The change journal stores the payload at each committed cursor. Retry timestamps affect scheduling only and do not decide content precedence.

Residual risk: delivery is at least once around a crash boundary. Correctness depends on retaining the operation ledger and change journal. Neither has automatic retention cleanup in Phase 9.

## Lost work and conflict handling

Threat: last-write-wins behavior could silently erase text, plans, or deletion intent.

Controls: a base-revision mismatch returns a conflict. An inbound record meeting a pending local mutation also becomes a conflict. Both payloads, both revisions, remote deletion state, owner, and cursor are retained locally. Duplicate observations update one open conflict. Resolution is explicit. Combine is limited to allow-listed qualitative fields.

Residual risk: automated combination is intentionally narrow and may produce text that needs editing. Human review is required for every open conflict.

## Tombstones and resurrection

Threat: removal markers could be discarded too early, causing deleted records to reappear on another device.

Controls: local soft-deleted records remain readable to the queue. Remote rows retain deletion timestamps. The change journal retains deletion events. No time-based tombstone cleanup is present. Keep Cloud can apply a remote deletion, while Keep Local explicitly queues the local state against the observed remote revision.

Residual risk: indefinite remote retention increases storage usage until a future retention policy is designed. Any later cleanup must prove that all supported cursors have advanced safely.

## Remote response manipulation and schema drift

Threat: malformed or unexpected remote records could be cast to a valid local type, cross a workspace boundary, corrupt cursors, or trigger an unsafe fallback.

Controls: the gateway validates entity allow-lists, identifiers, positive safe revisions, positive safe cursors, boolean deletion state, and object payloads. Pull procedures verify workspace ownership and cap the requested size. Missing functions or tables map to a missing-schema state. Local record application resolves profile settings through the active workspace and rejects records that do not belong to that workspace.

Residual risk: semantic payload validation remains enforced by local repositories and remote generated-column casts rather than a complete remote schema for every JSON field. Live incompatible-schema testing remains required.

## Deletion abuse and false success

Threat: a client could delete another user's cloud data, delete an account by supplying another identifier, or show success after a failed operation.

Controls: cloud deletion accepts no owner argument and deletes only rows matching the authenticated caller. Account deletion validates the bearer token, derives the user from that token, and passes only that derived identifier to the privileged server client. Exact action-specific confirmation phrases are required before local invocation. The client updates local synchronization state only after cloud deletion succeeds. Non-success server responses remain failures.

Residual risk: an authenticated person controlling an unlocked session can invoke destructive actions after entering the phrase. Operating-system device access controls and clear interface wording remain important.

## Export disclosure

Threat: an export could include session values, account identity, native notification or calendar identifiers, diagnostics, or hidden temporary state.

Controls: export is built from the portable record allow-list rather than raw tables. Profile, account, session, email, device calendar, event, and notification keys are excluded or rejected. Native temporary files are removed after sharing. Web object URLs are revoked after download.

Residual risk: portable exports contain the planning content the user requested, stable planning identifiers, and deletion markers. Once shared or downloaded, copies are controlled by the receiving location and must be protected by the user.

## Logs and diagnostics

Threat: errors and diagnostics could leak planning payloads, email addresses, tokens, credentials, SQL, backend URLs, or native identifiers.

Controls: synchronization errors become bounded categories. Diagnostic rows contain coarse operational metadata only. The account-deletion function emits no console output. Production presentation uses localized generic recovery text.

Residual risk: platform and third-party runtime logging is outside the application-owned diagnostic schema. Release checks must inspect production build behavior and avoid enabling verbose transport logging with real accounts.

## Availability and resource exhaustion

Threat: a large queue, remote history, retry loop, export, or conflict set could block normal local planning or exhaust memory.

Controls: local actions do not await transport. Push is capped at 50 queue rows, pull at 100 change rows, repository pages at 100, and retry delay is capped. Provider execution is non-overlapping and event-driven. Conflict and status queries are bounded. Snapshot enumeration is paginated.

Residual risk: version 1 export materializes the portable snapshot and serialized JSON in memory. Very large workspaces require manual stress testing and a future streaming format if measurements show unacceptable memory pressure.

## Required live validation

Before release, an authorized non-production project must apply the Phase 9 migration and deploy the deletion function. Two accounts must verify policy isolation. Two physical devices must exercise initial upload, merge, restore, concurrent edits, conflict choices, interruption, duplicate retry, offline recovery, tombstones, account switching, cloud deletion, and account deletion. These checks are not satisfied by repository tests.
