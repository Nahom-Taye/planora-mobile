# Planora Phase 9 Architecture

## Scope and consent boundary

Phase 9 adds optional account synchronization, portable planning export, conflict review, and device, cloud, and account deletion controls. SQLite remains the immediate source of truth for every screen and local mutation. Local planning continues without an account, public backend configuration, or network connection.

Authentication and synchronization are separate choices. Signing in restores an account session and remote profile only. It does not upload, merge, or restore planning data. Synchronization begins only after the user opens Privacy and Data and explicitly selects Upload, Merge, or Restore. Disabling synchronization stops transport without deleting local planning data.

The Supabase migration and account-deletion function are repository artifacts. Their presence does not mean they have been applied or deployed.

## Portable and device-specific data

Portable records include the active workspace, tasks, plan-block recurrence series, plan blocks, routines, routine check-ins, goals, milestones, goal-to-routine links, areas, tags, reflections, profile-scoped planning preferences, and reminder intent. Stable entity identifiers, local revisions, deletion state, and workspace ownership travel with those records.

Device notification schedules, notification identifiers, selected calendar identifiers and names, calendar event identifiers, calendar fingerprints, remembered temporary screen destinations, onboarding state, account links, sessions, email addresses, tokens, diagnostics, queue metadata, and conflict metadata are excluded. Portable profile preferences exclude device-specific calendar values and temporary Planner and Insights views. Reminder intent is portable; scheduled operating-system notifications are not.

The versioned JSON export uses `planora-planning-export`, version `1`, an export timestamp, and portable records. Native platforms create a temporary cache file only for the share operation and remove it afterward. Web uses a browser download. Exports do not contain session material or native notification and calendar identifiers. The recipient and later storage of an exported file are outside the application boundary.

## Local migration 8

Migration 8 is the only Phase 9 local migration. It appends account and retry metadata to the durable local change queue and creates synchronization bindings, per-entity remote state, preserved conflicts, redacted diagnostics, portable-type details, and transaction-scoped queue suppression. It adds bounded queue indexes and mutation triggers for portable tables.

Triggers enqueue only when the workspace has an enabled binding. Remote application runs under suppression, so pulled records do not re-enter the outbound queue. Released migrations 1 through 7 remain unchanged. Migration 8 is additive, seed-free, forward-only, and does not enable synchronization or upload existing records.

## Activation modes

- Upload requires that the signed-in account has no non-deleted remote planning workspace. It binds the local workspace and enqueues its complete portable snapshot.
- Merge requires an existing remote workspace. It keeps the remote workspace record, enqueues local child records, and then incrementally exchanges changes.
- Restore requires an existing remote workspace. It does not enqueue the local snapshot and incrementally applies remote records into the active local workspace.

Only the first owned remote workspace is currently selectable because the product has one active personal workspace. An account mismatch disables the old binding. A different account must make a new explicit activation choice. Remote revision state is cleared before rebinding a local workspace to a different account, while account-tagged conflicts remain isolated from the new account.

## Queue lifecycle and bounded work

Local mutations create stable UUID operation identifiers before transport. A queued operation moves from `pending` to `processing`, then is removed only after an acknowledged application. Network and remote failures move it to `failed` with a non-private category and a bounded next-attempt timestamp. A processing operation older than five minutes is eligible for recovery after an interrupted run. Multiple queued mutations for the same entity are coalesced within a batch while retaining the newest operation that is selected. Initial snapshots persist dependency-safe order so recurrence series, goals, routines, and parent tasks precede local rows that reference them.

One run reads at most 50 outbound queue rows and requests at most 100 inbound changes. Pulls use a strictly increasing server cursor. Retry uses exponential delay capped at five minutes plus bounded jitter. App activation and a confirmed network reconnect may request another run, and an in-process guard prevents overlapping provider runs. There is no unbounded background loop.

Every remote write carries its stable operation identifier and expected server revision. The server records applied operations per owner, making a repeated push idempotent. Server-assigned revisions and sequence cursors determine remote ordering; device wall-clock time never decides which planning version wins. Local timestamps are used only for retry eligibility and presentation.

## Pulls, cursors, and tombstones

The remote change journal stores the payload, revision, deletion state, and server cursor for each committed change. Incremental pulls are ordered by cursor. The local binding advances only through records that were examined and either applied or preserved as conflicts. Entity state stores the acknowledged server revision used as the base of a later push.

