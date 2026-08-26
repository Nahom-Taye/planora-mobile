import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseRecoveryUrl } from '../src/features/auth/services/recovery-link.ts';
import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';
import { normalizePermissionState } from '../src/features/reminders/services/permission-state.ts';
import { parseNotificationDestination } from '../src/features/reminders/services/notification-navigation.ts';
import { createRedactedDiagnostic } from '../src/features/recovery/services/redacted-diagnostics.ts';
import { confirmationMatches } from '../src/features/sync/services/data-control.ts';
import { exportContainsDeviceIdentifiers, type PlanningExport } from '../src/features/sync/services/export-format.ts';
import { mapRemoteError } from '../src/features/sync/services/supabase-sync-gateway.ts';
import { contrastRatio } from '../src/theme/contrast.ts';

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
