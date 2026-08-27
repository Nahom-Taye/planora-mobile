import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, FormField, Text } from '@/components/ui';
import { toLocalTime } from '@/domain/entities';
import type { WritableCalendar } from '@/features/calendar/services/calendar-device';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useReminders } from '@/providers/reminder-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function ReminderCalendarSettingsSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const reminders = useReminders();
  const settings = localization.settings;
  const [titles, setTitles] = useState(settings?.notificationTitlesEnabled ?? false);
  const [quietEnabled, setQuietEnabled] = useState(settings?.quietHoursEnabled ?? false);
  const [quietStart, setQuietStart] = useState(settings?.quietHoursStart ?? '22:00');
  const [quietEnd, setQuietEnd] = useState(settings?.quietHoursEnd ?? '07:00');
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setTitles(settings.notificationTitlesEnabled);
    setQuietEnabled(settings.quietHoursEnabled);
    setQuietStart(settings.quietHoursStart);
    setQuietEnd(settings.quietHoursEnd);
  }, [settings]);

  const save = async () => {
    try {
      await reminders.saveReminderPreferences({
        notificationTitlesEnabled: titles,
        quietHoursEnabled: quietEnabled,
        quietHoursStart: toLocalTime(quietStart),
        quietHoursEnd: toLocalTime(quietEnd),
      });
      setMessage(localization.t('reminders.settingsSaved'));
    } catch {
      setMessage(localization.t('validation.time'));
    }
  };

  const connectCalendar = async () => {
    const permission =
      reminders.calendarPermission === 'allowed'
        ? 'allowed'
        : await reminders.requestCalendar();
    if (permission === 'allowed') setCalendars(await reminders.listCalendars());
  };

  return (
    <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xxxl }}>
      <Text accessibilityRole="header" variant="heading">{localization.t('reminders.settingsTitle')}</Text>
      <Card style={{ gap: theme.spacing.md }} variant="subtle">
        <Text variant="label">{localization.t('reminders.permissionStatus')}</Text>
        <Text tone="textMuted">
          {localization.t(`reminders.permission${capitalize(reminders.notificationPermission)}` as never)}
        </Text>
        <Text tone="textMuted" variant="caption">{localization.t('reminders.permissionExplanation')}</Text>
        {reminders.notificationPermission !== 'allowed' && reminders.notificationPermission !== 'developmentBuildRequired' ? (
          <Button
            label={localization.t(reminders.notificationPermission === 'blocked' ? 'reminders.openSettings' : 'reminders.allow')}
            onPress={() => reminders.notificationPermission === 'blocked' ? void Linking.openSettings() : void reminders.requestNotifications()}
            variant="secondary"
          />
        ) : null}
      </Card>
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text variant="label">{localization.t('reminders.showTitles')}</Text>
          <Text tone="textMuted" variant="caption">{localization.t('reminders.showTitlesDescription')}</Text>
        </View>
        <Switch accessibilityLabel={localization.t('reminders.showTitles')} onValueChange={setTitles} value={titles} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text variant="label">{localization.t('reminders.quietHours')}</Text>
          <Text tone="textMuted" variant="caption">{localization.t('reminders.quietHoursDescription')}</Text>
        </View>
        <Switch accessibilityLabel={localization.t('reminders.quietHours')} onValueChange={setQuietEnabled} value={quietEnabled} />
      </View>
      {quietEnabled ? (
        <View style={{ gap: theme.spacing.md }}>
          <FormField label={localization.t('reminders.quietStart')} onChangeText={setQuietStart} value={quietStart} />
          <FormField label={localization.t('reminders.quietEnd')} onChangeText={setQuietEnd} value={quietEnd} />
        </View>
      ) : null}
      <Button label={localization.t('common.save')} loading={reminders.busy} onPress={() => void save()} />
      <Button
        label={localization.t('reminders.reconcile')}
        onPress={() => void reminders.reconcile().then((result) => {
          if (result) setMessage(localization.t('reminders.reconcileResult', result));
        })}
        variant="secondary"
      />
      <Text accessibilityLiveRegion="polite" tone="textMuted" variant="caption">{message}</Text>
      <Text accessibilityRole="header" variant="heading">{localization.t('calendar.title')}</Text>
      {Platform.OS === 'web' ? (
        <Card variant="subtle"><Text>{localization.t('calendar.mobileOnly')}</Text></Card>
      ) : (
        <Card style={{ gap: theme.spacing.md }} variant="subtle">
          <Text tone="textMuted">{localization.t('calendar.explanation')}</Text>
          <Text variant="label">
            {settings?.deviceCalendarName
              ? localization.t('calendar.selected', { name: settings.deviceCalendarName })
              : localization.t('calendar.noneSelected')}
          </Text>
          <Button label={localization.t('calendar.choose')} onPress={() => void connectCalendar()} variant="secondary" />
          {calendars.map((calendar) => (
            <Pressable
              accessibilityRole="button"
              key={calendar.id}
              onPress={() => void reminders.selectCalendar({ id: calendar.id, name: calendar.title }).then(() => setCalendars([]))}
              style={styles.calendarRow}
            >
              <Text variant="label">{calendar.title}</Text>
            </Pressable>
          ))}
          {calendars.length === 0 && reminders.calendarPermission === 'allowed' ? (
            <Text tone="textMuted" variant="caption">{localization.t('calendar.noWritable')}</Text>
          ) : null}
          {settings?.deviceCalendarId ? (
            <Button label={localization.t('calendar.disconnect')} onPress={() => void reminders.selectCalendar(null)} variant="ghost" />
          ) : null}
        </Card>
      )}
    </View>
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  calendarRow: { justifyContent: 'center', minHeight: MIN_TOUCH_TARGET },
  copy: { flex: 1 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: MIN_TOUCH_TARGET },
});
