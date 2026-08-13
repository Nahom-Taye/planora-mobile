import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  password?: boolean;
};

export const AuthTextField = forwardRef<TextInput, AuthTextFieldProps>(
  function AuthTextField(
    { label, error, password = false, style, ...props },
    ref,
  ) {
    const theme = useAppTheme();
    const localization = useLocalization();
    const [revealed, setRevealed] = useState(false);
    const errorId = `${label.toLowerCase().replace(/\s+/g, '-')}-error`;

    return (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label">{label}</Text>
        <View
          style={[
            styles.field,
            {
              backgroundColor: theme.colors.surface,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <TextInput
            accessibilityLabel={label}
            accessibilityHint={error}
            placeholderTextColor={theme.colors.textMuted}
            ref={ref}
            secureTextEntry={password && !revealed}
            selectionColor={theme.colors.primary}
            style={[
              styles.input,
              theme.typography.body,
              { color: theme.colors.text },
              style,
            ]}
            {...props}
          />
          {password ? (
            <Pressable
              accessibilityLabel={localization.t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
              accessibilityRole="button"
              accessibilityState={{ selected: revealed }}
              onPress={() => setRevealed((value) => !value)}
              style={styles.visibility}
            >
              <Ionicons
                color={theme.colors.textMuted}
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={22}
              />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text nativeID={errorId} tone="danger" variant="caption">
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  field: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
  },
  input: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  visibility: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
});
