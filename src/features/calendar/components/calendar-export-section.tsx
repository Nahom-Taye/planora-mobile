import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import type { DeviceCalendarEvent, PlanBlock } from '@/domain/entities';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useReminders } from '@/providers/reminder-provider';

export function CalendarExportSection({ block }: { block: PlanBlock }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const reminders = useReminders();
  const [mapping, setMapping] = useState<DeviceCalendarEvent | null>(null);

  const refresh = useCallback(
    () => reminders.calendarMappingFor(block).then(setMapping),
    [block, reminders],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exportBlock = async (force = false) => {
    if (reminders.calendarPermission !== 'allowed') {
      const permission = await reminders.requestCalendar();
      if (permission !== 'allowed') return;
    }
    await reminders.exportBlock(block, force);
    await refresh();
  };

  const remove = () => {
    if (!mapping) return;
    Alert.alert(
      localization.t('calendar.removeTitle'),
      localization.t('calendar.removeDescription'),
      [
        { text: localization.t('common.cancel'), style: 'cancel' },
        {
          text: localization.t('calendar.keepExternal'),
          onPress: () => void reminders.removeCalendarMapping(mapping, false).then(refresh),
        },
        {
          text: localization.t('calendar.removeBoth'),
          style: 'destructive',
          onPress: () => void reminders.removeCalendarMapping(mapping, true).then(refresh),
        },
      ],
    );
  };

  return (
    <Card style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }} variant="subtle">
      <Text accessibilityRole="header" variant="heading">{localization.t('calendar.exportTitle')}</Text>
      <Text tone="textMuted">{localization.t('calendar.exportDescription')}</Text>
      {localization.settings?.deviceCalendarName ? (
        <Text variant="label">
          {localization.t('calendar.selected', { name: localization.settings.deviceCalendarName })}
        </Text>
      ) : (
        <Text tone="warning">{localization.t('calendar.chooseInSettings')}</Text>
      )}
      {reminders.calendarConflict ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text tone="warning">
            {localization.t(
              reminders.calendarConflict === 'missing'
                ? 'calendar.missingConflict'
                : 'calendar.changedConflict',
            )}
          </Text>
          <Button
            label={localization.t(
              reminders.calendarConflict === 'missing'
                ? 'calendar.createAgain'
                : 'calendar.replaceExternal',
            )}
            onPress={() => void exportBlock(true)}
            variant="secondary"
          />
        </View>
      ) : null}
      {localization.settings?.deviceCalendarId ? (
        <Button
          label={localization.t(mapping ? 'calendar.updateExport' : 'calendar.export')}
          loading={reminders.busy}
          onPress={() => void exportBlock()}
          variant="secondary"
        />
      ) : null}
      {mapping ? <Button label={localization.t('calendar.removeExport')} onPress={remove} variant="ghost" /> : null}
      {reminders.statusMessage ? <Text accessibilityLiveRegion="polite" tone="danger">{localization.message(reminders.statusMessage)}</Text> : null}
    </Card>
  );
}
