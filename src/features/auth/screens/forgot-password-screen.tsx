import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Text } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';
import { AuthTextField } from '../components/auth-text-field';
import { validateEmail } from '../services/auth-validation';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const account = useAccount();
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
      description="Enter your email and we will request a recovery message without revealing whether an account exists."
      eyebrow="ACCOUNT RECOVERY"
      icon="key-outline"
      title="Reset your password"
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={error}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        onSubmitEditing={() => void submit()}
        returnKeyType="send"
        textContentType="emailAddress"
        value={email}
      />
      <Text tone="textMuted" variant="caption">
        For privacy, the confirmation screen is the same for every valid email format.
      </Text>
      <Button
        disabled={!account.configured}
        label="Send recovery instructions"
        loading={account.isBusy}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
