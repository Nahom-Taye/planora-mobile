import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ScrollView, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Screen, SectionHeader } from '@/components/ui';
import { AccountSettingsSection } from '@/features/account';
import { DataStorageSection } from '@/features/storage';
import { PrivacyDataSection } from '@/features/sync';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { LanguageSettingsSection } from '../components/language-settings-section';
import { PlanningPreferencesSection } from '../components/planning-preferences-section';
import { ReminderCalendarSettingsSection } from '../components/reminder-calendar-settings-section';

export function SettingsScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const params = useLocalSearchParams<{ section?: string; ts?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});
  const section = typeof params.section === 'string' ? params.section : undefined;
  const requestId = typeof params.ts === 'string' ? params.ts : undefined;

  useEffect(() => {
    if (!section) return;
    // Wait one frame batch so section layouts are measured before scrolling.
    const timer = setTimeout(() => {
      const y = sectionPositions.current[section];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [section, requestId]);

  const registerSection = (name: string) => (event: { nativeEvent: { layout: { y: number } } }) => {
    sectionPositions.current[name] = event.nativeEvent.layout.y;
  };

  return (
    <Screen
      safeAreaEdges={['top', 'right', 'left']}
      scrollRef={scrollRef}
      testID="settings-screen"
    >
      <BrandWordmark compact markSize={32} />
      <View style={{ height: theme.spacing.xl }} />
      <SectionHeader
        description={localization.t('settings.description')}
        eyebrow={localization.t('settings.eyebrow')}
        title={localization.t('settings.title')}
      />
      <View onLayout={registerSection('language')}>
        <LanguageSettingsSection />
      </View>
      <PlanningPreferencesSection />
      <View onLayout={registerSection('reminders')}>
        <ReminderCalendarSettingsSection />
      </View>
      <View onLayout={registerSection('account')}>
        <AccountSettingsSection />
      </View>
      <PrivacyDataSection />
      <DataStorageSection />
    </Screen>
  );
}
