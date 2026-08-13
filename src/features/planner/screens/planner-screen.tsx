import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Button, Card, Screen, Text } from '@/components/ui';
import { CapacitySummary } from '@/features/planner/components/capacity-summary';
import { DayTimeline } from '@/features/planner/components/day-timeline';
import { PlannerDateNavigation } from '@/features/planner/components/planner-date-navigation';
import { UnscheduledTaskTray } from '@/features/planner/components/unscheduled-task-tray';
import { WeekSummaryList } from '@/features/planner/components/week-summary-list';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanner } from '@/providers/planner-provider';
import { useWorkspace } from '@/providers/workspace-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function PlannerScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const planner = usePlanner();
  const workspace = useWorkspace();
  const router = useRouter();

  if (!planner.selectedDate || !workspace.profile) {
    return (
      <Screen contentStyle={styles.center} testID="planner-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('planner.loading')}
        </Text>
      </Screen>
    );
  }

  if (planner.status === 'error' && planner.blocks.length === 0) {
    return (
      <Screen contentStyle={styles.center} testID="planner-error">
        <Card>
          <Text accessibilityRole="header" variant="heading">
            {localization.t('planner.refreshTitle')}
          </Text>
          <Text style={{ marginVertical: theme.spacing.md }} tone="textMuted">
            {localization.message(planner.errorMessage)}
          </Text>
          <Button label={localization.t('common.retry')} onPress={() => void planner.refresh()} />
        </Card>
      </Screen>
    );
  }

  const setView = (view: 'day' | 'week') => void planner.setView(view);
  const openNew = () =>
    router.push({
      pathname: '/(planner)/blocks/new',
      params: { date: planner.selectedDate },
    } as unknown as Href);

  return (
    <Screen
      onRefresh={() => void planner.refresh()}
      refreshing={planner.status === 'loading'}
      safeAreaEdges={['top', 'right', 'left']}
      testID="planner-screen"
    >
      <View style={styles.topRow}>
        <BrandWordmark compact markSize={30} />
        <Pressable
          accessibilityLabel={localization.t('planner.newBlock')}
          accessibilityRole="button"
          onPress={openNew}
          style={[
            styles.addButton,
            { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill },
          ]}
        >
          <Ionicons color={theme.colors.onPrimary} name="add" size={24} />
        </Pressable>
      </View>

      <View style={[styles.headingRow, { marginTop: theme.spacing.xl }]}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" variant="title">
            {localization.t('planner.title')}
          </Text>
          <Text tone="textMuted">
            {localization.formatDate(planner.selectedDate)}
          </Text>
        </View>
        <View
          accessibilityRole="tablist"
          style={[
            styles.segment,
            { backgroundColor: theme.colors.surfaceSubtle, borderRadius: theme.radii.pill },
          ]}
        >
          {(['day', 'week'] as const).map((view) => {
            const selected = planner.view === view;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={view}
                onPress={() => setView(view)}
                style={[
                  styles.segmentButton,
                  selected && {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <Text tone={selected ? 'primary' : 'textMuted'} variant="caption">
                  {localization.t(view === 'day' ? 'planner.day' : 'planner.week')}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.lg }}>
        <PlannerDateNavigation
          date={planner.selectedDate}
          mode={planner.view}
          onChange={planner.selectDate}
          onMove={planner.view === 'day' ? planner.moveDate : planner.moveWeek}
          onToday={planner.selectToday}
        />
      </View>

      {planner.view === 'day' ? (
        <View style={[styles.content, { gap: theme.spacing.xl }]}>
          {planner.capacity ? <CapacitySummary summary={planner.capacity} /> : null}
          <View style={{ gap: theme.spacing.md }}>
            <View style={styles.sectionHeader}>
              <Text variant="heading">{localization.t('planner.timeline')}</Text>
              <Button
                label={localization.t('planner.newBlock')}
                onPress={openNew}
                variant="ghost"
              />
            </View>
            {planner.selectedBlocks.length === 0 ? (
              <Text tone="textMuted" variant="caption">
                {localization.t('planner.noBlocks')}
              </Text>
            ) : null}
            <DayTimeline
              blocks={planner.selectedBlocks}
              date={planner.selectedDate}
              dayStartsAt={localization.settings?.planningDayStartsAt ?? '06:00'}
              timeZone={workspace.profile.timeZone}
              today={planner.today}
            />
          </View>
          <UnscheduledTaskTray
            date={planner.selectedDate}
            tasks={planner.unscheduledTasks}
          />
        </View>
      ) : (
        <View style={[styles.content, { gap: theme.spacing.lg }]}>
          <WeekSummaryList
            onSelect={(date) => {
              planner.selectDate(date);
              void planner.setView('day');
            }}
            selectedDate={planner.selectedDate}
            summaries={planner.weekSummaries}
          />
          <Text tone="textMuted" variant="caption">
            {localization.t('planner.overlapCounted')}
          </Text>
        </View>
      )}

      {planner.errorMessage ? (
        <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
          {localization.message(planner.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  center: { gap: 16, justifyContent: 'center' },
  content: { marginTop: 24 },
  headingCopy: { flex: 1, gap: 3 },
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  segment: { flexDirection: 'row', padding: 3 },
  segmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
  },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
});
