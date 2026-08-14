import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { toCalendarDate } from '@/domain/entities';
import { PlanBlockForm } from '@/features/planner/components/plan-block-form';
import { CalendarExportSection } from '@/features/calendar/components/calendar-export-section';
import { ReminderAction } from '@/features/reminders/components/reminder-action';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanner } from '@/providers/planner-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function PlanBlockEditorScreen({ create = false }: { create?: boolean }) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const planner = usePlanner();
  const planning = usePlanning();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    date?: string;
    taskId?: string;
    title?: string;
  }>();
  const block = create || !params.id ? null : planner.getBlock(params.id);
  const recurrence = block?.seriesId ? planner.getSeries(block.seriesId) : null;

  if (!create && planner.status === 'loading' && planner.blocks.length === 0) {
    return (
      <Screen contentStyle={styles.center} testID="edit-plan-block-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('planner.loading')}
        </Text>
      </Screen>
    );
  }

  const closeAfter = async (operation: () => Promise<{ ok: boolean }>) => {
    const result = await operation();
    if (result.ok) router.back();
  };
  const cancelBlock = () => {
    if (!block) return;
    Alert.alert(
      localization.t('planner.cancelTitle'),
      localization.t('planner.cancelDescription'),
      [
        { text: localization.t('planner.keepBlock'), style: 'cancel' },
        {
          text: localization.t('planner.cancelBlock'),
          onPress: () => void closeAfter(() => planner.cancelBlock(block)),
        },
      ],
    );
  };
  const deleteBlock = () => {
    if (!block) return;
    Alert.alert(
      localization.t('planner.deleteTitle'),
      localization.t('planner.deleteDescription'),
      [
        { text: localization.t('planner.keepBlock'), style: 'cancel' },
        {
          text: localization.t('planner.deleteBlock'),
          style: 'destructive',
          onPress: () => void closeAfter(() => planner.deleteBlock(block)),
        },
      ],
    );
  };

  const actionableTasks = planning.tasks.filter(
    (task) => task.status === 'pending' || task.status === 'in_progress',
  );
  const availableRoutines = planning.routines.filter(
    (routine) => routine.status !== 'archived',
  );

  return (
    <Screen testID={create ? 'create-plan-block-screen' : 'edit-plan-block-screen'}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('common.goBack')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons
            color={theme.colors.text}
            name={localization.isRTL ? 'arrow-forward' : 'arrow-back'}
            size={24}
          />
        </Pressable>
        <Text accessibilityRole="header" variant="heading">
          {localization.t(create ? 'planner.newBlock' : 'planner.blockDetails')}
        </Text>
        <View style={styles.iconButton} />
      </View>

      {!create && !block ? (
        <Card>
          <Text variant="heading">{localization.t('planner.refreshTitle')}</Text>
          <Button
            label={localization.t('common.retry')}
            onPress={() => void planner.refresh()}
          />
        </Card>
      ) : (
        <PlanBlockForm
          block={block ?? undefined}
          busy={planner.isMutating}
          initialDate={params.date ?? planner.selectedDate ?? planner.today ?? ''}
          initialTaskId={params.taskId}
          initialTitle={params.title}
          onSubmit={async ({ block: draft, recurrence: recurrenceDraft, editFuture }) => {
            let result;
            if (block && editFuture && recurrence && recurrenceDraft) {
              result = await planner.editFuture(
                recurrence,
                recurrenceDraft,
                toCalendarDate(draft.date),
              );
            } else if (block) {
              result = await planner.updateBlock(block, draft);
            } else if (recurrenceDraft) {
              result = await planner.createRecurrence(recurrenceDraft);
            } else {
              const task = draft.taskId
                ? planning.getTask(draft.taskId)
                : null;
              result = task
                ? await planner.scheduleTask(task, {
                    title: draft.title,
                    notes: draft.notes,
                    date: draft.date,
                    startTime: draft.startTime,
                    endTime: draft.endTime,
                    status: draft.status,
                  })
                : await planner.createBlock(draft);
            }
            if (result.ok) router.back();
            return result;
          }}
          recurrence={recurrence}
          routines={availableRoutines}
          tasks={actionableTasks}
        />
      )}

      {block ? (
        <>
        <View style={{ marginTop: theme.spacing.xxl }}>
          <ReminderAction entityId={block.id} entityType="plan_block" />
        </View>
        <CalendarExportSection block={block} />
        <Card style={{ marginTop: theme.spacing.xl }} variant="subtle">
          <View style={{ gap: theme.spacing.sm }}>
            {block.status === 'planned' ? (
              <Button
                label={localization.t('planner.completeBlock')}
                onPress={() => void closeAfter(() => planner.completeBlock(block))}
                variant="ghost"
              />
            ) : (
              <Button
                label={localization.t('planner.reopenBlock')}
                onPress={() => void closeAfter(() => planner.reopenBlock(block))}
                variant="ghost"
              />
            )}
            {block.taskId || block.routineId ? (
              <Button
                label={localization.t('planner.removeLink')}
                onPress={() => void planner.unlinkBlock(block)}
                variant="ghost"
              />
            ) : null}
            {block.status !== 'cancelled' ? (
              <Button
                label={localization.t('planner.cancelBlock')}
                onPress={cancelBlock}
                variant="ghost"
              />
            ) : null}
            <Button
              label={localization.t('planner.deleteBlock')}
              onPress={deleteBlock}
              variant="ghost"
            />
          </View>
        </Card>
        </>
      ) : null}

      {planner.errorMessage ? (
        <Text accessibilityLiveRegion="polite" tone="danger" variant="caption">
          {localization.message(planner.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { gap: 16, justifyContent: 'center' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
});
