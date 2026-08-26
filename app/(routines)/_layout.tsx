import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function RoutineLayout() {
  return (
    <FeatureErrorBoundary area="routines">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
