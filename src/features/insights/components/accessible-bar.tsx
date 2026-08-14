import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

export function AccessibleBar({
  label,
  value,
  maximum,
  detail,
}: {
  label: string;
  value: number;
  maximum: number;
  detail: string;
}) {
  const theme = useAppTheme();
  const width = maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0;
  return (
    <View
      accessibilityLabel={`${label}. ${detail}`}
      accessible
      style={{ gap: theme.spacing.xs }}
    >
      <View style={styles.header}>
        <Text style={styles.label} variant="caption">
          {label}
        </Text>
        <Text tone="textMuted" variant="caption">
          {detail}
        </Text>
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: theme.colors.surfaceSubtle,
            borderColor: theme.colors.border,
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
              width: `${width}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { height: 10 },
  header: { flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  label: { flex: 1 },
  track: { borderWidth: StyleSheet.hairlineWidth, height: 12, overflow: 'hidden' },
});
