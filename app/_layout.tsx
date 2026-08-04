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
import { useAppTheme } from '@/hooks/use-app-theme';
import { StorageInitializationError } from '@/features/storage/components/storage-initialization-error';
import { AccountProvider, useAccount } from '@/providers/account-provider';
import { OnboardingProvider, useOnboarding } from '@/providers/onboarding-provider';
import { StorageProvider, useStorage } from '@/providers/storage-provider';
import { AppThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

function RootNavigator() {
  const theme = useAppTheme();
  const storage = useStorage();
  const onboarding = useOnboarding();
  const account = useAccount();
  const [showLaunchScreen, setShowLaunchScreen] = useState(true);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const launchTimer = setTimeout(() => setShowLaunchScreen(false), 550);

    return () => clearTimeout(launchTimer);
  }, []);

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
    storage.status !== 'ready' ||
    onboarding.status === 'loading'
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
            ? 'Preparing local storage.'
            : 'Loading your preferences.'
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

  const onboardingComplete = onboarding.status === 'complete';
  const accountAvailable =
    account.status === 'signed_in' || account.status === 'recovering';

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!onboardingComplete || onboarding.isReviewing}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingComplete && !accountAvailable}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingComplete && accountAvailable}>
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
      <AppThemeProvider>
        <StorageProvider>
          <StorageBackedApplication />
        </StorageProvider>
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}

function StorageBackedApplication() {
  const storage = useStorage();

  return (
    <OnboardingProvider repositories={storage.repositories}>
      <AccountProvider>
        <RootNavigator />
      </AccountProvider>
    </OnboardingProvider>
  );
}
