import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';

export function RecoverableAuthErrorScreen() {
  const router = useRouter();
  const account = useAccount();

  return (
    <AuthScaffold
      description="The account request did not complete, but your local Planora data is safe and remains available."
      eyebrow="RECOVERABLE ISSUE"
      icon="refresh-circle-outline"
      title="Let's try another path"
    >
      <AuthErrorSummary
        message={
          account.errorMessage ??
          'Account services are not available right now. Your local data is unaffected.'
        }
      />
      <Button
        label="Back to account options"
        onPress={() => router.replace('/(auth)/welcome')}
      />
      <Button
        label="Continue locally"
        onPress={() => router.replace('/(tabs)')}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
