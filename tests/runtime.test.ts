import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import React from 'react';
import { BaseNavigationContainer, createNavigatorFactory, useNavigationBuilder } from '@react-navigation/core';
import { StackRouter } from '@react-navigation/routers';
import type { RepositoryStore } from '../src/domain/repositories/contracts.ts';
import { toCalendarDate, toInstant, toTimeZone, type Task } from '../src/domain/entities/index.ts';
import { openingRoute, resolveOpeningDestination, type AppEntryInput } from '../src/features/auth/services/app-entry.ts';
import { createMemoryStorage } from '../src/features/auth/services/session-storage-core.ts';
import { createTranslator, formatCalendarDateValue, formatDurationValue, formatInstantValue, formatLocalTimeValue, formatNumberValue, formatPercentageValue } from '../src/features/localization/localization.ts';
import { createDevelopmentDiagnostic, createRedactedDiagnostic, reportFeatureFailure } from '../src/features/recovery/services/redacted-diagnostics.ts';
import { buildTodayPlan } from '../src/features/today/services/today-planning.ts';
import { instantValue } from '../src/features/today/services/display-values.ts';
import { localCalendarDate } from '../src/features/today/services/local-date.ts';
import { taskMapper, routineMapper } from '../src/storage/mappers/entity-mappers.ts';
import type { SqlExecutor, SqlValue } from '../src/storage/database/connection.ts';
import { SqliteEntityRepository } from '../src/storage/repositories/sqlite-entity-repository.ts';
import { TaskService } from '../src/features/tasks/services/task-service.ts';
import { publishLocalDataChange } from '../src/storage/repositories/local-data-change-signal.ts';
import { aggregatePeriod } from '../src/features/insights/services/local-aggregation.ts';
import { calculateInsightsRange } from '../src/features/insights/services/range-calculations.ts';
import { calculateCapacity } from '../src/features/planner/services/capacity.ts';
import { RefreshGeneration } from '../src/features/today/services/refresh-generation.ts';
import { dependencyFunction, evaluateJsx, findJsx, generatedTree, host, native, renderer, requireModule, routeFiles, sourceModule, type Renderer, type RouteNode } from './runtime-harness.ts';

