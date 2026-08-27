import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import { toCalendarDate, toInstant, toTimeZone, type Task } from '../src/domain/entities/index.ts';
import { parseRecoveryUrl } from '../src/features/auth/services/recovery-link.ts';
import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';
import { selectNotificationRuntime } from '../src/features/reminders/services/notification-runtime-selection.ts';
import { normalizePermissionState } from '../src/features/reminders/services/permission-state.ts';
import { parseNotificationDestination } from '../src/features/reminders/services/notification-navigation.ts';
import { createDevelopmentDiagnostic, createRedactedDiagnostic } from '../src/features/recovery/services/redacted-diagnostics.ts';
import { AutomaticSyncCoordinator, automaticRetryDelay } from '../src/features/sync/services/automatic-sync.ts';
import { confirmationMatches } from '../src/features/sync/services/data-control.ts';
import { exportContainsDeviceIdentifiers, type PlanningExport } from '../src/features/sync/services/export-format.ts';
import { mapRemoteError } from '../src/features/sync/services/supabase-sync-gateway.ts';
import { syncStatusTranslationKey } from '../src/features/sync/services/sync-status.ts';
import { buildTodayPlan } from '../src/features/today/services/today-planning.ts';
import { contrastRatio } from '../src/theme/contrast.ts';
import { goBackOrReplace, type BackNavigation } from '../src/utils/safe-navigation.ts';

const root = process.cwd();

test('feature diagnostics expose allow-listed metadata without private error content', () => {
  const error = new Error('planner note secret@example.test bearer-token-value');
  error.stack = 'private stack with planning content';
  const diagnostic = createRedactedDiagnostic('planner', error, () => new Date('2026-08-25T12:00:00.000Z'));
  assert.deepEqual(diagnostic, {
    event: 'feature_failure',
    area: 'planner',
    category: 'unexpected',
    occurredAt: '2026-08-25T12:00:00.000Z',
  });
  const encoded = JSON.stringify(diagnostic);
  assert.doesNotMatch(encoded, /secret|example|bearer|stack|planning content/i);
});

test('feature diagnostics classify recoverable boundaries without reading error messages', () => {
  const storage = new Error('private');
  storage.name = 'StorageError';
  const network = new Error('private');
  network.name = 'NetworkError';
  const interrupted = new Error('private');
  interrupted.name = 'AbortError';
  assert.equal(createRedactedDiagnostic('today', storage).category, 'storage');
  assert.equal(createRedactedDiagnostic('synchronization', network).category, 'network');
  assert.equal(createRedactedDiagnostic('planner', interrupted).category, 'interrupted');
});

test('development diagnostics expose only safe error classes and project frames', () => {
  const error = new RangeError('private task text secret@example.test');
  error.stack = 'RangeError: private task text\nsrc/features/today/services/today-planning.ts:24:9\nnode_modules/library.ts:2:1';
  assert.deepEqual(createDevelopmentDiagnostic(error), {
    errorClass: 'range',
    projectFrames: ['src/features/today/services/today-planning.ts:24:9'],
  });
  assert.equal(createRedactedDiagnostic('today', error).category, 'render');
  assert.doesNotMatch(JSON.stringify(createDevelopmentDiagnostic(error)), /private|example|task text/i);
});

test('a synchronized completion rebuilds Today without losing local metadata', () => {
  const completedAt = toInstant(new Date('2026-08-27T14:30:00.000Z'));
  const task: Task = {
    id: '123e4567-e89b-42d3-a456-426614174000',
    workspaceId: '123e4567-e89b-42d3-a456-426614174001',
    title: 'Synchronized task',
    notes: null,
    status: 'completed',
    priority: 'none',
    dueDate: null,
    scheduledTime: null,
    timeZone: toTimeZone('America/Asuncion'),
    completedAt,
    areaId: null,
    goalId: null,
    parentTaskId: null,
    createdAt: toInstant(new Date('2026-08-26T12:00:00.000Z')),
    updatedAt: completedAt,
    revision: 8,
    deletedAt: null,
  };
  const plan = buildTodayPlan(
    [task],
    [],
    [],
    toCalendarDate('2026-08-27'),
    toTimeZone('America/Asuncion'),
  );
  assert.equal(plan.completed[0], task);
  assert.equal(plan.completed[0].revision, 8);
  assert.equal(plan.completed[0].completedAt, completedAt);
});

