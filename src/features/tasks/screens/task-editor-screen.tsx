import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { ReminderAction } from '@/features/reminders/components/reminder-action';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

import { TaskForm } from '../components/task-form';

type TaskEditorScreenProps = { create?: boolean };

export function TaskEditorScreen({ create = false }: TaskEditorScreenProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; goalId?: string }>();
  const planning = usePlanning();
  const goals = useGoals();
  const localization = useLocalization();
  const task = create || !params.id ? null : planning.getTask(params.id);
  const linkedGoal = goals.getGoal(task?.goalId ?? params.goalId ?? '');

  if (!create && planning.status === 'loading' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="edit-task-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('tasks.loading')}
        </Text>
      </Screen>
    );
  }

  if (!create && planning.status === 'error' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="edit-task-error">
        <Card>
          <Text accessibilityRole="header" variant="heading">
            {localization.t('tasks.refreshTitle')}
          </Text>
          <Text style={{ marginVertical: theme.spacing.md }} tone="textMuted">
            {localization.message(planning.errorMessage) || localization.t('tasks.notLoaded')}
          </Text>
          <Button label={localization.t('common.retry')} onPress={() => void planning.refresh()} />
        </Card>
      </Screen>
    );
  }

  const runAndClose = async (
    operation: () => ReturnType<typeof planning.completeTask>,
  ) => {
    const result = await operation();
    if (result.ok) goBackOrReplace(router, '/(tasks)/tasks');
  };

  const cancel = () => {
    if (!task) return;
    Alert.alert(
      localization.t('tasks.cancelTitle'),
      localization.t('tasks.cancelDescription'),
      [
        { text: localization.t('tasks.keep'), style: 'cancel' },
        {
          text: localization.t('tasks.cancel'),
          style: 'destructive',
          onPress: () => void runAndClose(() => planning.cancelTask(task)),
        },
      ],
    );
  };

  const remove = () => {
    if (!task) return;
    Alert.alert(
      localization.t('tasks.deleteTitle'),
      localization.t('tasks.deleteDescription'),
      [
        { text: localization.t('tasks.keep'), style: 'cancel' },
        {
          text: localization.t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void planning.deleteTask(task).then((result) => {
              if (result.ok) goBackOrReplace(router, '/(tasks)/tasks');
            });
          },
        },
      ],
    );
  };

  return (
    <Screen testID={create ? 'create-task-screen' : 'edit-task-screen'}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('common.goBack')}
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/(tasks)/tasks')}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name={localization.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} />
        </Pressable>
        <Text accessibilityRole="header" variant="heading">
          {localization.t(create ? 'tasks.new' : 'tasks.details')}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {create
          ? localization.t('tasks.createDescription')
          : localization.t('tasks.editDescription')}
      </Text>
      {linkedGoal ? (
        <Pressable
          accessibilityLabel={localization.t('goals.openGoal', { title: linkedGoal.title })}
          accessibilityRole="link"
          onPress={() =>
            router.push({
              pathname: '/(goals)/goals/[id]',
              params: { id: linkedGoal.id },
            })
          }
          style={{ marginBottom: theme.spacing.xl }}
        >
          <Card variant="subtle">
            <Text tone="accent" variant="caption">
              {localization.t('goals.linkedGoal', { title: linkedGoal.title })}
            </Text>
          </Card>
        </Pressable>
      ) : null}
      {!create && !task ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('tasks.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('tasks.unavailableDescription')}
          </Text>
        </Card>
      ) : (
        <TaskForm
          busy={planning.isMutating}
          initialDate={planning.today ?? ''}
          onSubmit={async (draft) => {
            const result = task
              ? await planning.updateTask(task, draft)
              : await planning.createTask(draft, params.goalId ?? null);
            if (result.ok) goBackOrReplace(router, '/(tasks)/tasks');
            return result;
          }}
          task={task ?? undefined}
        />
      )}
      {task ? (
        <Card style={{ marginTop: theme.spacing.xxl }} variant="subtle">
          <Text variant="label">{localization.t('tasks.actions')}</Text>
          <View style={[styles.actions, { gap: theme.spacing.sm }]}>
            <ReminderAction entityId={task.id} entityType="task" />
            {task.status === 'pending' || task.status === 'in_progress' ? (
              <>
                <Action
                  disabled={planning.isMutating}
                  label={localization.t('tasks.complete')}
                  onPress={() => void runAndClose(() => planning.completeTask(task))}
                />
                <Action disabled={planning.isMutating} label={localization.t('tasks.cancel')} onPress={cancel} />
              </>
            ) : (
              <Action
                disabled={planning.isMutating}
                label={localization.t('tasks.reopen')}
                onPress={() => void runAndClose(() => planning.reopenTask(task))}
              />
            )}
            <Action disabled={planning.isMutating} destructive label={localization.t('tasks.delete')} onPress={remove} />
          </View>
        </Card>
      ) : null}
      {planning.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(planning.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function Action({
  label,
  onPress,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, { opacity: disabled ? 0.5 : 1 }]}
    >
      <Text tone={destructive ? 'danger' : 'textMuted'} variant="label">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  actions: {
    marginTop: 8,
  },
  center: {
    gap: 16,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
});
