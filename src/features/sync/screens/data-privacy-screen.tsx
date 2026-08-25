import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button, Card, FormField, Screen, SectionHeader, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/providers/localization-provider';
import { useSync } from '@/providers/sync-provider';

type PendingAction = 'clear_device' | 'delete_cloud' | 'delete_account' | null;

export function DataPrivacyScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const sync = useSync();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmation, setConfirmation] = useState('');
  const [removeCalendarEvents, setRemoveCalendarEvents] = useState(false);
  const statusKey = statusTranslationKey(sync.binding?.state);

  const destructiveAction = async () => {
    const action = pendingAction;
    if (!action) return;
    const result = action === 'clear_device'
      ? await sync.clearDevice(confirmation, removeCalendarEvents)
      : action === 'delete_cloud'
        ? await sync.deleteCloud(confirmation)
        : await sync.deleteAccount(confirmation);
    if (result !== null) {
      setPendingAction(null);
      setConfirmation('');
      Alert.alert(localization.t('sync.completedTitle'), localization.t(action === 'clear_device' ? 'sync.deviceCleared' : action === 'delete_cloud' ? 'sync.cloudDeleted' : 'sync.accountDeleted'));
    }
  };

  return (
    <Screen testID="privacy-data-screen">
      <Button label={localization.t('common.goBack')} onPress={() => router.back()} variant="ghost" />
      <View style={{ height: theme.spacing.lg }} />
      <SectionHeader eyebrow={localization.t('sync.eyebrow')} title={localization.t('sync.title')} description={localization.t('sync.description')} />

      <Card style={{ marginTop: theme.spacing.xl }}>
        <Text variant="heading">{localization.t('sync.status')}</Text>
        <Text accessibilityLiveRegion="polite" style={{ marginTop: theme.spacing.sm }} tone="textMuted">
          {localization.t(statusKey)}
        </Text>
        <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted" variant="caption">
          {localization.t('sync.pendingCount', { count: sync.pending })}
        </Text>
        {sync.binding?.lastSuccessAt ? (
          <Text tone="textMuted" variant="caption">{localization.t('sync.lastSuccess', { value: new Intl.DateTimeFormat(localization.locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(sync.binding.lastSuccessAt)) })}</Text>
        ) : null}
        {sync.message ? <Text accessibilityLiveRegion="assertive" style={{ marginTop: theme.spacing.md }} tone="warning">{localization.t('sync.recoverableError')}</Text> : null}
        <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
          {sync.binding?.enabled ? (
            <>
              <Button label={localization.t('sync.syncNow')} loading={sync.busy} onPress={() => void sync.synchronize()} style={styles.flex} />
              <Button label={localization.t('sync.disable')} onPress={() => void sync.disable()} style={styles.flex} variant="secondary" />
            </>
          ) : sync.signedIn && sync.configured ? (
            <>
              <Button label={localization.t('sync.upload')} loading={sync.busy} onPress={() => void sync.enable('upload')} style={styles.flex} />
              <Button label={localization.t('sync.merge')} loading={sync.busy} onPress={() => void sync.enable('merge')} style={styles.flex} variant="secondary" />
              <Button label={localization.t('sync.restore')} loading={sync.busy} onPress={() => void sync.enable('restore')} style={styles.flex} variant="secondary" />
            </>
          ) : (
            <Text tone="textMuted">{localization.t(sync.configured ? 'sync.signInRequired' : 'sync.unavailable')}</Text>
          )}
        </View>
        <Text style={{ marginTop: theme.spacing.md }} tone="textMuted" variant="caption">{localization.t('sync.activationNote')}</Text>
        {sync.conflicts.length ? (
          <Button label={localization.t('sync.reviewConflicts', { count: sync.conflicts.length })} onPress={() => router.push('/(sync)/conflicts' as Href)} style={{ marginTop: theme.spacing.lg }} variant="secondary" />
        ) : null}
      </Card>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
        <Text variant="heading">{localization.t('sync.exportTitle')}</Text>
        <Text tone="textMuted">{localization.t('sync.exportDescription')}</Text>
        <Button label={localization.t('sync.exportAction')} loading={sync.busy} onPress={() => void sync.exportData(localization.t('sync.exportDialog'))} />
      </View>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
        <Text variant="heading">{localization.t('sync.deletionTitle')}</Text>
        <Text tone="textMuted">{localization.t('sync.deletionDescription')}</Text>
        <Button label={localization.t('sync.clearDevice')} onPress={() => setPendingAction('clear_device')} variant="secondary" />
        <Button disabled={!sync.binding?.enabled} label={localization.t('sync.deleteCloud')} onPress={() => setPendingAction('delete_cloud')} variant="secondary" />
        <Button disabled={!sync.signedIn} label={localization.t('sync.deleteAccount')} onPress={() => setPendingAction('delete_account')} variant="secondary" />
      </View>

      {pendingAction ? (
        <Card style={{ marginTop: theme.spacing.xl }}>
          <Text variant="heading">{localization.t('sync.confirmTitle')}</Text>
          <Text style={{ marginTop: theme.spacing.sm }} tone="textMuted">
            {localization.t(`sync.confirm${pendingAction === 'clear_device' ? 'Clear' : pendingAction === 'delete_cloud' ? 'Cloud' : 'Account'}` as never)}
          </Text>
          <FormField autoCapitalize="characters" label={localization.t('sync.confirmation')} onChangeText={setConfirmation} style={{ marginTop: theme.spacing.lg }} value={confirmation} />
          {pendingAction === 'clear_device' ? (
            <Button label={localization.t(removeCalendarEvents ? 'calendar.removeBoth' : 'calendar.keepExternal')} onPress={() => setRemoveCalendarEvents((value) => !value)} style={{ marginTop: theme.spacing.md }} variant="secondary" />
          ) : null}
          <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
            <Button label={localization.t('common.cancel')} onPress={() => { setPendingAction(null); setConfirmation(''); setRemoveCalendarEvents(false); }} style={styles.flex} variant="ghost" />
            <Button label={localization.t('common.delete')} loading={sync.busy} onPress={() => void destructiveAction()} style={styles.flex} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

function statusTranslationKey(state: string | undefined): 'sync.stateLocal' | 'sync.stateIdle' | 'sync.stateSyncing' | 'sync.stateOffline' | 'sync.stateError' | 'sync.stateConflict' | 'sync.stateRestoring' | 'sync.stateAccountMismatch' {
  if (state === 'idle') return 'sync.stateIdle';
  if (state === 'syncing') return 'sync.stateSyncing';
  if (state === 'offline') return 'sync.stateOffline';
  if (state === 'error') return 'sync.stateError';
  if (state === 'conflict') return 'sync.stateConflict';
  if (state === 'restoring') return 'sync.stateRestoring';
  if (state === 'account_mismatch') return 'sync.stateAccountMismatch';
  return 'sync.stateLocal';
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flexGrow: 1 },
});
