# Store readiness

Planora is configured for release preparation, not publication. The repository does not contain store accounts, linked project identifiers, signing credentials, hosted policy URLs, screenshots, approvals, or submission automation.

## Application identity

- Name: Planora
- Slug: `planora`
- Version: `1.0.0`
- Android package: `com.nahomtaye.planora`
- iOS bundle identifier: `com.nahomtaye.planora`
- Orientation: portrait-first
- Interface: light and dark themes, phone and larger-screen support
- Languages: English, Amharic, Spanish, French, and Arabic

Android version code and iOS build number start at 1. EAS uses remote app-version sourcing and production auto-increment. Development and preview builds use internal distribution. Production uses store distribution without automatic submission.

## Store-listing guidance

Suggested short description: "Calm, local-first planning for tasks, routines, goals, and your day."

The full description should accurately explain local-only use, optional account synchronization, tasks, routines, planner blocks, goals and milestones, local insights and reflections, optional reminders, one-way calendar export, portable export, and separate device, cloud, and account deletion controls. It must not imply that synchronization is automatic, that remote infrastructure is already deployed, or that payments or premium features exist.

Screenshots should be captured from a release candidate with real reviewer-created content and should cover Today, Tasks, Planner, Routines, Goals, Insights, reminders, privacy and data, synchronization choices, and settings. Required device sizes, localization sets, and store-specific image rules must be confirmed in the store consoles at submission time. No temporary screenshots belong in the repository.

## Assets and permissions

The repository contains original Planora icon, adaptive icon, splash artwork, and a 96 by 96 white transparent Android notification icon. Expo configuration references these assets and defines light and dark splash backgrounds. The calendar permission description states that Planora exports only plan blocks the user chooses. Five iOS locale resources provide the calendar description. The Android notification channel name and description use the active Planora language.

Calendar access and notification permission are requested only after a user action. The application does not request location, camera, contacts, microphone, photos, advertising, tracking, or payment permissions.

## Required external inputs

- A real linked EAS project and authorized build accounts
- Apple Developer and Google Play Console access
- Signing certificates and provisioning managed outside the repository
- A hosted privacy-policy URL
- A hosted support URL and real support process
- Approved store descriptions, keywords, categories, age ratings, and localized screenshots
- Completed Apple privacy and Google data-safety forms
- Dependency-risk decision for the unresolved Expo SDK 54 build-tool findings
- Successful manual accessibility, physical-device, and live Supabase checks

## Publication blockers

The Supabase migration and account-deletion function are not claimed as deployed. Live row-level security, two-device synchronization, cloud deletion, account deletion, notification delivery, and calendar behavior are not claimed as verified. VoiceOver, TalkBack, large-text, high-contrast, reduced-motion, fluent-language, preview-build, and production-build reviews remain manual. These items block store submission and staged production rollout.
