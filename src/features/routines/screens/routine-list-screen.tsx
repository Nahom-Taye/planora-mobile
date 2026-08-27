import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import type { Routine } from '@/domain/entities';
import {
  formatRoutineScheduleLabel,
  groupRoutines,
} from '@/features/routines/services/routine-organization';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { usePlanning } from '@/providers/planning-provider';
import { MIN_TOUCH_TARGET } from '@/utils/layout';
import { goBackOrReplace } from '@/utils/safe-navigation';

export function RoutineListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const planning = usePlanning();
  const localization = useLocalization();

  if (planning.status === 'loading' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="routines-loading">
        <ActivityIndicator color={theme.colors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" tone="textMuted">
          {localization.t('routines.loading')}
        </Text>
      </Screen>
    );
  }

  if (planning.status === 'error' && !planning.plan) {
    return (
      <Screen contentStyle={styles.center} testID="routines-error">
        <EmptyState
          action={<Button label={localization.t('common.retry')} onPress={() => void planning.refresh()} />}
          description={localization.message(planning.errorMessage) || localization.t('routines.notLoaded')}
          icon={<Ionicons color={theme.colors.warning} name="refresh-circle-outline" size={48} />}
          title={localization.t('routines.listRefresh')}
        />
      </Screen>
    );
  }

  if (!planning.plan) return null;
  const groups = groupRoutines(planning.routines);

  return (
    <Screen
      onRefresh={() => void planning.refresh()}
      refreshing={planning.status === 'loading'}
      testID="routine-list-screen"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={localization.t('common.goBack')}
          accessibilityRole="button"
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          style={styles.iconButton}
        >
          <Ionicons color={theme.colors.text} name={localization.isRTL ? 'arrow-forward' : 'arrow-back'} size={24} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.headerTitle} variant="heading">
          {localization.t('routines.title')}
        </Text>
        <Button
          label={localization.t('routines.new')}
          onPress={() => router.push('/(routines)/routines/new')}
          variant="ghost"
        />
      </View>
      <Text style={{ marginBottom: theme.spacing.xl }} tone="textMuted">
        {localization.t('routines.description')}
      </Text>
      {planning.routines.length === 0 ? (
        <Card>
          <EmptyState
            action={<Button label={localization.t('routines.createAction')} onPress={() => router.push('/(routines)/routines/new')} />}
            description={localization.t('routines.emptyDescription')}
            icon={<Ionicons color={theme.colors.accent} name="repeat-outline" size={48} />}
            title={localization.t('routines.emptyTitle')}
          />
        </Card>
      ) : (
        <>
          <RoutineGroup label={localization.t('common.active')} routines={groups.active} />
          <RoutineGroup label={localization.t('common.paused')} quiet routines={groups.paused} />
          <RoutineGroup label={localization.t('common.archived')} quiet routines={groups.archived} />
        </>
      )}
      {planning.errorMessage ? (
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.lg }} tone="danger">
          {localization.message(planning.errorMessage)}
        </Text>
      ) : null}
    </Screen>
  );
}

function RoutineGroup({
  label,
  routines,
  quiet = false,
}: {
  label: string;
  routines: Routine[];
  quiet?: boolean;
}) {
  const theme = useAppTheme();
  if (routines.length === 0) return null;

  return (
    <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
      <Text accessibilityRole="header" variant="heading">
        {label}
      </Text>
      {routines.map((routine) => (
        <RoutineListRow key={routine.id} quiet={quiet} routine={routine} />
      ))}
    </View>
  );
}

function RoutineListRow({ routine, quiet }: { routine: Routine; quiet: boolean }) {
  const theme = useAppTheme();
  const router = useRouter();
  const localization = useLocalization();
  const schedule = formatRoutineScheduleLabel(routine, {
    everyDay: localization.t('routines.everyDay'),
    formatDate: (date) => localization.formatDate(date, { weekday: 'short' }),
    formatList: localization.formatList,
    formatTime: localization.formatTime,
  });

  return (
    <Pressable
      accessibilityHint={localization.t('routines.opensDetails')}
      accessibilityLabel={`${routine.title}. ${localization.t(`common.${routine.status}` as 'common.active' | 'common.paused' | 'common.archived')}. ${schedule}.`}
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/(routines)/routines/[id]',
          params: { id: routine.id },
        })
      }
    >
      {({ pressed }) => (
        <Card
          style={{ opacity: quiet ? 0.72 : pressed ? 0.78 : 1 }}
          variant={quiet ? 'subtle' : 'default'}
        >
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text variant="label">{routine.title}</Text>
              <Text tone="textMuted" variant="caption">
                {schedule}
              </Text>
            </View>
            <Ionicons color={theme.colors.textMuted} name={localization.isRTL ? 'chevron-back' : 'chevron-forward'} size={20} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: 16,
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 16,
  },
  headerTitle: {
    flex: 1,
  },
  iconButton: {
    alignItems: 'center',
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    marginRight: 8,
    width: MIN_TOUCH_TARGET,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
