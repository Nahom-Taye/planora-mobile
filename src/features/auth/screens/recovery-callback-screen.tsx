import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';

export function RecoveryCallbackScreen() {
  const router = useRouter();
  const account = useAccount();
  const appEntry = useAppEntry();
  const localization = useLocalization();
  const url = Linking.useURL();
  const handledUrl = useRef<string | null>(null);
  const consumeCallback = account.consumeCallback;
  const retry = useCallback(async () => {
    if (!url) return;
    const result = await consumeCallback(url, Linking.createURL('/callback'));
    if (!result.ok) return;
    router.replace(
      result.purpose === 'recovery'
        ? '/(recovery)/reset-password'
        : '/entry',
    );
  }, [consumeCallback, router, url]);

  useEffect(() => {
    if (!url || handledUrl.current === url || account.isBusy) return;
    handledUrl.current = url;
    void retry();
  }, [account.isBusy, retry, url]);

  return (
    <AuthScaffold
      backFallback="/(auth)/forgot-password"
      description={localization.t('auth.recoveryValidating')}
      eyebrow={localization.t('auth.recoveryEyebrow')}
      icon="shield-checkmark-outline"
      showBack
      title={localization.t(account.isBusy ? 'auth.recoveryValidating' : 'auth.secureRecovery')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      {account.errorMessage ? (
        <Button label={localization.t('common.retry')} loading={account.isBusy} onPress={() => void retry()} variant="secondary" />
      ) : null}
      {account.errorMessage ? (
        <Button
          label={localization.t('auth.requestNewLink')}
          onPress={() => router.replace('/(auth)/forgot-password')}
        />
      ) : null}
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
