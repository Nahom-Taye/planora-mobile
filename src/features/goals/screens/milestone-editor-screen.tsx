import { useLocalSearchParams, useRouter } from 'expo-router';

import { Card, Screen, Text } from '@/components/ui';
import { GoalScreenHeader } from '@/features/goals/components/goal-screen-header';
import { MilestoneForm } from '@/features/goals/components/milestone-form';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function MilestoneEditorScreen({ create = false }: { create?: boolean }) {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; milestoneId?: string }>();
  const goals = useGoals();
  const localization = useLocalization();
  const goal = params.id ? goals.getGoal(params.id) : null;
  const milestone =
    create || !params.milestoneId ? null : goals.getMilestone(params.milestoneId);

  return (
    <Screen testID={create ? 'create-milestone-screen' : 'edit-milestone-screen'}>
      <GoalScreenHeader
        onBack={() => goBackOrReplace(router, '/(tabs)/goals')}
        title={localization.t(create ? 'goals.newMilestone' : 'goals.editMilestone')}
      />
      {!goal || (!create && !milestone) ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('goals.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('goals.unavailableDescription')}
          </Text>
        </Card>
      ) : (
        <MilestoneForm
          busy={goals.isMutating}
          milestone={milestone ?? undefined}
          onSubmit={async (draft) => {
            const result = milestone
              ? await goals.updateMilestone(goal, milestone, draft)
              : await goals.createMilestone(goal, draft);
            if (result.ok) goBackOrReplace(router, '/(tabs)/goals');
            return result;
          }}
        />
      )}
      {goals.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(goals.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}