Local and remote deletions are tombstones rather than silent hard deletion during synchronization. Deleted local rows remain available to the queue. Remote records retain `deleted_at`, and the change journal carries deletion state. Phase 9 defines no automatic tombstone cleanup or age-based journal deletion. Cloud-data deletion and authenticated account deletion are the explicit remote removal paths.

## Conflict preservation and resolution

If the server revision differs from the queued base revision, or an inbound change meets a pending local mutation, Phase 9 stores both payloads, both revisions, the remote cursor, deletion state, workspace, and account in a local conflict row. Repeated observation of the same open entity conflict updates that row rather than creating another visible copy. Synchronization does not silently apply last-write-wins.

Conflict lists and queue counts are filtered by both workspace and current account. Resolution requires the current account identifier to match the conflict. Keep Cloud applies the preserved remote record and removes only matching queued changes. Keep Local queues the current local record against the preserved remote revision. Combine is offered only for allow-listed text fields and keeps non-text values from the local and remote payload according to the documented combination rule.

## Account switching and cancellation

Every run captures the initiating account. The engine checks that account before and after remote requests and before local application. If the active account changes, the run cancels without applying the returned remote payload. An acknowledged outbound operation may remain queued when cancellation occurs; its stable operation identifier makes a later retry by the original account safe.

A binding owned by another account is disabled with an account-mismatch state. Signing out does not delete local planning. Signing into another account does not expose the former account's conflicts, pending count, remote revisions, or cloud workspace through the synchronization interface.

## Error, offline, and schema behavior

Missing or invalid public configuration leaves synchronization unavailable and preserves local-only operation. A missing remote schema becomes a bounded `schema_missing` failure rather than enabling a partial fallback. Session expiry, offline transport, invalid remote responses, and other remote failures have separate non-private categories. Failed runs retain the queue and local data. Reconnect and foreground events retry through the same bounded engine. Account changes cancel work in progress.

Diagnostics store only workspace identifier when applicable, category, occurrence timestamp, attempt count, coarse connectivity, and optional entity type. They exclude payloads, titles, notes, reflection bodies, email addresses, tokens, credentials, SQL, URLs, and native identifiers. Production UI shows an authored recoverable message rather than raw remote or database output.

## Deletion controls

Clear Device requires the exact confirmation phrase. It cancels only recorded notification mappings, optionally removes only recorded calendar events, and then removes the selected workspace's local planning and synchronization rows. It does not contact the backend. A failed confirmation performs no device operation.

Delete Cloud requires an authenticated configured gateway and an exact action-specific phrase. The server function deletes only planning rows owned by the authenticated caller. Local planning remains, but successful remote deletion disables affected bindings, clears their outbound queues and remote revision state, and removes obsolete open conflicts so a later lifecycle event cannot re-upload data without a new explicit activation. A server failure leaves the local binding and data intact and is not reported as success.

Delete Account invokes the account-deletion server function with the current bearer session. The function accepts only POST, validates the bearer session with the public client, derives the user identifier from that validated session, and only then uses a server-side privileged client to delete that user. The service-role credential is never present in the application or repository. Failure is returned as failure; the client does not claim deletion succeeded.

## Remote authorization model

The Phase 9 Supabase migration creates owner-scoped planning tables, an operation ledger, and an immutable change journal. Entity and operation identity is composite with owner identity, preventing the same portable UUID used by separate accounts from colliding. Row Level Security is enabled and forced. Policies compare every row's owner to `auth.uid()`, anonymous and public access is revoked, direct authenticated table access is revoked, internal trigger functions are not executable by client roles, and only the four explicit authenticated remote procedures receive execute permission.

Security-definer procedures validate authentication and constrain every lookup and mutation by the derived caller. Push validates entity types, object payloads, workspace ownership, base revisions, and stable operations. Pull validates workspace ownership and caps its batch at 100. Cloud deletion derives ownership from the session rather than accepting an owner parameter.

## Verification boundary

Automated Phase 9 tests cover migration order and forward-only behavior, queue guards and suppression, bounded portable snapshots, export exclusions, retry bounds, destructive phrases, text combination, owner-scoped remote schema, Row Level Security, least privilege, idempotency, server ordering, bounded incremental pull, tombstones, authenticated account deletion, missing configuration, and all five catalogs.

Live verification still requires applying the Supabase migration, deploying the account-deletion function, testing Row Level Security with two accounts, exercising upload, merge, restore, conflicts, tombstones, account switching, cloud deletion, and account deletion against a non-production backend, and using two physical devices. No deployment or live result is claimed. Payments, subscriptions, paywalls, and premium capabilities remain deferred.
