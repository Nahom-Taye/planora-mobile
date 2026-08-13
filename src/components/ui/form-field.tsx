import { forwardRef } from 'react';
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
  function FormField({ label, error, hint, style, ...props }, ref) {
    const theme = useAppTheme();
    const localization = useLocalization();

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
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderRadius: theme.radii.lg,
              color: theme.colors.text,
              textAlign: localization.isRTL ? 'right' : 'left',
              writingDirection: localization.direction,
            },
            props.multiline && styles.multiline,
            style,
          ]}
          {...props}
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
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  multiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
});
