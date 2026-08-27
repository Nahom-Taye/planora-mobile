import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthErrorSummary } from '../components/auth-error-summary';
import { AuthScaffold } from '../components/auth-scaffold';
import { AuthTextField } from '../components/auth-text-field';
import {
  collectErrors,
  validatePassword,
  type FieldErrors,
} from '../services/auth-validation';

export function ResetPasswordScreen() {
  const router = useRouter();
  const account = useAccount();
  const localization = useLocalization();
  const confirmRef = useRef<TextInput>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = async () => {
    const nextErrors = collectErrors([
      ['password', validatePassword(password)],
      [
        'confirmPassword',
        confirmPassword === password ? null : 'Passwords do not match.',
      ],
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const result = await account.updatePassword(password);
    if (result.ok) router.replace('/(tabs)');
  };

  return (
    <AuthScaffold
      backFallback="/(auth)/forgot-password"
      description={localization.t('auth.choosePasswordDescription')}
      eyebrow={localization.t('auth.secureRecovery')}
      icon="lock-closed-outline"
      showBack
      title={localization.t('auth.choosePassword')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="new-password"
        error={localization.message(errors.password) || undefined}
        label={localization.t('auth.newPassword')}
        onChangeText={setPassword}
        onSubmitEditing={() => confirmRef.current?.focus()}
        password
        returnKeyType="next"
        textContentType="newPassword"
        value={password}
      />
      <AuthTextField
        autoComplete="new-password"
        error={localization.message(errors.confirmPassword) || undefined}
        label={localization.t('auth.confirmNewPassword')}
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        password
        ref={confirmRef}
        returnKeyType="done"
        textContentType="newPassword"
        value={confirmPassword}
      />
      <Button
        label={localization.t('auth.savePassword')}
        loading={account.isBusy}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
