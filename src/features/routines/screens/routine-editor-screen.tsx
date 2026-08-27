import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { ReminderAction } from '@/features/reminders/components/reminder-action';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

import { RoutineForm } from '../components/routine-form';

export function RoutineEditorScreen({ create = false }: { create?: boolean }) {
  const theme = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const planning = usePlanning();
  const localization = useLocalization();
  const routine = create || !params.id ? null : planning.getRoutine(params.id);

  if (!create && planning.status === 'loading' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="edit-routine-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('routines.loading')}
        </Text>
      </Screen>
    );
  }

  if (!create && planning.status === 'error' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="edit-routine-error">
        <Card>
          <Text accessibilityRole="header" variant="heading">
            {localization.t('routines.refreshTitle')}
          </Text>
          <Text style={{ marginVertical: theme.spacing.md }} tone="textMuted">
            {localization.message(planning.errorMessage) || localization.t('routines.notLoaded')}
          </Text>
          <Button label={localization.t('common.retry')} onPress={() => void planning.refresh()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen testID={create ? 'create-routine-screen' : 'edit-routine-screen'}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('common.goBack')}
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/(routines)/routines')}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name={localization.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} />
        </Pressable>
        <Text accessibilityRole="header" variant="heading">
          {localization.t(create ? 'routines.new' : 'routines.details')}
        </Text>
        <View style={styles.iconButton} />
      </View>
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {localization.t('routines.description')}
      </Text>
      {!create && !routine ? (
        <Card variant="subtle">
          <Text variant="heading">{localization.t('routines.unavailable')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t('routines.unavailableDescription')}
          </Text>
        </Card>
      ) : (
        <RoutineForm
          busy={planning.isMutating}
          onSubmit={async (draft) => {
            const result = routine
              ? await planning.updateRoutine(routine, draft)
              : await planning.createRoutine(draft);
            if (result.ok) goBackOrReplace(router, '/(routines)/routines');
            return result;
          }}
          routine={routine ?? undefined}
        />
      )}
      {routine ? (
        <View style={{ marginTop: theme.spacing.xl }}>
          <ReminderAction entityId={routine.id} entityType="routine" />
        </View>
      ) : null}
      {planning.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(planning.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    gap: 16,
    justifyContent: 'center',
  },
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