test('foreground Today rebuild tolerates a malformed optional completion timestamp', () => {
  const task = {
    id: '123e4567-e89b-42d3-a456-426614174002',
    workspaceId: '123e4567-e89b-42d3-a456-426614174001',
    title: 'Queued completion',
    notes: null,
    status: 'completed',
    priority: 'none',
    dueDate: null,
    scheduledTime: null,
    timeZone: null,
    completedAt: '',
    areaId: null,
    goalId: null,
    parentTaskId: null,
    createdAt: '2026-08-27T12:00:00.000Z',
    updatedAt: 'malformed',
    revision: 4,
    deletedAt: null,
  } as unknown as Task;
  assert.doesNotThrow(() =>
    buildTodayPlan([task], [], [], toCalendarDate('2026-08-27'), toTimeZone('UTC')),
  );
});

test('authentication back navigation uses history or a deterministic replacement', () => {
  const calls: string[] = [];
  const withHistory = {
    canGoBack: () => true,
    back: () => calls.push('back'),
    replace: () => calls.push('replace'),
  } as BackNavigation;
  goBackOrReplace(withHistory, '/(auth)/welcome');
  assert.deepEqual(calls, ['back']);
  calls.length = 0;
  goBackOrReplace({ ...withHistory, canGoBack: () => false }, '/(auth)/welcome');
  assert.deepEqual(calls, ['replace']);
});

test('direct and deep-linked authentication screens define safe back destinations', async () => {
  const files = [
    'auth-welcome-screen.tsx',
    'check-email-screen.tsx',
    'create-account-screen.tsx',
    'forgot-password-screen.tsx',
    'recoverable-auth-error-screen.tsx',
    'recovery-callback-screen.tsx',
    'reset-password-screen.tsx',
    'sign-in-screen.tsx',
  ];
  for (const file of files) {
    const source = await readFile(`${root}/src/features/auth/screens/${file}`, 'utf8');
    assert.match(source, /backFallback=/, file);
  }
  const scaffold = await readFile(`${root}/src/features/auth/components/auth-scaffold.tsx`, 'utf8');
  assert.match(scaffold, /goBackOrReplace\(router, backFallback\)/);
  assert.match(scaffold, /MIN_TOUCH_TARGET/);
  assert.match(scaffold, /common\.goBack/);
});

test('notification runtime keeps Expo Go and web outside the native module boundary', () => {
  assert.equal(selectNotificationRuntime('android', 'storeClient'), 'expo_go');
  assert.equal(selectNotificationRuntime('ios', 'standalone'), 'native');
  assert.equal(selectNotificationRuntime('android', 'bare'), 'native');
  assert.equal(selectNotificationRuntime('web', 'standalone'), 'web');
});

test('project-owned code contains no remote push token calls or eager notification imports', async () => {
  const files = [
    ...(await ownedFiles(`${root}/app`)),
    ...(await ownedFiles(`${root}/src`)),
  ];
  const forbidden = [
    ['getExpo', 'PushTokenAsync'].join(''),
    ['getDevice', 'PushTokenAsync'].join(''),
  ];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const name of forbidden) assert.equal(source.includes(name), false, file);
  }
  for (const file of [
    `${root}/src/providers/reminder-provider.tsx`,
    `${root}/src/features/reminders/services/device-permissions.ts`,
    `${root}/src/features/reminders/services/notification-device.ts`,
  ]) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /import \* as Notifications from 'expo-notifications'/);
  }
  const boundary = await readFile(`${root}/src/features/reminders/services/notification-runtime.ts`, 'utf8');
  assert.match(boundary, /notificationModule \?\?= import\('expo-notifications'\)/);
  assert.match(boundary, /currentNotificationRuntime\(\) !== 'native'/);
});

test('automatic synchronization debounces queue changes', async () => {
  const reasons: string[] = [];
  const coordinator = new AutomaticSyncCoordinator({
    canRun: () => true,
    run: async (reason) => { reasons.push(reason); },
    debounceMs: 10,
  });
  coordinator.trigger('queue');
  coordinator.trigger('queue');
  coordinator.trigger('queue');
  await delay(35);
  coordinator.stop();
  assert.deepEqual(reasons, ['queue']);
});

