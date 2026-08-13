import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import type { Task, TaskPriority, TaskStatus } from '@/domain/entities';
import type { TaskDraft } from '@/features/tasks/services/task-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

type TaskFormProps = {
  task?: Task;
  initialDate?: string;
  busy: boolean;
  onSubmit: (draft: TaskDraft) => Promise<{
    ok: boolean;
    fieldErrors?: Record<string, string>;
  }>;
};

export function TaskForm({ task, initialDate = '', busy, onSubmit }: TaskFormProps) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const priorities: { value: TaskPriority; label: string }[] = [
    { value: 'none', label: localization.t('tasks.priorityNone') },
    { value: 'low', label: localization.t('tasks.priorityLow') },
    { value: 'medium', label: localization.t('tasks.priorityMedium') },
    { value: 'high', label: localization.t('tasks.priorityHigh') },
  ];
  const statuses: { value: TaskStatus; label: string }[] = [
    { value: 'pending', label: localization.t('common.pending') },
    { value: 'in_progress', label: localization.t('common.inProgress') },
    { value: 'completed', label: localization.t('common.completed') },
    { value: 'cancelled', label: localization.t('common.cancelled') },
  ];
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'none');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? initialDate);
  const [scheduledTime, setScheduledTime] = useState(task?.scheduledTime ?? '');
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
    const result = await onSubmit({ title, notes, priority, status, dueDate, scheduledTime });
    setErrors(result.fieldErrors ?? {});
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <FormField
        autoFocus
        error={localization.message(errors.title) || undefined}
        label={localization.t('tasks.titleField')}
        maxLength={201}
        editable={!busy}
        onChangeText={(value) => updateText('title', setTitle, value)}
        returnKeyType="next"
        value={title}
      />
      <FormField
        error={localization.message(errors.notes) || undefined}
        label={localization.t('tasks.notesField')}
        maxLength={4001}
        multiline
        editable={!busy}
        onChangeText={(value) => updateText('notes', setNotes, value)}
        value={notes}
      />
      <ChoiceGroup busy={busy} label={localization.t('tasks.priorityField')} onChange={setPriority} options={priorities} value={priority} />
      {task ? (
        <ChoiceGroup busy={busy} label={localization.t('tasks.statusField')} onChange={setStatus} options={statuses} value={status} />
      ) : null}
      <FormField
        autoCapitalize="none"
        error={localization.message(errors.dueDate) || undefined}
        hint={localization.t('tasks.dueDateHint')}
        keyboardType="numbers-and-punctuation"
        label={localization.t('tasks.dueDate')}
        editable={!busy}
        onChangeText={(value) => updateText('dueDate', setDueDate, value)}
        placeholder="YYYY-MM-DD"
        value={dueDate}
      />
      <FormField
        autoCapitalize="none"
        error={localization.message(errors.scheduledTime) || undefined}
        hint={localization.t('tasks.timeHint')}
        keyboardType="numbers-and-punctuation"
        label={localization.t('tasks.scheduledTime')}
        editable={!busy}
        onChangeText={(value) =>
          updateText('scheduledTime', setScheduledTime, value)
        }
        placeholder="09:30"
        value={scheduledTime}
      />
      <Button
        label={localization.t(task ? 'common.save' : 'tasks.createAction')}
        loading={busy}
        onPress={() => void submit()}
      />
    </View>
  );
}

type ChoiceGroupProps<T extends string> = {
  busy: boolean;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

function ChoiceGroup<T extends string>({ busy, label, value, options, onChange }: ChoiceGroupProps<T>) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{label}</Text>
      <View accessibilityRole="radiogroup" style={[styles.choices, { gap: theme.spacing.sm }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: busy }}
              disabled={busy}
              key={option.value}
              onPress={() => onChange(option.value)}
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
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 16,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
