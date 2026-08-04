import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Card, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { AccountSettingsSection } from '@/features/account';
import { DataStorageSection } from '@/features/storage';
import { useAppTheme } from '@/hooks/use-app-theme';

export function SettingsScreen() {
  const theme = useAppTheme();

  return (
    <Screen safeAreaEdges={['top', 'right', 'left']} testID="settings-screen">
      <BrandWordmark compact markSize={32} />
      <View style={{ height: theme.spacing.xxxl }} />
      <SectionHeader
        description="Personalize how Planora looks and behaves, with accessible defaults from the start."
        eyebrow="YOUR SPACE"
        title="Settings"
      />
      <AccountSettingsSection />
      <DataStorageSection />
      <Card style={{ marginTop: theme.spacing.xxl }}>
        <EmptyState
          description="More preferences and data controls will appear only when their supporting features exist."
          icon={
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Ionicons
                color={theme.colors.primary}
                name="options-outline"
                size={30}
              />
            </View>
          }
          title="Your preferences will live here"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
});