test('automatic synchronization remains single-flight and coalesces edits during a run', async () => {
  let release: () => void = () => undefined;
  let count = 0;
  const firstRun = new Promise<void>((resolve) => { release = resolve; });
  const coordinator = new AutomaticSyncCoordinator({
    canRun: () => true,
    run: async () => {
      count += 1;
      if (count === 1) await firstRun;
    },
    debounceMs: 5,
  });
  coordinator.trigger('foreground');
  await delay(5);
  coordinator.trigger('queue');
  coordinator.trigger('queue');
  assert.equal(count, 1);
  release();
  await delay(25);
  coordinator.stop();
  assert.equal(count, 2);
});

test('automatic synchronization obeys offline, disabled, account, lifecycle, foreground, and reconnect guards', async () => {
  let enabled = false;
  let online = true;
  let active = true;
  let accountMatches = true;
  const reasons: string[] = [];
  const coordinator = new AutomaticSyncCoordinator({
    canRun: () => enabled && online && active && accountMatches,
    run: async (reason) => { reasons.push(reason); },
    debounceMs: 5,
  });
  coordinator.trigger('queue');
  enabled = true;
  online = false;
  coordinator.trigger('queue');
  online = true;
  coordinator.trigger('foreground');
  await delay(5);
  coordinator.trigger('reconnect');
  await delay(5);
  accountMatches = false;
  coordinator.trigger('queue');
  accountMatches = true;
  active = false;
  coordinator.trigger('queue');
  await delay(10);
  coordinator.stop();
  assert.deepEqual(reasons, ['foreground', 'reconnect']);
});

test('automatic retries honor queued backoff and exclude conflicts', () => {
  const now = new Date('2026-08-27T12:00:00.000Z').getTime();
  assert.equal(automaticRetryDelay([{
    state: 'failed',
    errorCode: 'offline',
    lastAttemptAt: '2026-08-27T12:00:00.000Z',
    nextAttemptAt: '2026-08-27T12:00:08.000Z',
  }], now), 8000);
  assert.equal(automaticRetryDelay([{
    state: 'failed',
    errorCode: 'conflict',
    lastAttemptAt: '2026-08-27T12:00:00.000Z',
    nextAttemptAt: null,
  }], now), null);
  assert.equal(automaticRetryDelay([{
    state: 'pending',
    errorCode: null,
    lastAttemptAt: null,
    nextAttemptAt: null,
  }], now), 1200);
  assert.equal(automaticRetryDelay([{
    state: 'failed',
    errorCode: 'offline',
    lastAttemptAt: null,
    nextAttemptAt: 'malformed',
  }], now), 1200);
});

test('synchronization status never reports up to date while local changes are pending', () => {
  assert.equal(syncStatusTranslationKey({ state: 'idle', pending: 1, busy: false, online: true }), 'sync.statePending');
  assert.equal(syncStatusTranslationKey({ state: 'idle', pending: 1, busy: false, online: false }), 'sync.statePendingOffline');
  assert.equal(syncStatusTranslationKey({ state: 'idle', pending: 0, busy: false, online: true }), 'sync.stateIdle');
  assert.equal(syncStatusTranslationKey({ state: 'conflict', pending: 1, busy: false, online: true }), 'sync.stateConflict');
  assert.equal(syncStatusTranslationKey({ state: 'account_mismatch', pending: 1, busy: false, online: true }), 'sync.stateAccountMismatch');
  assert.equal(syncStatusTranslationKey({ state: 'idle', pending: 1, busy: true, online: true }), 'sync.stateSyncing');
});

test('permission denial and blocked states remain distinct and recoverable', () => {
  assert.equal(normalizePermissionState({ granted: true, status: 'granted', canAskAgain: true }), 'allowed');
  assert.equal(normalizePermissionState({ granted: false, status: 'undetermined', canAskAgain: true }), 'undetermined');
  assert.equal(normalizePermissionState({ granted: false, status: 'denied', canAskAgain: true }), 'denied');
  assert.equal(normalizePermissionState({ granted: false, status: 'denied', canAskAgain: false }), 'blocked');
});

