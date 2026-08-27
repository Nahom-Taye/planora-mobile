import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyState, Screen, Text } from '@/components/ui';
import { GoalScreenHeader } from '@/features/goals/components/goal-screen-header';
import { availableTasksForGoalLink } from '@/features/goals/services/goal-task-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function GoalLinkScreen({ mode }: { mode: 'tasks' | 'routines' }) {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const goals = useGoals();
  const localization = useLocalization();
  const goal = params.id ? goals.getGoal(params.id) : null;

  if (!goal) {
    return (
      <Screen>
        <GoalScreenHeader
          onBack={() => goBackOrReplace(router, '/(tabs)/goals')}
          title={localization.t('goals.unavailable')}
        />
        <Text tone="textMuted">{localization.t('goals.unavailableDescription')}</Text>
      </Screen>
    );
  }

  const linkedRoutineIds = new Set(
    goals.routineLinksFor(goal.id).map((link) => link.routineId),
  );
  const items =
    mode === 'tasks'
      ? availableTasksForGoalLink(goals.tasks, goal.workspaceId)
      : goals.routines.filter(
          (routine) => routine.status === 'active' && !linkedRoutineIds.has(routine.id),
        );
  const title = localization.t(mode === 'tasks' ? 'goals.chooseTask' : 'goals.chooseRoutine');
  const section = localization.t(
    mode === 'tasks' ? 'goals.availableTasks' : 'goals.availableRoutines',
  );

  return (
    <Screen testID={`goal-link-${mode}-screen`}>
      <GoalScreenHeader onBack={() => goBackOrReplace(router, '/(tabs)/goals')} title={title} />
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {goal.title}
      </Text>
      {items.length ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text accessibilityRole="header" variant="heading">{section}</Text>
          {items.map((item) => (
            <Pressable
              accessibilityLabel={item.title}
              accessibilityRole="button"
              accessibilityState={{ disabled: goals.isMutating }}
              disabled={goals.isMutating}
              key={item.id}
              onPress={() => {
                const result =
                  mode === 'tasks'
                    ? goals.linkTask(goal, item as (typeof goals.tasks)[number])
                    : goals.linkRoutine(goal, item as (typeof goals.routines)[number]);
                void result.then((value) => {
                  if (value.ok) goBackOrReplace(router, '/(tabs)/goals');
                });
              }}
            >
              {({ pressed }) => (
                <Card style={{ opacity: pressed ? 0.72 : 1 }} variant="subtle">
                  <View style={styles.row}>
                    <Text numberOfLines={2} style={styles.copy} variant="label">
                      {item.title}
                    </Text>
                    <Ionicons color={theme.colors.primary} name="add-circle-outline" size={24} />
                  </View>
                </Card>
              )}
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState
          description={localization.t(
            mode === 'tasks' ? 'goals.noAvailableTasks' : 'goals.noAvailableRoutines',
          )}
          icon={
            <Ionicons
              color={theme.colors.accent}
              name={mode === 'tasks' ? 'checkbox-outline' : 'repeat-outline'}
              size={48}
            />
          }
          title={section}
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

const styles = StyleSheet.create({
  copy: { flex: 1 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET,
  },
});
