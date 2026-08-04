import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput } from 'react-native';

import { Button } from '@/components/ui';
import { useAccount } from '@/providers/account-provider';

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
      description="Choose a new password for your account. This does not change or remove local planning data."
      eyebrow="SECURE RECOVERY"
      icon="lock-closed-outline"
      showBack={false}
      title="Choose a new password"
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="new-password"
        error={errors.password}
        label="New password"
        onChangeText={setPassword}
        onSubmitEditing={() => confirmRef.current?.focus()}
        password
        returnKeyType="next"
        textContentType="newPassword"
        value={password}
      />
      <AuthTextField
        autoComplete="new-password"
        error={errors.confirmPassword}
        label="Confirm new password"
        onChangeText={setConfirmPassword}
        onSubmitEditing={() => void submit()}
        password
        ref={confirmRef}
        returnKeyType="done"
        textContentType="newPassword"
        value={confirmPassword}
      />
      <Button
        label="Save new password"
        loading={account.isBusy}
        onPress={() => void submit()}
      />
    </AuthScaffold>
  );
}
