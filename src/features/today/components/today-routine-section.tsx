import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { Routine, RoutineCheckIn } from '@/domain/entities';
import { checkInForRoutine } from '@/features/routines/services/routine-service';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';

export function TodayRoutineSection({
  routines,
  checkIns,
}: {
  routines: Routine[];
  checkIns: RoutineCheckIn[];
}) {
  const theme = useAppTheme();
  const localization = useLocalization();

  return (
    <View style={{ marginTop: theme.spacing.lg }}>
      <View style={[styles.sectionHeader, { marginBottom: theme.spacing.md }]}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primarySoft }]}>
          <Ionicons color={theme.colors.primary} name="repeat" size={15} />
        </View>
        <Text accessibilityRole="header" variant="heading">
          {localization.t('today.routines')}
        </Text>
      </View>
      {routines.length === 0 ? (
        <Text tone="textMuted" style={{ paddingVertical: theme.spacing.sm }}>
          {localization.t('today.noRoutines')}
        </Text>
      ) : (
        <View style={styles.list}>
          {routines.map((routine) => (
            <TodayRoutineRow
              checkIn={checkInForRoutine(checkIns, routine.id)}
              key={routine.id}
              routine={routine}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function TodayRoutineRow({
  routine,
  checkIn,
}: {
  routine: Routine;
  checkIn: RoutineCheckIn | null;
}) {
  const theme = useAppTheme();
  const localization = useLocalization();
  const router = useRouter();
  const planning = usePlanning();
  const description = checkIn
    ? checkIn.outcome === 'completed'
      ? localization.t('today.completedToday')
      : localization.t('today.skippedToday')
    : routine.schedule.time
      ? localization.formatTime(routine.schedule.time)
      : localization.t('common.anyTime');

  return (
    <View
      style={[
        styles.itemRow,
        theme.shadows.subtle,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.divider,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      <Pressable
        accessibilityLabel={`${routine.title}, ${description}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: planning.isMutating }}
        disabled={planning.isMutating}
        onPress={() =>
          void (checkIn
            ? planning.undoRoutine(routine)
            : planning.checkRoutine(routine, 'completed'))
        }
        style={styles.checkButton}
      >
        <Ionicons
          color={
            checkIn?.outcome === 'completed'
              ? theme.colors.success
              : theme.colors.textMuted
          }
          name={
            checkIn
              ? checkIn.outcome === 'completed'
                ? 'checkmark-circle'
                : 'remove-circle'
              : 'ellipse-outline'
          }
          size={26}
        />
      </Pressable>
      <Pressable
        accessibilityHint={localization.t('routines.opensDetails')}
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(routines)/routines/[id]',
            params: { id: routine.id },
          })
        }
        style={styles.itemCopy}
      >
        <Text variant="body">{routine.title}</Text>
        <Text tone="textMuted" variant="caption">{description}</Text>
      </Pressable>
      <View style={styles.secondaryAction}>
      <Button
        disabled={planning.isMutating}
        label={
          !checkIn
            ? localization.t('common.skip')
            : checkIn.outcome === 'completed'
              ? localization.t('today.markSkipped')
              : localization.t('today.markComplete')
        }
        onPress={() =>
          void planning.checkRoutine(
            routine,
            !checkIn || checkIn.outcome === 'completed' ? 'skipped' : 'completed',
          )
        }
        variant="ghost"
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  checkButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  itemCopy: { flex: 1, minWidth: 160, gap: 6, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET },
  secondaryAction: { alignItems: 'flex-end', width: '100%' },
  itemRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  list: { gap: 10 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 8,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
});
