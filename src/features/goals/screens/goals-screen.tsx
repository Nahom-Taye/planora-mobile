import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, FormField, Screen, Text } from '@/components/ui';
import type { Goal } from '@/domain/entities';
import { ChoiceChips } from '@/features/goals/components/choice-chips';
import { GoalProgressSummary } from '@/features/goals/components/goal-progress-summary';
import {
  organizeGoals,
  type GoalFilter,
} from '@/features/goals/services/goal-organization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function GoalsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoals();
  const localization = useLocalization();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GoalFilter>('current');
  const groups = useMemo(
    () => organizeGoals(goals.goals, query, filter),
    [filter, goals.goals, query],
  );
  const activeCount = goals.goals.filter((goal) => goal.status === 'active').length;

  if (goals.status === 'loading' && goals.goals.length === 0) {
    return (
      <Screen contentStyle={styles.center} testID="goals-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('goals.loading')}
        </Text>
      </Screen>
    );
  }

  if (goals.status === 'error' && goals.goals.length === 0) {
    return (
      <Screen contentStyle={styles.center} testID="goals-error">
        <EmptyState
          action={
            <Button
              label={localization.t('common.retry')}
              onPress={() => void goals.refresh()}
            />
          }
          description={
            localization.message(goals.errorMessage) || localization.t('goals.notLoaded')
          }
          icon={
            <Ionicons
              color={theme.colors.warning}
              name="refresh-circle-outline"
              size={48}
            />
          }
          title={localization.t('goals.refreshTitle')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      onRefresh={() => void goals.refresh()}
      refreshing={goals.status === 'loading'}
      testID="goals-screen"
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" variant="display">
            {localization.t('goals.heading')}
          </Text>
          <Text tone="textMuted" variant="caption">
            {localization.t('goals.summaryActive', {
              count: localization.formatNumber(activeCount),
            })}
          </Text>
        </View>
        <Button
          label={localization.t('goals.create')}
          onPress={() => router.push('/(goals)/goals/new')}
        />
      </View>
      {goals.goals.length === 0 ? (
        <EmptyState
          description={localization.t('goals.emptyDescription')}
          icon={<Ionicons color={theme.colors.accent} name="flag-outline" size={48} />}
          title={localization.t('goals.emptyTitle')}
        />
      ) : (
        <>
          <View style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xl }}>
            <FormField
              accessibilityLabel={localization.t('goals.search')}
              label={localization.t('goals.search')}
              onChangeText={setQuery}
              returnKeyType="search"
              value={query}
            />
            <ChoiceChips
              label={localization.t('goals.status')}
              onChange={setFilter}
              options={[
                { value: 'current', label: localization.t('goals.filterCurrent') },
                { value: 'completed', label: localization.t('goals.filterCompleted') },
                { value: 'all', label: localization.t('goals.filterAll') },
              ]}
              value={filter}
            />
          </View>
          <GoalSection goals={groups.active} title={localization.t('goals.activeGoals')} />
          <GoalSection goals={groups.someday} title={localization.t('goals.somedayGoals')} />
          <GoalSection goals={groups.paused} title={localization.t('goals.pausedGoals')} />
          <GoalSection goals={groups.completed} title={localization.t('goals.completedGoals')} />
          <GoalSection goals={groups.abandoned} title={localization.t('goals.abandonedGoals')} />
          {Object.values(groups).every((items) => items.length === 0) ? (
            <Text align="center" tone="textMuted">
              {localization.t('goals.noMatches')}
            </Text>
          ) : null}
        </>
      )}
      {goals.errorMessage ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {localization.message(goals.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function GoalSection({ title, goals: items }: { title: string; goals: Goal[] }) {
  const theme = useAppTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
      <Text accessibilityRole="header" variant="heading">
        {title}
      </Text>
      {items.map((goal) => (
        <GoalRow goal={goal} key={goal.id} />
      ))}
    </View>
  );
}

function GoalRow({ goal }: { goal: Goal }) {
  const theme = useAppTheme();
  const router = useRouter();
  const goals = useGoals();
  const localization = useLocalization();
  const milestones = goals.milestonesFor(goal.id);
  const tasks = goals.tasksFor(goal.id);
  const nextMilestone = milestones.find((item) => item.status === 'pending');
  const nextAction =
    tasks.find((task) => task.id === goal.nextActionTaskId) ??
    tasks.find((task) => task.status === 'in_progress' || task.status === 'pending');
  const status = statusLabel(goal, localization);
  const needsAttention =
    goal.status === 'active' &&
    Boolean(goal.targetDate && goals.today && goal.targetDate < goals.today);
  const target = goal.targetDate
    ? localization.t('goals.targetContext', {
        date: localization.formatDate(goal.targetDate, { month: 'short', day: 'numeric' }),
      })
    : localization.t('goals.noTargetDate');

  return (
    <Pressable
      accessibilityHint={localization.t('goals.opensDetails')}
      accessibilityLabel={`${goal.title}. ${status}. ${target}.`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/(goals)/goals/[id]',
          params: { id: goal.id },
        })
      }
    >
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.78 : 1 }}>
          <View style={styles.row}>
            <View style={styles.rowCopy}>
              <Text numberOfLines={2} variant="heading">
                {goal.title}
              </Text>
              <Text tone="textMuted" variant="caption">
                {status} · {target}
                {needsAttention ? ` · ${localization.t('goals.needsAttention')}` : ''}
              </Text>
              <GoalProgressSummary compact progress={goals.progressFor(goal)} />
              {nextMilestone || nextAction ? (
                <Text numberOfLines={2} tone="textMuted" variant="caption">
                  {nextMilestone
                    ? `${localization.t('goals.nextMilestone')}: ${nextMilestone.title}`
                    : `${localization.t('goals.nextAction')}: ${nextAction?.title}`}
                </Text>
              ) : null}
            </View>
            <Ionicons
              color={theme.colors.textMuted}
              name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
            />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

function statusLabel(
  goal: Goal,
  localization: ReturnType<typeof useLocalization>,
) {
  if (goal.status === 'active') return localization.t('goals.statusActive');
  if (goal.status === 'paused') return localization.t('goals.statusPaused');
  if (goal.status === 'completed') return localization.t('goals.statusCompleted');
  return localization.t('goals.statusAbandoned');
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 16, justifyContent: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerCopy: { flex: 1, gap: 2 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: MIN_TOUCH_TARGET },
  rowCopy: { flex: 1, gap: 8 },
});
