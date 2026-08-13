import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

export function AuthErrorSummary({ message }: { message: string | null }) {
  const theme = useAppTheme();
  const localization = useLocalization();

  if (!message) return null;

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={{
        backgroundColor: theme.colors.surfaceSubtle,
        borderColor: theme.colors.danger,
        borderLeftWidth: 4,
        borderRadius: theme.radii.md,
        padding: theme.spacing.lg,
      }}
    >
      <Text tone="danger" variant="caption">
        {localization.message(message)}
      </Text>
    </View>
  );
}
