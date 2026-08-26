import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function InsightsLayout() {
  return (
    <FeatureErrorBoundary area="insights">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
