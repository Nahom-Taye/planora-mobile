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
    <View style={{ marginTop: theme.spacing.xl }}>
      <Text
        accessibilityRole="header"
        style={{ marginBottom: theme.spacing.sm }}
        variant="heading"
      >
        {localization.t('today.routines')}
      </Text>
      {routines.length === 0 ? (
        <Text tone="textMuted" variant="caption">
          {localization.t('today.noRoutines')}
        </Text>
      ) : (
        <View
          style={[
            styles.list,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.divider,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          {routines.map((routine, index) => (
            <TodayRoutineRow
              checkIn={checkInForRoutine(checkIns, routine.id)}
              isLast={index === routines.length - 1}
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
  isLast,
}: {
  routine: Routine;
  checkIn: RoutineCheckIn | null;
  isLast: boolean;
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
        { borderBottomColor: theme.colors.divider, opacity: checkIn ? 0.7 : 1 },
        isLast && styles.last,
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
        <Text numberOfLines={2} variant="label">{routine.title}</Text>
        <Text tone="textMuted" variant="caption">{description}</Text>
      </Pressable>
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
  );
}

const styles = StyleSheet.create({
  checkButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    width: MIN_TOUCH_TARGET,
  },
  itemCopy: { flex: 1, gap: 2, justifyContent: 'center', minHeight: MIN_TOUCH_TARGET },
  itemRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    paddingEnd: 4,
    paddingVertical: 5,
  },
  last: { borderBottomWidth: 0 },
  list: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
