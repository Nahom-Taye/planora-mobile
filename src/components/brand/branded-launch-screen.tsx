import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useLocalization } from '@/providers/localization-provider';

import { BrandWordmark } from './brand-wordmark';

type BrandedLaunchScreenProps = {
  message?: string;
};

export function BrandedLaunchScreen({
  message,
}: BrandedLaunchScreenProps) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const reducedMotion = useReducedMotion();

  return (
    <SafeAreaView
      accessibilityLabel={localization.t('launch.starting')}
      accessibilityRole="progressbar"
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <View
        style={[
          styles.ambientShape,
          styles.ambientTop,
          { backgroundColor: theme.colors.accentSoft },
        ]}
      />
      <View
        style={[
          styles.ambientShape,
          styles.ambientBottom,
          { backgroundColor: theme.colors.surfaceSubtle },
        ]}
      />
      <View style={[styles.center, { gap: theme.spacing.xl }]}>
        <BrandWordmark markSize={58} />
        <Text
          accessibilityLiveRegion="polite"
          align="center"
          tone="textMuted"
        >
          {message ?? localization.t('launch.tagline')}
        </Text>
      </View>
      <ActivityIndicator animating={reducedMotion === false} color={theme.colors.accent} style={styles.indicator} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 24,
  },
  center: {
    alignItems: 'center',
  },
  indicator: {
    alignSelf: 'center',
    bottom: 52,
    position: 'absolute',
  },
  ambientShape: {
    borderRadius: 999,
    opacity: 0.7,
    position: 'absolute',
  },
  ambientTop: {
    height: 260,
    right: -110,
    top: -80,
    width: 260,
  },
  ambientBottom: {
    bottom: -110,
    height: 230,
    left: -90,
    width: 230,
  },
});
