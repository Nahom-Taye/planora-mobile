import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';
import { useLocalization } from '@/providers/localization-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

export function AccountSettingsSection() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
  const localization = useLocalization();
  const onboarding = useOnboarding();
  const signedIn = account.status === 'signed_in' || account.status === 'recovering';

  const confirmSignOut = () => {
    Alert.alert(
      localization.t('auth.signOutTitle'),
      localization.t('auth.signOutDescription'),
      [
        { text: localization.t('common.cancel'), style: 'cancel' },
        {
          text: localization.t('auth.signOut'),
          style: 'destructive',
          onPress: () => {
            void account.signOut().then((result) => {
              if (result.ok) router.replace('/(auth)/sign-in');
            });
          },
        },
      ],
    );
  };

  const reviewOnboarding = () => {
    onboarding.beginReview();
    router.push('/(onboarding)/onboarding');
  };

  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading">{localization.t('auth.accountLabel')}</Text>
        <Text tone="textMuted" variant="caption">
          {localization.t('auth.accountSettingsDescription')}
        </Text>
      </View>
      <Card>
        <View style={[styles.status, { gap: theme.spacing.lg }]}>
          <View
            style={[
              styles.icon,
              {
                backgroundColor: theme.colors.accentSoft,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Ionicons
              color={theme.colors.accent}
              name={signedIn ? 'person-circle-outline' : 'phone-portrait-outline'}
              size={30}
            />
          </View>
          <View style={styles.copy} accessibilityLiveRegion="polite">
            <Text variant="heading">
              {signedIn ? account.profile?.displayName || localization.t('auth.planoraAccount') : localization.t('auth.localOnly')}
            </Text>
            <Text tone="textMuted" variant="caption">
              {signedIn
                ? account.session?.email
                : localization.t('auth.localOnlyDescription')}
            </Text>
            {signedIn ? (
              <Text tone={account.session?.emailVerified ? 'success' : 'warning'} variant="caption">
                {localization.t(account.session?.emailVerified ? 'auth.emailVerified' : 'auth.emailPending')}
              </Text>
            ) : null}
          </View>
        </View>

        {!account.configured && !signedIn ? (
          <Text style={{ marginTop: theme.spacing.lg }} tone="warning" variant="caption">
            {localization.t('auth.accountUnavailable')}
          </Text>
        ) : null}

        <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.xl }]}>
          {signedIn ? (
            <>
              <Button
                label={localization.t('auth.editProfile')}
                onPress={() => router.push('/(account)/profile')}
                style={styles.flex}
              />
              <Button
                label={localization.t('auth.signOut')}
                loading={account.isBusy}
                onPress={confirmSignOut}
                style={styles.flex}
                variant="secondary"
              />
            </>
          ) : (
            <>
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
            </>
          )}
        </View>
      </Card>
      <Button label={localization.t('auth.viewOnboarding')} onPress={reviewOnboarding} variant="ghost" />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  flex: {
    flex: 1,
  },
  icon: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
