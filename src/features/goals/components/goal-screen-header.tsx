import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function GoalScreenHeader({
  title,
  onBack,
  actionLabel,
  onAction,
}: {
  title: string;
  onBack: () => void;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel={localization.t('common.goBack')}
        accessibilityRole="button"
        onPress={onBack}
        style={styles.iconButton}
      >
        <Ionicons
          color={theme.colors.text}
          name={localization.isRTL ? 'arrow-forward' : 'arrow-back'}
          size={24}
        />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={2} style={styles.title} variant="heading">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="ghost" />
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  title: { flex: 1 },
});
