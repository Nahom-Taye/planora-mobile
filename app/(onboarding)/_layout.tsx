import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function OnboardingLayout() {
  return (
    <FeatureErrorBoundary area="onboarding">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
