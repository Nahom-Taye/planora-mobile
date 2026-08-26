import { Stack } from 'expo-router';

import { FeatureErrorBoundary } from '@/features/recovery';

export default function ReminderLayout() {
  return (
    <FeatureErrorBoundary area="reminders">
      <Stack screenOptions={{ headerShown: false }} />
    </FeatureErrorBoundary>
  );
}
