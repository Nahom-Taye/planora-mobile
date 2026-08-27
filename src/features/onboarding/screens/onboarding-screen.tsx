import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const onboarding = useOnboarding();
  const localization = useLocalization();
  const pages = [
    {
      eyebrow: localization.t('onboarding.pageOneEyebrow'),
      title: localization.t('onboarding.pageOneTitle'),
      description: localization.t('onboarding.pageOneDescription'),
      icon: 'sunny-outline' as const,
      detail: localization.t('onboarding.pageOneDetail'),
    },
    {
      eyebrow: localization.t('onboarding.pageTwoEyebrow'),
      title: localization.t('onboarding.pageTwoTitle'),
      description: localization.t('onboarding.pageTwoDescription'),
      icon: 'cloud-offline-outline' as const,
      detail: localization.t('onboarding.pageTwoDetail'),
    },
    {
      eyebrow: localization.t('onboarding.pageThreeEyebrow'),
      title: localization.t('onboarding.pageThreeTitle'),
      description: localization.t('onboarding.pageThreeDescription'),
      icon: 'person-circle-outline' as const,
      detail: localization.t('onboarding.pageThreeDetail'),
    },
  ];
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex];
  const isLast = pageIndex === pages.length - 1;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      localization.t('onboarding.stepAnnouncement', {
        current: localization.formatNumber(pageIndex + 1),
        total: localization.formatNumber(pages.length),
        title: page.title,
      }),
    );
  }, [localization, page.title, pageIndex, pages.length]);

  const finish = async (skip: boolean) => {
    const succeeded = skip
      ? await onboarding.skip()
      : await onboarding.complete();
    if (succeeded) router.replace('/(tabs)');
  };

  const closeReview = () => {
    onboarding.leaveReview();
    goBackOrReplace(router, '/(tabs)/settings');
  };

  return (
    <Screen contentStyle={styles.screen} testID="onboarding-screen">
      <View style={styles.topRow}>
        <BrandWordmark compact markSize={34} />
        <Pressable
          accessibilityLabel={localization.t(onboarding.isReviewing ? 'onboarding.close' : 'onboarding.skip')}
          accessibilityRole="button"
          onPress={() => {
            if (onboarding.isReviewing) closeReview();
            else void finish(true);
          }}
          style={({ pressed }) => [
            styles.skip,
            { opacity: pressed ? 0.62 : 1 },
          ]}
        >
          <Text tone="textMuted" variant="label">
            {localization.t(onboarding.isReviewing ? 'common.close' : 'common.skip')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.progressRow, { gap: theme.spacing.sm }]}>
        {pages.map((item, index) => (
          <View
            accessibilityElementsHidden
            key={item.title}
            style={[
              styles.progressItem,
              {
                backgroundColor:
                  index <= pageIndex
                    ? theme.colors.primary
                    : theme.colors.surfaceSubtle,
                borderColor: theme.colors.border,
              },
            ]}
          />
        ))}
        <Text style={styles.progressText} tone="textMuted" variant="caption">
          {localization.t('onboarding.step', {
            current: localization.formatNumber(pageIndex + 1),
            total: localization.formatNumber(pages.length),
          })}
        </Text>
      </View>

      <Card style={[styles.hero, { marginTop: theme.spacing.xxl }]}>
        <View
          style={[
            styles.icon,
            {
              backgroundColor: theme.colors.accentSoft,
              borderRadius: theme.radii.xl,
            },
          ]}
        >
          <Ionicons color={theme.colors.accent} name={page.icon} size={50} />
        </View>
        <View style={{ gap: theme.spacing.md }}>
          <Text tone="primary" variant="overline">
            {page.eyebrow}
          </Text>
          <Text accessibilityRole="header" variant="display">
            {page.title}
          </Text>
          <Text tone="textMuted">{page.description}</Text>
        </View>
        <View
          style={[
            styles.detail,
            {
              backgroundColor: theme.colors.surfaceSubtle,
              borderRadius: theme.radii.lg,
              gap: theme.spacing.md,
            },
          ]}
        >
          <Ionicons color={theme.colors.primary} name="checkmark-circle" size={22} />
          <Text style={styles.detailText} variant="caption">
            {page.detail}
          </Text>
        </View>
      </Card>

      <View accessibilityLiveRegion="polite" style={styles.errorArea}>
        {onboarding.errorMessage ? (
          <Text align="center" tone="danger" variant="caption">
            {localization.message(onboarding.errorMessage)}
          </Text>
        ) : null}
      </View>

      <View style={[styles.actions, { gap: theme.spacing.md }]}>
        {pageIndex > 0 ? (
          <Button
            label={localization.t('common.back')}
            onPress={() => setPageIndex((value) => value - 1)}
            variant="secondary"
          />
        ) : null}
        <Button
          label={localization.t(isLast ? (onboarding.isReviewing ? 'common.done' : 'onboarding.startLocally') : 'common.continue')}
          loading={onboarding.isSaving}
          onPress={() => {
            if (!isLast) setPageIndex((value) => value + 1);
            else if (onboarding.isReviewing) closeReview();
            else void finish(false);
          }}
          style={styles.primaryAction}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  detail: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 16,
  },
  detailText: {
    flex: 1,
  },
  errorArea: {
    justifyContent: 'center',
    minHeight: 42,
  },
  hero: {
    gap: 28,
  },
  icon: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'center',
    width: 92,
  },
  primaryAction: {
    flex: 1,
  },
  progressItem: {
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 6,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 40,
  },
  progressText: {
    marginLeft: 6,
  },
  screen: {
    justifyContent: 'center',
    paddingBottom: 32,
  },
  skip: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
