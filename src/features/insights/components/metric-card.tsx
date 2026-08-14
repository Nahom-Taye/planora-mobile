import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

export function MetricCard({
  label,
  value,
  basis,
}: {
  label: string;
  value: string;
  basis: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      accessibilityLabel={`${label}: ${value}. ${basis}`}
      accessible
      style={styles.item}
    >
      <Card style={{ flex: 1, gap: theme.spacing.sm }} variant="subtle">
        <Text variant="heading">{value}</Text>
        <Text variant="label">{label}</Text>
        <Text tone="textMuted" variant="caption">
          {basis}
        </Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexGrow: 1, minWidth: 150, width: '47%' },
});
