import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { GoalProgress } from '@/features/goals/services/goal-progress';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

export function GoalProgressSummary({
  progress,
  compact = false,
}: {
  progress: GoalProgress;
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const label = progressLabel(progress, localization);

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text tone="textMuted" variant={compact ? 'caption' : 'label'}>
        {label}
      </Text>
      {progress.percentage !== null ? (
        <View
          accessibilityLabel={label}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: progress.percentage,
            text: label,
          }}
          style={[
            styles.track,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderRadius: theme.radii.pill,
            },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radii.pill,
                width: `${progress.percentage}%`,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function progressLabel(
  progress: GoalProgress,
  localization: ReturnType<typeof useLocalization>,
) {
  if (progress.state === 'not_started') return localization.t('goals.notStarted');
  if (progress.state === 'context') return localization.t('goals.noNumericProgress');
  if (progress.completed !== null && progress.total !== null) {
    const percentage = localization.t('goals.percentComplete', {
      percent: localization.formatPercentage(progress.percentage ?? 0),
    });
    const count = localization.t('goals.progressCount', {
      completed: localization.formatNumber(progress.completed),
      total: localization.formatNumber(progress.total),
    });
    return `${percentage} · ${count}`;
  }
  return localization.t('goals.percentComplete', {
    percent: localization.formatPercentage(progress.percentage ?? 0),
  });
}

const styles = StyleSheet.create({
  fill: { height: 6 },
  track: { height: 6, overflow: 'hidden', width: '100%' },
});
