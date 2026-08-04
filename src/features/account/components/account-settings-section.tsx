import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';
import { useOnboarding } from '@/providers/onboarding-provider';

export function AccountSettingsSection() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();
  const onboarding = useOnboarding();
  const signedIn = account.status === 'signed_in' || account.status === 'recovering';

  const confirmSignOut = () => {
    Alert.alert(
      'Sign out of your account?',
      'Your planning data stays on this device and remains available after sign-out.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void account.signOut(),
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
        <Text variant="heading">Account</Text>
        <Text tone="textMuted" variant="caption">
          Account features are optional and stay separate from local planning data.
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
              {signedIn ? account.profile?.displayName || 'Planora account' : 'Local-only'}
            </Text>
            <Text tone="textMuted" variant="caption">
              {signedIn
                ? account.session?.email
                : 'No account is required to use the main planning tabs.'}
            </Text>
            {signedIn ? (
              <Text tone={account.session?.emailVerified ? 'success' : 'warning'} variant="caption">
                {account.session?.emailVerified ? 'Email verified' : 'Email verification pending'}
              </Text>
            ) : null}
          </View>
        </View>

        {!account.configured && !signedIn ? (
          <Text style={{ marginTop: theme.spacing.lg }} tone="warning" variant="caption">
            Account services are unavailable in this build. Local planning remains ready.
          </Text>
        ) : null}

        <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.xl }]}>
          {signedIn ? (
            <>
              <Button
                label="Edit profile"
                onPress={() => router.push('/(account)/profile')}
                style={styles.flex}
              />
              <Button
                label="Sign out"
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
                label="Create account"
                onPress={() => router.push('/(auth)/create-account')}
                style={styles.flex}
              />
              <Button
                disabled={!account.configured}
                label="Sign in"
                onPress={() => router.push('/(auth)/sign-in')}
                style={styles.flex}
                variant="secondary"
              />
            </>
          )}
        </View>
      </Card>
      <Button label="View onboarding again" onPress={reviewOnboarding} variant="ghost" />
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
