import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type CreateAction = {
  key: string;
  icon: IconName;
  label: string;
  description: string;
  onPress: () => void;
};

type CreateActionSheetProps = {
  visible: boolean;
  title: string;
  actions: CreateAction[];
  onClose: () => void;
};

export function CreateActionSheet({
  visible,
  title,
  actions,
  onClose,
}: CreateActionSheetProps) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      friction: 9,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  if (!visible) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.container}>
        <Pressable
          accessibilityLabel={localization.t('common.cancel')}
          accessibilityRole="button"
          onPress={onClose}
          style={[styles.backdrop, { backgroundColor: theme.colors.overlay }]}
        />
        <Animated.View
          style={[
            styles.sheet,
            theme.shadows.floating,
            {
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              paddingBottom: theme.spacing.xl + theme.spacing.lg,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.md,
              opacity: progress,
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [48, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[styles.grabber, { backgroundColor: theme.colors.divider }]}
          />
          <Text
            accessibilityRole="header"
            align="center"
            style={{ marginBottom: theme.spacing.md }}
            variant="heading"
          >
            {title}
          </Text>
          <View style={{ gap: theme.spacing.sm }}>
            {actions.map((action) => (
              <Pressable
                accessibilityHint={action.description}
                accessibilityRole="button"
                key={action.key}
                onPress={action.onPress}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed
                      ? theme.colors.primarySoft
                      : theme.colors.surfaceSubtle,
                    borderRadius: theme.radii.lg,
                    padding: theme.spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor: theme.colors.primarySoft,
                      borderRadius: theme.radii.pill,
                    },
                  ]}
                >
                  <Ionicons
                    color={theme.colors.primary}
                    name={action.icon}
                    size={22}
                  />
                </View>
                <View style={styles.rowCopy}>
                  <Text variant="label">{action.label}</Text>
                  <Text tone="textMuted" variant="caption">
                    {action.description}
                  </Text>
                </View>
                <Ionicons
                  color={theme.colors.textMuted}
                  name={localization.isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={18}
                />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={[
              styles.cancel,
              {
                borderColor: theme.colors.divider,
                borderRadius: theme.radii.lg,
                marginTop: theme.spacing.md,
              },
            ]}
          >
            <Text tone="textMuted" variant="label">
              {localization.t('common.cancel')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.45 },
  cancel: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
  },
  container: { flex: 1, justifyContent: 'flex-end' },
  grabber: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 12,
    width: 44,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    minHeight: MIN_TOUCH_TARGET + 12,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowIcon: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  sheet: { width: '100%' },
});
