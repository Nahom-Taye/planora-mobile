import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function ChoiceChips<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: TValue;
  options: { value: TValue; label: string }[];
  onChange: (value: TValue) => void;
}) {
  const theme = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      <Text variant="label">{label}</Text>
      <View style={[styles.wrap, { gap: theme.spacing.sm }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected
                    ? theme.colors.accentSoft
                    : theme.colors.surface,
                  borderColor: selected
                    ? theme.colors.primary
                    : theme.colors.border,
                  borderRadius: theme.radii.pill,
                  opacity: pressed ? 0.72 : 1,
                  paddingHorizontal: theme.spacing.lg,
                },
              ]}
            >
              <Text tone={selected ? 'primary' : 'textMuted'} variant="label">
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
