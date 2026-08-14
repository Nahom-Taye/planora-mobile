import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useLocalization } from '@/providers/localization-provider';

export function NotificationFallbackScreen() {
  const localization = useLocalization();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  return (
    <Screen contentStyle={{ justifyContent: 'center' }} testID="notification-fallback-screen">
      <Card>
        <Text accessibilityRole="header" variant="heading">{localization.t('reminders.fallbackTitle')}</Text>
        <Text tone="textMuted">
          {localization.t(reason === 'missing' ? 'reminders.fallbackMissing' : 'reminders.fallbackMalformed')}
        </Text>
        <Button label={localization.t('common.today')} onPress={() => router.replace('/')} />
      </Card>
    </Screen>
  );
}
