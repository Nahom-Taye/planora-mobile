import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, FormField, Text } from '@/components/ui';
import { PlanningPreferencesService } from '@/features/settings/services/planning-preferences-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useStorage } from '@/providers/storage-provider';
import { useWorkspace } from '@/providers/workspace-provider';

export function PlanningPreferencesSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const storage = useStorage();
  const workspace = useWorkspace();
  const [capacity, setCapacity] = useState(
    String(localization.settings?.dailyPlanningCapacityMinutes ?? 480),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minutes = Number(capacity);
    if (!Number.isInteger(minutes) || minutes < 30 || minutes > 1440) {
      setError(localization.t('validation.capacity'));
      return;
    }
    if (!storage.repositories || !workspace.profile || saving) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const service = new PlanningPreferencesService(storage.repositories);
      const settings = await service.get(workspace.profile.id);
      if (!settings) throw new Error('missing');
      await service.setCapacity(settings, minutes);
      await localization.refresh();
      setSaved(true);
    } catch {
      setError(localization.t('errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading">{localization.t('settings.planning')}</Text>
        <Text tone="textMuted" variant="caption">
          {localization.t('settings.planningDescription')}
        </Text>
      </View>
      <Card>
        <View style={styles.form}>
          <FormField
            error={error ?? undefined}
            hint={localization.t('settings.capacityHint')}
            keyboardType="number-pad"
            label={localization.t('settings.capacity')}
            onChangeText={(value) => {
              setCapacity(value);
              setError(null);
              setSaved(false);
            }}
            value={capacity}
          />
          <Button
            label={localization.t('settings.saveCapacity')}
            loading={saving}
            onPress={() => void save()}
          />
          {saved ? (
            <Text accessibilityLiveRegion="polite" tone="success" variant="caption">
              {localization.t('settings.saved')}
            </Text>
          ) : null}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: 16 } });
