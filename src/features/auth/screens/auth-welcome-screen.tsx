import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';
import { useAppEntry } from '@/providers/app-entry-provider';
import { useOnboarding } from '@/providers/onboarding-provider';
import { useLocalization } from '@/providers/localization-provider';

import { AuthScaffold } from '../components/auth-scaffold';

export function AuthWelcomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
  const appEntry = useAppEntry();
  const onboarding = useOnboarding();
  const localization = useLocalization();

  return (
    <AuthScaffold
      description={localization.t('auth.chooseDescription')}
      icon="person-circle-outline"
      showBack
      title={localization.t('auth.chooseTitle')}
    >
      <Card variant="accent">
        <View style={[styles.option, { gap: theme.spacing.lg }]}>
          <Ionicons color={theme.colors.accent} name="phone-portrait-outline" size={30} />
          <View style={styles.copy}>
            <Text variant="heading">{localization.t('auth.localTitle')}</Text>
            <Text tone="textMuted" variant="caption">
              {localization.t('auth.localDescription')}
            </Text>
          </View>
        </View>
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
          style={{ marginTop: theme.spacing.lg }}
        />
      </Card>

      <Card>
        <View style={[styles.option, { gap: theme.spacing.lg }]}>
          <Ionicons color={theme.colors.primary} name="person-add-outline" size={30} />
          <View style={styles.copy}>
            <Text variant="heading">{localization.t('auth.accountTitle')}</Text>
            <Text tone="textMuted" variant="caption">
              {localization.t('auth.accountDescription')}
            </Text>
          </View>
        </View>
        {!account.configured ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ marginTop: theme.spacing.lg }}
            tone="warning"
            variant="caption"
          >
            {localization.t('auth.accountUnavailable')}
          </Text>
        ) : null}
        <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
          <Button
            disabled={!account.configured}
            label={localization.t('auth.createAccount')}
            onPress={() => router.push('/(auth)/create-account')}
            style={styles.flex}
          />
          <Button
            disabled={!account.configured}
            label={localization.t('auth.signIn')}
            onPress={() => router.push('/(auth)/sign-in')}
            style={styles.flex}
            variant="secondary"
          />
        </View>
      </Card>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  flex: {
    flex: 1,
  },
  option: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
});
