import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

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
  const appEntry = useAppEntry();
  const localization = useLocalization();
  const onboarding = useOnboarding();
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
    if (result.ok) {
      router.replace(
        onboarding.status === 'complete'
          ? '/(tabs)'
          : '/(onboarding)/onboarding',
      );
    }
  };

  return (
    <AuthScaffold
      description={localization.t('auth.signInDescription')}
      icon="log-in-outline"
      showBack={false}
      title={localization.t('auth.signInTitle')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      {!account.configured ? (
        <Text accessibilityLiveRegion="polite" tone="warning" variant="caption">
          {localization.t('auth.accountUnavailable')}
        </Text>
      ) : null}
      <AuthTextField
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={localization.message(errors.email) || undefined}
        keyboardType="email-address"
        label={localization.t('auth.email')}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder={localization.t('auth.emailPlaceholder')}
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
      />
      <AuthTextField
        autoComplete="current-password"
        error={localization.message(errors.password) || undefined}
        label={localization.t('auth.password')}
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
        label={localization.t('auth.signIn')}
        loading={account.isBusy}
        onPress={() => void submit()}
      />
      <Button
        disabled={!account.configured}
        label={localization.t('auth.forgotPassword')}
        onPress={() => router.push('/(auth)/forgot-password')}
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
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Text tone="textMuted" variant="caption">
          {localization.t('auth.newToAccount')}
        </Text>
        <Button
          disabled={!account.configured}
          label={localization.t('auth.createInstead')}
          onPress={() => router.replace('/(auth)/create-account')}
          variant="secondary"
        />
      </View>
    </AuthScaffold>
  );
}
