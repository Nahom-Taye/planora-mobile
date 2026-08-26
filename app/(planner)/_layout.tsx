import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function PlannerLayout() {
  return (
    <FeatureErrorBoundary area="planner">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
