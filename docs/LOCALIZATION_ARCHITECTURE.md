# Planora Localization Architecture

## Supported languages

Planora ships exactly five authored interface catalogs:

- English (`en`)
- Amharic (`am`, አማርኛ)
- Spanish (`es`, Español)
- French (`fr`, Français)
- Arabic (`ar`, العربية)

English is the fallback catalog. User-created titles, notes, tasks, routines, and block content are never translated. Translation does not use a network service, API key, account profile, or runtime content upload.

## Provider lifecycle and persistence

`LocalizationProvider` reads the active local profile's `AppSettings` after workspace initialization. The stored value can be one of the five languages or `system`. System mode resolves the first device locale to a supported base language and falls back to English. The provider watches application activation so a system-language change can be reflected after returning to Planora.

Manual selection updates the settings row with an expected revision and refreshes the interface immediately. Language is scoped to the local profile and survives application restarts. The preference is not placed in secure session storage and is not sent to the optional account service.

## Catalog structure and verification

English defines the deep catalog shape and the statically accepted key union. Each non-English catalog must satisfy that shape at compile time. Catalogs are grouped by launch, navigation, authentication, onboarding, Today, tasks, routines, Planner, Goals, Insights, reminders, synchronization, privacy and data controls, Settings, storage, validation, and errors.

The validation command independently flattens every catalog and fails for a missing key, unknown key, placeholder mismatch, or value equal to its raw key. It also decodes project-owned text files with a fatal UTF-8 decoder. Tests exercise English fallback, interpolation, plural branches, all five catalog registrations, Ethiopic and Arabic Unicode ranges, and RTL selection.

## Locale-aware formatting

Calendar dates are formatted from typed year-month-day values at a safe UTC noon, preserving the intended calendar date. Local times are formatted from typed wall-clock values. `Intl.DateTimeFormat`, `Intl.NumberFormat`, and `Intl.PluralRules` provide localized dates, weekdays, months, times, numbers, duration units, and plural selection. Localized lists use authored conjunction patterns so unsupported runtime list-format capabilities are not required.

Formatting locale follows the selected interface language rather than translating user content. Time-zone calculations remain separate and use the local profile's IANA time zone.

## Typography and scripts

Functional interface typography uses bundled open-source Noto Sans files in Regular, Medium, Semibold, and Bold weights. Latin-script languages use Noto Sans, Arabic uses Noto Sans Arabic, and Amharic uses Noto Sans Ethiopic. Only those weights are loaded. The Planora wordmark retains its original branded treatment.

Font terms and the three source-family copyright notices are included in `assets/fonts/NOTO_SANS_LICENSE.txt` under the SIL Open Font License 1.1. The bundled script-specific families prevent reliance on a decorative device font and provide Ethiopic and Arabic glyph coverage.

## Arabic and right-to-left behavior

The application declares RTL support through the Expo localization configuration. Arabic resolves to `rtl`; the other four languages resolve to `ltr`. Shared screens and text use logical direction, directional navigation arrows and chevrons mirror, timeline labels and blocks swap logical sides, and neutral icons remain unchanged. Web receives document language and direction values.

Native direction changes may require an application restart. The Settings screen explains that Expo Go on the current SDK can reset native RTL preferences and that a development build is required for authoritative native RTL verification. Automated tests validate direction decisions and exports, but they do not constitute native RTL visual verification.

## Accessibility and error handling

Authored accessibility labels, hints, state descriptions, validation, empty states, confirmation dialogs, and recoverable errors use the same catalogs as visible text. Repository and provider messages with known safe wording map to localized entries. Unknown external errors are not exposed directly by account gateways; they first become a bounded, privacy-preserving authored failure.

Language controls are radio buttons with selected state and native language names. Large text uses the same script-specific families and shared responsive layout. Language changes do not alter user records, task identifiers, or scheduling semantics.

## Translation quality boundary

The catalogs include Phase 9 synchronization, export, conflict, and deletion text and are mechanically complete, but automated validation cannot certify naturalness, cultural fit, pronunciation, truncation, or assistive-technology quality. Amharic and the other non-English catalogs require final review by fluent human reviewers before production release. No certified or professionally approved linguistic quality is claimed.
