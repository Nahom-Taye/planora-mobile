import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

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
  const appEntry = useAppEntry();
  const localization = useLocalization();
  const onboarding = useOnboarding();
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
      result.requiresEmailVerification
        ? '/(auth)/check-email'
        : onboarding.status === 'complete'
          ? '/(tabs)'
          : '/(onboarding)/onboarding',
    );
  };

  return (
    <AuthScaffold
      description={localization.t('auth.createDescription')}
      icon="person-add-outline"
      title={localization.t('auth.createTitle')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="name"
        error={localization.message(errors.displayName) || undefined}
        label={localization.t('auth.displayName')}
        onChangeText={setDisplayName}
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder={localization.t('auth.displayNamePlaceholder')}
        returnKeyType="next"
        textContentType="name"
        value={displayName}
      />
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={localization.message(errors.email) || undefined}
        keyboardType="email-address"
        label={localization.t('auth.email')}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        ref={emailRef}
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <AuthTextField
        autoComplete="new-password"
        error={localization.message(errors.password) || undefined}
        label={localization.t('auth.password')}
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
        error={localization.message(errors.confirmPassword) || undefined}
        label={localization.t('auth.confirmPassword')}
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        password
        ref={confirmRef}
        returnKeyType="done"
        textContentType="newPassword"
        value={confirmPassword}
      />
      <Text tone="textMuted" variant="caption">
        {localization.t('auth.passwordPrivacy')}
      </Text>
      <Button
        disabled={!account.configured}
        label={localization.t('auth.createAccount')}
        loading={account.isBusy}
        onPress={() => void submit()}
      />
      <Button
        label={localization.t('auth.alreadyAccount')}
        onPress={() => router.replace('/(auth)/sign-in')}
        variant="ghost"
      />
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
        variant="secondary"
      />
    </AuthScaffold>
  );
}
