import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

type StorageInitializationErrorProps = {
  message: string | null;
  onRetry: () => Promise<void>;
};

export function StorageInitializationError({
  message,
  onRetry,
}: StorageInitializationErrorProps) {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <Screen
      contentStyle={styles.screenContent}
      scroll={false}
      testID="storage-error-screen"
    >
      <BrandWordmark />
      <Card style={[styles.card, { marginTop: theme.spacing.xxxl }]}>
        <View
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={[styles.content, { gap: theme.spacing.lg }]}
        >
          <View
            style={[
              styles.icon,
              {
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.primary}
              name="cloud-offline-outline"
              size={30}
            />
          </View>
          <View style={{ gap: theme.spacing.sm }}>
            <Text align="center" variant="heading">
              {localization.t('storage.errorTitle')}
            </Text>
            <Text align="center" tone="textMuted">
              {localization.message(message) || localization.t('errors.workspace')}
            </Text>
          </View>
          <Button
            accessibilityLabel={localization.t('storage.retryLabel')}
            label={localization.t('common.retry')}
            onPress={() => void onRetry()}
            style={styles.button}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    justifyContent: 'center',
    paddingBottom: 24,
  },
  card: {
    width: '100%',
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  button: {
    alignSelf: 'stretch',
  },
});
