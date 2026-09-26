import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { type ComponentProps } from 'react';
import { View } from 'react-native';

import { FeatureErrorBoundary } from '@/features/recovery';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import type { MainTabName } from '@/types/navigation';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<MainTabName, IconName> = {
  index: 'sunny-outline',
  planner: 'calendar-clear-outline',
  goals: 'flag-outline',
  insights: 'bar-chart-outline',
  settings: 'settings-outline',
};

const ACTIVE_TAB_ICONS: Record<MainTabName, IconName> = {
  index: 'sunny',
  planner: 'calendar-clear',
  goals: 'flag',
  insights: 'bar-chart',
  settings: 'settings',
};

export default function TabLayout() {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <FeatureErrorBoundary area="today">
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.background },
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarHideOnKeyboard: true,
          tabBarIcon: ({ color, focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 54, height: 32, borderRadius: 16, backgroundColor: focused ? theme.colors.primarySoft : 'transparent' }}>
            <Ionicons
              color={color}
              name={(focused ? ACTIVE_TAB_ICONS : TAB_ICONS)[route.name as MainTabName]}
              size={22}
            />
            </View>
          ),
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: theme.typography.label.fontFamily,
            fontWeight: '600',
            marginBottom: 2,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.tabBar,
            borderTopColor: theme.colors.divider,
            borderTopWidth: 0,
            minHeight: 70,
            paddingTop: 8,
            elevation: 12,
            shadowColor: theme.colors.overlay,
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: localization.t('tabs.today') }} />
        <Tabs.Screen name="planner" options={{ title: localization.t('tabs.planner') }} />
        <Tabs.Screen name="goals" options={{ title: localization.t('tabs.goals') }} />
        <Tabs.Screen name="insights" options={{ title: localization.t('tabs.insights') }} />
        <Tabs.Screen name="settings" options={{ title: localization.t('tabs.settings') }} />
      </Tabs>
    </FeatureErrorBoundary>
  );
}
