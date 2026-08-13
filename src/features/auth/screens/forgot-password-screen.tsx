import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Text } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';
import { AuthTextField } from '../components/auth-text-field';
import { validateEmail } from '../services/auth-validation';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const account = useAccount();
  const localization = useLocalization();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const submit = async () => {
    const nextError = validateEmail(email) ?? undefined;
    setError(nextError);
    if (nextError) return;
    const result = await account.sendRecovery(
      email,
      Linking.createURL('/callback', {
        queryParams: { flow: 'recovery' },
      }),
    );
    if (result.ok) router.replace('/(auth)/check-email');
  };

  return (
    <AuthScaffold
      description={localization.t('auth.recoveryDescription')}
      eyebrow={localization.t('auth.recoveryEyebrow')}
      icon="key-outline"
      title={localization.t('auth.recoveryTitle')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={localization.message(error) || undefined}
        keyboardType="email-address"
        label={localization.t('auth.email')}
        onChangeText={setEmail}
        onSubmitEditing={() => void submit()}
        returnKeyType="send"
        textContentType="emailAddress"
        value={email}
      />
      <Text tone="textMuted" variant="caption">
        {localization.t('auth.recoveryPrivacy')}
      </Text>
      <Button
        disabled={!account.configured}
        label={localization.t('auth.sendRecovery')}
        loading={account.isBusy}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
