import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { CapacitySummary as Summary } from '@/features/planner/services/capacity';
import { pluralTranslationKey } from '@/features/localization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

export function CapacitySummary({ summary }: { summary: Summary }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const remaining = localization.formatDuration(Math.abs(summary.remainingMinutes));

  return (
    <View
      accessibilityLabel={localization.t('planner.capacitySummary', {
        planned: localization.formatDuration(summary.plannedMinutes),
        capacity: localization.formatDuration(
          summary.plannedMinutes + summary.remainingMinutes,
        ),
      })}
      accessible
    >
      <Card padded={false} variant="subtle">
        <View style={[styles.content, { gap: theme.spacing.lg }]}>
        <View style={styles.metric}>
          <Text variant="heading">
            {localization.formatDuration(summary.plannedMinutes)}
          </Text>
          <Text tone="textMuted" variant="caption">
            {localization.t('planner.workload')}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text tone={summary.isOverCapacity ? 'warning' : 'accent'} variant="heading">
            {remaining}
          </Text>
          <Text tone="textMuted" variant="caption">
            {localization.t(
              summary.isOverCapacity
                ? 'planner.overCapacity'
                : 'planner.remainingCapacity',
              { duration: remaining },
            )}
          </Text>
        </View>
        <View style={styles.compactMetric}>
          <Ionicons
            color={summary.overlapCount ? theme.colors.warning : theme.colors.textMuted}
            name={summary.overlapCount ? 'layers-outline' : 'checkmark-circle-outline'}
            size={18}
          />
          <Text tone="textMuted" variant="caption">
            {localization.t(
              pluralTranslationKey(
                localization.language,
                summary.overlapCount,
                'planner.overlapOne',
                'planner.overlapOther',
              ),
              { count: localization.formatNumber(summary.overlapCount) },
            )}
          </Text>
        </View>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  compactMetric: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metric: {
    minWidth: 110,
  },
});
