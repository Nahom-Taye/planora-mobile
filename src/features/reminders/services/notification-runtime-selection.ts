export type NotificationRuntime = 'web' | 'expo_go' | 'native';

export function selectNotificationRuntime(
  platform: string,
  executionEnvironment: string,
): NotificationRuntime {
  if (platform === 'web') return 'web';
  if (executionEnvironment === 'storeClient') return 'expo_go';
  return 'native';
}
