import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Button, Card, Screen, Text } from '@/components/ui';
import type { PlanBlock } from '@/domain/entities';
import { calculateCapacity } from '@/features/planner/services/capacity';
import { blocksForDate } from '@/features/planner/services/planner-organization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanner } from '@/providers/planner-provider';
import { usePlanning } from '@/providers/planning-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

import { TodayRoutineSection } from '../components/today-routine-section';
import { TodayTaskSection } from '../components/today-task-section';

export function TodayScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const planning = usePlanning();
  const planner = usePlanner();
  const workspace = useWorkspace();
  const [quickTitle, setQuickTitle] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const capture = async () => {
    if (!quickTitle.trim() || planning.isMutating) return;
    const result = await planning.quickCapture(quickTitle);
    if (result.ok) {
      setQuickTitle('');
      setQuickError(null);
    } else {
      setQuickError(
        localization.message(
          result.fieldErrors?.title ?? localization.t('errors.generic'),
        ),
      );
    }
  };
  const refresh = () => Promise.all([planning.refresh(), planner.refresh()]);

  if (planning.status === 'loading' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="today-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('today.loading')}
        </Text>
      </Screen>
    );
  }

  if (planning.status === 'error' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="today-error">
        <Card>
          <Text accessibilityRole="header" variant="heading">
            {localization.t('today.refreshTitle')}
          </Text>
          <Text style={{ marginVertical: theme.spacing.md }} tone="textMuted">
            {localization.message(
              planning.errorMessage ?? localization.t('today.failed'),
            )}
          </Text>
          <Button
            label={localization.t('common.retry')}
            onPress={() => void refresh()}
          />
        </Card>
      </Screen>
    );
  }

  const plan = planning.plan;
  if (!plan || !planning.today || !workspace.profile) return null;
  const todayBlocks = blocksForDate(planner.blocks, planning.today).filter(
    (block) => block.status !== 'cancelled',
  );
  const capacity = calculateCapacity(
    todayBlocks,
    planning.tasks,
    planner.capacityMinutes,
    workspace.profile.timeZone,
  );
  const nowTime = localTimeNow(workspace.profile.timeZone);
  const nextBlock = todayBlocks.find(
    (block) => block.status === 'planned' && block.endTime > nowTime,
  );
  const attention = uniqueTasks([
    ...plan.overdue,
    ...plan.today.filter((task) => task.priority === 'high'),
  ]);
  const remaining = plan.today.filter(
    (task) => !attention.some((item) => item.id === task.id),
  );
  const hasAnything =
    attention.length +
      remaining.length +
      plan.unscheduled.length +
      plan.completed.length +
      plan.routines.length +
      todayBlocks.length >
    0;

  const showCreateMenu = () =>
    Alert.alert(localization.t('today.moreActions'), undefined, [
      {
        text: localization.t('tasks.new'),
        onPress: () => router.push('/(tasks)/tasks/new'),
      },
      {
        text: localization.t('routines.new'),
        onPress: () => router.push('/(routines)/routines/new'),
      },
      {
        text: localization.t('planner.newBlock'),
        onPress: () =>
          router.push({
            pathname: '/(planner)/blocks/new',
            params: { date: planning.today },
          } as unknown as Href),
      },
      { text: localization.t('common.cancel'), style: 'cancel' },
    ]);

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={planning.status === 'loading' || planner.status === 'loading'}
      safeAreaEdges={['top', 'right', 'left']}
      testID="today-screen"
    >
      <View style={styles.header}>
        <BrandWordmark compact markSize={28} />
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={localization.t('common.refresh')}
            accessibilityRole="button"
            accessibilityState={{ busy: planning.status === 'loading' }}
            onPress={() => void refresh()}
            style={styles.iconButton}
          >
            <Ionicons color={theme.colors.textMuted} name="refresh" size={21} />
          </Pressable>
          <Pressable
            accessibilityLabel={localization.t('today.moreActions')}
            accessibilityRole="button"
            onPress={showCreateMenu}
            style={styles.iconButton}
          >
            <Ionicons color={theme.colors.primary} name="add-circle-outline" size={26} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.heading, { marginTop: theme.spacing.lg }]}>
        <Text accessibilityRole="header" variant="title">
          {localization.t('today.greeting')}
        </Text>
        <Text tone="textMuted">
          {localization.formatDate(planning.today, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View
        accessibilityLabel={`${localization.t('today.progress', {
          completed: localization.formatNumber(plan.completedCount),
          total: localization.formatNumber(plan.totalCount),
        })}. ${localization.t('planner.capacitySummary', {
          planned: localization.formatDuration(capacity.plannedMinutes),
          capacity: localization.formatDuration(planner.capacityMinutes),
        })}`}
        style={[
          styles.summary,
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderRadius: theme.radii.lg,
            gap: theme.spacing.lg,
            marginTop: theme.spacing.lg,
          },
        ]}
      >
        <SummaryMetric
          label={localization.t('today.progress', {
            completed: localization.formatNumber(plan.completedCount),
            total: localization.formatNumber(plan.totalCount),
          })}
          value={`${localization.formatNumber(plan.completedCount)}/${localization.formatNumber(plan.totalCount)}`}
        />
        <SummaryMetric
          label={
            capacity.isOverCapacity
              ? localization.t('planner.overloaded')
              : localization.t('planner.remainingCapacity', {
                  duration: localization.formatDuration(capacity.remainingMinutes),
                })
          }
          tone={capacity.isOverCapacity ? 'warning' : 'accent'}
          value={localization.formatDuration(capacity.plannedMinutes)}
        />
        <SummaryMetric
          label={localization.t('planner.overlapOther', {
            count: localization.formatNumber(capacity.overlapCount),
          })}
          tone={capacity.overlapCount ? 'warning' : 'textMuted'}
          value={localization.formatNumber(capacity.overlapCount)}
        />
      </View>

      <View
        style={[
          styles.quickRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: quickError ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radii.lg,
            marginTop: theme.spacing.lg,
          },
        ]}
      >
        <Ionicons color={theme.colors.textMuted} name="add" size={21} />
        <TextInput
          accessibilityHint={localization.t('today.quickHint')}
          accessibilityLabel={localization.t('today.quickLabel')}
          maxLength={201}
          onChangeText={(value) => {
            setQuickTitle(value);
            if (quickError) setQuickError(null);
          }}
          onSubmitEditing={() => void capture()}
          placeholder={localization.t('today.quickPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          style={[
            styles.quickInput,
            theme.typography.body,
            {
              color: theme.colors.text,
              textAlign: localization.isRTL ? 'right' : 'left',
              writingDirection: localization.direction,
            },
          ]}
          value={quickTitle}
        />
        <Pressable
          accessibilityLabel={localization.t('today.add')}
          accessibilityRole="button"
          accessibilityState={{ disabled: planning.isMutating || !quickTitle.trim() }}
          disabled={planning.isMutating || !quickTitle.trim()}
          onPress={() => void capture()}
          style={styles.quickAdd}
        >
          <Ionicons
            color={quickTitle.trim() ? theme.colors.primary : theme.colors.textMuted}
            name={localization.isRTL ? 'arrow-back-circle' : 'arrow-forward-circle'}
            size={28}
          />
        </Pressable>
      </View>
      {quickError ? (
        <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
          {quickError}
        </Text>
      ) : null}

      {nextBlock ? (
        <NextBlock block={nextBlock} />
      ) : !hasAnything ? (
        <Text style={{ marginTop: theme.spacing.xl }} tone="textMuted">
          {localization.t('today.quietEmpty')}
        </Text>
      ) : null}

      <TodayTaskSection
        emptyLabel={localization.t('today.noPriority')}
        tasks={attention}
        title={localization.t('today.priority')}
      />
      <TodayTaskSection
        emptyLabel={localization.t('today.noRemaining')}
        tasks={remaining}
        title={localization.t('today.remaining')}
      />
      <TodayRoutineSection checkIns={plan.checkIns} routines={plan.routines} />
      <AgendaPreview blocks={todayBlocks} />
      {plan.unscheduled.length ? (
        <TodayTaskSection
          tasks={plan.unscheduled}
          title={localization.t('today.unscheduled')}
        />
      ) : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showCompleted }}
          onPress={() => setShowCompleted((value) => !value)}
          style={styles.completedToggle}
        >
          <Text tone="textMuted" variant="label">
            {localization.t(
              showCompleted ? 'today.hideCompleted' : 'today.showCompleted',
            )}
          </Text>
          <Ionicons
            color={theme.colors.textMuted}
            name={showCompleted ? 'chevron-up' : 'chevron-down'}
            size={20}
          />
        </Pressable>
        {showCompleted ? (
          <TodayTaskSection
            completed
            tasks={plan.completed}
            title={localization.t('today.completed')}
          />
        ) : null}
      </View>

      <View style={[styles.links, { borderTopColor: theme.colors.divider }]}>
        <InlineLink
          label={localization.t('today.allTasks')}
          onPress={() => router.push('/(tasks)/tasks')}
        />
        <InlineLink
          label={localization.t('today.allRoutines')}
          onPress={() => router.push('/(routines)/routines')}
        />
        <InlineLink
          label={localization.t('today.openPlanner')}
          onPress={() => router.push('/(tabs)/planner')}
        />
        <InlineLink
          label={localization.t('reflections.reflectToday')}
          onPress={() =>
            router.push({
              pathname: '/(insights)/reflections/new',
              params: { scope: 'day', periodStart: planning.today },
            } as unknown as Href)
          }
        />
      </View>

      {planning.errorMessage || planner.errorMessage ? (
        <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
          {localization.message(planning.errorMessage ?? planner.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function SummaryMetric({
  value,
  label,
  tone = 'text',
}: {
  value: string;
  label: string;
  tone?: 'text' | 'textMuted' | 'accent' | 'warning';
}) {
  return (
    <View style={styles.summaryMetric}>
      <Text tone={tone} variant="heading">
        {value}
      </Text>
      <Text numberOfLines={2} tone="textMuted" variant="caption">
        {label}
      </Text>
    </View>
  );
}

function NextBlock({ block }: { block: PlanBlock }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  return (
    <Pressable
      accessibilityHint={localization.t('planner.blockDetails')}
      accessibilityLabel={`${localization.t('today.nextUp')}: ${block.title}, ${localization.formatTime(block.startTime)}–${localization.formatTime(block.endTime)}`}
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/(planner)/blocks/[id]', params: { id: block.id } } as unknown as Href)
      }
      style={[
        styles.nextBlock,
        {
          backgroundColor: theme.colors.accentSoft,
          borderRadius: theme.radii.lg,
          marginTop: theme.spacing.xl,
        },
      ]}
    >
      <View style={styles.nextTime}>
        <Text tone="accent" variant="overline">
          {localization.t('today.nextUp')}
        </Text>
        <Text variant="label">{localization.formatTime(block.startTime)}</Text>
      </View>
      <View style={styles.nextCopy}>
        <Text numberOfLines={2} variant="label">{block.title}</Text>
        <Text tone="textMuted" variant="caption">
          {localization.formatTime(block.startTime)}–{localization.formatTime(block.endTime)}
        </Text>
      </View>
      <Ionicons
        color={theme.colors.textMuted}
        name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
        size={20}
      />
    </Pressable>
  );
}

function AgendaPreview({ blocks }: { blocks: PlanBlock[] }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  return (
    <View style={{ marginTop: theme.spacing.xl }}>
      <View style={styles.sectionHeading}>
        <Text variant="heading">{localization.t('today.agenda')}</Text>
        <InlineLink
          label={localization.t('today.openPlanner')}
          onPress={() => router.push('/(tabs)/planner')}
        />
      </View>
      {blocks.length === 0 ? (
        <Text tone="textMuted" variant="caption">
          {localization.t('today.noAgenda')}
        </Text>
      ) : (
        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
          {blocks.slice(0, 5).map((block) => (
            <Pressable
              accessibilityRole="button"
              key={block.id}
              onPress={() =>
                router.push({
                  pathname: '/(planner)/blocks/[id]',
                  params: { id: block.id },
                } as unknown as Href)
              }
              style={[styles.agendaRow, { borderBottomColor: theme.colors.divider }]}
            >
              <Text style={styles.agendaTime} tone="textMuted" variant="caption">
                {localization.formatTime(block.startTime)}
              </Text>
              <View style={styles.nextCopy}>
                <Text numberOfLines={1} variant="label">{block.title}</Text>
                <Text tone="textMuted" variant="caption">
                  {localization.formatTime(block.endTime)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function InlineLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.inlineLink}>
      <Text tone="primary" variant="caption">{label}</Text>
    </Pressable>
  );
}

function localTimeNow(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

function uniqueTasks<T extends { id: string }>(tasks: T[]) {
  return [...new Map(tasks.map((task) => [task.id, task])).values()];
}

const styles = StyleSheet.create({
  agendaRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 6,
  },
  agendaTime: { width: 72 },
  center: { gap: 16, justifyContent: 'center' },
  completedToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row' },
  heading: { gap: 4 },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  inlineLink: { justifyContent: 'center', minHeight: MIN_TOUCH_TARGET, paddingHorizontal: 4 },
  links: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 28,
    paddingTop: 10,
  },
  nextBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nextCopy: { flex: 1, gap: 2 },
  nextTime: { gap: 3, minWidth: 74 },
  quickAdd: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  quickInput: { flex: 1, minHeight: MIN_TOUCH_TARGET, paddingVertical: 8 },
  quickRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 54,
    paddingStart: 14,
    paddingEnd: 4,
  },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', padding: 14 },
  summaryMetric: { flex: 1, minWidth: 92 },
});
