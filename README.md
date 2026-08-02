# Planora

Planora is a calm personal planning and productivity tracker for Android and iOS. The application connects daily focus, forward planning, long-term goals, and personal reflection through a clear mobile experience.

This repository contains the completed Phase 1 foundation. Data persistence, accounts, remote services, notifications, payments, and complete planning workflows are intentionally outside the current scope.

## Foundation features

- Five primary destinations: Today, Planner, Goals, Insights, and Settings
- File-based navigation with Expo Router
- Strict TypeScript configuration
- System-aware light and dark themes
- Indigo, teal, and warm-neutral design tokens
- Reusable screen, card, button, text, empty-state, and section-header components
- Safe-area handling and responsive content widths for phones and larger screens
- Accessible touch targets, semantic colors, scalable typography, and navigation labels
- Original Planora wordmark and branded loading experience
- Android and iOS application identity configuration

## Requirements

- Node.js LTS
- npm
- Expo Go installed on an Android device or iPhone

## Setup

```bash
git clone https://github.com/Nahom-Taye/planora-mobile.git
cd planora-mobile
npm install
```

## Start the application

```bash
npm run start
```

The Expo terminal displays a QR code after the development server starts.

- On Android, open Expo Go and scan the QR code.
- On iPhone, scan the QR code with the Camera application and open it in Expo Go.
- Keep the computer and mobile device on the same network.
- If local network discovery is unavailable, run `npx expo start --tunnel`.

Platform-specific development commands are also available:

```bash
npm run android
npm run ios
npm run web
```

## Project structure

```text
app/                  Route files and navigation layouts
assets/               Local images, fonts, and bundled media
docs/                 Product direction and phased scope
src/
  components/         Reusable brand and interface components
  features/           Feature-owned screens and modules
  hooks/              Shared React hooks
  theme/              Themes, semantic colors, and design tokens
  types/              Shared TypeScript types
  utils/              Shared constants and utilities
```

Routes remain thin and delegate presentation to feature modules. Shared visual rules live in the theme and component layers.

## Verification

Run checks individually:

```bash
npm run typecheck
npm run lint
npm run doctor
```

Run the complete project check:

```bash
npm run check
```

## Product specification

The product vision, navigation map, future domain entities, accessibility expectations, security principles, and ten planned phases are documented in [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
