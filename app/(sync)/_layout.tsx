import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function SyncLayout() {
  return (
    <FeatureErrorBoundary area="synchronization">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
