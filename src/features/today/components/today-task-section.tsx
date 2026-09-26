import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { Task } from '@/domain/entities';
import { goalForTask } from '@/features/goals/services/goal-task-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function TodayTaskSection({
  title,
  tasks,
  completed = false,
  emptyLabel,
  icon,
}: {
  title: string;
  tasks: Task[];
  completed?: boolean;
  emptyLabel?: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  if (tasks.length === 0 && !emptyLabel) return null;

  return (
    <View style={{ marginTop: completed ? theme.spacing.sm : theme.spacing.lg }}>
      <View style={[styles.sectionHeader, { marginBottom: theme.spacing.md }]}>
        {icon ? (
          <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft }]}>
            <Ionicons color={theme.colors.primary} name={icon} size={15} />
          </View>
        ) : null}
        <Text
          accessibilityRole="header"
          tone={completed ? 'textMuted' : 'text'}
          variant="heading"
        >
          {title}
        </Text>
        {tasks.length > 0 ? (
          <View style={[styles.countChip, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={{ color: theme.colors.primary }} variant="caption">
              {localization.formatNumber(tasks.length)}
            </Text>
          </View>
        ) : null}
      </View>
      {tasks.length === 0 ? (
        <Text tone="textMuted" style={{ paddingVertical: theme.spacing.sm }}>{emptyLabel}</Text>
      ) : (
        <View style={styles.list}>
          {tasks.map((task) => (
            <TodayTaskRow
              completed={completed}
              key={task.id}
              task={task}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TodayTaskRow({
  task,
  completed,
}: {
  task: Task;
  completed: boolean;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const planning = usePlanning();
  const goals = useGoals();
  const linkedGoal = goalForTask(task, goals.goals);
  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const state = isCancelled
    ? localization.t('common.cancelled')
    : isDone
      ? localization.t('common.completed')
      : priorityLabel(task, localization.t);
  const priorityColor = isDone
    ? theme.colors.success
    : task.priority === 'high'
      ? theme.colors.danger
      : task.priority === 'medium'
        ? theme.colors.warning
        : theme.colors.textMuted;

  return (
    <View
      style={[
        styles.itemRow,
        theme.shadows.subtle,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.divider,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={`${task.title}, ${state}`}
        accessibilityRole="checkbox"
        accessibilityState={{
          checked: isDone,
          disabled: planning.isMutating || isCancelled,
        }}
        disabled={planning.isMutating || isCancelled}
        onPress={() =>
          void (isDone ? planning.reopenTask(task) : planning.completeTask(task))
        }
        style={styles.checkButton}
      >
        <Ionicons
          color={
            isDone
              ? theme.colors.success
              : task.priority === 'high'
                ? theme.colors.warning
                : theme.colors.textMuted
          }
          name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
        />
      </Pressable>
      <Pressable
        accessibilityHint={localization.t('tasks.opensDetails')}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(tasks)/tasks/[id]',
            params: { id: task.id },
          })
        }
        style={styles.itemCopy}
      >
        <Text
          style={isDone || isCancelled ? styles.strike : undefined}
          tone={completed ? 'textMuted' : 'text'}
          variant="label"
        >
          {task.title}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
          <Text tone="textMuted" variant="caption">
            {task.scheduledTime
              ? `${localization.formatTime(task.scheduledTime)} · ${state}`
              : state}
          </Text>
        </View>
        {linkedGoal ? (
          <Text tone="accent" variant="caption">
            {localization.t('goals.linkedGoal', { title: linkedGoal.title })}
          </Text>
        ) : null}
      </Pressable>
      <Ionicons
        color={theme.colors.textMuted}
        name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
        size={18}
      />
    </View>
  );
}

function priorityLabel(
  task: Task,
  t: ReturnType<typeof useLocalization>['t'],
) {
  if (task.priority === 'high') return t('tasks.priorityHigh');
  if (task.priority === 'medium') return t('tasks.priorityMedium');
  if (task.priority === 'low') return t('tasks.priorityLow');
  return t('tasks.priorityNone');
}

const styles = StyleSheet.create({
  checkButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  countChip: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  itemCopy: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  itemRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    paddingStart: 4,
    paddingEnd: 16,
    paddingVertical: 12,
    gap: 4,
  },
  list: { gap: 10 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  priorityDot: { borderRadius: 4, height: 8, width: 8 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  strike: { textDecorationLine: 'line-through' },
});
