import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { CalendarDate, Task } from '@/domain/entities';
import { goalForTask } from '@/features/goals/services/goal-task-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useGoals } from '@/providers/goal-provider';
import { useLocalization } from '@/providers/localization-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function UnscheduledTaskTray({
  tasks,
  date,
}: {
  tasks: Task[];
  date: CalendarDate;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const goals = useGoals();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="heading">{localization.t('planner.unscheduledTasks')}</Text>
      {tasks.length === 0 ? (
        <Text tone="textMuted" variant="caption">
          {localization.t('planner.noTasks')}
        </Text>
      ) : (
        tasks.slice(0, 8).map((task) => (
          <Card key={task.id} padded={false} variant="subtle">
            <Pressable
              accessibilityHint={localization.t('planner.scheduleTask')}
              accessibilityLabel={`${localization.t('planner.scheduleTask')}: ${task.title}`}
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/(planner)/blocks/new',
                  params: { date, taskId: task.id, title: task.title },
                } as unknown as Href)
              }
              style={({ pressed }) => [
                styles.row,
                {
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: theme.spacing.lg,
                },
              ]}
            >
              <View style={styles.copy}>
                <Text numberOfLines={2} variant="label">
                  {task.title}
                </Text>
                <Text tone="textMuted" variant="caption">
                  {task.dueDate
                    ? localization.formatDate(task.dueDate, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : localization.t('tasks.unscheduled')}
                </Text>
                {goalForTask(task, goals.goals) ? (
                  <Text numberOfLines={1} tone="accent" variant="caption">
                    {localization.t('goals.linkedGoal', {
                      title: goalForTask(task, goals.goals)?.title ?? '',
                    })}
                  </Text>
                ) : null}
              </View>
              <Ionicons
                color={theme.colors.primary}
                name="time-outline"
                size={22}
              />
            </Pressable>
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 2 },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: MIN_TOUCH_TARGET + 10,
    paddingVertical: 8,
  },
});
