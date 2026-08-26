import { useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  View,
} from 'react-native';
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import {
  reportFeatureFailure,
  type RecoveryArea,
} from '@/features/recovery/services/redacted-diagnostics';

type BoundaryProps = PropsWithChildren<{
  onError: (error: unknown, information: ErrorInfo) => void;
  renderFallback: (retry: () => void) => ReactNode;
}>;

type BoundaryState = { failed: boolean };

class RecoveryBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, information: ErrorInfo) {
    this.props.onError(error, information);
  }

  private readonly retry = () => this.setState({ failed: false });

  render() {
    return this.state.failed
      ? this.props.renderFallback(this.retry)
      : this.props.children;
  }
}

export function FeatureErrorBoundary({
  area,
  children,
}: PropsWithChildren<{ area: RecoveryArea }>) {
  const router = useRouter();
  const theme = useAppTheme();
  const localization = useLocalization();
  const onError = useCallback(
    (error: unknown) => {
      reportFeatureFailure(area, error);
    },
    [area],
  );

  const fallback = useCallback(
    (retry: () => void) => (
      <RecoveryFallback
        area={area}
        description={localization.t('recoveryBoundary.description')}
        gap={theme.spacing.lg}
        onRetry={retry}
        onToday={() => router.replace('/')}
        retryHint={localization.t('recoveryBoundary.retryHint')}
        retryLabel={localization.t('recoveryBoundary.retry')}
        title={localization.t('recoveryBoundary.title')}
        todayHint={localization.t('recoveryBoundary.todayHint')}
        todayLabel={localization.t('recoveryBoundary.today')}
      />
    ),
    [area, localization, router, theme.spacing.lg],
  );

  return (
    <RecoveryBoundary onError={onError} renderFallback={fallback}>
      {children}
    </RecoveryBoundary>
  );
}

function RecoveryFallback({
  area,
  description,
  gap,
  onRetry,
  onToday,
  retryHint,
  retryLabel,
  title,
  todayHint,
  todayLabel,
}: {
  area: RecoveryArea;
  description: string;
  gap: number;
  onRetry: () => void;
  onToday: () => void;
  retryHint: string;
  retryLabel: string;
  title: string;
  todayHint: string;
  todayLabel: string;
}) {
  const alertRef = useRef<View>(null);

  useEffect(() => {
    const handle = findNodeHandle(alertRef.current);
    if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
  }, []);

  return (
    <Screen contentStyle={styles.screen} scroll={false} testID={`${area}-recovery-screen`}>
      <Card style={styles.card}>
        <View
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          ref={alertRef}
          style={{ gap }}
        >
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" align="center" variant="heading">
              {title}
            </Text>
            <Text align="center" tone="textMuted">{description}</Text>
          </View>
          <Button accessibilityHint={retryHint} label={retryLabel} onPress={onRetry} />
          <Button accessibilityHint={todayHint} label={todayLabel} onPress={onToday} variant="secondary" />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%' },
  screen: { justifyContent: 'center', paddingBottom: 24 },
});
