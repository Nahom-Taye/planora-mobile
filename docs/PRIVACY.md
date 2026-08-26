# Privacy

This document describes the behavior implemented in the Planora application. It is product documentation, not a hosted privacy policy or legal approval.

## Local planning

SQLite on the current device is the immediate source of truth for planning. Planora supports onboarding, tasks, routines, planning, goals, milestones, insights, reflections, reminders, settings, and local export without an account or network connection. Signing in does not upload planning data. Synchronization begins only after the user explicitly enables upload, merge, or restore for the active account and workspace.

Planora does not include analytics, advertising, payment, subscription, or tracking services. A release owner must verify store privacy disclosures against the final native binary and any externally deployed services.

## Data categories

Portable planning data can include workspaces, tasks, plan blocks and repeating plans, routines and check-ins, goals and milestones, organization fields, reflections, reminder choices, and portable planning preferences. When synchronization is enabled, those records are associated with the authenticated account and workspace in Supabase.

Device-specific data stays on the device. This includes session material held through SecureStore, native notification schedule identifiers, device-calendar identifiers and mappings, temporary interface state, and synchronization diagnostics. Portable exports exclude credentials, session tokens, account identifiers, native notification identifiers, device-calendar identifiers, synchronization queue metadata, conflict payloads, and diagnostics.

Notifications are scheduled locally. The user chooses whether a reminder may include a planning title; otherwise the notification uses generic localized text. Android reminder notifications use private lock-screen visibility. Calendar export is one-way and occurs only for a plan block the user chooses. Planora does not import unrelated calendar events.

## Synchronization and account data

Synchronization uses the signed-in account only after explicit activation. Local queues, remote rows, cursors, and conflicts are account-scoped. Account switching cancels active work and prevents queue or conflict reuse by another account. Remote access is intended to be protected by row-level security and authenticated functions.

The Phase 9 Supabase migration and account-deletion function are repository artifacts only. They have not been claimed as deployed. Until the schema and function are deployed and verified, missing-schema behavior is a recoverable local-only state and remote deletion cannot be considered operational.

## Export and deletion

Portable export creates a versioned JSON file and invokes a platform share or download flow. Native temporary export files are removed after the share attempt. The recipient and destination chosen by the user are outside Planora's control.

Device-data deletion requires an exact confirmation phrase and removes planning data from the active device. Removing linked device-calendar events is a separate choice. Cloud-data deletion requires a signed-in account, an enabled binding, an exact confirmation phrase, and server success before the interface reports completion. Account deletion requires an exact confirmation phrase and an authenticated server-side request; it does not automatically erase device planning data.

## Diagnostics and retention

Synchronization diagnostics contain an allow-listed category, occurrence time, attempt count, connectivity state, and optional entity type. Feature recovery diagnostics contain only the feature area, category, and time. They exclude planning content, email addresses, tokens, credentials, raw error messages, and stack traces. Development output uses the same redacted structure.

Remote tombstones are retained by the implemented schema with no automatic cleanup policy. A future retention policy must preserve offline-device correctness before any cleanup is introduced.

## Manual launch inputs

A hosted privacy-policy URL, support URL, responsible organization details, jurisdiction-specific review, and store privacy questionnaires remain manual launch inputs. None are invented or approved by this repository.
