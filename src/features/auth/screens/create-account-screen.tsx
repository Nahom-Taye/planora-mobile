import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';
import { AuthTextField } from '../components/auth-text-field';
import {
  collectErrors,
  validateDisplayName,
  validateEmail,
  validatePassword,
  type FieldErrors,
} from '../services/auth-validation';

export function CreateAccountScreen() {
  const router = useRouter();
  const account = useAccount();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async () => {
    const nextErrors = collectErrors([
      ['displayName', validateDisplayName(displayName)],
      ['email', validateEmail(email)],
      ['password', validatePassword(password)],
      [
        'confirmPassword',
        confirmPassword === password ? null : 'Passwords do not match.',
      ],
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    const result = await account.signUp({
      displayName: displayName.trim(),
      email,
      password,
      locale: resolved.locale || 'en-US',
      timeZone: resolved.timeZone || 'UTC',
      redirectTo: Linking.createURL('/callback', {
        queryParams: { flow: 'verification' },
      }),
    });

    if (!result.ok) return;
    router.replace(
      result.requiresEmailVerification ? '/(auth)/check-email' : '/(tabs)',
    );
  };

  return (
    <AuthScaffold
      description="Create a minimal account profile for sign-in and recovery. Planning content is not sent to the account service."
      icon="person-add-outline"
      title="Create your account"
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="name"
        error={errors.displayName}
        label="Display name"
        onChangeText={setDisplayName}
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder="How you want to be addressed"
        returnKeyType="next"
        textContentType="name"
        value={displayName}
      />
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={errors.email}
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        ref={emailRef}
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <AuthTextField
        autoComplete="new-password"
        error={errors.password}
        label="Password"
        onChangeText={setPassword}
        onSubmitEditing={() => confirmRef.current?.focus()}
        password
        ref={passwordRef}
        returnKeyType="next"
        textContentType="newPassword"
        value={password}
      />
      <AuthTextField
        autoComplete="new-password"
        error={errors.confirmPassword}
        label="Confirm password"
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        password
        ref={confirmRef}
        returnKeyType="done"
        textContentType="newPassword"
        value={confirmPassword}
      />
      <Text tone="textMuted" variant="caption">
        Your password is sent securely to the account provider and is never stored in Planora&apos;s local planning database.
      </Text>
      <Button
        disabled={!account.configured}
        label="Create account"
        loading={account.isBusy}
        onPress={() => void submit()}
      />
      <Button
        label="Already have an account? Sign in"
        onPress={() => router.replace('/(auth)/sign-in')}
        variant="ghost"
      />
    </AuthScaffold>
  );
}
