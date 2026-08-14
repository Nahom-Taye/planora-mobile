import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function SegmentedControl<TValue extends string | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: TValue; label: string }[];
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  const theme = useAppTheme();
  return (
    <View accessibilityLabel={label} accessibilityRole="tablist" style={styles.row}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={String(option.value)}
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
                borderRadius: theme.radii.lg,
                opacity: pressed ? 0.76 : 1,
              },
            ]}
          >
            <Text
              align="center"
              tone={selected ? 'primary' : 'textMuted'}
              variant="caption"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: 88,
    paddingHorizontal: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
