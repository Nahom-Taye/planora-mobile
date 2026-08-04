import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';

export function RecoveryCallbackScreen() {
  const router = useRouter();
  const account = useAccount();
  const url = Linking.useURL();
  const handledUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    void account.consumeCallback(url).then((result) => {
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
      description="Planora is validating the recovery link without showing its private session details."
      eyebrow="ACCOUNT RECOVERY"
      icon="shield-checkmark-outline"
      showBack={false}
      title={account.isBusy ? 'Checking your link' : 'Recovery link status'}
    >
      <AuthErrorSummary message={account.errorMessage} />
      {account.errorMessage ? (
        <Button
          label="Request a new link"
          onPress={() => router.replace('/(auth)/forgot-password')}
        />
      ) : null}
      <Button
        label="Continue locally"
        onPress={() => router.replace('/(tabs)')}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
