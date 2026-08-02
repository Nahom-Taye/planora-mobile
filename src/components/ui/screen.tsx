import { type PropsWithChildren } from 'react';
import {
  ScrollView,
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
import { MAX_CONTENT_WIDTH } from '@/utils/layout';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  safeAreaEdges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function Screen({
  children,
  scroll = true,
  safeAreaEdges = ['top', 'right', 'bottom', 'left'],
  contentStyle,
  testID,
}: ScreenProps) {
  const theme = useAppTheme();
  const innerStyle = [
    styles.inner,
    { paddingHorizontal: theme.spacing.xl },
    contentStyle,
  ];

  return (
    <SafeAreaView
      edges={safeAreaEdges}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      testID={testID}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={innerStyle}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.staticContent, ...innerStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
