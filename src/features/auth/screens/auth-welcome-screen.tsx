import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAccount } from '@/providers/account-provider';

import { AuthScaffold } from '../components/auth-scaffold';

export function AuthWelcomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const account = useAccount();

  return (
    <AuthScaffold
      description="Keep using Planora locally, or add an account for a small profile and account recovery. Planning content stays on this device."
      icon="person-circle-outline"
      showBack
      title="Choose what fits today"
    >
      <Card variant="accent">
        <View style={[styles.option, { gap: theme.spacing.lg }]}>
          <Ionicons color={theme.colors.accent} name="phone-portrait-outline" size={30} />
          <View style={styles.copy}>
            <Text variant="heading">Continue locally</Text>
            <Text tone="textMuted" variant="caption">
              No account is required. Your existing local planning data remains ready offline.
            </Text>
          </View>
        </View>
        <Button
          label="Return to Planora"
          onPress={() => router.replace('/(tabs)')}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Card>

      <Card>
        <View style={[styles.option, { gap: theme.spacing.lg }]}>
          <Ionicons color={theme.colors.primary} name="person-add-outline" size={30} />
          <View style={styles.copy}>
            <Text variant="heading">Optional account</Text>
            <Text tone="textMuted" variant="caption">
              Create a profile or sign in. This does not upload, merge, or replace local planning records.
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
            Account services are not configured in this build. Local-only use remains available.
          </Text>
        ) : null}
        <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
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
