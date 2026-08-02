import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

type BrandMarkProps = {
  size?: number;
};

export function BrandMark({ size = 40 }: BrandMarkProps) {
  const theme = useAppTheme();
  const itemSize = Math.max(4, size * 0.14);
  const lineHeight = Math.max(3, size * 0.09);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          backgroundColor: theme.colors.primary,
          borderRadius: size * 0.3,
          height: size,
          width: size,
        },
      ]}
    >
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={[
            styles.row,
            {
              left: size * 0.2,
              top: size * (0.22 + row * 0.21),
            },
          ]}
        >
          <View
            style={{
              backgroundColor:
                row === 0 ? theme.colors.accent : theme.colors.onPrimary,
              borderRadius: itemSize / 2,
              height: itemSize,
              width: itemSize,
            }}
          />
          <View
            style={{
              backgroundColor: theme.colors.onPrimary,
              borderRadius: lineHeight / 2,
              height: lineHeight,
              opacity: row === 2 ? 0.72 : 0.92,
              width: size * (row === 1 ? 0.32 : 0.4),
            }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'absolute',
  },
});
