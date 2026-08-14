import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import type {
  InsightsRange,
  InsightsView,
  Reflection,
  TaskPriority,
} from '@/domain/entities';
import { AccessibleBar } from '@/features/insights/components/accessible-bar';
import { MetricCard } from '@/features/insights/components/metric-card';
import { SegmentedControl } from '@/features/insights/components/segmented-control';
import type {
  InsightExplanation,
  TrendComparison,
} from '@/features/insights/services/metric-definitions';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useInsights } from '@/providers/insights-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function InsightsScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const insights = useInsights();
  const refresh = insights.refresh;

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  if (insights.status === 'loading' && !insights.snapshot) {
    return (
      <Screen contentStyle={styles.center} testID="insights-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('insights.loading')}
        </Text>
      </Screen>
    );
  }

  if (insights.status === 'error' && !insights.snapshot) {
    return (
      <Screen contentStyle={styles.center} testID="insights-error">
        <EmptyState
          action={
            <Button
              label={localization.t('common.retry')}
              onPress={() => void insights.refresh()}
            />
          }
          description={localization.message(insights.errorMessage)}
          icon={
            <Ionicons
              color={theme.colors.warning}
              name="refresh-circle-outline"
              size={48}
            />
          }
          title={localization.t('insights.refreshTitle')}
        />
      </Screen>
    );
  }

  const snapshot = insights.snapshot;
  if (!snapshot) return null;

  return (
    <Screen
      onRefresh={() => void insights.refresh()}
      refreshing={insights.status === 'loading'}
      testID="insights-screen"
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text accessibilityRole="header" variant="display">
          {localization.t('insights.heading')}
        </Text>
        <Text tone="textMuted">{localization.t('insights.description')}</Text>
      </View>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
        <SegmentedControl
          label={localization.t('insights.destination')}
          onChange={insights.selectView}
          options={destinationOptions(localization)}
          value={insights.selectedView}
        />
        <SegmentedControl
          label={localization.t('insights.range')}
          onChange={insights.selectRange}
          options={rangeOptions(localization)}
          value={insights.selectedRange}
        />
      </View>
      <Text style={{ marginTop: theme.spacing.md }} tone="textMuted" variant="caption">
        {localization.t('insights.periodDates', {
          start: localization.formatDate(snapshot.range.current.start, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          end: localization.formatDate(snapshot.range.current.end, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
        })}
      </Text>
      <Text tone="textMuted" variant="caption">
        {localization.t('insights.partialPeriod')}
      </Text>
      {insights.status === 'partial' ? (
        <Card style={{ marginTop: theme.spacing.lg }} variant="subtle">
          <Text accessibilityLiveRegion="polite" tone="warning">
            {localization.t('insights.partialData')}
          </Text>
        </Card>
      ) : null}
      {insights.selectedView === 'summary' ? (
        <SummaryDestination />
      ) : insights.selectedView === 'trends' ? (
        <TrendsDestination />
      ) : (
        <ReflectionsDestination />
      )}
      <Text style={{ marginTop: theme.spacing.xl }} tone="textMuted" variant="caption">
        {localization.t('insights.localPrivacy')}
      </Text>
    </Screen>
  );
}

function SummaryDestination() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const insights = useInsights();
  const snapshot = insights.snapshot!;
  const current = snapshot.current;
  const ratio = current.tasks.completionDenominator
    ? `${localization.formatNumber(current.tasks.completionNumerator)}/${localization.formatNumber(current.tasks.completionDenominator)}`
    : `${localization.formatNumber(0)}/${localization.formatNumber(0)}`;
  const routineOutcomes = `${localization.formatNumber(current.routines.completed)}/${localization.formatNumber(current.routines.skipped)}/${localization.formatNumber(current.routines.pending)}`;
  const activity =
    current.tasks.completed +
    current.workload.plannedBlockCount +
    current.routines.completed +
    current.routines.skipped +
    current.goals.milestonesCompleted +
    current.reflectionCount;

  return (
    <View style={{ gap: theme.spacing.xl, marginTop: theme.spacing.xl }}>
      {activity === 0 ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('insights.noActivityTitle')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('insights.noActivity')}
          </Text>
        </Card>
      ) : null}
      <Section title={localization.t('insights.summary')}>
        <View style={styles.metricGrid}>
          <MetricCard
            basis={localization.t('insights.tasksCompletedBasis')}
            label={localization.t('insights.tasksCompleted')}
            value={localization.formatNumber(current.tasks.completed)}
          />
          <MetricCard
            basis={localization.t('insights.actionableRemainingBasis')}
            label={localization.t('insights.actionableRemaining')}
            value={localization.formatNumber(current.tasks.actionableRemaining)}
          />
          <MetricCard
            basis={localization.t('insights.completionRatioBasis')}
            label={localization.t('insights.completionRatio')}
            value={ratio}
          />
          <MetricCard
            basis={localization.t('insights.plannedTimeBasis')}
            label={localization.t('insights.plannedTime')}
            value={localization.formatDuration(current.workload.plannedMinutes)}
          />
          <MetricCard
            basis={localization.t('insights.completedBlockTimeBasis')}
            label={localization.t('insights.completedBlockTime')}
            value={localization.formatDuration(current.workload.completedMinutes)}
          />
          <MetricCard
            basis={localization.t('insights.overCapacityBasis')}
            label={localization.t('insights.overCapacityDays')}
            value={localization.formatNumber(current.workload.overCapacityDays)}
          />
          <MetricCard
            basis={localization.t('insights.overlapBasis')}
            label={localization.t('insights.overlaps')}
            value={localization.formatNumber(current.workload.overlapCount)}
          />
          <MetricCard
            basis={localization.t('insights.routineOutcomesBasis')}
            label={localization.t('insights.routineOutcomes')}
            value={routineOutcomes}
          />
          <MetricCard
            basis={localization.t('insights.milestonesBasis')}
            label={localization.t('insights.milestonesCompleted')}
            value={localization.formatNumber(current.goals.milestonesCompleted)}
          />
          <MetricCard
            basis={localization.t('insights.activeGoalsBasis')}
            label={localization.t('insights.activeGoals')}
            value={localization.formatNumber(current.goals.activeGoals)}
          />
          <MetricCard
            basis={localization.t('insights.reflectionCountBasis')}
            label={localization.t('insights.reflectionCount')}
            value={localization.formatNumber(current.reflectionCount)}
          />
        </View>
      </Section>
      <ExplanationSection explanations={snapshot.explanations} />
      <WorkloadSection />
      <TaskSection />
      <RoutineSection />
      <GoalSection />
    </View>
  );
}

function WorkloadSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const workload = useInsights().snapshot!.current.workload;
  const visibleDays = workload.days.filter((day) => day.plannedMinutes > 0);
  const maxDay = Math.max(
    1,
    ...visibleDays.map((day) => Math.max(day.plannedMinutes, day.capacityMinutes)),
  );
  const maxWeekday = Math.max(1, ...workload.weekdays.map((day) => day.plannedMinutes));
  return (
    <Section title={localization.t('insights.workload')}>
      <Card style={{ gap: theme.spacing.md }} variant="subtle">
        <Text>
          {localization.t('insights.blockCompletion', {
            completed: localization.formatNumber(workload.completedBlockCount),
            total: localization.formatNumber(workload.plannedBlockCount),
          })}
        </Text>
        <Text>
          {localization.t('insights.unscheduledTasksValue', {
            count: localization.formatNumber(workload.unscheduledActionableTasks),
          })}
        </Text>
        <Text tone="textMuted" variant="caption">
          {localization.t('insights.overlapCounting')}
        </Text>
      </Card>
      <Text variant="label">{localization.t('insights.dayWorkload')}</Text>
      {visibleDays.length ? (
        visibleDays.map((day) => (
          <AccessibleBar
            detail={localization.t('insights.dayWorkloadValue', {
              planned: localization.formatDuration(day.plannedMinutes),
              capacity: localization.formatDuration(day.capacityMinutes),
            })}
            key={day.date}
            label={localization.formatDate(day.date, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            maximum={maxDay}
            value={day.plannedMinutes}
          />
        ))
      ) : (
        <Text tone="textMuted">{localization.t('insights.noPlannedTime')}</Text>
      )}
      <Text variant="label">{localization.t('insights.weekdayDistribution')}</Text>
      {workload.weekdays.map((day) => (
        <AccessibleBar
          detail={localization.formatDuration(day.plannedMinutes)}
          key={day.weekday}
          label={weekdayLabel(day.weekday, localization)}
          maximum={maxWeekday}
          value={day.plannedMinutes}
        />
      ))}
    </Section>
  );
}

function TaskSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const tasks = useInsights().snapshot!.current.tasks;
  const max = Math.max(1, ...tasks.completedByPriority.map((item) => item.count));
  const completedDays = tasks.completedByDay.filter((item) => item.count > 0);
  const maxDay = Math.max(1, ...completedDays.map((item) => item.count));
  return (
    <Section title={localization.t('insights.taskPatterns')}>
      <Card style={{ gap: theme.spacing.sm }} variant="subtle">
        <Text>{localization.t('insights.overdueValue', { count: localization.formatNumber(tasks.overdue) })}</Text>
        <Text>{localization.t('insights.pendingValue', { count: localization.formatNumber(tasks.pending) })}</Text>
        <Text>{localization.t('insights.inProgressValue', { count: localization.formatNumber(tasks.inProgress) })}</Text>
        <Text>{localization.t('insights.activeGoalTasksValue', { count: localization.formatNumber(tasks.connectedToActiveGoals) })}</Text>
      </Card>
      <Text variant="label">{localization.t('insights.completedByPriority')}</Text>
      {tasks.completedByPriority.map((item) => (
        <AccessibleBar
          detail={localization.formatNumber(item.count)}
          key={item.priority}
          label={priorityLabel(item.priority, localization)}
          maximum={max}
          value={item.count}
        />
      ))}
      <Text variant="label">{localization.t('insights.completedByDay')}</Text>
      {completedDays.length ? (
        completedDays.map((item) => (
          <AccessibleBar
            detail={localization.t('insights.completedDayValue', {
              count: localization.formatNumber(item.count),
            })}
            key={item.date}
            label={localization.formatDate(item.date, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            maximum={maxDay}
            value={item.count}
          />
        ))
      ) : (
        <Text tone="textMuted">{localization.t('insights.noCompletedTasks')}</Text>
      )}
    </Section>
  );
}

function RoutineSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const routines = useInsights().snapshot!.current.routines;
  return (
    <Section title={localization.t('insights.routineSummary')}>
      <Card style={{ gap: theme.spacing.sm }} variant="subtle">
        <Text>{localization.t('insights.routineCompletedValue', { count: localization.formatNumber(routines.completed) })}</Text>
        <Text>{localization.t('insights.routineSkippedValue', { count: localization.formatNumber(routines.skipped) })}</Text>
        <Text>{localization.t('insights.routinePendingValue', { count: localization.formatNumber(routines.pending) })}</Text>
        <Text>{localization.t('insights.routineOpportunityValue', { count: localization.formatNumber(routines.scheduled) })}</Text>
        <Text>
          {localization.t('insights.routineCompletionRatio', {
            completed: localization.formatNumber(routines.completed),
            scheduled: localization.formatNumber(routines.scheduled),
          })}
        </Text>
        <Text tone="textMuted" variant="caption">{localization.t('insights.routineBasis')}</Text>
      </Card>
      {routines.items.map((item) => (
        <View key={item.routineId} style={[styles.detailRow, { borderBottomColor: theme.colors.divider }]}>
          <Text style={styles.rowCopy} variant="label">{item.title}</Text>
          <Text tone="textMuted" variant="caption">
            {localization.t('insights.routineItemValue', {
              completed: localization.formatNumber(item.completed),
              skipped: localization.formatNumber(item.skipped),
              pending: localization.formatNumber(item.pending),
              scheduled: localization.formatNumber(item.scheduled),
            })}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function GoalSection() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const goals = useInsights().snapshot!.current.goals;
  return (
    <Section title={localization.t('insights.goalContext')}>
      <Card style={{ gap: theme.spacing.sm }} variant="subtle">
        <Text>{localization.t('insights.linkedTasksCompletedValue', { count: localization.formatNumber(goals.linkedTasksCompleted) })}</Text>
        <Text>{localization.t('insights.upcomingTargetsValue', { count: localization.formatNumber(goals.upcomingTargets) })}</Text>
        <Text>{localization.t('insights.noNextActionValue', { count: localization.formatNumber(goals.goalsWithoutNextAction) })}</Text>
        <Text>{localization.t('insights.goalReflectionsValue', { count: localization.formatNumber(goals.goalReflections) })}</Text>
        <Text tone="textMuted" variant="caption">{localization.t('insights.goalProgressBasis')}</Text>
      </Card>
      {goals.items.map((item) => (
        <View key={item.goal.id} style={[styles.detailRow, { borderBottomColor: theme.colors.divider }]}>
          <Text style={styles.rowCopy} variant="label">{item.goal.title}</Text>
          <Text tone="textMuted" variant="caption">
            {item.progress.percentage === null
              ? localization.t('goals.noNumericProgress')
              : localization.formatPercentage(item.progress.percentage)}
          </Text>
        </View>
      ))}
    </Section>
  );
}

function TrendsDestination() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const trends = useInsights().snapshot!.trends;
  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
      <Text accessibilityRole="header" variant="heading">{localization.t('insights.trends')}</Text>
      <Text tone="textMuted">{localization.t('insights.trendBasis')}</Text>
      {trends.map((trend) => (
        <TrendCard key={trend.metric} trend={trend} />
      ))}
    </View>
  );
}

function TrendCard({ trend }: { trend: TrendComparison }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const duration = trend.metric === 'plannedMinutes';
  const current = duration ? localization.formatDuration(trend.current) : localization.formatNumber(trend.current);
  const previous = duration ? localization.formatDuration(trend.previous) : localization.formatNumber(trend.previous);
  const direction = localization.t(`insights.direction${capitalize(trend.direction)}` as
    | 'insights.directionMore'
    | 'insights.directionSimilar'
    | 'insights.directionLess'
    | 'insights.directionInsufficient');
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{localization.t(trendLabelKey(trend.metric))}</Text>
      <Text tone={trend.direction === 'insufficient' ? 'textMuted' : 'accent'} variant="heading">{direction}</Text>
      <Text>{localization.t('insights.exactComparison', { current, previous })}</Text>
      {trend.direction !== 'insufficient' ? (
        <Text tone="textMuted" variant="caption">
          {localization.t('insights.absoluteDifference', {
            difference: duration
              ? localization.formatDuration(Math.abs(trend.difference))
              : localization.formatNumber(Math.abs(trend.difference)),
          })}
          {trend.percentage !== null
            ? ` ${localization.t('insights.percentageDifference', {
                percentage: localization.formatPercentage(trend.percentage),
              })}`
            : ''}
        </Text>
      ) : (
        <Text tone="textMuted" variant="caption">{localization.t('insights.minimumSample', { count: localization.formatNumber(trend.minimumSample) })}</Text>
      )}
    </Card>
  );
}

function ReflectionsDestination() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const insights = useInsights();
  const router = useRouter();
  const today = insights.today;
  const openCreate = (scope: 'day' | 'week') =>
    today &&
    router.push({
      pathname: '/(insights)/reflections/new',
      params: { scope, periodStart: today },
    } as unknown as Href);
  return (
    <View style={{ gap: theme.spacing.xl, marginTop: theme.spacing.xl }}>
      <View style={styles.actionRow}>
        <Button label={localization.t('reflections.newDaily')} onPress={() => openCreate('day')} style={styles.actionButton} />
        <Button label={localization.t('reflections.newWeekly')} onPress={() => openCreate('week')} style={styles.actionButton} variant="secondary" />
      </View>
      <Section title={localization.t('reflections.history')}>
        {insights.reflections.length ? (
          insights.reflections.map((reflection) => (
            <ReflectionRow key={reflection.id} reflection={reflection} />
          ))
        ) : (
          <Card variant="subtle">
            <Text variant="heading">{localization.t('reflections.emptyTitle')}</Text>
            <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">{localization.t('reflections.empty')}</Text>
          </Card>
        )}
      </Section>
    </View>
  );
}

function ReflectionRow({ reflection }: { reflection: Reflection }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const insights = useInsights();
  const router = useRouter();
  const goal = insights.goals.find((item) => item.id === reflection.scopeId);
  const scope = localization.t(
    reflection.scope === 'day'
      ? 'reflections.daily'
      : reflection.scope === 'week'
        ? 'reflections.weekly'
        : 'reflections.goal',
  );
  const mood = reflection.mood
    ? localization.t(`reflections.mood${capitalize(reflection.mood)}` as
        | 'reflections.moodLow'
        | 'reflections.moodSteady'
        | 'reflections.moodGood'
        | 'reflections.moodGreat')
    : localization.t('common.none');
  return (
    <Pressable
      accessibilityLabel={`${scope}. ${goal?.title ?? ''}. ${localization.formatDate(reflection.periodStart)}. ${localization.t('reflections.moodValue', { mood })}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(insights)/reflections/[id]', params: { id: reflection.id } } as unknown as Href)}
    >
      {({ pressed }) => (
        <Card style={{ gap: theme.spacing.xs, opacity: pressed ? 0.76 : 1 }} variant="subtle">
          <Text variant="label">{goal?.title ? `${scope}: ${goal.title}` : scope}</Text>
          <Text tone="textMuted" variant="caption">{localization.formatDate(reflection.periodStart, { year: 'numeric', month: 'short', day: 'numeric' })} · {localization.t('reflections.moodValue', { mood })}</Text>
          <Text numberOfLines={3}>{reflection.body}</Text>
        </Card>
      )}
    </Pressable>
  );
}

function ExplanationSection({ explanations }: { explanations: InsightExplanation[] }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  return (
    <Section title={localization.t('insights.explanations')}>
      <Card style={{ gap: theme.spacing.sm }} variant="accent">
        {explanations.map((explanation) => (
          <Text key={explanation.id}>{explanationText(explanation, localization)}</Text>
        ))}
        <Text tone="textMuted" variant="caption">{localization.t('insights.explanationBasis')}</Text>
      </Card>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text accessibilityRole="header" variant="heading">{title}</Text>
      {children}
    </View>
  );
}

function destinationOptions(localization: ReturnType<typeof useLocalization>): { value: InsightsView; label: string }[] {
  return [
    { value: 'summary', label: localization.t('insights.summary') },
    { value: 'trends', label: localization.t('insights.trends') },
    { value: 'reflections', label: localization.t('insights.reflections') },
  ];
}

function rangeOptions(localization: ReturnType<typeof useLocalization>): { value: InsightsRange; label: string }[] {
  return [
    { value: '7d', label: localization.t('insights.last7Days') },
    { value: '4w', label: localization.t('insights.last4Weeks') },
    { value: '12w', label: localization.t('insights.last12Weeks') },
  ];
}

function trendLabelKey(metric: TrendComparison['metric']) {
  const keys = {
    tasksCompleted: 'insights.trendTasks',
    plannedMinutes: 'insights.trendPlanned',
    overCapacityDays: 'insights.trendCapacity',
    routineCheckIns: 'insights.trendRoutines',
    milestonesCompleted: 'insights.trendMilestones',
    reflections: 'insights.trendReflections',
  } as const;
  return keys[metric];
}

function explanationText(explanation: InsightExplanation, localization: ReturnType<typeof useLocalization>) {
  if (explanation.id === 'overCapacity') return localization.t('insights.explainOverCapacity', { count: localization.formatNumber(explanation.value) });
  if (explanation.id === 'overlap') return localization.t('insights.explainOverlap', { count: localization.formatNumber(explanation.value) });
  if (explanation.id === 'highPriority') return localization.t('insights.explainHighPriority', { count: localization.formatNumber(explanation.value) });
  if (explanation.id === 'routineMore') return localization.t('insights.explainRoutineMore');
  if (explanation.id === 'routineLess') return localization.t('insights.explainRoutineLess');
  if (explanation.id === 'routineSimilar') return localization.t('insights.explainRoutineSimilar');
  return localization.t('insights.explainInsufficient');
}

function priorityLabel(priority: TaskPriority, localization: ReturnType<typeof useLocalization>) {
  if (priority === 'high') return localization.t('tasks.priorityHigh');
  if (priority === 'medium') return localization.t('tasks.priorityMedium');
  if (priority === 'low') return localization.t('tasks.priorityLow');
  return localization.t('tasks.priorityNone');
}

function weekdayLabel(weekday: number, localization: ReturnType<typeof useLocalization>) {
  const date = `2024-01-${String(7 + weekday).padStart(2, '0')}`;
  return localization.formatDate(date, { weekday: 'long' });
}

function capitalize<TValue extends string>(value: TValue) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

const styles = StyleSheet.create({
  actionButton: { flexGrow: 1 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  center: { alignItems: 'center', gap: 16, justifyContent: 'center' },
  detailRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 6,
  },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  rowCopy: { flex: 1 },
});
