import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import type {
  PlanBlock,
  PlanBlockSeries,
  RecurrenceFrequency,
  Routine,
  Task,
  Weekday,
} from '@/domain/entities';
import type { PlanBlockDraft } from '@/features/planner/services/plan-block-validation';
import type { RecurrenceDraft } from '@/features/planner/services/recurrence';
import { goalForTask } from '@/features/goals/services/goal-task-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

type Submission = {
  block: PlanBlockDraft;
  recurrence: RecurrenceDraft | null;
  editFuture: boolean;
};

export function PlanBlockForm({
  block,
  recurrence,
  initialDate,
  initialTaskId,
  initialTitle,
  tasks,
  routines,
  busy,
  onSubmit,
}: {
  block?: PlanBlock;
  recurrence?: PlanBlockSeries | null;
  initialDate: string;
  initialTaskId?: string | null;
  initialTitle?: string;
  tasks: Task[];
  routines: Routine[];
  busy: boolean;
  onSubmit: (submission: Submission) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const goals = useGoals();
  const [title, setTitle] = useState(block?.title ?? initialTitle ?? '');
  const [notes, setNotes] = useState(block?.notes ?? '');
  const [date, setDate] = useState(block?.date ?? initialDate);
  const [startTime, setStartTime] = useState(block?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(block?.endTime ?? '10:00');
  const [status, setStatus] = useState<PlanBlockDraft['status']>(
    block?.status ?? 'planned',
  );
  const [taskId, setTaskId] = useState<string | null>(
    block?.taskId ?? initialTaskId ?? null,
  );
  const [routineId, setRoutineId] = useState<string | null>(
    block?.routineId ?? null,
  );
  const [repeat, setRepeat] = useState<'none' | RecurrenceFrequency>(
    recurrence?.frequency ?? 'none',
  );
  const [interval, setInterval] = useState(String(recurrence?.interval ?? 1));
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    recurrence?.weekdays ?? [],
  );
  const [endDate, setEndDate] = useState(recurrence?.endDate ?? '');
  const [editFuture, setEditFuture] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (repeat === 'weekly' && weekdays.length === 0) {
      setWeekdays([weekdayForInput(date)]);
    }
  }, [date, repeat, weekdays.length]);

  const submit = async () => {
    if (busy) return;
    setErrors({});
    const blockDraft: PlanBlockDraft = {
      title,
      notes,
      date,
      startTime,
      endTime,
      status,
      taskId,
      routineId,
    };
    const recurrenceDraft: RecurrenceDraft | null =
      repeat === 'none'
        ? null
        : {
            title,
            notes,
            startDate: date,
            startTime,
            endTime,
            frequency: repeat,
            interval: Number(interval),
            weekdays,
            endDate,
            taskId,
            routineId,
          };
    const result = await onSubmit({
      block: blockDraft,
      recurrence: recurrenceDraft,
      editFuture,
    });
    if (!result.ok) setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {block?.seriesId && recurrence ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="label">{localization.t('planner.repeat')}</Text>
          <View accessibilityRole="radiogroup" style={styles.wrap}>
            <Choice
              label={localization.t('planner.editOccurrence')}
              onPress={() => setEditFuture(false)}
              selected={!editFuture}
            />
            <Choice
              label={localization.t('planner.editFuture')}
              onPress={() => setEditFuture(true)}
              selected={editFuture}
            />
          </View>
        </View>
      ) : null}

      <FormField
        autoFocus={!block}
        editable={!busy}
        error={localizedError(errors.title, localization.message)}
        label={localization.t('planner.titleField')}
        maxLength={201}
        onChangeText={setTitle}
        value={title}
      />
      <FormField
        editable={!busy}
        error={localizedError(errors.notes, localization.message)}
        label={localization.t('planner.notesField')}
        maxLength={4001}
        multiline
        onChangeText={setNotes}
        value={notes}
      />
      <View style={styles.fieldRow}>
        <FormField
          autoCapitalize="none"
          editable={!busy}
          error={localizedError(errors.date ?? errors.startDate, localization.message)}
          label={localization.t('planner.date')}
          onChangeText={setDate}
          style={styles.field}
          value={date}
        />
        <FormField
          autoCapitalize="none"
          editable={!busy}
          error={localizedError(errors.startTime, localization.message)}
          label={localization.t('planner.startTime')}
          onChangeText={setStartTime}
          style={styles.field}
          value={startTime}
        />
        <FormField
          autoCapitalize="none"
          editable={!busy}
          error={localizedError(errors.endTime, localization.message)}
          label={localization.t('planner.endTime')}
          onChangeText={setEndTime}
          style={styles.field}
          value={endTime}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{localization.t('planner.statusField')}</Text>
        <View accessibilityRole="radiogroup" style={styles.wrap}>
          {(['planned', 'completed', 'cancelled'] as const).map((value) => (
            <Choice
              key={value}
              label={localization.t(`common.${value}` as 'common.planned')}
              onPress={() => setStatus(value)}
              selected={status === value}
            />
          ))}
        </View>
      </View>

      <LinkChoices
        label={localization.t('planner.linkedTask')}
        noneLabel={localization.t('common.none')}
        onChange={(value) => {
          setTaskId(value);
          if (value) setRoutineId(null);
        }}
        options={tasks.map((task) => {
          const goal = goalForTask(task, goals.goals);
          return {
            id: task.id,
            title: goal
              ? `${task.title} · ${localization.t('goals.linkedGoal', { title: goal.title })}`
              : task.title,
          };
        })}
        value={taskId}
      />
      <LinkChoices
        label={localization.t('planner.linkedRoutine')}
        noneLabel={localization.t('common.none')}
        onChange={(value) => {
          setRoutineId(value);
          if (value) setTaskId(null);
        }}
        options={routines.map((routine) => ({ id: routine.id, title: routine.title }))}
        value={routineId}
      />
      {errors.link || errors.taskId || errors.routineId ? (
        <Text tone="danger" variant="caption">
          {localization.message(errors.link ?? errors.taskId ?? errors.routineId)}
        </Text>
      ) : null}

      {!block || editFuture ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="label">{localization.t('planner.repeat')}</Text>
          <View accessibilityRole="radiogroup" style={styles.wrap}>
            <Choice
              label={localization.t('planner.repeatNone')}
              onPress={() => setRepeat('none')}
              selected={repeat === 'none'}
            />
            <Choice
              label={localization.t('planner.repeatDaily')}
              onPress={() => setRepeat('daily')}
              selected={repeat === 'daily'}
            />
            <Choice
              label={localization.t('planner.repeatWeekly')}
              onPress={() => setRepeat('weekly')}
              selected={repeat === 'weekly'}
            />
          </View>
          {repeat !== 'none' ? (
            <>
              <FormField
                editable={!busy}
                error={localizedError(errors.interval, localization.message)}
                keyboardType="number-pad"
                label={localization.t('planner.repeatInterval')}
                onChangeText={setInterval}
                value={interval}
              />
              {repeat === 'weekly' ? (
                <WeekdayChoices onChange={setWeekdays} value={weekdays} />
              ) : null}
              <FormField
                autoCapitalize="none"
                editable={!busy}
                error={localizedError(errors.endDate, localization.message)}
                label={localization.t('planner.repeatEnd')}
                onChangeText={setEndDate}
                value={endDate}
              />
              <Text tone="textMuted" variant="caption">
                {localization.t('planner.recurrenceBounded')}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      <Button
        label={block ? localization.t('common.save') : localization.t('common.create')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

function LinkChoices({
  label,
  noneLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  noneLabel: string;
  options: { id: string; title: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.wrap}>
        <Choice label={noneLabel} onPress={() => onChange(null)} selected={!value} />
        {options.slice(0, 10).map((option) => (
          <Choice
            key={option.id}
            label={option.title}
            onPress={() => onChange(option.id)}
            selected={value === option.id}
          />
        ))}
      </View>
    </View>
  );
}

function WeekdayChoices({
  value,
  onChange,
}: {
  value: Weekday[];
  onChange: (weekdays: Weekday[]) => void;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{localization.t('routines.weekdays')}</Text>
      <View style={styles.wrap}>
        {([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => (
          <Choice
            key={weekday}
            label={weekdayLabel(weekday, localization.locale)}
            onPress={() =>
              onChange(
                value.includes(weekday)
                  ? value.filter((item) => item !== weekday)
                  : [...value, weekday].sort(),
              )
            }
            selected={value.includes(weekday)}
          />
        ))}
      </View>
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
          borderColor: selected ? theme.colors.accent : theme.colors.border,
          borderRadius: theme.radii.pill,
        },
      ]}
    >
      <Text numberOfLines={2} tone={selected ? 'primary' : 'textMuted'} variant="caption">
        {label}
      </Text>
    </Pressable>
  );
}

function weekdayForInput(value: string): Weekday {
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return (Number.isNaN(date.getTime()) ? 1 : date.getUTCDay()) as Weekday;
}

function weekdayLabel(weekday: Weekday, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2024, 0, 7 + weekday)),
  );
}

function localizedError(
  error: string | undefined,
  message: (value: string | null | undefined) => string,
) {
  return error ? message(error) : undefined;
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  field: { minWidth: 112 },
  fieldRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
