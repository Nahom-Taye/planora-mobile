import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  selected,
  style,
}: ButtonProps) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isDanger = variant === 'danger';

  const animateTo = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      speed: 40,
      bounciness: 5,
      useNativeDriver: true,
    }).start();

  const contentColor = isPrimary
    ? theme.colors.onPrimary
    : isDanger
      ? theme.colors.onDanger
      : theme.colors.primary;

  const content = loading ? (
    <ActivityIndicator color={contentColor} />
  ) : (
    <Text align="center" style={{ color: contentColor }} variant="label">
      {label}
    </Text>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ busy: loading, disabled: isDisabled, selected }}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        style={({ pressed }) => [
          styles.base,
          {
            backgroundColor: isPrimary
              ? 'transparent'
              : isDanger
                ? theme.colors.danger
                : isSecondary
                  ? pressed
                    ? theme.colors.surfaceSubtle
                    : theme.colors.surface
                  : pressed
                    ? theme.colors.primarySoft
                    : 'transparent',
            borderColor: isSecondary ? theme.colors.border : 'transparent',
            borderRadius: theme.radii.pill,
            opacity: isDisabled ? 0.45 : pressed && isDanger ? 0.85 : 1,
            paddingHorizontal: isPrimary ? 0 : theme.spacing.lg,
            paddingVertical: isPrimary ? 0 : 11,
            overflow: 'hidden',
          },
          isPrimary && !isDisabled && theme.shadows.subtle,
        ]}
      >
        {({ pressed }) =>
          isPrimary ? (
            <LinearGradient
              colors={
                pressed
                  ? [theme.colors.primaryPressed, theme.colors.primaryPressed]
                  : theme.gradients.primary
              }
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[
                styles.gradient,
                {
                  borderRadius: theme.radii.pill,
                  paddingHorizontal: theme.spacing.lg,
                },
              ]}
            >
              {content}
            </LinearGradient>
          ) : (
            content
          )
        }
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET + 4,
    flexShrink: 1,
  },
  gradient: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET + 2,
    paddingVertical: 11,
  },
});
