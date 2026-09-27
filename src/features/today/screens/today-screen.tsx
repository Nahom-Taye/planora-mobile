import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

import { CreateActionSheet } from '../components/create-action-sheet';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const logoSpin = useRef(new Animated.Value(0)).current;
  const menuProgress = useRef(new Animated.Value(0)).current;

  const toggleMenu = () => {
    const opening = !menuOpen;
    if (opening) setMenuOpen(true);
    logoSpin.setValue(0);
    Animated.parallel([
      Animated.timing(logoSpin, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(menuProgress, {
        toValue: opening ? 1 : 0,
        friction: 7,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (!opening) setMenuOpen(false);
    });
  };

  const closeMenuAnd = (action: () => void) => {
    menuProgress.setValue(0);
    setMenuOpen(false);
    action();
  };

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
  const lanternLit = theme.mode === 'dark';
  const toggleTheme = () => {
    void localization.setTheme(lanternLit ? 'light' : 'dark');
  };

  if ((planning.status === 'idle' || planning.status === 'loading') && !planning.plan) {
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
          <Button
            label={localization.t('tabs.settings')}
            onPress={() => router.replace('/(tabs)/settings')}
            variant="secondary"
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
  const streak = completionStreak(
    planning.tasks,
    planning.today,
    workspace.profile.timeZone,
  );
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

  const createAnd = (action: () => void) => {
    setCreateOpen(false);
    action();
  };
  const createActions = [
    {
      key: 'task',
      icon: 'checkbox-outline' as const,
      label: localization.t('tasks.new'),
      description: localization.t('today.createTaskHint'),
      onPress: () => createAnd(() => router.push('/(tasks)/tasks/new')),
    },
    {
      key: 'routine',
      icon: 'repeat-outline' as const,
      label: localization.t('routines.new'),
      description: localization.t('today.createRoutineHint'),
      onPress: () => createAnd(() => router.push('/(routines)/routines/new')),
    },
    {
      key: 'block',
      icon: 'time-outline' as const,
      label: localization.t('planner.newBlock'),
      description: localization.t('today.createBlockHint'),
      onPress: () =>
        createAnd(() =>
          router.push({
            pathname: '/(planner)/blocks/new',
            params: { date: planning.today },
          } as unknown as Href),
        ),
    },
  ];

  return (
    <Screen
      onRefresh={() => void refresh()}
      refreshing={planning.status === 'loading' || planner.status === 'loading'}
      safeAreaEdges={['top', 'right', 'left']}
      testID="today-screen"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('today.moreActions')}
          accessibilityRole="button"
          accessibilityState={{ expanded: menuOpen }}
          onPress={toggleMenu}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: logoSpin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
                {
                  scale: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            }}
          >
            <BrandWordmark compact markSize={28} />
          </Animated.View>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel={localization.t('settings.appearance')}
            accessibilityRole="button"
            accessibilityState={{ selected: lanternLit }}
            onPress={toggleTheme}
            style={[
              styles.iconButton,
              {
                backgroundColor: lanternLit ? 'rgba(255, 173, 84, 0.16)' : theme.colors.surface,
                borderColor: lanternLit ? 'rgba(255, 173, 84, 0.55)' : theme.colors.divider,
                borderWidth: 1,
                borderRadius: theme.radii.pill,
              },
              lanternLit && styles.lanternGlow,
            ]}
          >
            <Ionicons
              color={lanternLit ? '#FFAD54' : theme.colors.textMuted}
              name={lanternLit ? 'flame' : 'flame-outline'}
              size={21}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={localization.t('common.refresh')}
            accessibilityRole="button"
            accessibilityState={{ busy: planning.status === 'loading' }}
            onPress={() => void refresh()}
            style={[styles.iconButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider, borderWidth: 1, borderRadius: theme.radii.pill }]}
          >
            <Ionicons color={theme.colors.textMuted} name="refresh" size={21} />
          </Pressable>
          <Pressable
            accessibilityLabel={localization.t('today.moreActions')}
            accessibilityRole="button"
            onPress={() => setCreateOpen(true)}
            style={[styles.iconButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill }, theme.shadows.floating]}
          >
            <Ionicons color={theme.colors.onPrimary} name="add" size={25} />
          </Pressable>
        </View>
      </View>

      <CreateActionSheet
        actions={createActions}
        onClose={() => setCreateOpen(false)}
        title={localization.t('today.createTitle')}
        visible={createOpen}
      />

      {menuOpen ? (
        <Animated.View
          style={[
            styles.brandMenu,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.divider,
              borderRadius: theme.radii.lg,
              left: theme.spacing.lg,
              right: theme.spacing.lg,
              opacity: menuProgress,
              transform: [
                {
                  translateY: menuProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-12, 0],
                  }),
                },
              ],
            },
            theme.shadows.floating,
          ]}
        >
          {(
            [
              { icon: 'person-circle-outline', label: localization.t('today.menuProfile'), section: 'account' },
              { icon: 'globe-outline', label: localization.t('settings.language'), section: 'language' },
              { icon: 'notifications-outline', label: localization.t('today.menuNotifications'), section: 'reminders' },
            ] as const
          ).map((item, index, items) => (
            <Pressable
              accessibilityRole="button"
              key={item.icon}
              onPress={() =>
                closeMenuAnd(() =>
                  router.push({
                    pathname: '/(tabs)/settings',
                    params: { section: item.section, ts: String(Date.now()) },
                  } as unknown as Href),
                )
              }
              style={[
                styles.brandMenuRow,
                { paddingHorizontal: theme.spacing.lg },
                index < items.length - 1 && {
                  borderBottomColor: theme.colors.divider,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.brandMenuIcon,
                  { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.pill },
                ]}
              >
                <Ionicons color={theme.colors.primary} name={item.icon} size={17} />
              </View>
              <Text style={styles.brandMenuLabel} variant="label">
                {item.label}
              </Text>
              <Ionicons color={theme.colors.textMuted} name="chevron-forward" size={16} />
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      <View style={[styles.heading, { marginTop: theme.spacing.lg }]}>
        <Text accessibilityRole="header" variant="title">
          {localization.t('today.greeting')}
        </Text>
        <Text tone="textMuted">
          {localization.formatDate(planning.today, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text tone="textMuted" variant="caption">
          {localization.t('today.help')}
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
          theme.shadows.floating,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.xl,
            gap: theme.spacing.lg,
            marginTop: theme.spacing.lg,
            overflow: 'hidden',
          },
        ]}
      >
        <View pointerEvents="none" style={[styles.heroBlob, { backgroundColor: 'rgba(255, 255, 255, 0.14)', top: -70, right: -50, width: 190, height: 190, borderRadius: 95 }]} />
        <View pointerEvents="none" style={[styles.heroBlob, { backgroundColor: 'rgba(255, 139, 194, 0.22)', bottom: -80, left: -40, width: 170, height: 170, borderRadius: 85 }]} />
        <View style={styles.progressHeading}>
          <View style={styles.progressCopy}>
            <Text tone="onPrimary" variant="label">{localization.t('today.completed')}</Text>
            <Text style={{ opacity: 0.85 }} tone="onPrimary" variant="caption">
              {localization.t('today.progress', {
                completed: localization.formatNumber(plan.completedCount),
                total: localization.formatNumber(plan.totalCount),
              })}
            </Text>
            {streak > 0 ? (
              <View style={[styles.streakChip, { borderRadius: theme.radii.pill }]}>
                <Ionicons color="#FFAD54" name="flame" size={14} />
                <Text tone="onPrimary" variant="caption">
                  {localization.t('today.streak', {
                    count: localization.formatNumber(streak),
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          <Text tone="onPrimary" variant="display">
            {localization.formatNumber(plan.completedCount)}
            <Text style={{ opacity: 0.75 }} tone="onPrimary" variant="heading"> / {localization.formatNumber(plan.totalCount)}</Text>
          </Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={localization.t('today.completed')}
          accessibilityValue={{ min: 0, max: Math.max(1, plan.totalCount), now: plan.completedCount }}
          style={[styles.progressTrack, { backgroundColor: 'rgba(255, 255, 255, 0.25)' }]}
        >
          <View style={[styles.progressFill, { backgroundColor: theme.colors.onPrimary, width: `${plan.totalCount ? Math.min(100, plan.completedCount / plan.totalCount * 100) : 0}%` }]} />
        </View>
      </View>
      <View style={[styles.metrics, { gap: theme.spacing.md }]}>
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
        icon="flag"
        tasks={attention}
        title={localization.t('today.priority')}
      />
      <TodayTaskSection
        emptyLabel={localization.t('today.noRemaining')}
        icon="list"
        tasks={remaining}
        title={localization.t('today.remaining')}
      />
      <TodayRoutineSection checkIns={plan.checkIns} routines={plan.routines} />
      <AgendaPreview blocks={todayBlocks} />
      {plan.unscheduled.length ? (
        <TodayTaskSection
          icon="time"
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
  const theme = useAppTheme();
  return (
    <View style={[styles.summaryMetric, { backgroundColor: theme.colors.surface, borderColor: theme.colors.divider, borderRadius: theme.radii.lg }]}>
      <Text tone={tone} variant="heading">
        {value}
      </Text>
      <Text tone="textMuted" variant="caption">
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
        <Text variant="label">{block.title}</Text>
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
    <View style={{ marginTop: theme.spacing.lg }}>
      <View style={styles.sectionHeading}>
        <View style={styles.sectionTitleRow}>
          <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft }]}>
            <Ionicons color={theme.colors.primary} name="calendar-clear" size={15} />
          </View>
          <Text variant="heading">{localization.t('today.agenda')}</Text>
        </View>
        <InlineLink
          label={localization.t('today.openPlanner')}
          onPress={() => router.push('/(tabs)/planner')}
        />
      </View>
      {blocks.length === 0 ? (
        <Text tone="textMuted">
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
                <Text variant="label">{block.title}</Text>
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

function dateInZone(instant: string, timeZone: string) {
  const value = new Date(instant);
  if (Number.isNaN(value.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  } catch {
    return null;
  }
}

function previousDay(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 12)).toISOString().slice(0, 10);
}

function completionStreak(
  tasks: { completedAt: string | null }[],
  today: string,
  timeZone: string,
) {
  const days = new Set<string>();
  for (const task of tasks) {
    if (!task.completedAt) continue;
    const day = dateInZone(task.completedAt, timeZone);
    if (day) days.add(day);
  }
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

const styles = StyleSheet.create({
  agendaRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 14,
  },
  agendaTime: { width: 72 },
  brandMenu: { borderWidth: 1, elevation: 12, position: 'absolute', top: 76, zIndex: 40 },
  brandMenuIcon: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  brandMenuLabel: { flex: 1 },
  brandMenuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: 10,
  },
  center: { gap: 16, justifyContent: 'center' },
  completedToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
  },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: 8 },
  heading: { gap: 8 },
  heroBlob: { position: 'absolute' },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  lanternGlow: {
    elevation: 6,
    shadowColor: '#FFAD54',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
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
    paddingVertical: 20,
  },
  nextCopy: { flex: 1, gap: 6 },
  nextTime: { gap: 8, flexBasis: 80, flexShrink: 1 },
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
    minHeight: 64,
    paddingStart: 14,
    paddingEnd: 4,
  },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, justifyContent: 'space-between' },
  sectionIcon: { alignItems: 'center', borderRadius: 8, height: 26, justifyContent: 'center', width: 26 },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  summary: { padding: 20 },
  streakChip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  progressHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  progressCopy: { flex: 1, minWidth: 140, gap: 6 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  summaryMetric: { flexGrow: 1, flexBasis: 140, gap: 6, padding: 16, borderWidth: StyleSheet.hairlineWidth },
});
