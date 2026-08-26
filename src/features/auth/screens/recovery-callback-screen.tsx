import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';

export function RecoveryCallbackScreen() {
  const router = useRouter();
  const account = useAccount();
  const appEntry = useAppEntry();
  const localization = useLocalization();
  const onboarding = useOnboarding();
  const url = Linking.useURL();
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    void account.consumeCallback(url, Linking.createURL('/callback')).then((result) => {
      if (!result.ok) return;
      router.replace(
        result.purpose === 'recovery'
          ? '/(recovery)/reset-password'
          : '/(tabs)',
      );
    });
  }, [account, router, url]);

  return (
    <AuthScaffold
      description={localization.t('auth.recoveryValidating')}
      eyebrow={localization.t('auth.recoveryEyebrow')}
      icon="shield-checkmark-outline"
      showBack={false}
      title={localization.t(account.isBusy ? 'auth.recoveryValidating' : 'auth.secureRecovery')}
    >
      <AuthErrorSummary message={account.errorMessage} />
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
          router.replace(
            onboarding.status === 'complete'
              ? '/(tabs)'
              : '/(onboarding)/onboarding',
          );
        }}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
