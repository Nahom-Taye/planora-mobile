import { type PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { MAX_CONTENT_WIDTH } from '@/utils/layout';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  safeAreaEdges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({
  children,
  scroll = true,
  safeAreaEdges = ['top', 'right', 'bottom', 'left'],
  contentStyle,
  testID,
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const innerStyle = [
    styles.inner,
    { paddingHorizontal: theme.spacing.xl },
    contentStyle,
  ];

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.background,
          direction: localization.direction,
        },
      ]}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="never"
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  colors={[theme.colors.primary]}
                  onRefresh={onRefresh}
                  refreshing={refreshing}
                  tintColor={theme.colors.primary}
                />
              ) : undefined
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={innerStyle}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.staticContent, ...innerStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
  },
  staticContent: {
    alignSelf: 'center',
    flex: 1,
  },
  inner: {
    maxWidth: MAX_CONTENT_WIDTH,
    paddingBottom: 112,
    paddingTop: 20,
    width: '100%',
  },
});
