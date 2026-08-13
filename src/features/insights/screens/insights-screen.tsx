import { FeaturePlaceholder } from '@/features/foundation/components/feature-placeholder';
import { useLocalization } from '@/providers/localization-provider';

export function InsightsScreen() {
  const localization = useLocalization();
  return (
    <FeaturePlaceholder
      description={localization.t('placeholders.insightsDescription')}
      emptyDescription={localization.t('placeholders.insightsEmptyDescription')}
      emptyTitle={localization.t('placeholders.insightsEmpty')}
      icon="bar-chart-outline"
      title={localization.t('tabs.insights')}
    />
  );
}
