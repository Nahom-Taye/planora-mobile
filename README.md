# Planora

Planora is a cross-platform mobile application for organizing daily tasks, planning schedules, managing goals, and reviewing personal progress.

The application is designed for Android and iOS with a clean interface, responsive layouts, accessible controls, and light and dark themes.

## Features

- Daily task organization
- Weekly and monthly planning
- Goal and milestone tracking
- Productivity insights
- Personal settings
- Light and dark themes
- Responsive mobile layouts
- Accessible navigation and controls

## Technology

- React Native
- Expo
- Expo Router
- TypeScript
- npm

## Getting started

### Requirements

- Node.js LTS
- npm
- Expo Go on an Android device or iPhone

### Installation

```bash
git clone https://github.com/Nahom-Taye/planora-mobile.git
cd planora-mobile
npm install
```

### Run the application

```bash
npm run start
```

Scan the displayed QR code using Expo Go on Android or the Camera application on iPhone.

The computer and mobile device should be connected to the same network. If the connection is unavailable, use:

```bash
npx expo start --tunnel
```

## Development commands

```bash
npm run start
npm run android
npm run ios
npm run web
npm run typecheck
npm run lint
npm run doctor
npm run check
```

## Project structure

```text
app/                  Navigation and application routes
assets/               Images, fonts, and bundled media
docs/                 Product documentation
src/
  components/         Shared interface components
  features/           Application features and screens
  hooks/              Shared React hooks
  theme/              Colors, typography, and themes
  types/              Shared TypeScript definitions
  utils/              Shared utilities and constants
```

## Planned development

Planora will continue to expand with complete task management, recurring plans, habits, reminders, focus sessions, calendar views, progress reports, offline storage, account synchronization, and additional personalization options.

## Repository

Developed and maintained by [Nahom Taye](https://github.com/Nahom-Taye).
