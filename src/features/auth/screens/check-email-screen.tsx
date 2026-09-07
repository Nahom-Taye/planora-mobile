import { useRouter } from 'expo-router';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthScaffold } from '../components/auth-scaffold';
import { AuthErrorSummary } from '../components/auth-error-summary';

export function CheckEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const appEntry = useAppEntry();
  const account = useAccount();
  const localization = useLocalization();

  return (
    <AuthScaffold
      backFallback="/(auth)/sign-in"
      description={localization.t('auth.checkEmailDescription')}
      eyebrow={localization.t('auth.checkEmailEyebrow')}
      icon="mail-outline"
      title={localization.t('auth.checkEmailTitle')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      <Card variant="accent">
        <Text variant="heading">{localization.t('auth.inboxTitle')}</Text>
        <Text style={{ marginTop: theme.spacing.md }} tone="textMuted">
          {localization.t('auth.checkEmailDescription')}
        </Text>
      </Card>
      {account.canResendConfirmation ? (
        <>
          <Text tone="textMuted" variant="caption">{localization.t('auth.resendWait')}</Text>
          <Button label={localization.t('auth.resendConfirmation')} loading={account.isBusy} onPress={() => void account.resendConfirmation()} variant="secondary" />
        </>
      ) : null}
      <Button
        label={localization.t('auth.returnSignIn')}
        onPress={() => router.replace('/(auth)/sign-in')}
      />
      <Button
        label={localization.t('auth.localTitle')}
        onPress={() => {
          appEntry.continueLocally();
          router.replace('/entry');
        }}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
