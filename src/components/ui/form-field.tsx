import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

import { Text } from './text';

type FormFieldProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
};

export const FormField = forwardRef<TextInput, FormFieldProps>(
  function FormField({ label, error, hint, style, onFocus, onBlur, ...props }, ref) {
    const theme = useAppTheme();
    const localization = useLocalization();
    const [focused, setFocused] = useState(false);

    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{label}</Text>
        <TextInput
          accessibilityHint={error ?? hint}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          ref={ref}
          selectionColor={theme.colors.primary}
          style={[
            styles.input,
            theme.typography.body,
            {
              backgroundColor: theme.colors.surface,
              borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radii.lg,
              color: theme.colors.text,
              textAlign: localization.isRTL ? 'right' : 'left',
              writingDirection: localization.direction,
            },
            props.multiline && styles.multiline,
            style,
          ]}
          {...props}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
            {error}
          </Text>
        ) : hint ? (
          <Text tone="textMuted" variant="caption">
            {hint}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  multiline: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
});
