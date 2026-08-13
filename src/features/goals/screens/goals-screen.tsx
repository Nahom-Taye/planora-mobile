import { FeaturePlaceholder } from '@/features/foundation/components/feature-placeholder';
import { useLocalization } from '@/providers/localization-provider';

export function GoalsScreen() {
  const localization = useLocalization();
  return (
    <FeaturePlaceholder
      description={localization.t('placeholders.goalsDescription')}
      emptyDescription={localization.t('placeholders.goalsEmptyDescription')}
      emptyTitle={localization.t('placeholders.goalsEmpty')}
      icon="flag-outline"
      title={localization.t('tabs.goals')}
    />
  );
}
