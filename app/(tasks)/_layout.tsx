import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function TaskLayout() {
  return (
    <FeatureErrorBoundary area="tasks">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
