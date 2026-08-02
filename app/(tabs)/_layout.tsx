import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';

import { useAppTheme } from '@/hooks/use-app-theme';
import type { MainTabName } from '@/types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<MainTabName, IconName> = {
  index: 'sunny-outline',
  planner: 'calendar-clear-outline',
  goals: 'flag-outline',
  insights: 'bar-chart-outline',
  settings: 'settings-outline',
};

export default function TabLayout() {
  const theme = useAppTheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            color={color}
            name={TAB_ICONS[route.name as MainTabName]}
            size={size}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.divider,
          minHeight: 64,
          paddingTop: 6,
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="planner" options={{ title: 'Planner' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
