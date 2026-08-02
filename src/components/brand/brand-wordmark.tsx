import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

import { BrandMark } from './brand-mark';

type BrandWordmarkProps = {
  markSize?: number;
  compact?: boolean;
};

export function BrandWordmark({
  markSize = 40,
  compact = false,
}: BrandWordmarkProps) {
  const theme = useAppTheme();

  return (
    <View
      accessibilityLabel="Planora"
      accessibilityRole="header"
      style={[styles.container, { gap: theme.spacing.md }]}
    >
      <BrandMark size={markSize} />
      <Text
        style={{ fontSize: compact ? 22 : 30, letterSpacing: -0.5 }}
        variant="title"
      >
        Planora
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
