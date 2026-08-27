import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import type { Task } from '@/domain/entities';
import { groupTasks } from '@/features/tasks/services/task-organization';
import { goalForTask } from '@/features/goals/services/goal-task-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function TaskListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const planning = usePlanning();
  const localization = useLocalization();

  if (planning.status === 'loading' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="tasks-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('tasks.loading')}
        </Text>
      </Screen>
    );
  }

  if (planning.status === 'error' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="tasks-error">
        <EmptyState
          action={<Button label={localization.t('common.retry')} onPress={() => void planning.refresh()} />}
          description={localization.message(planning.errorMessage) || localization.t('tasks.notLoaded')}
          icon={<Ionicons color={theme.colors.warning} name="refresh-circle-outline" size={48} />}
          title={localization.t('tasks.listRefresh')}
        />
      </Screen>
    );
  }

  if (!planning.today || !planning.plan) return null;
  const groups = groupTasks(planning.tasks, planning.today);

  return (
    <Screen
      onRefresh={() => void planning.refresh()}
      refreshing={planning.status === 'loading'}
      testID="task-list-screen"
    >
      <ListHeader
        actionLabel={localization.t('tasks.new')}
        onAction={() => router.push('/(tasks)/tasks/new')}
        onBack={() => goBackOrReplace(router, '/(tabs)')}
        title={localization.t('tasks.title')}
      />
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {localization.t('tasks.editDescription')}
      </Text>
      {planning.tasks.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button label={localization.t('tasks.createAction')} onPress={() => router.push('/(tasks)/tasks/new')} />}
            description={localization.t('tasks.emptyDescription')}
            icon={<Ionicons color={theme.colors.accent} name="checkbox-outline" size={48} />}
            title={localization.t('tasks.emptyTitle')}
          />
        </Card>
      ) : (
        <>
          <TaskGroup label={localization.t('tasks.overdue')} tasks={groups.overdue} />
          <TaskGroup label={localization.t('common.today')} tasks={groups.today} />
          <TaskGroup label={localization.t('tasks.upcoming')} tasks={groups.upcoming} />
          <TaskGroup label={localization.t('tasks.unscheduled')} tasks={groups.unscheduled} />
          <TaskGroup quiet label={localization.t('common.completed')} tasks={groups.completed} />
          <TaskGroup quiet label={localization.t('common.cancelled')} tasks={groups.cancelled} />
        </>
      )}
      {planning.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(planning.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function TaskGroup({
  label,
  tasks,
  quiet = false,
}: {
  label: string;
  tasks: Task[];
  quiet?: boolean;
}) {
  const theme = useAppTheme();
  if (tasks.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
      <Text accessibilityRole="header" variant="heading">
        {label}
      </Text>
      {tasks.map((task) => (
        <TaskListRow key={task.id} quiet={quiet} task={task} />
      ))}
    </View>
  );
}

function TaskListRow({ task, quiet }: { task: Task; quiet: boolean }) {
  const theme = useAppTheme();
  const router = useRouter();
  const localization = useLocalization();
  const goals = useGoals();
  const linkedGoal = goalForTask(task, goals.goals);
  const dueLabel = task.dueDate
    ? localization.formatDate(task.dueDate, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : localization.t('common.none');
  const priority =
    task.priority === 'none'
      ? localization.t('tasks.priorityNone')
      : localization.t(`tasks.priority${task.priority[0].toUpperCase()}${task.priority.slice(1)}` as 'tasks.priorityLow' | 'tasks.priorityMedium' | 'tasks.priorityHigh');

  return (
    <Pressable
      accessibilityHint={localization.t('tasks.opensDetails')}
      accessibilityLabel={`${task.title}. ${statusLabel(task, localization.t)}. ${dueLabel}. ${priority}.${linkedGoal ? ` ${localization.t('goals.linkedGoal', { title: linkedGoal.title })}.` : ''}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/(tasks)/tasks/[id]',
          params: { id: task.id },
        })
      }
    >
      {({ pressed }) => (
        <Card
          style={{ opacity: quiet ? 0.72 : pressed ? 0.78 : 1 }}
          variant={quiet ? 'subtle' : 'default'}
        >
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text variant="label">{task.title}</Text>
              <Text tone="textMuted" variant="caption">
                {statusLabel(task, localization.t)} · {dueLabel}
                {task.scheduledTime ? ` · ${localization.formatTime(task.scheduledTime)}` : ''} · {priority}
              </Text>
              {linkedGoal ? (
                <Text tone="accent" variant="caption">
                  {localization.t('goals.linkedGoal', { title: linkedGoal.title })}
                </Text>
              ) : null}
            </View>
            <Ionicons color={theme.colors.textMuted} name={localization.isRTL ? 'chevron-back' : 'chevron-forward'} size={20} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function statusLabel(task: Task, translate: ReturnType<typeof useLocalization>['t']) {
  if (task.status === 'in_progress') return translate('common.inProgress');
  return translate(`common.${task.status}` as 'common.pending' | 'common.completed' | 'common.cancelled');
}

function ListHeader({
  title,
  actionLabel,
  onAction,
  onBack,
}: {
  title: string;
  actionLabel: string;
  onAction: () => void;
  onBack: () => void;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={localization.t('common.goBack')}
        accessibilityRole="button"
        onPress={onBack}
        style={styles.iconButton}
      >
        <Ionicons color={theme.colors.text} name={localization.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.headerTitle} variant="heading">
        {title}
      </Text>
      <Button label={actionLabel} onPress={onAction} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  headerTitle: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    marginRight: 8,
    width: MIN_TOUCH_TARGET,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
