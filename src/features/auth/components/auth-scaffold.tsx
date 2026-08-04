import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/brand';
import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MAX_CONTENT_WIDTH, MIN_TOUCH_TARGET } from '@/utils/layout';

type AuthScaffoldProps = PropsWithChildren<{
  title: string;
  description: string;
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  showBack?: boolean;
}>;

export function AuthScaffold({
  children,
  title,
  description,
  eyebrow = 'OPTIONAL ACCOUNT',
  icon = 'person-outline',
  showBack = true,
}: AuthScaffoldProps) {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.inner, { paddingHorizontal: theme.spacing.xl }]}>
            <View style={styles.navigation}>
              {showBack ? (
                <Pressable
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Ionicons color={theme.colors.text} name="arrow-back" size={24} />
                </Pressable>
              ) : (
                <View style={styles.backButton} />
              )}
              <BrandWordmark compact markSize={32} />
            </View>

            <View style={[styles.heading, { gap: theme.spacing.md }]}>
              <View
                style={[
                  styles.icon,
                  {
                    backgroundColor: theme.colors.accentSoft,
                    borderRadius: theme.radii.xl,
                  },
                ]}
              >
                <Ionicons color={theme.colors.accent} name={icon} size={36} />
              </View>
              <Text tone="primary" variant="overline">
                {eyebrow}
              </Text>
              <Text accessibilityRole="header" variant="display">
                {title}
              </Text>
              <Text tone="textMuted">{description}</Text>
            </View>
            <View style={{ gap: theme.spacing.lg }}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  flex: {
    flex: 1,
  },
  heading: {
    marginBottom: 32,
    marginTop: 40,
  },
  icon: {
    alignItems: 'center',
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  inner: {
    maxWidth: MAX_CONTENT_WIDTH,
    paddingBottom: 48,
    width: '100%',
  },
  navigation: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    alignItems: 'center',
    flexGrow: 1,
  },
});
