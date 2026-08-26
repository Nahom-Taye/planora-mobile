import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function AuthLayout() {
  return (
    <FeatureErrorBoundary area="authentication">
      <Stack initialRouteName="sign-in" screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