test('invalid notification destinations are rejected before navigation', () => {
  assert.equal(parseNotificationDestination({ planoraVersion: 1, entityType: 'task', entityId: 'not-an-id' }), null);
  assert.equal(parseNotificationDestination({ planoraVersion: 1, entityType: 'account', entityId: '123e4567-e89b-42d3-a456-426614174000' }), null);
  assert.deepEqual(parseNotificationDestination({ planoraVersion: 1, entityType: 'goal', entityId: '123e4567-e89b-42d3-a456-426614174000' }), {
    entityType: 'goal',
    entityId: '123e4567-e89b-42d3-a456-426614174000',
  });
});

test('recovery callbacks must match the callback scheme, host, and path', () => {
  const expected = 'planora://callback';
  assert.equal(parseRecoveryUrl('https://untrusted.example/callback?code=private', expected).kind, 'invalid');
  assert.equal(parseRecoveryUrl('planora://different?code=private', expected).kind, 'invalid');
  assert.deepEqual(parseRecoveryUrl('planora://callback?code=one&flow=recovery', expected), {
    kind: 'authorization_code',
    code: 'one',
    purpose: 'recovery',
  });
});

test('destructive confirmations stay action-specific', () => {
  assert.equal(confirmationMatches('CLEAR', 'clear_device'), true);
  assert.equal(confirmationMatches('DELETE CLOUD', 'delete_cloud'), true);
  assert.equal(confirmationMatches('DELETE ACCOUNT', 'delete_account'), true);
  assert.equal(confirmationMatches('DELETE', 'delete_account'), false);
  assert.equal(confirmationMatches('DELETE ACCOUNT', 'delete_cloud'), false);
});

test('portable exports detect session, account, and native identifier leakage', () => {
  const base: PlanningExport = {
    format: 'planora-planning-export',
    version: 1,
    exportedAt: '2026-08-25T12:00:00.000Z',
    records: [],
  };
  assert.equal(exportContainsDeviceIdentifiers(base), false);
  for (const key of ['accessToken', 'accountId', 'deviceCalendarId', 'eventId', 'notificationIdentifier', 'refreshToken', 'session']) {
    assert.equal(exportContainsDeviceIdentifiers({ ...base, records: [{ entityType: 'task', entityId: 'one', workspaceId: 'workspace', localRevision: 1, deleted: false, payload: { [key]: 'private' } }] }), true);
  }
});

test('release configuration preserves application identity and controlled distribution', async () => {
  const app = JSON.parse(await readFile(`${root}/app.json`, 'utf8'));
  const eas = JSON.parse(await readFile(`${root}/eas.json`, 'utf8'));
  assert.equal(app.expo.name, 'Planora');
  assert.equal(app.expo.slug, 'planora');
  assert.equal(app.expo.orientation, 'portrait');
  assert.equal(app.expo.android.package, 'com.nahomtaye.planora');
  assert.equal(app.expo.ios.bundleIdentifier, 'com.nahomtaye.planora');
  assert.equal(eas.build.development.distribution, 'internal');
  assert.equal(eas.build.preview.distribution, 'internal');
  assert.equal(eas.build.production.distribution, 'store');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal('submit' in eas, false);
  assert.doesNotMatch(JSON.stringify({ app, eas }), /projectId|appleId|ascAppId|serviceAccountKeyPath|googleServicesFile/i);
});

test('release artwork uses required dimensions and transparent notification pixels', async () => {
  assert.deepEqual(await pngMetadata(`${root}/assets/images/app-icon.png`), { width: 1024, height: 1024, colorType: 6 });
  assert.deepEqual(await pngMetadata(`${root}/assets/images/adaptive-icon.png`), { width: 1024, height: 1024, colorType: 6 });
  assert.deepEqual(await pngMetadata(`${root}/assets/images/splash-artwork.png`), { width: 1024, height: 1024, colorType: 2 });
  assert.deepEqual(await pngMetadata(`${root}/assets/images/notification-icon.png`), { width: 96, height: 96, colorType: 6 });
});

