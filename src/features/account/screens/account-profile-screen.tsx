import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Text } from '@/components/ui';
import { AuthErrorSummary } from '@/features/auth/components/auth-error-summary';
import { AuthScaffold } from '@/features/auth/components/auth-scaffold';
import { AuthTextField } from '@/features/auth/components/auth-text-field';
import { validateDisplayName } from '@/features/auth/services/auth-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';

export function AccountProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
  const localization = useLocalization();
  const [displayName, setDisplayName] = useState(account.profile?.displayName ?? '');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!account.profile) void account.refreshProfile();
  }, [account]);

  useEffect(() => {
    if (account.profile) setDisplayName(account.profile.displayName ?? '');
  }, [account.profile]);

  const save = async () => {
    const nextError = validateDisplayName(displayName) ?? undefined;
    setError(nextError);
    if (nextError) return;
    const resolved = new Intl.DateTimeFormat().resolvedOptions();
    const result = await account.saveProfile({
      displayName: displayName.trim(),
      locale: account.profile?.locale ?? resolved.locale ?? 'en-US',
      timeZone: account.profile?.timeZone ?? resolved.timeZone ?? 'UTC',
    });
    if (result.ok) router.back();
  };

  return (
    <AuthScaffold
      description={localization.t('auth.profileDescription')}
      eyebrow={localization.t('auth.profileEyebrow')}
      icon="person-circle-outline"
      title={localization.t('auth.editProfile')}
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="name"
        error={localization.message(error) || undefined}
        label={localization.t('auth.displayName')}
        onChangeText={setDisplayName}
        onSubmitEditing={() => void save()}
        returnKeyType="done"
        textContentType="name"
        value={displayName}
      />
      <Card variant="subtle">
        <Text variant="label">{localization.t('auth.profileScope')}</Text>
        <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted" variant="caption">
          {localization.t('auth.profileDescription')}
        </Text>
      </Card>
      <Button label={localization.t('auth.saveProfile')} loading={account.isBusy} onPress={() => void save()} />
    </AuthScaffold>
  );
}
