import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function GoalsLayout() {
  return (
    <FeatureErrorBoundary area="goals">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
