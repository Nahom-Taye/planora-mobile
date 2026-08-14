import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import type { Goal, Milestone, Routine, Task } from '@/domain/entities';
import { GoalDetailSection } from '@/features/goals/components/goal-detail-section';
import { GoalProgressSummary } from '@/features/goals/components/goal-progress-summary';
import { GoalScreenHeader } from '@/features/goals/components/goal-screen-header';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function GoalDetailScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const goals = useGoals();
  const localization = useLocalization();
  const goal = params.id ? goals.getGoal(params.id) : null;

  if (!goal) {
    return (
      <Screen>
        <GoalScreenHeader
          onBack={() => router.back()}
          title={localization.t('goals.details')}
        />
        <Card variant="subtle">
          <Text variant="heading">{localization.t('goals.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('goals.unavailableDescription')}
          </Text>
        </Card>
      </Screen>
    );
  }

  const milestones = goals.milestonesFor(goal.id);
  const tasks = goals.tasksFor(goal.id);
  const links = goals.routineLinksFor(goal.id);
  const routines = links
    .map((link) => goals.routines.find((routine) => routine.id === link.routineId))
    .filter((routine): routine is Routine => Boolean(routine));
  const countableMilestones = milestones.filter((item) => item.status !== 'cancelled');
  const allMilestonesComplete =
    countableMilestones.length > 0 &&
    countableMilestones.every((item) => item.status === 'completed');
  const needsAttention =
    goal.status === 'active' &&
    Boolean(goal.targetDate && goals.today && goal.targetDate < goals.today);

  return (
    <Screen
      onRefresh={() => void goals.refresh()}
      refreshing={goals.status === 'loading'}
      testID="goal-detail-screen"
    >
      <GoalScreenHeader
        actionLabel={localization.t('common.edit')}
        onAction={() =>
          router.push({ pathname: '/(goals)/goals/[id]/edit', params: { id: goal.id } })
        }
        onBack={() => router.back()}
        title={localization.t('goals.details')}
      />
      <View style={{ gap: theme.spacing.sm }}>
        <Text accessibilityRole="header" variant="title">
          {goal.title}
        </Text>
        <Text tone="accent" variant="label">
          {statusLabel(goal, localization)}
        </Text>
        <Text tone="textMuted" variant="caption">
          {horizonLabel(goal, localization)} ·{' '}
          {goal.targetDate
            ? localization.t('goals.targetContext', {
                date: localization.formatDate(goal.targetDate, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                }),
              })
            : localization.t('goals.noTargetDate')}
        </Text>
        {needsAttention ? (
          <Text tone="warning" variant="caption">
            {localization.t('goals.needsAttention')}
          </Text>
        ) : null}
      </View>
      <Card style={{ marginTop: theme.spacing.xl }} variant="subtle">
        <GoalProgressSummary progress={goals.progressFor(goal)} />
      </Card>
      {goal.description ? (
        <Text style={{ marginTop: theme.spacing.xl }}>{goal.description}</Text>
      ) : null}
      {goal.motivation ? (
        <GoalDetailSection title={localization.t('goals.motivation')}>
          <Text>{goal.motivation}</Text>
        </GoalDetailSection>
      ) : null}
      <GoalDetailSection
        action={
          <Button
            label={localization.t('goals.addMilestone')}
            onPress={() =>
              router.push({
                pathname: '/(goals)/goals/[id]/milestones/new',
                params: { id: goal.id },
              })
            }
            variant="ghost"
          />
        }
        title={localization.t('goals.milestones')}
      >
        {milestones.length ? (
          milestones.map((milestone, index) => (
            <MilestoneRow
              canMoveDown={index < milestones.length - 1}
              canMoveUp={index > 0}
              goal={goal}
              key={milestone.id}
              milestone={milestone}
            />
          ))
        ) : (
          <Text tone="textMuted">{localization.t('goals.noMilestones')}</Text>
        )}
        {allMilestonesComplete && goal.status !== 'completed' ? (
          <Text tone="textMuted" variant="caption">
            {localization.t('goals.completionSuggestion')}
          </Text>
        ) : null}
      </GoalDetailSection>
      <GoalDetailSection
        action={
          <Button
            label={localization.t('goals.linkTask')}
            onPress={() =>
              router.push({
                pathname: '/(goals)/goals/[id]/tasks',
                params: { id: goal.id },
              })
            }
            variant="ghost"
          />
        }
        title={localization.t('goals.linkedTasks')}
      >
        <Button
          label={localization.t('goals.createTask')}
          onPress={() =>
            router.push({
              pathname: '/(tasks)/tasks/new',
              params: { goalId: goal.id },
            })
          }
          variant="secondary"
        />
        {tasks.length ? (
          tasks.map((task) => <LinkedTaskRow goal={goal} key={task.id} task={task} />)
        ) : (
          <Text tone="textMuted">{localization.t('goals.noTasks')}</Text>
        )}
      </GoalDetailSection>
      <GoalDetailSection
        action={
          <Button
            label={localization.t('goals.linkRoutine')}
            onPress={() =>
              router.push({
                pathname: '/(goals)/goals/[id]/routines',
                params: { id: goal.id },
              })
            }
            variant="ghost"
          />
        }
        title={localization.t('goals.supportingRoutines')}
      >
        {routines.length ? (
          routines.map((routine) => (
            <LinkedRoutineRow
              goal={goal}
              key={routine.id}
              routine={routine}
            />
          ))
        ) : (
          <Text tone="textMuted">{localization.t('goals.noRoutines')}</Text>
        )}
      </GoalDetailSection>
      <GoalDetailSection title={localization.t('goals.actions')}>
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label={localization.t('reflections.reflectGoal')}
            onPress={() =>
              goals.today &&
              router.push({
                pathname: '/(insights)/reflections/new',
                params: {
                  scope: 'goal',
                  goalId: goal.id,
                  periodStart: goals.today,
                },
              } as unknown as Href)
            }
            variant="secondary"
          />
          {goal.status === 'active' ? (
            <>
              <Button
                label={localization.t('goals.pause')}
                onPress={() => confirmGoalAction(goal, 'pause')}
                variant="secondary"
              />
              <Button
                label={localization.t('goals.complete')}
                onPress={() => confirmGoalAction(goal, 'complete')}
              />
            </>
          ) : goal.status === 'paused' ? (
            <Button
              label={localization.t('goals.resume')}
              onPress={() => void goals.resumeGoal(goal)}
            />
          ) : (
            <Button
              label={localization.t('goals.reopen')}
              onPress={() => void goals.reopenGoal(goal)}
            />
          )}
          {goal.status !== 'abandoned' ? (
            <Button
              label={localization.t('goals.abandon')}
              onPress={() => confirmGoalAction(goal, 'abandon')}
              variant="ghost"
            />
          ) : null}
          <Button
            label={localization.t('goals.delete')}
            onPress={() => confirmGoalAction(goal, 'delete')}
            variant="ghost"
          />
        </View>
      </GoalDetailSection>
      {goals.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(goals.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );

  function confirmGoalAction(
    current: Goal,
    action: 'pause' | 'complete' | 'abandon' | 'delete',
  ) {
    const title = localization.t(`goals.${action}Title` as
      | 'goals.pauseTitle'
      | 'goals.completeTitle'
      | 'goals.abandonTitle'
      | 'goals.deleteTitle');
    const description = localization.t(`goals.${action}Description` as
      | 'goals.pauseDescription'
      | 'goals.completeDescription'
      | 'goals.abandonDescription'
      | 'goals.deleteDescription');
    Alert.alert(title, description, [
      { text: localization.t('goals.keepGoal'), style: 'cancel' },
      {
        text: localization.t(`goals.${action}` as
          | 'goals.pause'
          | 'goals.complete'
          | 'goals.abandon'
          | 'goals.delete'),
        style: action === 'delete' || action === 'abandon' ? 'destructive' : 'default',
        onPress: () => {
          const result =
            action === 'pause'
              ? goals.pauseGoal(current)
              : action === 'complete'
                ? goals.completeGoal(current)
                : action === 'abandon'
                  ? goals.abandonGoal(current)
                  : goals.deleteGoal(current);
          void result.then((value) => {
            if (value.ok && action === 'delete') router.replace('/(tabs)/goals');
          });
        },
      },
    ]);
  }
}

function MilestoneRow({
  goal,
  milestone,
  canMoveUp,
  canMoveDown,
}: {
  goal: Goal;
  milestone: Milestone;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoals();
  const localization = useLocalization();
  const state =
    milestone.status === 'completed'
      ? localization.t('goals.milestoneCompleted')
      : milestone.status === 'cancelled'
        ? localization.t('goals.milestoneCancelled')
        : localization.t('goals.milestonePending');
  return (
    <View style={[styles.listRow, { borderBottomColor: theme.colors.divider }]}>
      <Pressable
        accessibilityHint={localization.t('goals.editMilestone')}
        accessibilityLabel={`${milestone.title}. ${state}.`}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(goals)/goals/[id]/milestones/[milestoneId]',
            params: { id: goal.id, milestoneId: milestone.id },
          })
        }
        style={styles.rowCopy}
      >
        <Text numberOfLines={2} variant="label">{milestone.title}</Text>
        <Text tone="textMuted" variant="caption">
          {state}
          {milestone.targetDate
            ? ` · ${localization.formatDate(milestone.targetDate, { month: 'short', day: 'numeric' })}`
            : ''}
        </Text>
      </Pressable>
      <View style={styles.rowActions}>
        <IconAction
          disabled={!canMoveUp || goals.isMutating}
          hint={localization.t('goals.moveUpHint')}
          icon="arrow-up"
          label={localization.t('goals.moveUp')}
          onPress={() => void goals.reorderMilestone(goal, milestone, 'up')}
        />
        <IconAction
          disabled={!canMoveDown || goals.isMutating}
          hint={localization.t('goals.moveDownHint')}
          icon="arrow-down"
          label={localization.t('goals.moveDown')}
          onPress={() => void goals.reorderMilestone(goal, milestone, 'down')}
        />
        <IconAction
          disabled={goals.isMutating}
          icon={milestone.status === 'pending' ? 'checkmark' : 'refresh'}
          label={localization.t(
            milestone.status === 'pending'
              ? 'goals.completeMilestone'
              : 'goals.reopenMilestone',
          )}
          onPress={() =>
            void (milestone.status === 'pending'
              ? goals.completeMilestone(goal, milestone)
              : goals.reopenMilestone(goal, milestone))
          }
        />
        {milestone.status === 'pending' ? (
          <IconAction
            disabled={goals.isMutating}
            icon="close-circle-outline"
            label={localization.t('goals.cancelMilestone')}
            onPress={() => void goals.cancelMilestone(goal, milestone)}
          />
        ) : null}
        <IconAction
          disabled={goals.isMutating}
          icon="trash-outline"
          label={localization.t('goals.deleteMilestone')}
          onPress={() =>
            Alert.alert(
              localization.t('goals.deleteMilestoneTitle'),
              localization.t('goals.deleteMilestoneDescription'),
              [
                { text: localization.t('goals.keepMilestone'), style: 'cancel' },
                {
                  text: localization.t('goals.deleteMilestone'),
                  style: 'destructive',
                  onPress: () => void goals.deleteMilestone(goal, milestone),
                },
              ],
            )
          }
        />
      </View>
    </View>
  );
}

