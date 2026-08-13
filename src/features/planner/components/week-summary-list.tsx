import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { CalendarDate } from '@/domain/entities';
import { pluralTranslationKey } from '@/features/localization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

type WeekSummary = {
  date: CalendarDate;
  blockCount: number;
  taskCount: number;
  plannedMinutes: number;
  remainingMinutes: number;
  isOverCapacity: boolean;
  overlapCount: number;
  unscheduledTaskCount: number;
};

export function WeekSummaryList({
  summaries,
  selectedDate,
  onSelect,
}: {
  summaries: WeekSummary[];
  selectedDate: CalendarDate;
  onSelect: (date: CalendarDate) => void;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {summaries.map((summary) => {
        const selected = summary.date === selectedDate;
        const blockKey = pluralTranslationKey(
          localization.language,
          summary.blockCount,
          'planner.blockOne',
          'planner.blockOther',
        );
        const taskKey = pluralTranslationKey(
          localization.language,
          summary.taskCount,
          'planner.taskOne',
          'planner.taskOther',
        );
        return (
          <Card
            key={summary.date}
            padded={false}
            variant={selected ? 'accent' : 'subtle'}
          >
            <Pressable
              accessibilityLabel={`${localization.t('planner.selectedDay')}: ${localization.formatDate(summary.date)}, ${localization.t(blockKey, { count: localization.formatNumber(summary.blockCount) })}, ${localization.t(taskKey, { count: localization.formatNumber(summary.taskCount) })}${summary.isOverCapacity ? `, ${localization.t('planner.overloaded')}` : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelect(summary.date)}
              style={({ pressed }) => [
                styles.row,
                {
                  opacity: pressed ? 0.72 : 1,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            >
              <View style={styles.date}>
                <Text tone={selected ? 'primary' : 'textMuted'} variant="overline">
                  {localization.formatDate(summary.date, { weekday: 'short' })}
                </Text>
                <Text variant="heading">
                  {localization.formatDate(summary.date, { day: 'numeric' })}
                </Text>
              </View>
              <View style={styles.copy}>
                <Text variant="label">
                  {localization.formatDuration(summary.plannedMinutes)}
                </Text>
                <Text tone="textMuted" variant="caption">
                  {localization.t(blockKey, {
                    count: localization.formatNumber(summary.blockCount),
                  })}{' '}
                  ·{' '}
                  {localization.t(taskKey, {
                    count: localization.formatNumber(summary.taskCount),
                  })}
                </Text>
              </View>
              <View style={styles.signals}>
                {summary.overlapCount ? (
                  <Ionicons
                    accessibilityLabel={localization.t(
                      pluralTranslationKey(
                        localization.language,
                        summary.overlapCount,
                        'planner.overlapOne',
                        'planner.overlapOther',
                      ),
                      { count: localization.formatNumber(summary.overlapCount) },
                    )}
                    color={theme.colors.warning}
                    name="layers-outline"
                    size={20}
                  />
                ) : null}
                {summary.isOverCapacity ? (
                  <View style={styles.overloaded}>
                    <Ionicons color={theme.colors.warning} name="speedometer-outline" size={18} />
                    <Text tone="warning" variant="caption">
                      {localization.t('planner.overloaded')}
                    </Text>
                  </View>
                ) : null}
                <Ionicons
                  color={theme.colors.textMuted}
                  name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                />
              </View>
            </Pressable>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 2 },
  date: { alignItems: 'center', width: 48 },
  overloaded: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET + 14,
  },
  signals: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
