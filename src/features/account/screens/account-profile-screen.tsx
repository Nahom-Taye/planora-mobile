import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Text } from '@/components/ui';
import { AuthErrorSummary } from '@/features/auth/components/auth-error-summary';
import { AuthScaffold } from '@/features/auth/components/auth-scaffold';
import { AuthTextField } from '@/features/auth/components/auth-text-field';
import { validateDisplayName } from '@/features/auth/services/auth-validation';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';

export function AccountProfileScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
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
      description="This small account profile is separate from your local planning records."
      eyebrow="ACCOUNT PROFILE"
      icon="person-circle-outline"
      title="Edit profile"
    >
      <AuthErrorSummary message={account.errorMessage} />
      <AuthTextField
        autoComplete="name"
        error={error}
        label="Display name"
        onChangeText={setDisplayName}
        onSubmitEditing={() => void save()}
        returnKeyType="done"
        textContentType="name"
        value={displayName}
      />
      <Card variant="subtle">
        <Text variant="label">Profile scope</Text>
        <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted" variant="caption">
          Only display name, locale, and time zone belong to this remote profile. Tasks, goals, routines, reflections, and plans stay local.
        </Text>
      </Card>
      <Button label="Save profile" loading={account.isBusy} onPress={() => void save()} />
    </AuthScaffold>
  );
}