function LinkedTaskRow({ goal, task }: { goal: Goal; task: Task }) {
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoals();
  const localization = useLocalization();
  const isNext = goal.nextActionTaskId === task.id;
  return (
    <View style={[styles.listRow, { borderBottomColor: theme.colors.divider }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/(tasks)/tasks/[id]', params: { id: task.id } })
        }
        style={styles.rowCopy}
      >
        <Text numberOfLines={2} variant="label">{task.title}</Text>
        <Text tone="textMuted" variant="caption">
          {isNext ? localization.t('goals.nextAction') : taskStatus(task, localization)}
        </Text>
      </Pressable>
      <View style={styles.rowActions}>
        <IconAction
          disabled={goals.isMutating}
          icon={isNext ? 'close' : 'navigate-outline'}
          label={localization.t(isNext ? 'goals.clearNextAction' : 'goals.setNextAction')}
          onPress={() => void goals.setNextAction(goal, isNext ? null : task)}
        />
        <IconAction
          disabled={goals.isMutating}
          icon="unlink-outline"
          label={localization.t('goals.unlinkTask')}
          onPress={() => void goals.unlinkTask(goal, task)}
        />
      </View>
    </View>
  );
}

function LinkedRoutineRow({ goal, routine }: { goal: Goal; routine: Routine }) {
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoals();
  const localization = useLocalization();
  const link = goals.routineLinks.find(
    (item) => item.goalId === goal.id && item.routineId === routine.id,
  );
  const checkIn = goals.checkIns.find((item) => item.routineId === routine.id);
  const todayState =
    checkIn?.outcome === 'completed'
      ? localization.t('goals.routineCompletedToday')
      : checkIn?.outcome === 'skipped'
        ? localization.t('goals.routineSkippedToday')
        : localization.t('goals.routinePendingToday');
  return (
    <View style={[styles.listRow, { borderBottomColor: theme.colors.divider }]}>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({ pathname: '/(routines)/routines/[id]', params: { id: routine.id } })
        }
        style={styles.rowCopy}
      >
        <Text numberOfLines={2} variant="label">{routine.title}</Text>
        <Text tone="textMuted" variant="caption">{todayState}</Text>
      </Pressable>
      {link ? (
        <IconAction
          disabled={goals.isMutating}
          icon="unlink-outline"
          label={localization.t('goals.unlinkRoutine')}
          onPress={() => void goals.unlinkRoutine(goal, link)}
        />
      ) : null}
    </View>
  );
}

