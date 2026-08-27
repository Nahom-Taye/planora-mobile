import { useRouter } from 'expo-router';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

import { AuthScaffold } from '../components/auth-scaffold';

export function CheckEmailScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const appEntry = useAppEntry();
  const localization = useLocalization();
  const onboarding = useOnboarding();

  return (
    <AuthScaffold
      backFallback="/(auth)/sign-in"
      description={localization.t('auth.checkEmailDescription')}
      eyebrow={localization.t('auth.checkEmailEyebrow')}
      icon="mail-outline"
      title={localization.t('auth.checkEmailTitle')}
    >
      <Card variant="accent">
        <Text variant="heading">{localization.t('auth.inboxTitle')}</Text>
        <Text style={{ marginTop: theme.spacing.md }} tone="textMuted">
          {localization.t('auth.checkEmailDescription')}
        </Text>
      </Card>
      <Button
        label={localization.t('auth.returnSignIn')}
        onPress={() => router.replace('/(auth)/sign-in')}
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
        variant="ghost"
      />
    </AuthScaffold>
  );
}
