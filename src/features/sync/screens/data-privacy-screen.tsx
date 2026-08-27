import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, FormField, Screen, SectionHeader, Text } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useLocalization } from '@/providers/localization-provider';
import { useSync } from '@/providers/sync-provider';
import { syncStatusTranslationKey } from '@/features/sync/services/sync-status';
import { goBackOrReplace } from '@/utils/safe-navigation';

type PendingAction = 'clear_device' | 'delete_cloud' | 'delete_account' | null;

export function DataPrivacyScreen() {
  const theme = useAppTheme();
  const localization = useLocalization();
  const sync = useSync();
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmation, setConfirmation] = useState('');
  const [removeCalendarEvents, setRemoveCalendarEvents] = useState(false);
  const confirmationRef = useRef<TextInput>(null);
  const reducedMotion = useReducedMotion();
  const statusKey = syncStatusTranslationKey({
    state: sync.binding?.state,
    pending: sync.pending,
    busy: sync.busy,
    online: sync.online,
  });

  const destructiveAction = async () => {
    const action = pendingAction;
    if (!action) return;
    const result = action === 'clear_device'
      ? await sync.clearDevice(confirmation, removeCalendarEvents)
      : action === 'delete_cloud'
        ? await sync.deleteCloud(confirmation)
        : await sync.deleteAccount(confirmation);
    if (result !== null) {
      closeConfirmation();
      Alert.alert(localization.t('sync.completedTitle'), localization.t(action === 'clear_device' ? 'sync.deviceCleared' : action === 'delete_cloud' ? 'sync.cloudDeleted' : 'sync.accountDeleted'));
    }
  };

  const closeConfirmation = () => {
    setPendingAction(null);
    setConfirmation('');
    setRemoveCalendarEvents(false);
  };

  const confirmationDescription = pendingAction === 'clear_device'
    ? localization.t('sync.confirmClear')
    : pendingAction === 'delete_cloud'
      ? localization.t('sync.confirmCloud')
      : localization.t('sync.confirmAccount');
  const confirmationAction = pendingAction === 'clear_device'
    ? localization.t('destructive.clearDevice')
    : pendingAction === 'delete_cloud'
      ? localization.t('destructive.deleteCloud')
      : localization.t('destructive.deleteAccount');

  return (
    <Screen testID="privacy-data-screen">
      <Button label={localization.t('common.goBack')} onPress={() => goBackOrReplace(router, '/(tabs)/settings')} variant="ghost" />
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
          <Text tone="textMuted" variant="caption">{localization.t('sync.lastSuccess', { value: localization.formatInstant(sync.binding.lastSuccessAt) })}</Text>
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
        <Button label={localization.t('sync.clearDevice')} onPress={() => setPendingAction('clear_device')} variant="danger" />
        <Button disabled={!sync.binding?.enabled} label={localization.t('sync.deleteCloud')} onPress={() => setPendingAction('delete_cloud')} variant="danger" />
        <Button disabled={!sync.signedIn} label={localization.t('sync.deleteAccount')} onPress={() => setPendingAction('delete_account')} variant="danger" />
      </View>

      <Modal
        accessibilityViewIsModal
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={closeConfirmation}
        onShow={() => confirmationRef.current?.focus()}
        presentationStyle="overFullScreen"
        statusBarTranslucent
        transparent
        visible={pendingAction !== null}
      >
        <SafeAreaView style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
            <Card style={styles.modalCard}>
              <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={{ gap: theme.spacing.md }}>
                <Text accessibilityRole="header" variant="heading">{localization.t('sync.confirmTitle')}</Text>
                <Text tone="textMuted">{confirmationDescription}</Text>
              </View>
              <FormField
                autoCapitalize="characters"
                autoCorrect={false}
                label={localization.t('sync.confirmation')}
                onChangeText={setConfirmation}
                ref={confirmationRef}
                style={{ marginTop: theme.spacing.lg }}
                value={confirmation}
              />
              {pendingAction === 'clear_device' ? (
                <Button
                  accessibilityHint={localization.t('destructive.calendarStateHint')}
                  label={localization.t(removeCalendarEvents ? 'calendar.removeBoth' : 'calendar.keepExternal')}
                  onPress={() => setRemoveCalendarEvents((value) => !value)}
                  selected={removeCalendarEvents}
                  style={{ marginTop: theme.spacing.md }}
                  variant="secondary"
                />
              ) : null}
              {sync.message ? (
                <Text accessibilityLiveRegion="assertive" style={{ marginTop: theme.spacing.md }} tone="danger">
                  {localization.t('sync.recoverableError')}
                </Text>
              ) : null}
              <View style={[styles.actions, { gap: theme.spacing.md, marginTop: theme.spacing.lg }]}>
                <Button label={localization.t('common.cancel')} onPress={closeConfirmation} style={styles.flex} variant="ghost" />
                <Button label={confirmationAction} loading={sync.busy} onPress={() => void destructiveAction()} style={styles.flex} variant="danger" />
              </View>
            </Card>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  flex: { flexGrow: 1 },
  modalCard: { alignSelf: 'center', maxWidth: 560, width: '100%' },
  modalKeyboard: { justifyContent: 'center', flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24 },
});