function IconAction({
  label,
  icon,
  onPress,
  disabled = false,
  hint,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconAction, { opacity: disabled ? 0.35 : 1 }]}
    >
      <Ionicons color={theme.colors.primary} name={icon} size={20} />
    </Pressable>
  );
}

function statusLabel(goal: Goal, localization: ReturnType<typeof useLocalization>) {
  if (goal.status === 'active') return localization.t('goals.statusActive');
  if (goal.status === 'paused') return localization.t('goals.statusPaused');
  if (goal.status === 'completed') return localization.t('goals.statusCompleted');
  return localization.t('goals.statusAbandoned');
}

function horizonLabel(goal: Goal, localization: ReturnType<typeof useLocalization>) {
  if (goal.horizon === 'month') return localization.t('goals.horizonMonth');
  if (goal.horizon === 'quarter') return localization.t('goals.horizonQuarter');
  if (goal.horizon === 'year') return localization.t('goals.horizonYear');
  return localization.t('goals.horizonSomeday');
}

function taskStatus(task: Task, localization: ReturnType<typeof useLocalization>) {
  if (task.status === 'in_progress') return localization.t('common.inProgress');
  if (task.status === 'completed') return localization.t('common.completed');
  if (task.status === 'cancelled') return localization.t('common.cancelled');
  return localization.t('common.pending');
}

const styles = StyleSheet.create({
  iconAction: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  listRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: MIN_TOUCH_TARGET + 12,
    paddingVertical: 6,
  },
  rowActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  rowCopy: { flex: 1, gap: 2, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET },
});
