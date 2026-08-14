import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandedLaunchScreen } from '@/components/brand';
import { StorageInitializationError } from '@/features/storage/components/storage-initialization-error';
import { useAppTheme } from '@/hooks/use-app-theme';
import { AccountProvider, useAccount } from '@/providers/account-provider';
import { AppEntryProvider, useAppEntry } from '@/providers/app-entry-provider';
import { LocalizationProvider, useLocalization } from '@/providers/localization-provider';
import { GoalProvider } from '@/providers/goal-provider';
import { InsightsProvider } from '@/providers/insights-provider';
import { OnboardingProvider, useOnboarding } from '@/providers/onboarding-provider';
import { PlanningProvider } from '@/providers/planning-provider';
import { PlannerProvider } from '@/providers/planner-provider';
import { ReminderProvider } from '@/providers/reminder-provider';
import { StorageProvider, useStorage } from '@/providers/storage-provider';
import { WorkspaceProvider, useWorkspace } from '@/providers/workspace-provider';
import { AppThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

function RootNavigator() {
  const theme = useAppTheme();
  const storage = useStorage();
  const onboarding = useOnboarding();
  const account = useAccount();
  const appEntry = useAppEntry();
  const workspace = useWorkspace();
  const localization = useLocalization();
  const refreshLocalization = localization.refresh;
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const launchTimer = setTimeout(() => setShowLaunchScreen(false), 550);

    return () => clearTimeout(launchTimer);
  }, []);

  useEffect(() => {
    if (onboarding.status === 'complete') void refreshLocalization();
  }, [onboarding.status, refreshLocalization]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const baseTheme = theme.isDark ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        background: theme.colors.background,
        border: theme.colors.border,
        card: theme.colors.surface,
        notification: theme.colors.accent,
        primary: theme.colors.primary,
        text: theme.colors.text,
      },
    };
  }, [theme]);

  if (
    showLaunchScreen ||
    !localization.fontsReady ||
    storage.status !== 'ready' ||
    onboarding.status === 'loading' ||
    account.status === 'restoring'
  ) {
    if (storage.status === 'error') {
      return (
        <StorageInitializationError
          message={storage.errorMessage}
          onRetry={storage.retry}
        />
      );
    }

    return (
      <BrandedLaunchScreen
        message={
          storage.status !== 'ready'
            ? localization.t('launch.storage')
            : account.status === 'restoring'
              ? localization.t('launch.account')
              : localization.t('launch.preferences')
        }
      />
    );
  }

  if (onboarding.status === 'error') {
    return (
      <StorageInitializationError
        message={onboarding.errorMessage}
        onRetry={onboarding.retry}
      />
    );
  }

  if (workspace.status === 'error' && appEntry.accessGranted) {
    return (
      <StorageInitializationError
        message={workspace.errorMessage}
        onRetry={workspace.retry}
      />
    );
  }

  const planningRequired =
    appEntry.accessGranted &&
    onboarding.status === 'complete' &&
    !onboarding.isReviewing;

  if (planningRequired && workspace.status !== 'ready') {
    return <BrandedLaunchScreen message={localization.t('launch.workspace')} />;
  }

  const onboardingComplete = onboarding.status === 'complete';
  const accountAvailable =
    account.status === 'signed_in' || account.status === 'recovering';

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack initialRouteName="(auth)" screenOptions={{ headerShown: false }}>
        <Stack.Protected
          guard={
            appEntry.accessGranted &&
            (!onboardingComplete || onboarding.isReviewing)
          }
        >
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected
          guard={appEntry.accessGranted && onboardingComplete}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(tasks)" />
          <Stack.Screen name="(routines)" />
          <Stack.Screen name="(planner)" />
          <Stack.Screen name="(goals)" />
          <Stack.Screen name="(insights)" />
          <Stack.Screen name="(reminders)" />
        </Stack.Protected>
        <Stack.Protected guard={!accountAvailable}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected
          guard={onboardingComplete && accountAvailable}
        >
          <Stack.Screen name="(account)" />
        </Stack.Protected>
        <Stack.Screen name="(recovery)" />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StorageProvider>
        <LocalizedApplication />
      </StorageProvider>
    </SafeAreaProvider>
  );
}

function LocalizedApplication() {
  const storage = useStorage();

  return (
    <LocalizationProvider repositories={storage.repositories}>
      <AppThemeProvider>
        <StorageBackedApplication />
      </AppThemeProvider>
    </LocalizationProvider>
  );
}

function StorageBackedApplication() {
  const storage = useStorage();

  return (
    <OnboardingProvider repositories={storage.repositories}>
      <AccountProvider>
        <AppEntryProvider>
          <WorkspaceProvider repositories={storage.repositories}>
            <PlanningProvider repositories={storage.repositories}>
              <GoalProvider repositories={storage.repositories}>
                <PlannerProvider repositories={storage.repositories}>
                  <InsightsProvider repositories={storage.repositories}>
                    <ReminderProvider repositories={storage.repositories}>
                      <RootNavigator />
                    </ReminderProvider>
                  </InsightsProvider>
                </PlannerProvider>
              </GoalProvider>
            </PlanningProvider>
          </WorkspaceProvider>
        </AppEntryProvider>
      </AccountProvider>
    </OnboardingProvider>
  );
}
