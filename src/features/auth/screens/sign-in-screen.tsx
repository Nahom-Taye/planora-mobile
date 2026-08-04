import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';
import { AuthTextField } from '../components/auth-text-field';
import {
  collectErrors,
  validateEmail,
  type FieldErrors,
} from '../services/auth-validation';

export function SignInScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async () => {
    const nextErrors = collectErrors([
      ['email', validateEmail(email)],
      ['password', password ? null : 'Enter your password.'],
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const result = await account.signIn(email, password);
    if (result.ok) router.replace('/(tabs)');
  };

  return (
    <AuthScaffold
      description="Sign in to your optional Planora account. Your local planning space remains separate and available."
      icon="log-in-outline"
      title="Welcome back"
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={errors.email}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="you@example.com"
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <AuthTextField
        autoComplete="current-password"
        error={errors.password}
        label="Password"
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        password
        ref={passwordRef}
        returnKeyType="done"
        textContentType="password"
        value={password}
      />
      <Button
        disabled={!account.configured}
        label="Sign in"
        loading={account.isBusy}
        onPress={() => void submit()}
      />
      <Button
        label="Forgot password?"
        onPress={() => router.push('/(auth)/forgot-password')}
        variant="ghost"
      />
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Text tone="textMuted" variant="caption">
          New to account features?
        </Text>
        <Button
          label="Create an account"
          onPress={() => router.replace('/(auth)/create-account')}
          variant="secondary"
        />
      </View>
    </AuthScaffold>
  );
}
