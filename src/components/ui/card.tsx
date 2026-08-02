import { type PropsWithChildren } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

type CardProps = PropsWithChildren<{
  variant?: 'default' | 'subtle' | 'accent';
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({
  children,
  variant = 'default',
  padded = true,
  style,
}: CardProps) {
  const theme = useAppTheme();
  const backgroundColor =
    variant === 'accent'
      ? theme.colors.accentSoft
      : variant === 'subtle'
        ? theme.colors.surfaceSubtle
        : theme.colors.surface;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.xl,
          padding: padded ? theme.spacing.xl : 0,
        },
        variant === 'default' && theme.shadows.subtle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
