import { useRouter, type Href } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useSync } from '@/providers/sync-provider';

export function PrivacyDataSection() {
  const router = useRouter();
  const theme = useAppTheme();
  const localization = useLocalization();
  const sync = useSync();
  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading">{localization.t('sync.settingsTitle')}</Text>
        <Text tone="textMuted" variant="caption">{localization.t('sync.settingsDescription')}</Text>
      </View>
      <Card>
        <Text variant="label">{localization.t(sync.binding?.enabled ? 'sync.enabled' : 'sync.localOnly')}</Text>
        <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted" variant="caption">{localization.t('sync.localFirst')}</Text>
        <Button label={localization.t('sync.manage')} onPress={() => router.push('/(sync)/data' as Href)} style={{ marginTop: theme.spacing.lg }} />
      </Card>
    </View>
  );
}
