import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

export function GoalDetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.section,
        {
          borderTopColor: theme.colors.divider,
          gap: theme.spacing.md,
          paddingTop: theme.spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title} variant="heading">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 24 },
  title: { flex: 1 },
});
