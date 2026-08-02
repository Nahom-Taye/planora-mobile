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
import { AppThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

function RootNavigator() {
  const theme = useAppTheme();
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

  if (showLaunchScreen) {
    return <BrandedLaunchScreen />;
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <RootNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
