import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useOnboarding } from '@/providers/onboarding-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

const pages = [
  {
    eyebrow: 'A CALMER START',
    title: 'Your day, with room to breathe',
    description:
      'Planora gives Today, Planner, Goals, Insights, and Settings a quiet home while each planning feature is built with care.',
    icon: 'sunny-outline' as const,
    detail: 'Explore the existing planning spaces without creating an account.',
  },
  {
    eyebrow: 'LOCAL BY DEFAULT',
    title: 'Ready when the network is not',
    description:
      'Your planning foundation is stored on this device and remains available offline. Local actions never wait for an account service.',
    icon: 'cloud-offline-outline' as const,
    detail: 'Local data survives app restarts and stays separate from account sessions.',
  },
  {
    eyebrow: 'YOUR CHOICE',
    title: 'An account is optional',
    description:
      'Create an account for profile and recovery access, or continue locally. Phase 3 does not upload or synchronize planning content.',
    icon: 'person-circle-outline' as const,
    detail: 'You can sign in later from Settings without changing local identifiers.',
  },
];

export function OnboardingScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const onboarding = useOnboarding();
  const [pageIndex, setPageIndex] = useState(0);
  const page = pages[pageIndex];
  const isLast = pageIndex === pages.length - 1;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `Step ${pageIndex + 1} of ${pages.length}. ${page.title}`,
    );
  }, [page.title, pageIndex]);

  const finish = async (skip: boolean) => {
    const succeeded = skip
      ? await onboarding.skip()
      : await onboarding.complete();
    if (succeeded) router.replace('/(tabs)');
  };

  const closeReview = () => {
    onboarding.leaveReview();
    router.back();
  };

  return (
    <Screen contentStyle={styles.screen} testID="onboarding-screen">
      <View style={styles.topRow}>
        <BrandWordmark compact markSize={34} />
        <Pressable
          accessibilityLabel={onboarding.isReviewing ? 'Close onboarding' : 'Skip onboarding'}
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
            {onboarding.isReviewing ? 'Close' : 'Skip'}
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
          Step {pageIndex + 1} of {pages.length}
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
            {onboarding.errorMessage}
          </Text>
        ) : null}
      </View>

      <View style={[styles.actions, { gap: theme.spacing.md }]}>
        {pageIndex > 0 ? (
          <Button
            label="Back"
            onPress={() => setPageIndex((value) => value - 1)}
            variant="secondary"
          />
        ) : null}
        <Button
          label={isLast ? (onboarding.isReviewing ? 'Done' : 'Start locally') : 'Continue'}
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
