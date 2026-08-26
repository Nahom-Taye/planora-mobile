import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function RecoveryLayout() {
  return (
    <FeatureErrorBoundary area="recovery">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