const day = toCalendarDate('2026-09-07');
const zone = toTimeZone('UTC');
const timestamp = toInstant('2026-09-07T12:00:00.000Z');
const pause = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const task = (changes: Partial<Task> = {}): Task => ({
  id: randomUUID(), workspaceId: 'workspace', title: 'Record', notes: null, status: 'pending', priority: 'none', dueDate: day, scheduledTime: null, timeZone: zone, completedAt: null, areaId: null, goalId: null, parentTaskId: null,
  createdAt: timestamp, updatedAt: timestamp, revision: 8, deletedAt: null, ...changes,
});

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE tasks (${taskMapper.columns.map((column) => `${column} ${column === 'revision' ? 'INTEGER' : 'TEXT'}`).join(', ')})`);
  const executor: SqlExecutor = {
    async executeStatic(sql) { db.exec(sql); },
    async run(sql, parameters: SqlValue[] = []) {
      const result = db.prepare(sql).run(...parameters);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async all<T>(sql: string, parameters: SqlValue[] = []) { return db.prepare(sql).all(...parameters) as T[]; },
    async first<T>(sql: string, parameters: SqlValue[] = []) { return (db.prepare(sql).get(...parameters) ?? null) as T | null; },
  };
  const tasks = new SqliteEntityRepository(executor, taskMapper, { createId: randomUUID, now: () => new Date(timestamp) });
  return { db, tasks, insert(value: Task) {
    const row = taskMapper.toRow(value);
    db.prepare(`INSERT INTO tasks VALUES (${taskMapper.columns.map(() => '?').join(', ')})`).run(...taskMapper.columns.map((column) => row[column]));
  } };
}

function routeLayouts(node: RouteNode): RouteNode[] {
  return [node, ...node.children.flatMap(routeLayouts)].filter((entry) => entry.type === 'layout');
}

test('Expo generates the same immediate route tree for Android, iOS, web and static rendering', () => {
  const simplify = (node: RouteNode): unknown => ({ route: node.route, initialRouteName: node.initialRouteName, children: node.children.map(simplify) });
  const expected = simplify(generatedTree('android'));
  for (const platform of ['ios', 'web', 'native']) assert.deepEqual(simplify(generatedTree(platform)), expected);
  for (const layout of routeLayouts(generatedTree('android'))) {
    const source = readFileSync('app/' + layout.contextKey.replace(/^\.\//, ''), 'utf8');
    const configured = [...source.matchAll(/initialRouteName\s*(?:=\s*["']|:\s*['"])([^'"}]+)/g)].map((match) => match[1]);
    if (layout.initialRouteName) configured.push(layout.initialRouteName);
    for (const name of configured) assert.ok(layout.children.some((child) => child.route === name), `${layout.contextKey}: ${name}`);
    for (const match of source.matchAll(/<(?:Stack|Tabs)\.Screen name="([^"]+)"/g)) assert.ok(layout.children.some((child) => child.route === match[1]), match[1]);
  }
  assert.equal(routeLayouts(generatedTree('web')).length, 13);
  assert.ok(!routeFiles().some((file) => file.includes('(public)')));
});

const protectedRuntime = sourceModule<{ Protected: React.ComponentType; isProtectedReactElement: (child: React.ReactElement) => boolean }>(requireModule.resolve('expo-router/build/views/Protected'), {
  '../primitives': { Group: createNavigatorFactory(Navigator)().Group },
});
const ScreenMarker = () => null;
const useFilter = dependencyFunction('expo-router/build/layouts/withLayoutContext', 'useFilterScreenChildren', {
  react_1: React, Protected_1: protectedRuntime,
  Screen_1: { isScreen: (child: React.ReactElement) => React.isValidElement(child) && child.type === ScreenMarker },
  NativeTabTrigger_1: { isNativeTabTrigger: () => false },
});
const sortChildren = dependencyFunction('expo-router/build/useScreens', 'getSortedChildren', {
  Route_1: { sortRoutesWithInitial: () => (a: RouteNode, b: RouteNode) => a.route.localeCompare(b.route) },
});
let activeScreens: string[] = [];
let initialScreen = '';
function Navigator(props: React.ComponentProps<typeof BaseNavigationContainer> & { initialRouteName?: string }) {
  const { state, NavigationContent } = useNavigationBuilder(StackRouter, props);
  activeScreens = state.routeNames;
  initialScreen = state.routes[state.index].name;
  return React.createElement(NavigationContent, null, React.createElement('navigation'));
}
const TestNavigator = createNavigatorFactory(Navigator)();
function EmptyScreen() { return null; }
const Stack = Object.assign((props: { children: React.ReactNode; initialRouteName?: string }) => {
  const { screens, protectedScreens } = useFilter(props.children);
  const sorted = sortChildren(generatedTree('android').children, screens) as { route: RouteNode; props: object }[];
  return React.createElement(TestNavigator.Navigator, { initialRouteName: props.initialRouteName }, sorted.filter(({ route }) => !protectedScreens.has(route.route)).map(({ route }) => React.createElement(TestNavigator.Screen, { key: route.route, name: route.route, component: EmptyScreen })));
}, { Screen: ScreenMarker, Protected: protectedRuntime.Protected });

async function renderRootStack(input: AppEntryInput, source = readFileSync('app/_layout.tsx', 'utf8')) {
  const element = evaluateJsx(findJsx(source, 'Stack'), {
    Stack, appEntry: { accessGranted: input.hasSession || input.continuedLocally },
    onboardingComplete: input.onboardingComplete, onboarding: { isReviewing: false },
    accountAvailable: input.accountStatus === 'signed_in' || input.accountStatus === 'recovering',
  });
  let mounted!: Renderer;
  await renderer.act(() => { mounted = renderer.create(React.createElement(BaseNavigationContainer, null, element)); });
  await renderer.act(() => mounted.unmount());
  return [...activeScreens];
}

test('the released root reproduces the exact navigation error and misleading Today diagnostic', async () => {
  const baseline = readFileSync('app/_layout.tsx', 'utf8').replace('initialRouteName="entry"', 'initialRouteName="(auth)"');
  await assert.rejects(renderRootStack({ accountStatus: 'signed_in', hasSession: true, continuedLocally: false, onboardingComplete: true }, baseline), (error: unknown) => {
    assert.equal((error as Error).message, "Couldn't find a screen named '(auth)' to use as 'initialRouteName'.");
    assert.equal(createRedactedDiagnostic('today', error).category, 'unexpected');
    assert.equal(createDevelopmentDiagnostic(error).errorClass, 'other');
    assert.match(readFileSync('app/_layout.tsx', 'utf8'), /FeatureErrorBoundary area="startup">\s*<RootNavigator/);
    return true;
  });
});

for (const accountStatus of ['signed_out', 'signed_in', 'local_only', 'recovering', 'error'] as const) {
  for (const onboardingComplete of [false, true]) {
    for (const continuedLocally of [false, true]) {
      test(`cold root ${accountStatus}, onboarding ${onboardingComplete}, local choice ${continuedLocally}`, async () => {
        const input = { accountStatus, onboardingComplete, continuedLocally, hasSession: accountStatus === 'signed_in' || accountStatus === 'recovering' };
        const screens = await renderRootStack(input);
        assert.equal(initialScreen, 'entry');
        const destination = resolveOpeningDestination(input);
        const href = openingRoute(destination, accountStatus)!;
        const group = href.split('/')[1];
        assert.ok(screens.includes(group), href);
        assert.notEqual(href, '/entry');
        assert.equal(openingRoute(resolveOpeningDestination(input), accountStatus), href);
        assert.ok(screens.includes('(recovery)'));
        if (!input.hasSession) assert.ok(screens.includes('(auth)'));
      });
    }
  }
}

test('restoration waits, onboarding review resolves once, and callback/authentication paths are generated', () => {
  assert.equal(openingRoute(resolveOpeningDestination({ accountStatus: 'restoring', hasSession: false, onboardingComplete: true, continuedLocally: false }), 'restoring'), null);
  assert.equal(openingRoute('tabs', 'signed_in', true), '/(onboarding)/onboarding');
  assert.equal(openingRoute('tabs', 'recovering', false, true), '/(tabs)');
  assert.equal(openingRoute('onboarding', 'recovering', false, true), '/(onboarding)/onboarding');
  const root = generatedTree('android');
  const auth = root.children.find((node) => node.route === '(auth)')!;
  for (const name of ['welcome', 'sign-in', 'create-account', 'check-email', 'forgot-password', 'error']) assert.ok(auth.children.some((node) => node.route === name));
  const recovery = root.children.find((node) => node.route === '(recovery)')!;
  for (const name of ['callback', 'reset-password']) assert.ok(recovery.children.some((node) => node.route === name));
});

test('legacy SQL timestamp failures are reproduced at their original mapper expression', () => {
  const releasedTimestampRead = (value: string) => toInstant(value);
  assert.throws(() => releasedTimestampRead('malformed'), { message: 'Invalid absolute timestamp.' });
  assert.throws(() => toInstant('malformed'), { message: 'Invalid absolute timestamp.' });
  assert.throws(() => new Intl.DateTimeFormat('en').format(new Date('malformed')), RangeError);
});

test('Today reads an empty SQLite database without writing or seeding', async () => {
  const store = database();
  try {
    assert.deepEqual(buildTodayPlan((await store.tasks.list()).items, [], [], day, zone), { overdue: [], today: [], unscheduled: [], completed: [], routines: [], checkIns: [], completedCount: 0, totalCount: 0 });
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM tasks').get()!.count, 0);
  } finally { store.db.close(); }
});

for (const value of [null, '', ' ', 'malformed', '2026-02-30T12:00:00Z', '2026-09-07T25:00:00Z', '2026-09-07T12:00:70Z']) {
  test(`Today preserves malformed timestamp text and revision: ${JSON.stringify(value)}`, async () => {
    const store = database();
    const malformed = task({ completedAt: value as Task['completedAt'], updatedAt: (value ?? '') as Task['updatedAt'], status: 'completed' });
    const normal = task();
    store.insert(malformed);
    store.insert(normal);
    const before = store.db.prepare('SELECT * FROM tasks ORDER BY id').all();
    try {
      const tasks = (await store.tasks.list()).items;
      const plan = buildTodayPlan(tasks, [], [], day, zone);
      assert.equal(plan.today.length, 1);
      assert.equal(plan.completed.length, 1);
      assert.equal(plan.completed[0].revision, 8);
      assert.equal(plan.completed[0].completedAt, value);
      assert.equal(instantValue(value), null);
      const insights = aggregatePeriod({ tasks, routines: [], checkIns: [], blocks: [], goals: [], milestones: [], reflections: [] }, calculateInsightsRange(day, '7d', 1).current, day, zone, 1, 480);
      assert.ok(Number.isFinite(insights.tasks.completed));
      assert.deepEqual(store.db.prepare('SELECT * FROM tasks ORDER BY id').all(), before);
    } finally { store.db.close(); }
  });
}

test('legacy missing optional fields, unknown statuses and deleted rows remain isolated', () => {
  const row = taskMapper.toRow(task());
  for (const key of ['completed_at', 'scheduled_time', 'due_date', 'area_id', 'goal_id', 'parent_task_id']) delete row[key];
  row.status = 'legacy';
  const legacy = taskMapper.fromRow(row);
  const plan = buildTodayPlan([legacy, task({ deletedAt: timestamp }), task({ status: 'completed', dueDate: null, completedAt: timestamp })], [], [], day, zone);
  assert.equal(plan.unscheduled[0], legacy);
  assert.equal(plan.completedCount, 1);
  assert.equal(plan.totalCount, 2);
  assert.equal(legacy.status, 'legacy');
});

test('completion, editing, conflict, deletion, restoration and reopening preserve synchronized revisions', async () => {
  const store = database();
  const value = task({ dueDate: null });
  store.insert(value);
  const service = new TaskService({ tasks: store.tasks } as unknown as RepositoryStore, () => new Date(timestamp));
  try {
    const completed = await service.complete(value);
    assert.equal(completed.revision, 9);
    assert.equal(buildTodayPlan([completed], [], [], day, zone).completed[0].completedAt, timestamp);
    await assert.rejects(service.complete(value), (error: unknown) => (error as { code: string }).code === 'REVISION_CONFLICT');
    const edited = await store.tasks.update(completed.id, { expectedRevision: 9, title: 'Edited' });
    assert.equal(edited.completedAt, timestamp);
    const deleted = await store.tasks.softDelete(edited.id, edited.revision);
    assert.equal((await store.tasks.list()).items.length, 0);
    store.db.prepare('UPDATE tasks SET deleted_at = NULL, revision = revision + 1 WHERE id = ? AND revision = ?').run(deleted.id, deleted.revision);
    const restored = (await store.tasks.getById(deleted.id))!;
    assert.equal(restored.completedAt, timestamp);
    const reopened = await service.reopen(restored);
    assert.equal(reopened.completedAt, null);
    assert.equal(buildTodayPlan([reopened], [], [], day, zone).unscheduled.length, 1);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM tasks').get()!.count, 1);
  } finally { store.db.close(); }
});

test('all five catalogs format malformed optional values safely and retain valid local dates', () => {
  for (const locale of ['en', 'am', 'es', 'fr', 'ar'] as const) {
    assert.equal(formatCalendarDateValue('2026-02-30', locale, {}), '—');
    assert.equal(formatLocalTimeValue('25:90', locale), '—');
    assert.equal(formatInstantValue('invalid', locale), '—');
    assert.equal(formatNumberValue(NaN, locale), '—');
    assert.equal(formatPercentageValue(Infinity, locale), '—');
    assert.equal(formatDurationValue(undefined as unknown as number, locale, createTranslator(locale)), '—');
    assert.notEqual(formatCalendarDateValue(day, locale, {}), '—');
    assert.notEqual(formatLocalTimeValue('09:30', locale), '—');
    assert.notEqual(formatInstantValue(timestamp, locale), '—');
  }
});

test('routine optional time and task completion fallback never rewrite original data', () => {
  const routine = routineMapper.fromRow({ id: 'routine', workspace_id: 'workspace', title: 'Routine', notes: null, status: 'active', time_zone: 'UTC', schedule_json: JSON.stringify({ kind: 'daily', time: 'invalid' }), created_at: timestamp, updated_at: 'invalid', revision: 7, deleted_at: null });
  const completed = task({ status: 'completed', dueDate: null, completedAt: ' ' as Task['completedAt'] });
  const plan = buildTodayPlan([completed], [routine], [], day, zone);
  assert.equal(plan.routines[0], routine);
  assert.equal(plan.completed[0], completed);
  assert.equal(plan.completed[0].completedAt, ' ');
  assert.equal(formatLocalTimeValue(routine.schedule.time!, 'en'), '—');
});

test('stale refresh results and failures cannot commit after newer data, background or disposal', async () => {
  const generation = new RefreshGeneration();
  let state = 'initial';
  let finish!: () => void;
  const current = generation.begin();
  const pending = new Promise<void>((resolve) => { finish = resolve; }).then(() => { if (current()) state = 'stale'; });
  generation.invalidate();
  const latest = generation.begin();
  if (latest()) state = 'newer';
  finish();
  await pending;
  assert.equal(state, 'newer');
  generation.invalidate();
  assert.equal(latest(), false);
});

test('handled diagnostics use warnings with redaction and never call console.error', (context) => {
  Object.assign(globalThis, { __DEV__: true });
  const warnings = context.mock.method(console, 'warn', () => undefined);
  const errors = context.mock.method(console, 'error', () => undefined);
  reportFeatureFailure('today', new Error('private content'));
  assert.equal(errors.mock.calls.length, 0);
  assert.equal(warnings.mock.calls.length, 1);
  assert.doesNotMatch(JSON.stringify(warnings.mock.calls[0].arguments), /private content|credentials|token/);
});

const theme = { colors: {}, shadows: { subtle: {}, floating: {} }, spacing: { sm: 8, md: 12, lg: 16, xl: 24 }, radii: { lg: 16 }, typography: { body: {} } };
const translate = createTranslator('en');
const localization = { t: translate, message: (value: string) => value, formatDate: (value: string, options = {}) => formatCalendarDateValue(value, 'en', options), formatTime: (value: string) => formatLocalTimeValue(value, 'en'), formatNumber: (value: number) => formatNumberValue(value, 'en'), formatDuration: (value: number) => formatDurationValue(value, 'en', translate), isRTL: false, direction: 'ltr' };
const ui = Object.fromEntries(['Button', 'Card', 'Screen', 'Text'].map((name) => [name, host(name)]));
const routeActions: string[] = [];
const basicMocks = { 'react-native': native, '@expo/vector-icons/Ionicons': host('Icon'), '@/components/ui': ui, '@/components/brand': { BrandWordmark: host('Brand') }, '@/hooks/use-app-theme': { useAppTheme: () => theme }, '@/providers/localization-provider': { useLocalization: () => localization }, 'expo-router': { useRouter: () => ({ replace: (href: string) => routeActions.push(href), push: (href: string) => routeActions.push(href) }) } };

test('mounted Today remains usable through startup, restoration, foreground and automatic synchronization', async () => {
  const appEvents = new Set<(state: string) => void>();
  const store = database();
  const today = localCalendarDate(new Date(), zone);
  const currentTask = task({ dueDate: today });
  store.insert(currentTask);
  const emptyRepository = { list: async () => ({ items: [], nextOffset: null }) };
  let workspace = { status: 'idle', workspace: null as { id: string } | null, profile: null as { timeZone: typeof zone } | null };
  type Planning = { plan: ReturnType<typeof buildTodayPlan> | null; tasks: Task[]; status: string; refresh(): Promise<void>; completeTask(value: Task): Promise<unknown> };
  let planning!: Planning;
  const provider = sourceModule<{ PlanningProvider: React.ComponentType<React.PropsWithChildren<{ repositories: RepositoryStore | null }>>; usePlanning(): Planning }>('src/providers/planning-provider.tsx', {
    'react-native': { ...native, AppState: { addEventListener: (_event: string, callback: (state: string) => void) => { appEvents.add(callback); return { remove: () => appEvents.delete(callback) }; } } },
    './workspace-provider': { useWorkspace: () => workspace },
    '@/storage/repositories/local-data-change-signal': { subscribeLocalDataChanges: requireModule('../src/storage/repositories/local-data-change-signal.ts').subscribeLocalDataChanges },
  });
  const { TodayScreen } = sourceModule<{ TodayScreen: React.ComponentType }>('src/features/today/screens/today-screen.tsx', {
    ...basicMocks,
    '@/providers/planning-provider': { usePlanning: () => planning },
    '@/providers/workspace-provider': { useWorkspace: () => workspace },
    '@/providers/planner-provider': { usePlanner: () => ({ blocks: [], capacityMinutes: 480, status: 'ready', refresh: async () => undefined }) },
    '@/providers/goal-provider': { useGoals: () => ({ goals: [] }) },
  });
  const Probe = () => { planning = provider.usePlanning(); return React.createElement(TodayScreen); };
  const repositories = { tasks: store.tasks, routines: emptyRepository, routineCheckIns: emptyRepository } as unknown as RepositoryStore;
  const tree = (ready: boolean) => React.createElement(provider.PlanningProvider, { repositories: ready ? repositories : null }, React.createElement(Probe));
  let mounted!: Renderer;
  try {
    await renderer.act(() => { mounted = renderer.create(tree(false)); });
    assert.ok(mounted.root.findByProps({ testID: 'today-loading' }));
    workspace = { status: 'loading', workspace: null, profile: null };
    await renderer.act(() => mounted.update(tree(true)));
    assert.equal(planning.plan, null);
    workspace = { status: 'ready', workspace: { id: 'workspace' }, profile: { timeZone: zone } };
    await renderer.act(async () => { mounted.update(tree(true)); await pause(); });
    assert.ok(mounted.root.findByProps({ testID: 'today-screen' }));
    assert.equal(planning.plan!.today.length, 1);
    await renderer.act(async () => { await planning.completeTask(planning.tasks[0]); });
    assert.equal(planning.tasks[0].revision, 9);
    assert.ok(instantValue(planning.tasks[0].completedAt));
    store.db.prepare('UPDATE tasks SET completed_at = ?, updated_at = ?, revision = revision + 1 WHERE id = ?').run('malformed', '', currentTask.id);
    await renderer.act(async () => { publishLocalDataChange('tasks'); await pause(100); });
    assert.equal(planning.tasks[0].revision, 10);
    assert.ok(mounted.root.findByProps({ testID: 'today-screen' }));
    const originalList = store.tasks.list.bind(store.tasks);
    const stalePage = await originalList();
    let release!: (value: typeof stalePage) => void;
    store.tasks.list = () => new Promise((resolve) => { release = resolve; });
    let pending!: Promise<void>;
    await renderer.act(() => { pending = planning.refresh(); });
    store.tasks.list = originalList;
    store.db.prepare('UPDATE tasks SET revision = 11 WHERE id = ?').run(currentTask.id);
    await renderer.act(async () => { publishLocalDataChange('tasks'); release(stalePage); await pending; });
    assert.equal(planning.tasks[0].revision, 10);
    await renderer.act(() => pause(100));
    assert.equal(planning.tasks[0].revision, 11);
    await renderer.act(async () => { appEvents.forEach((listener) => listener('background')); appEvents.forEach((listener) => listener('active')); await pause(); });
    assert.equal(planning.status, 'ready');
    assert.ok(mounted.root.findByProps({ testID: 'today-screen' }));
    const obsoleteRefresh = planning.refresh;
    workspace = { status: 'idle', workspace: null, profile: null };
    await renderer.act(() => mounted.update(tree(true)));
    await renderer.act(() => obsoleteRefresh());
    assert.equal(planning.plan, null);
    assert.equal(planning.tasks.length, 0);
  } finally {
    if (mounted) await renderer.act(() => mounted.unmount());
    store.db.close();
  }
});

test('recovery boundary retries its child and navigates safely away from Today', async (context) => {
  const errors = context.mock.method(console, 'error', () => undefined);
  context.mock.method(console, 'warn', () => undefined);
  const { FeatureErrorBoundary } = sourceModule<{ FeatureErrorBoundary: React.ComponentType<React.PropsWithChildren<{ area: string }>> }>('src/features/recovery/components/feature-error-boundary.tsx', basicMocks);
  let fail = true;
  const Child = () => { if (fail) throw new Error('Render unavailable'); return React.createElement('recovered'); };
  let mounted!: Renderer;
  await renderer.act(() => { mounted = renderer.create(React.createElement(FeatureErrorBoundary, { area: 'today' }, React.createElement(Child))); });
  assert.ok(mounted.root.findByProps({ testID: 'today-recovery-screen' }));
  fail = false;
  await renderer.act(() => (mounted.root.findByProps({ label: translate('recoveryBoundary.retry') }).props.onPress as () => void)());
  assert.equal(mounted.root.findAllByType('recovered').length, 1);
  fail = true;
  await renderer.act(() => mounted.update(React.createElement(FeatureErrorBoundary, { area: 'today' }, React.createElement(Child))));
  fail = false;
  await renderer.act(() => (mounted.root.findByProps({ label: translate('tabs.settings') }).props.onPress as () => void)());
  assert.equal(routeActions.at(-1), '/(tabs)/settings');
  assert.equal(mounted.root.findAllByType('recovered').length, 1);
  assert.ok(errors.mock.calls.every((call) => call.arguments[0] !== 'feature_failure'));
  await renderer.act(() => mounted.unmount());
});

test('capacity handles an impossible local time without failing the entire agenda', () => {
  const block = { ...task(), date: toCalendarDate('2026-03-08'), startTime: '02:30', endTime: '03:30', status: 'planned' } as unknown as Parameters<typeof calculateCapacity>[0][number];
  const result = calculateCapacity([block], [], 480, toTimeZone('America/New_York'));
  assert.equal(result.plannedMinutes, 0);
  assert.ok(Number.isFinite(result.remainingMinutes));
});

test('local access restores across cold starts, while signing out returns to account entry', async () => {
  const storage = createMemoryStorage();
  let account = { status: 'signed_out', session: null as object | null };
  type Entry = { destination: ReturnType<typeof resolveOpeningDestination>; continueLocally(): void };
  let entry!: Entry;
  const { AppEntryProvider, useAppEntry } = sourceModule<{ AppEntryProvider: React.ComponentType<React.PropsWithChildren>; useAppEntry(): Entry }>('src/providers/app-entry-provider.tsx', {
    './account-provider': { useAccount: () => account },
    './onboarding-provider': { useOnboarding: () => ({ status: 'complete' }) },
    '@/features/auth/services/session-storage': { authSessionStorage: storage },
  });
  const Probe = () => { entry = useAppEntry(); return null; };
  const tree = () => React.createElement(AppEntryProvider, null, React.createElement(Probe));
  let mounted!: Renderer;
  await renderer.act(() => { mounted = renderer.create(tree()); });
  assert.equal(entry.destination, 'account_entry');
  await renderer.act(() => entry.continueLocally());
  assert.equal(entry.destination, 'tabs');
  await renderer.act(() => mounted.unmount());
  await renderer.act(() => { mounted = renderer.create(tree()); });
  assert.equal(entry.destination, 'tabs');
  account = { status: 'signed_in', session: {} };
  await renderer.act(() => mounted.update(tree()));
  assert.equal(entry.destination, 'tabs');
  account = { status: 'signed_out', session: null };
  await renderer.act(() => mounted.update(tree()));
  assert.equal(entry.destination, 'account_entry');
  await renderer.act(() => mounted.unmount());
  await renderer.act(() => { mounted = renderer.create(tree()); });
  assert.equal(entry.destination, 'account_entry');
  await renderer.act(() => mounted.unmount());
});

test('account entry and service-error screens offer working local access through an available route', async () => {
  for (const [file, exported] of [['auth-welcome-screen', 'AuthWelcomeScreen'], ['recoverable-auth-error-screen', 'RecoverableAuthErrorScreen']]) {
    let continued = false;
    const module = sourceModule<Record<string, React.ComponentType>>(`src/features/auth/screens/${file}.tsx`, {
      ...basicMocks,
      '../components/auth-scaffold': { AuthScaffold: host('Scaffold') },
      '../components/auth-error-summary': { AuthErrorSummary: host('ErrorSummary') },
      '@/providers/account-provider': { useAccount: () => ({ configured: true, errorMessage: 'Account services are temporarily unavailable. Your local data is unaffected.' }) },
      '@/providers/app-entry-provider': { useAppEntry: () => ({ continueLocally: () => { continued = true; } }) },
    });
    let mounted!: Renderer;
    await renderer.act(() => { mounted = renderer.create(React.createElement(module[exported])); });
    if (file === 'auth-welcome-screen') {
      assert.ok(mounted.root.findByProps({ label: translate('auth.signIn') }));
      assert.ok(mounted.root.findByProps({ label: translate('auth.createAccount') }));
    }
    await renderer.act(() => (mounted.root.findByProps({ label: translate('auth.localTitle') }).props.onPress as () => void)());
    assert.equal(continued, true);
    assert.equal(routeActions.at(-1), '/entry');
    await renderer.act(() => mounted.unmount());
  }
});

for (const purpose of ['verification', 'recovery']) {
  test(`direct ${purpose} callback is consumed once and resolves to an available route`, async () => {
    let requests = 0;
    const account = { isBusy: false, errorMessage: null, consumeCallback: async () => { requests++; return { ok: true, purpose }; } };
    const { RecoveryCallbackScreen } = sourceModule<{ RecoveryCallbackScreen: React.ComponentType }>('src/features/auth/screens/recovery-callback-screen.tsx', {
      ...basicMocks,
      '../components/auth-scaffold': { AuthScaffold: host('Scaffold') },
      '../components/auth-error-summary': { AuthErrorSummary: host('ErrorSummary') },
      'expo-linking': { useURL: () => `planora://callback?flow=${purpose}`, createURL: () => 'planora://callback' },
      '@/providers/account-provider': { useAccount: () => account },
      '@/providers/app-entry-provider': { useAppEntry: () => ({ continueLocally: () => undefined }) },
    });
    let mounted!: Renderer;
    await renderer.act(() => { mounted = renderer.create(React.createElement(RecoveryCallbackScreen)); });
    await renderer.act(() => mounted.update(React.createElement(RecoveryCallbackScreen)));
    assert.equal(requests, 1);
    assert.equal(routeActions.at(-1), purpose === 'recovery' ? '/(recovery)/reset-password' : '/entry');
    await renderer.act(() => mounted.unmount());
  });
}

