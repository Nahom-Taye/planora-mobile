import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import type { Routine, RoutineStatus, Weekday } from '@/domain/entities';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

import type { RoutineDraft } from '../services/routine-validation';

export function RoutineForm({
  routine,
  busy,
  onSubmit,
}: {
  routine?: Routine;
  busy: boolean;
  onSubmit: (draft: RoutineDraft) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const weekdayOptions: { value: Weekday; label: string }[] = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((value) => ({
    value,
    label: localization.formatDate(`2024-01-${String(7 + value).padStart(2, '0')}`, { weekday: 'short' }),
  }));
  const [title, setTitle] = useState(routine?.title ?? '');
  const [notes, setNotes] = useState(routine?.notes ?? '');
  const [scheduleKind, setScheduleKind] = useState<'daily' | 'weekly'>(
    routine?.schedule.kind ?? 'daily',
  );
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    routine?.schedule.kind === 'weekly' ? routine.schedule.weekdays : [],
  );
  const [time, setTime] = useState(routine?.schedule.time ?? '');
  const [status, setStatus] = useState<RoutineStatus>(routine?.status ?? 'active');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateText = (
    field: string,
    setter: (value: string) => void,
    value: string,
  ) => {
    setter(value);
    if (!errors[field]) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const submit = async () => {
    const result = await onSubmit({ title, notes, scheduleKind, weekdays, time, status });
    setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <FormField autoFocus editable={!busy} error={localization.message(errors.title) || undefined} label={localization.t('tasks.titleField')} maxLength={201} onChangeText={(value) => updateText('title', setTitle, value)} value={title} />
      <FormField editable={!busy} error={localization.message(errors.notes) || undefined} label={localization.t('tasks.notesField')} maxLength={4001} multiline onChangeText={(value) => updateText('notes', setNotes, value)} value={notes} />
      <Text variant="label">{localization.t('routines.schedule')}</Text>
      <View accessibilityRole="radiogroup" style={[styles.row, { gap: theme.spacing.sm }]}>
        <Choice busy={busy} label={localization.t('routines.everyDay')} role="radio" selected={scheduleKind === 'daily'} onPress={() => setScheduleKind('daily')} />
        <Choice busy={busy} label={localization.t('routines.selectedDays')} role="radio" selected={scheduleKind === 'weekly'} onPress={() => setScheduleKind('weekly')} />
      </View>
      {scheduleKind === 'weekly' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label">{localization.t('routines.weekdays')}</Text>
          <View style={[styles.row, { gap: theme.spacing.xs }]}>
            {weekdayOptions.map((option) => (
              <Choice
                busy={busy}
                key={option.value}
                label={option.label}
                selected={weekdays.includes(option.value)}
                onPress={() =>
                  setWeekdays((values) =>
                    values.includes(option.value)
                      ? values.filter((value) => value !== option.value)
                      : [...values, option.value],
                  )
                }
              />
            ))}
          </View>
          {errors.weekdays ? <Text tone="danger" variant="caption">{localization.message(errors.weekdays)}</Text> : null}
        </View>
      ) : null}
      <FormField
        error={localization.message(errors.time) || undefined}
        hint={localization.t('tasks.timeHint')}
        keyboardType="numbers-and-punctuation"
        label={localization.t('routines.preferredTime')}
        editable={!busy}
        onChangeText={(value) => updateText('time', setTime, value)}
        placeholder="07:30"
        value={time}
      />
      {routine ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label">{localization.t('routines.state')}</Text>
          <View accessibilityRole="radiogroup" style={[styles.row, { gap: theme.spacing.sm }]}>
            {(['active', 'paused', 'archived'] as RoutineStatus[]).map((value) => (
              <Choice
                busy={busy}
                key={value}
                label={localization.t(`common.${value}` as 'common.active' | 'common.paused' | 'common.archived')}
                role="radio"
                selected={status === value}
                onPress={() => setStatus(value)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Button
        label={localization.t(routine ? 'common.save' : 'routines.createAction')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
  busy,
  role = 'checkbox',
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  busy: boolean;
  role?: 'checkbox' | 'radio';
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={role}
      accessibilityState={{ checked: selected, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.pill,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text tone={selected ? 'primary' : 'textMuted'} variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
