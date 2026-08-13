import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { Task } from '@/domain/entities';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function TodayTaskSection({
  title,
  tasks,
  completed = false,
  emptyLabel,
}: {
  title: string;
  tasks: Task[];
  completed?: boolean;
  emptyLabel?: string;
}) {
  const theme = useAppTheme();
  if (tasks.length === 0 && !emptyLabel) return null;

  return (
    <View style={{ marginTop: completed ? theme.spacing.sm : theme.spacing.xl }}>
      <Text
        accessibilityRole="header"
        style={{ marginBottom: theme.spacing.sm }}
        tone={completed ? 'textMuted' : 'text'}
        variant="heading"
      >
        {title}
      </Text>
      {tasks.length === 0 ? (
        <Text tone="textMuted" variant="caption">{emptyLabel}</Text>
      ) : (
        <View
          style={[
            styles.list,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.divider,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          {tasks.map((task, index) => (
            <TodayTaskRow
              completed={completed}
              isLast={index === tasks.length - 1}
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
  isLast,
}: {
  task: Task;
  completed: boolean;
  isLast: boolean;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const planning = usePlanning();
  const isDone = task.status === 'completed';
  const isCancelled = task.status === 'cancelled';
  const state = isCancelled
    ? localization.t('common.cancelled')
    : isDone
      ? localization.t('common.completed')
      : priorityLabel(task, localization.t);

  return (
    <View
      style={[
        styles.itemRow,
        {
          borderBottomColor: theme.colors.divider,
          opacity: completed ? 0.68 : 1,
        },
        isLast && styles.last,
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
          numberOfLines={2}
          style={isDone || isCancelled ? styles.strike : undefined}
          variant="label"
        >
          {task.title}
        </Text>
        <Text tone="textMuted" variant="caption">
          {task.scheduledTime
            ? `${localization.formatTime(task.scheduledTime)} · ${state}`
            : state}
        </Text>
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
  itemCopy: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  itemRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingEnd: 12,
    paddingVertical: 5,
  },
  last: { borderBottomWidth: 0 },
  list: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  strike: { textDecorationLine: 'line-through' },
});
