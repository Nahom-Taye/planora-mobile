import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';

export function RecoverableAuthErrorScreen() {
  const router = useRouter();
  const account = useAccount();
  const localization = useLocalization();

  return (
    <AuthScaffold
      backFallback="/(auth)/welcome"
      description={localization.t('auth.issueDescription')}
      eyebrow={localization.t('auth.issueEyebrow')}
      icon="refresh-circle-outline"
      title={localization.t('auth.issueTitle')}
    >
      <AuthErrorSummary
        message={
          account.errorMessage ??
          localization.t('auth.accountUnavailable')
        }
      />
      <Button
        label={localization.t('auth.accountOptions')}
        onPress={() => router.replace('/(auth)/welcome')}
      />
      <Button
        label={localization.t('auth.localTitle')}
        onPress={() => router.replace('/(tabs)')}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
