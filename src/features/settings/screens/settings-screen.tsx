import { View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Screen, SectionHeader } from '@/components/ui';
import { AccountSettingsSection } from '@/features/account';
import { DataStorageSection } from '@/features/storage';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { LanguageSettingsSection } from '../components/language-settings-section';
import { PlanningPreferencesSection } from '../components/planning-preferences-section';

export function SettingsScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <Screen safeAreaEdges={['top', 'right', 'left']} testID="settings-screen">
      <BrandWordmark compact markSize={32} />
      <View style={{ height: theme.spacing.xxxl }} />
      <SectionHeader
        description={localization.t('settings.description')}
        eyebrow={localization.t('settings.eyebrow')}
        title={localization.t('settings.title')}
      />
      <LanguageSettingsSection />
      <PlanningPreferencesSection />
      <AccountSettingsSection />
      <DataStorageSection />
    </Screen>
  );
}
