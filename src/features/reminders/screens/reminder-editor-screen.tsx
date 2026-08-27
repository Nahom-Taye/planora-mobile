import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, FormField, Screen, Text } from '@/components/ui';
import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  type ReminderEntityType,
  type ReminderIntent,
} from '@/domain/entities';
import { SegmentedControl } from '@/features/insights/components/segmented-control';
import { addCalendarDays, localDateTimeInstant } from '@/features/planner/services/calendar-math';
import { localCalendarDate } from '@/features/today/services/local-date';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanner } from '@/providers/planner-provider';
import { usePlanning } from '@/providers/planning-provider';
import { useReminders } from '@/providers/reminder-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function ReminderEditorScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const params = useLocalSearchParams<{ entityType?: string; entityId?: string }>();
  const planning = usePlanning();
  const planner = usePlanner();
  const goals = useGoals();
  const workspace = useWorkspace();
  const reminders = useReminders();
  const entityType = validEntityType(params.entityType);
  const entityId = params.entityId ?? '';
  const source =
    entityType === 'task'
      ? planning.getTask(entityId)
      : entityType === 'plan_block'
        ? planner.getBlock(entityId)
        : entityType === 'routine'
          ? planning.getRoutine(entityId)
          : entityType === 'goal'
            ? goals.getGoal(entityId)
            : null;
  const supportsRelative = Boolean(
    source &&
      (entityType === 'plan_block' ||
        (entityType === 'task' && source && 'dueDate' in source && source.dueDate && source.scheduledTime) ||
        (entityType === 'routine' && source && 'schedule' in source && source.schedule.time) ||
        (entityType === 'goal' && source && 'targetDate' in source && source.targetDate)),
  );
  const [intent, setIntent] = useState<ReminderIntent | null>(null);
  const [triggerKind, setTriggerKind] = useState<ReminderIntent['triggerKind']>(
    supportsRelative ? 'relative' : 'absolute',
  );
  const [offsetMinutes, setOffsetMinutes] = useState(15);
  const defaultDate = workspace.profile
    ? addCalendarDays(localCalendarDate(new Date(), workspace.profile.timeZone), 1)
    : '';
  const [absoluteDate, setAbsoluteDate] = useState(defaultDate);
  const [absoluteTime, setAbsoluteTime] = useState('09:00');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!entityType || !entityId) return;
    void reminders.reminderFor(entityType, entityId).then((existing) => {
      setIntent(existing);
      if (!existing) return;
      setTriggerKind(existing.triggerKind);
      setOffsetMinutes(existing.offsetMinutes ?? 15);
      setEnabled(existing.enabled);
      if (existing.absoluteAt && workspace.profile) {
        const local = localParts(new Date(existing.absoluteAt), workspace.profile.timeZone);
        setAbsoluteDate(local.date);
        setAbsoluteTime(local.time);
      }
    });
  }, [entityId, entityType, reminders, workspace.profile]);

  const upcoming = useMemo(
    () =>
      intent
        ? reminders.schedules
            .filter((item) => item.reminderIntentId === intent.id)
            .sort((left, right) => (left.scheduledFor ?? '').localeCompare(right.scheduledFor ?? ''))[0]
        : null,
    [intent, reminders.schedules],
  );

  if (!entityType || !source || !workspace.profile) {
    return (
      <Screen>
        <Header onBack={() => goBackOrReplace(router, '/(tabs)')} title={localization.t('reminders.title')} />
        <Card variant="subtle">
          <Text variant="heading">{localization.t('reminders.unavailable')}</Text>
          <Text tone="textMuted">{localization.t('reminders.unavailableDescription')}</Text>
        </Card>
      </Screen>
    );
  }

  const save = async () => {
    let absoluteAt: string | null = null;
    if (triggerKind === 'absolute') {
      try {
        absoluteAt = toInstant(
          localDateTimeInstant(
            toCalendarDate(absoluteDate),
            toLocalTime(absoluteTime),
            workspace.profile!.timeZone,
          ),
        );
      } catch {
        absoluteAt = absoluteDate;
      }
    }
    const saved = await reminders.saveReminder({
      entityType,
      entityId,
      triggerKind,
      offsetMinutes: triggerKind === 'relative' ? offsetMinutes : null,
      absoluteAt,
      enabled,
    });
    if (saved) goBackOrReplace(router, '/(tabs)');
  };

  return (
    <Screen testID="reminder-editor-screen">
      <Header onBack={() => goBackOrReplace(router, '/(tabs)')} title={localization.t('reminders.title')} />
      <Card style={{ gap: theme.spacing.sm }} variant="subtle">
        <Text variant="heading">{source.title}</Text>
        <Text tone="textMuted">{localization.t('reminders.permissionExplanation')}</Text>
      </Card>
      {reminders.notificationPermission !== 'allowed' ? (
        <Card style={{ gap: theme.spacing.md }}>
          <Text variant="label">
            {localization.t(`reminders.permission${capitalize(reminders.notificationPermission)}` as never)}
          </Text>
          {reminders.notificationPermission !== 'developmentBuildRequired' ? (
            <Button
              label={localization.t(
                reminders.notificationPermission === 'blocked'
                  ? 'reminders.openSettings'
                  : 'reminders.allow',
              )}
              onPress={() =>
                reminders.notificationPermission === 'blocked'
                  ? void Linking.openSettings()
                  : void reminders.requestNotifications()
              }
            />
          ) : null}
        </Card>
      ) : null}
      <View style={styles.switchRow}>
        <View style={styles.copy}>
          <Text variant="label">{localization.t('reminders.enabled')}</Text>
          <Text tone="textMuted" variant="caption">{localization.t('reminders.deliveryNote')}</Text>
        </View>
        <Switch accessibilityLabel={localization.t('reminders.enabled')} onValueChange={setEnabled} value={enabled} />
      </View>
      <SegmentedControl
        label={localization.t('reminders.timing')}
        onChange={setTriggerKind}
        options={supportsRelative
          ? [
              { value: 'relative', label: localization.t('reminders.relative') },
              { value: 'absolute', label: localization.t('reminders.absolute') },
            ]
          : [{ value: 'absolute', label: localization.t('reminders.absolute') }]}
        value={triggerKind}
      />
      {triggerKind === 'relative' ? (
        <SegmentedControl
          label={localization.t('reminders.offset')}
          onChange={(value) => setOffsetMinutes(Number(value))}
          options={[
            { value: '0', label: localization.t('reminders.atTime') },
            { value: '15', label: localization.t('reminders.before15') },
            { value: '60', label: localization.t('reminders.before60') },
            { value: '1440', label: localization.t('reminders.beforeDay') },
          ]}
          value={String(offsetMinutes)}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          <FormField label={localization.t('reminders.date')} onChangeText={setAbsoluteDate} value={absoluteDate} />
          <FormField label={localization.t('reminders.time')} onChangeText={setAbsoluteTime} value={absoluteTime} />
        </View>
      )}
      {upcoming ? (
        <Card variant="subtle">
          <Text variant="label">{localization.t('reminders.upcoming')}</Text>
          <Text tone="textMuted">
            {upcoming.state === 'scheduled' && upcoming.scheduledFor
              ? new Intl.DateTimeFormat(localization.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(upcoming.scheduledFor))
              : localization.t(`reminders.reason${capitalize(upcoming.reason ?? 'schedule_failed')}` as never)}
          </Text>
        </Card>
      ) : null}
      {reminders.statusMessage ? <Text accessibilityLiveRegion="polite" tone="danger">{localization.message(reminders.statusMessage)}</Text> : null}
      <Button label={localization.t('common.save')} loading={reminders.busy} onPress={() => void save()} />
    </Screen>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel={localization.t('common.goBack')} accessibilityRole="button" onPress={onBack} style={styles.iconButton}>
        <Ionicons color={theme.colors.text} name={localization.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.copy} variant="heading">{title}</Text>
      <View style={styles.iconButton} />
    </View>
  );
}

function validEntityType(value?: string): ReminderEntityType | null {
  return value === 'task' || value === 'plan_block' || value === 'routine' || value === 'goal' ? value : null;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  copy: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 24 },
  iconButton: { alignItems: 'center', height: MIN_TOUCH_TARGET, justifyContent: 'center', width: MIN_TOUCH_TARGET },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: MIN_TOUCH_TARGET },
});
