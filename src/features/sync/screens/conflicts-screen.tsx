import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, Card, Screen, SectionHeader, Text } from '@/components/ui';
import { canCombineConflict, combineConflictPayload } from '@/features/sync/services/conflict-combination';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useSync } from '@/providers/sync-provider';
import type { PortableEntityType } from '@/domain/entities';
import type { TranslationKey } from '@/features/localization/catalogs';
import { goBackOrReplace } from '@/utils/safe-navigation';

const entityTypeKeys: Record<PortableEntityType, TranslationKey> = {
  workspace: 'entityTypes.workspace',
  task: 'entityTypes.task',
  plan_block_series: 'entityTypes.planBlockSeries',
  plan_block: 'entityTypes.planBlock',
  routine: 'entityTypes.routine',
  routine_check_in: 'entityTypes.routineCheckIn',
  goal: 'entityTypes.goal',
  milestone: 'entityTypes.milestone',
  goal_routine_link: 'entityTypes.goalRoutineLink',
  area: 'entityTypes.area',
  tag: 'entityTypes.tag',
  reflection: 'entityTypes.reflection',
  app_settings: 'entityTypes.appSettings',
  reminder_intent: 'entityTypes.reminderIntent',
};

export function ConflictsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const localization = useLocalization();
  const sync = useSync();

  return (
    <Screen testID="sync-conflicts-screen">
      <Button label={localization.t('common.goBack')} onPress={() => goBackOrReplace(router, '/(sync)/data')} variant="ghost" />
      <View style={{ height: theme.spacing.lg }} />
      <SectionHeader eyebrow={localization.t('sync.conflictEyebrow')} title={localization.t('sync.conflictTitle')} description={localization.t('sync.conflictDescription')} />
      <View style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xl }}>
        {sync.conflicts.length ? sync.conflicts.map((conflict) => (
          <Card key={conflict.id}>
            <Text variant="heading">{localization.t('sync.conflictItem', { type: localization.t(entityTypeKeys[conflict.entityType]) })}</Text>
            <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">{localization.t('sync.conflictBasis', { local: conflict.localRevision, remote: conflict.remoteRevision })}</Text>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
              <Button label={localization.t('sync.keepLocal')} loading={sync.busy} onPress={() => void sync.resolveConflict(conflict.id, 'local')} />
              <Button label={localization.t('sync.keepCloud')} loading={sync.busy} onPress={() => void sync.resolveConflict(conflict.id, 'remote')} variant="secondary" />
              {canCombineConflict(conflict.entityType) ? (
                <Button label={localization.t('sync.combineText')} loading={sync.busy} onPress={() => void sync.resolveConflict(conflict.id, 'combined', combineConflictPayload(conflict.entityType, conflict.localPayload, conflict.remotePayload))} variant="secondary" />
              ) : null}
            </View>
          </Card>
        )) : <Text tone="textMuted">{localization.t('sync.noConflicts')}</Text>}
      </View>
    </Screen>
  );
}