test('planner refresh ignores superseded reads and remains idle after a settled refresh', async () => {
  let currentBlocks: unknown[] = [];
  let reads = 0;
  let release: (() => void) | null = null;
  let delayed = false;
  const workspace = { status: 'ready', workspace: { id: 'workspace' }, profile: { timeZone: zone, weekStartsOn: 1 } };
  type Planner = { status: string; blocks: { id: string }[]; refresh(): Promise<void> };
  let planner!: Planner;
  const { PlannerProvider, usePlanner } = sourceModule<{ PlannerProvider: React.ComponentType<React.PropsWithChildren<{ repositories: RepositoryStore }>>; usePlanner(): Planner }>('src/providers/planner-provider.tsx', {
    'react-native': { ...native, AppState: { addEventListener: () => ({ remove: () => undefined }) } },
    './workspace-provider': { useWorkspace: () => workspace },
    './planning-provider': { usePlanning: () => ({ today: day, tasks: [] }) },
    './localization-provider': { useLocalization: () => ({ settings: null }) },
    '@/features/planner/services/recurrence': { RecurrenceService: class { async materializeWindow() {} } },
    '@/features/planner/services/plan-block-service': { PlanBlockService: class { async list() {
      reads++;
      const snapshot = currentBlocks;
      if (delayed) await new Promise<void>((resolve) => { release = resolve; });
      return snapshot;
    } } },
  });
  const Probe = () => { planner = usePlanner(); return null; };
  const repositories = { planBlockSeries: { list: async () => ({ items: [], nextOffset: null }) } } as unknown as RepositoryStore;
  let mounted!: Renderer;
  await renderer.act(() => { mounted = renderer.create(React.createElement(PlannerProvider, { repositories }, React.createElement(Probe))); });
  assert.equal(planner.status, 'ready');
  delayed = true;
  let pending!: Promise<void>;
  await renderer.act(() => { pending = planner.refresh(); });
  delayed = false;
  currentBlocks = [{ ...task(), id: 'newer-block', date: day, startTime: '09:00', endTime: '10:00', status: 'planned' }];
  await renderer.act(() => planner.refresh());
  await renderer.act(async () => { (release as unknown as () => void)(); await pending; });
  assert.equal(planner.blocks[0].id, 'newer-block');
  const settledReads = reads;
  await renderer.act(() => pause(200));
  assert.equal(reads, settledReads);
  await renderer.act(() => mounted.unmount());
});