test('light and dark semantic text colors meet normal-text contrast', async () => {
  const themes = await readFile(`${root}/src/theme/themes.ts`, 'utf8');
  for (const value of ['#B83A45', '#F08A92', '#241216']) assert.match(themes, new RegExp(value));
  const pairs = [
    ['#25242B', '#F8F6F2'], ['#66636B', '#F8F6F2'], ['#5B57D9', '#F8F6F2'],
    ['#117D70', '#F8F6F2'], ['#9A6215', '#F8F6F2'], ['#B83A45', '#F8F6F2'],
    ['#F7F3EE', '#121116'], ['#B1ACB6', '#121116'], ['#9C99F5', '#121116'],
    ['#4FD0BC', '#121116'], ['#E4AE5E', '#121116'], ['#F08A92', '#121116'],
    ['#FFFFFF', '#5B57D9'], ['#FFFFFF', '#B83A45'], ['#241216', '#F08A92'],
  ];
  for (const [foreground, background] of pairs) assert.ok(contrastRatio(foreground, background) >= 4.5);
});

test('core controls expose touch, role, state, hint, validation, and dialog metadata', async () => {
  const button = await readFile(`${root}/src/components/ui/button.tsx`, 'utf8');
  const field = await readFile(`${root}/src/components/ui/form-field.tsx`, 'utf8');
  const screen = await readFile(`${root}/src/components/ui/screen.tsx`, 'utf8');
  const data = await readFile(`${root}/src/features/sync/screens/data-privacy-screen.tsx`, 'utf8');
  assert.match(button, /minHeight: MIN_TOUCH_TARGET/);
  assert.match(button, /accessibilityRole="button"/);
  assert.match(button, /accessibilityState=\{\{ busy: loading, disabled: isDisabled, selected \}\}/);
  assert.match(button, /accessibilityHint=\{accessibilityHint\}/);
  assert.match(field, /accessibilityLabel=\{label\}/);
  assert.match(field, /accessibilityLiveRegion="polite"/);
  assert.match(screen, /SafeAreaView/);
  assert.match(screen, /KeyboardAvoidingView/);
  assert.match(data, /accessibilityViewIsModal/);
  assert.match(data, /accessibilityRole="alert"/);
});

test('major route groups have non-destructive recovery boundaries', async () => {
  const boundary = await readFile(`${root}/src/features/recovery/components/feature-error-boundary.tsx`, 'utf8');
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /this\.setState\(\{ failed: false \}\)/);
  assert.match(boundary, /accessibilityRole="alert"/);
  assert.doesNotMatch(boundary, /resetDatabase|clearWorkspace|stack\}/);
  for (const group of ['account', 'auth', 'goals', 'insights', 'onboarding', 'planner', 'recovery', 'reminders', 'routines', 'sync', 'tabs', 'tasks']) {
    const layout = await readFile(`${root}/app/(${group})/_layout.tsx`, 'utf8');
    assert.match(layout, /FeatureErrorBoundary/);
  }
});

test('startup and confirmation animation honor reduced motion', async () => {
  const rootLayout = await readFile(`${root}/app/_layout.tsx`, 'utf8');
  const launch = await readFile(`${root}/src/components/brand/branded-launch-screen.tsx`, 'utf8');
  const data = await readFile(`${root}/src/features/sync/screens/data-privacy-screen.tsx`, 'utf8');
  assert.match(rootLayout, /duration: reducedMotion \? 0 : 300/);
  assert.match(rootLayout, /fade: !reducedMotion/);
  assert.match(launch, /animating=\{reducedMotion === false\}/);
  assert.match(data, /animationType=\{reducedMotion === false \? 'fade' : 'none'\}/);
});

test('account switching and conflicts remain scoped to the active account', async () => {
  const provider = await readFile(`${root}/src/providers/sync-provider.tsx`, 'utf8');
  const resolution = await readFile(`${root}/src/features/sync/services/conflict-resolution.ts`, 'utf8');
  assert.match(provider, /accountId, status: 'open'/);
  assert.match(provider, /activeAccount\.current === accountId/);
  assert.match(resolution, /conflict\.accountId !== accountId/);
  assert.match(resolution, /filter: \{ workspaceId, accountId, entityId \}/);
  assert.match(resolution, /limit: 100/);
});

test('failed remote deletion cannot advance local completion state', async () => {
  const source = await readFile(`${root}/src/features/sync/services/data-control.ts`, 'utf8');
  const remoteDelete = source.indexOf('await this.gateway.deleteCloudPlanning()');
  const disconnect = source.indexOf('await disconnectDeletedCloud');
  assert.ok(remoteDelete > 0);
  assert.ok(disconnect > remoteDelete);
  assert.match(source, /await this\.gateway\.deleteAccount\(\)/);
});

