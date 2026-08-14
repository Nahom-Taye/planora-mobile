import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { GoalForm } from '@/features/goals/components/goal-form';
import { GoalScreenHeader } from '@/features/goals/components/goal-screen-header';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';

export function GoalEditorScreen({ create = false }: { create?: boolean }) {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const goals = useGoals();
  const localization = useLocalization();
  const goal = create || !params.id ? null : goals.getGoal(params.id);

  if (!create && goals.status === 'loading' && !goal) {
    return (
      <Screen contentStyle={{ gap: 16, justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text align="center" tone="textMuted">{localization.t('goals.loading')}</Text>
      </Screen>
    );
  }

  return (
    <Screen testID={create ? 'create-goal-screen' : 'edit-goal-screen'}>
      <GoalScreenHeader
        onBack={() => router.back()}
        title={localization.t(create ? 'goals.create' : 'goals.edit')}
      />
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {localization.t('goals.formDescription')}
      </Text>
      {!create && !goal ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('goals.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('goals.unavailableDescription')}
          </Text>
        </Card>
      ) : (
        <GoalForm
          areas={goals.areas}
          busy={goals.isMutating}
          goal={goal ?? undefined}
          onSubmit={async (draft) => {
            const result = goal
              ? await goals.updateGoal(goal, draft)
              : await goals.createGoal(draft);
            if (result.ok) router.back();
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
