import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { Text } from './text';

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  const theme = useAppTheme();

  return (
    <View style={styles.container}>
      {icon}
      <View style={{ gap: theme.spacing.sm }}>
        <Text align="center" variant="heading">
          {title}
        </Text>
        <Text align="center" tone="textMuted">
          {description}
        </Text>
      </View>
      {action ? <View style={{ marginTop: theme.spacing.sm }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
  },
});
