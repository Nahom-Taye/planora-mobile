import { useRouter } from 'expo-router';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

import { AuthScaffold } from '../components/auth-scaffold';

export function CheckEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <AuthScaffold
      description="If the address can receive the requested message, follow the link in that message to continue."
      eyebrow="CHECK YOUR EMAIL"
      icon="mail-outline"
      title="One more step"
    >
      <Card variant="accent">
        <Text variant="heading">The next step happens in your inbox</Text>
        <Text style={{ marginTop: theme.spacing.md }} tone="textMuted">
          Delivery can take a moment. Check spam or junk folders if the message does not appear.
        </Text>
      </Card>
      <Button
        label="Return to sign in"
        onPress={() => router.replace('/(auth)/sign-in')}
      />
      <Button
        label="Continue locally"
        onPress={() => router.replace('/(tabs)')}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
