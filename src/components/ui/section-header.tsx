import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

import { Text } from './text';

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
}: SectionHeaderProps) {
  const theme = useAppTheme();

  return (
    <View style={[styles.container, { gap: theme.spacing.sm }]}>
      {eyebrow ? (
        <Text tone="accent" variant="overline">
          {eyebrow}
        </Text>
      ) : null}
      <Text variant="display">{title}</Text>
      {description ? <Text tone="textMuted">{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