test('the actual root waits for storage, fonts, local preference and session restoration before mounting navigation', async () => {
  const state = { storage: 'loading', onboarding: 'loading', account: 'restoring', destination: 'loading', fontsReady: false };
  const wrapper = host('Provider');
  const providerMocks = Object.fromEntries(['account', 'app-entry', 'localization', 'goal', 'insights', 'onboarding', 'planning', 'planner', 'reminder', 'storage', 'sync', 'workspace'].map((name) => [`@/providers/${name}-provider`, {}]));
  const hooks = {
    '@/providers/account-provider': { useAccount: () => ({ status: state.account }) },
    '@/providers/app-entry-provider': { useAppEntry: () => ({ destination: state.destination, accessGranted: false }) },
    '@/providers/localization-provider': { useLocalization: () => ({ ...localization, fontsReady: state.fontsReady, refresh: async () => undefined }) },
    '@/providers/onboarding-provider': { useOnboarding: () => ({ status: state.onboarding, isReviewing: false }) },
    '@/providers/storage-provider': { useStorage: () => ({ status: state.storage }) },
    '@/providers/workspace-provider': { useWorkspace: () => ({ status: 'idle' }) },
  };
  const { RootNavigator } = sourceModule<{ RootNavigator: React.ComponentType }>('app/_layout.tsx', {
    ...basicMocks, ...providerMocks, ...hooks,
    'expo-router': { Stack },
    '@react-navigation/native': { DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, ThemeProvider: wrapper },
    'expo-constants': { executionEnvironment: 'storeClient', ExecutionEnvironment: { StoreClient: 'storeClient' } },
    'expo-splash-screen': { preventAutoHideAsync: async () => undefined, hideAsync: async () => undefined, setOptions: () => undefined },
    'expo-status-bar': { StatusBar: host('StatusBar') },
    'react-native-safe-area-context': { SafeAreaProvider: wrapper },
    '@/components/brand': { BrandedLaunchScreen: host('Launch') },
    '@/features/storage/components/storage-initialization-error': { StorageInitializationError: host('StorageError') },
    '@/features/recovery': { FeatureErrorBoundary: wrapper },
    '@/hooks/use-reduced-motion': { useReducedMotion: () => true },
    '@/theme': { AppThemeProvider: wrapper },
  }, '\nexport { RootNavigator };');
  const tree = () => React.createElement(BaseNavigationContainer, null, React.createElement(RootNavigator));
  let mounted!: Renderer;
  await renderer.act(async () => { mounted = renderer.create(tree()); await pause(10); });
  for (const update of [{ storage: 'ready' }, { onboarding: 'complete' }, { fontsReady: true }, { account: 'signed_out' }]) {
    Object.assign(state, update);
    await renderer.act(() => mounted.update(tree()));
    assert.equal(mounted.root.findAllByType('navigation').length, 0);
  }
  state.destination = 'account_entry';
  await renderer.act(async () => { mounted.update(tree()); await pause(10); });
  assert.equal(mounted.root.findAllByType('navigation').length, 1);
  assert.equal(initialScreen, 'entry');
  assert.ok(activeScreens.includes('(auth)'));
  await renderer.act(() => mounted.unmount());
});
