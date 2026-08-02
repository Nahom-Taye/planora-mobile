import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

import { Text } from './text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const theme = useAppTheme();
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary ? theme.colors.primary : 'transparent',
          borderColor: isSecondary ? theme.colors.border : 'transparent',
          borderRadius: theme.radii.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.82 : 1,
          paddingHorizontal: theme.spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={isPrimary ? theme.colors.onPrimary : theme.colors.primary}
        />
      ) : (
        <Text
          style={{ color: isPrimary ? theme.colors.onPrimary : theme.colors.primary }}
          variant="label"
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
});