test('network loss, session expiry, and missing remote schema stay distinguishable', () => {
  assert.equal(mapRemoteError({ status: 0, message: 'failed to fetch' }).category, 'offline');
  assert.equal(mapRemoteError({ status: 401 }).category, 'session_expired');
  assert.equal(mapRemoteError({ code: '42P01' }).category, 'schema_missing');
  assert.equal(mapRemoteError({ code: 'PGRST202' }).category, 'schema_missing');
  assert.equal(mapRemoteError({ status: 500 }).category, 'remote');
});

test('interrupted native export removes its temporary file', async () => {
  const source = await readFile(`${root}/src/features/sync/services/planning-export.ts`, 'utf8');
  assert.match(source, /try \{/);
  assert.match(source, /finally \{/);
  assert.match(source, /if \(file\.exists\) file\.delete\(\)/);
});

test('all five catalogs include complete release strings and matching placeholders', () => {
  assert.deepEqual(validateTranslationCatalogs(), []);
});

test('released local and remote migrations retain canonical hashes', async () => {
  const expected = new Map([
    ['src/storage/database/migrations/001-foundation.ts', '50033bd92f6ddd3f9167ca37a247368e35eae68195b22401c5838051f3342199'],
    ['src/storage/database/migrations/002-planning.ts', 'bb5f34917d7abba0df64e28a691f39e92d8991d783f9e07f4dd29ac11d46d245'],
    ['src/storage/database/migrations/003-account-foundation.ts', '6f7b0f1fa6155095540833cb94d858c1ccfec9f9a3726f2be0dc688ce6771a1b'],
    ['src/storage/database/migrations/004-planner-localization.ts', 'c3095fc13118c2b42bb3218c8d9f88d856154a8505c158f517436d1bab0ff4f1'],
    ['src/storage/database/migrations/005-goals-milestones.ts', '631ab2d9055ad6c15fb84bb4d68e50d922f7804e674aa0e7e02655f61c3e2a2d'],
    ['src/storage/database/migrations/006-insights-reflections.ts', 'ad3a090b99ec88ed53dd6badbd80e111b615ed41e40e19fc842530ae81cac178'],
    ['src/storage/database/migrations/007-reminders-calendar.ts', '0986a64e97839d9b2c41c700c0973fa600fe88c922879864cf04f4837ba2fc91'],
    ['src/storage/database/migrations/008-resilient-sync.ts', '6f876c82b0681e3daeac280513de8a0e089040dc1e5b64f91983b2cbd96fc1d2'],
    ['supabase/migrations/202608040001_account_profiles.sql', 'af8e5cfb8b8d7515ad4ef8de21c323588a268a7c2880075976a71dd2cabc3dcc'],
    ['supabase/migrations/202608140001_resilient_sync.sql', '8f908e25d46b898b54a133f30b51d76cf58d58476b0af7929138fec9da30fb42'],
    ['supabase/migrations/202608270001_qualify_sync_rpc_columns.sql', 'fce0e4e83aa7ae75e7169a262dc3a04863e0d297b9b00768c07a8e4201ceaa26'],
  ]);
  for (const [path, hash] of expected) {
    assert.equal(createHash('sha256').update(await readFile(`${root}/${path}`)).digest('hex'), hash, path);
  }
});

test('environment and signing material stay protected by repository rules', async () => {
  const ignore = await readFile(`${root}/.gitignore`, 'utf8');
  const example = await readFile(`${root}/.env.example`, 'utf8');
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.env\.example$/m);
  assert.match(ignore, /^\*\.jks$/m);
  assert.match(ignore, /^\*\.mobileprovision$/m);
  assert.match(example, /your-project-ref\.supabase\.co/);
  assert.match(example, /your-publishable-key/);
  assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{20,}|service[_-]?role/i);
});

async function pngMetadata(path: string) {
  const value = await readFile(path);
  assert.equal(value.subarray(1, 4).toString('ascii'), 'PNG');
  return {
    width: value.readUInt32BE(16),
    height: value.readUInt32BE(20),
    colorType: value[25],
  };
}

async function ownedFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await ownedFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
