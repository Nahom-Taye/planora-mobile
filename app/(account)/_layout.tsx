import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function AccountLayout() {
  return (
    <FeatureErrorBoundary area="account">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
