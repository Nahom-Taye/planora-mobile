import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandWordmark } from '@/components/brand';
import { Card, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';

type IconName = ComponentProps<typeof Ionicons>['name'];

type FeaturePlaceholderProps = {
  title: string;
  description: string;
  icon: IconName;
  emptyTitle: string;
  emptyDescription: string;
};

export function FeaturePlaceholder({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
}: FeaturePlaceholderProps) {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <Screen safeAreaEdges={['top', 'right', 'left']} testID={`${title.toLowerCase()}-screen`}>
      <BrandWordmark compact markSize={32} />
      <View style={{ height: theme.spacing.xxxl }} />
      <SectionHeader
        description={description}
        eyebrow={localization.t('settings.eyebrow')}
        title={title}
      />
      <Card style={{ marginTop: theme.spacing.xxl }}>
        <EmptyState
          description={emptyDescription}
          icon={
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: theme.colors.accentSoft,
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Ionicons color={theme.colors.primary} name={icon} size={30} />
            </View>
          }
          title={emptyTitle}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
});
