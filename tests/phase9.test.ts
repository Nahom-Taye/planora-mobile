import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateAuthConfiguration } from '../src/features/auth/services/auth-configuration.ts';
import { validateTranslationCatalogs } from '../src/features/localization/catalog-validation.ts';
import { canCombineConflict, combineConflictPayload } from '../src/features/sync/services/conflict-combination.ts';
import { confirmationMatches } from '../src/features/sync/services/data-control.ts';
import { exportContainsDeviceIdentifiers, type PlanningExport } from '../src/features/sync/services/export-format.ts';
import { PortableRecordService, retryDelayMs } from '../src/features/sync/services/portable-record-service.ts';
import { resilientSyncMigration } from '../src/storage/database/migrations/008-resilient-sync.ts';
import { migrations } from '../src/storage/database/migrations/index.ts';

const root = process.cwd();

class MemoryRepository {
  constructor(readonly rows: Record<string, unknown>[] = []) {}
  async getById(id: string, includeDeleted = false) {
    return this.rows.find((row) => row.id === id && (includeDeleted || row.deletedAt === null)) ?? null;
  }
  async list(options: { filter?: Record<string, unknown>; page?: { limit?: number; offset?: number }; includeDeleted?: boolean } = {}) {
    const values = this.rows.filter((row) => {
      if (!options.includeDeleted && row.deletedAt !== null) return false;
      return Object.entries(options.filter ?? {}).every(([key, value]) => value === undefined || row[key] === value);
    });
    const offset = options.page?.offset ?? 0;
    const limit = options.page?.limit ?? 50;
    return { items: values.slice(offset, offset + limit), nextOffset: offset + limit < values.length ? offset + limit : null };
  }
}

function metadata(id: string, revision = 1, deletedAt: string | null = null) {
  return { id, createdAt: '2026-08-14T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z', revision, deletedAt };
}

function storeForSnapshot() {
  const tasks = Array.from({ length: 125 }, (_, index) => ({
    ...metadata(`task-${String(index).padStart(3, '0')}`, index + 1, index === 124 ? '2026-08-14T01:00:00.000Z' : null),
    workspaceId: 'workspace-1', title: `Task ${index}`, notes: null, status: 'pending', priority: 'none', dueDate: null, scheduledTime: null, timeZone: null, completedAt: null, areaId: null, goalId: null, parentTaskId: null,
  }));
  tasks.push({ ...tasks[0], ...metadata('foreign-task'), workspaceId: 'workspace-2' });
  const empty = new MemoryRepository();
  return {
    workspaces: new MemoryRepository([{ ...metadata('workspace-1'), profileId: 'profile-1', name: 'Personal', kind: 'personal', status: 'active' }]),
    tasks: new MemoryRepository(tasks),
    planBlocks: empty,
    planBlockSeries: new MemoryRepository([{ ...metadata('series-1'), workspaceId: 'workspace-1', title: 'Week', notes: null, startDate: '2026-08-14', startTime: '09:00', endTime: '10:00', timeZone: 'UTC', frequency: 'weekly', interval: 1, weekdays: [5], count: 4, taskId: null, routineId: null, status: 'active' }]),
    routines: empty,
    routineCheckIns: empty,
    goals: empty,
    milestones: empty,
    goalRoutineLinks: new MemoryRepository([{ ...metadata('goal-routine-1'), workspaceId: 'workspace-1', goalId: 'goal-1', routineId: 'routine-1' }]),
    areas: empty,
    tags: empty,
    reflections: empty,
    reminderIntents: empty,
    appSettings: new MemoryRepository([{
      ...metadata('settings-1'), profileId: 'profile-1', themePreference: 'system', defaultTab: 'today', planningDayStartsAt: '06:00', languagePreference: 'system', dailyPlanningCapacityMinutes: 480, plannerView: 'day', insightsView: 'summary', insightsRange: '7d', notificationTitlesEnabled: false, quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00', deviceCalendarId: 'native-calendar', deviceCalendarName: 'Personal', onboardingVersion: 1, onboardingCompletedAt: '2026-08-14T00:00:00.000Z',
    }, {
      ...metadata('settings-2'), profileId: 'profile-2', themePreference: 'dark', defaultTab: 'goals', planningDayStartsAt: '08:00', languagePreference: 'fr', dailyPlanningCapacityMinutes: 300, plannerView: 'week', insightsView: 'trends', insightsRange: '4w', notificationTitlesEnabled: true, quietHoursEnabled: false, quietHoursStart: '23:00', quietHoursEnd: '06:00', deviceCalendarId: 'foreign-calendar', deviceCalendarName: 'Foreign', onboardingVersion: 1, onboardingCompletedAt: '2026-08-14T00:00:00.000Z',
    }]),
  } as unknown as ConstructorParameters<typeof PortableRecordService>[0];
}

async function migrationStatements() {
  const statements: string[] = [];
  await resilientSyncMigration.migrate({ executeStatic: async (statement: string) => { statements.push(statement); } } as never);
  return statements;
}

test('local migration 8 is the only appended migration and remains forward-only', async () => {
  assert.deepEqual(migrations.map((migration) => migration.version), [1, 2, 3, 4, 5, 6, 7, 8]);
  const sql = (await migrationStatements()).join('\n').toLowerCase();
  assert.equal(resilientSyncMigration.name, 'resilient_sync');
  assert.equal(/\bdrop\s+(table|column|index)\b/.test(sql), false);
  assert.equal(/insert into (tasks|goals|workspaces|reflections)/.test(sql), false);
});

test('migration 8 creates durable queue metadata, conflicts, diagnostics, and suppression', async () => {
  const sql = (await migrationStatements()).join('\n');
  for (const value of ['base_revision', 'account_id', 'next_attempt_at', 'sync_order', 'sync_bindings', 'sync_entity_states', 'sync_conflicts', 'sync_diagnostics', 'sync_suppression', 'plan_block_series', 'goal_routine_link']) assert.match(sql, new RegExp(value));
});

test('offline mutation triggers require an enabled binding and honor suppression', async () => {
  const sql = (await migrationStatements()).join('\n');
  assert.match(sql, /CREATE TRIGGER sync_queue_tasks_update/);
  assert.match(sql, /sync_bindings WHERE workspace_id = NEW\.workspace_id AND enabled = 1/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM sync_suppression/);
});

test('portable snapshots paginate without truncation and isolate the workspace', async () => {
  const records = await new PortableRecordService(storeForSnapshot()).snapshot('workspace-1');
  const tasks = records.filter((record) => record.entityType === 'task');
  assert.equal(tasks.length, 125);
  assert.equal(tasks.some((record) => record.entityId === 'foreign-task'), false);
  assert.equal(tasks.find((record) => record.entityId === 'task-124')?.deleted, true);
  assert.ok(records.some((record) => record.entityType === 'plan_block_series' && record.entityId === 'series-1'));
  assert.ok(records.some((record) => record.entityType === 'goal_routine_link' && record.entityId === 'goal-routine-1'));
});

test('portable preferences exclude device identifiers and temporary views', async () => {
  const records = await new PortableRecordService(storeForSnapshot()).snapshot('workspace-1');
  const settings = records.find((record) => record.entityType === 'app_settings');
  assert.ok(settings);
  assert.equal('deviceCalendarId' in settings.payload, false);
  assert.equal('plannerView' in settings.payload, false);
  assert.equal(settings.payload.dailyPlanningCapacityMinutes, 480);
  assert.equal(records.some((record) => record.entityId === 'settings-2'), false);
});

test('versioned exports reject native identifiers', () => {
  const safe: PlanningExport = { format: 'planora-planning-export', version: 1, exportedAt: '2026-08-14T00:00:00.000Z', records: [] };
  assert.equal(exportContainsDeviceIdentifiers(safe), false);
  assert.equal(exportContainsDeviceIdentifiers({ ...safe, records: [{ entityType: 'task', entityId: 'one', workspaceId: 'workspace-1', localRevision: 1, deleted: false, payload: { notificationIdentifier: 'native' } }] }), true);
});

test('retry delays use bounded exponential backoff with deterministic jitter', () => {
  assert.equal(retryDelayMs(1, 0), 1000);
  assert.equal(retryDelayMs(2, 1), 2500);
  assert.equal(retryDelayMs(50, 1), 320000);
});

test('destructive actions require exact action-specific phrases', () => {
  assert.equal(confirmationMatches(' clear ', 'clear_device'), true);
  assert.equal(confirmationMatches('DELETE CLOUD', 'delete_cloud'), true);
  assert.equal(confirmationMatches('DELETE ACCOUNT', 'delete_account'), true);
  assert.equal(confirmationMatches('DELETE', 'delete_account'), false);
});

test('conflict combination is limited to supported text and preserves both values', () => {
  assert.equal(canCombineConflict('reflection'), true);
  assert.equal(canCombineConflict('area'), false);
  assert.deepEqual(combineConflictPayload('task', JSON.stringify({ title: 'Local', notes: 'Local note' }), JSON.stringify({ title: 'Cloud', notes: 'Cloud note', priority: 'high' })), { title: 'Local', notes: 'Local note\n\nCloud note', priority: 'high' });
});

test('remote migration owns every planning row and enables forced row security', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  assert.match(sql, /owner_id uuid not null references auth\.users\(id\) on delete cascade/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /force row level security/);
  assert.match(sql, /auth\.uid\(\)/);
});

test('remote entity and operation identities are scoped by owner', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  assert.match(sql, /primary key \(id, owner_id\)/);
  assert.match(sql, /primary key \(operation_id, owner_id\)/);
  assert.match(sql, /on conflict \(id, owner_id\)/);
  assert.doesNotMatch(sql, /on conflict \(id\) do update/);
});

test('remote migration defines explicit ownership policies and least-privilege function grants', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  for (const action of ['select', 'insert', 'update', 'delete']) assert.match(sql, new RegExp(`for ${action} to authenticated`));
  assert.match(sql, /with check \(\(select auth\.uid\(\)\) is not null/);
  assert.match(sql, /revoke all on function public\.apply_planning_operation/);
});

test('remote mutation application is idempotent and revisions use server ordering', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  assert.match(sql, /planning_operations where operation_id = p_operation_id/);
  assert.match(sql, /nextval\('public\.planning_change_cursor_seq'\)/);
  assert.match(sql, /new\.revision := case when tg_op = 'INSERT' then 1 else old\.revision \+ 1 end/);
});

test('incremental pulls are cursor ordered and bounded to one hundred records', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  assert.match(sql, /p_batch_limit > 100/);
  assert.match(sql, /change_cursor > p_after_cursor order by change_cursor limit p_batch_limit/);
  assert.match(sql, /planning_changes \(change_cursor, owner_id, workspace_id, entity_type, entity_id, revision, deleted, payload\)/);
  assert.match(sql, /payload := change_row\.payload/);
});

test('forward RPC correction qualifies returned-column names without changing contracts', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608270001_qualify_sync_rpc_columns.sql`, 'utf8');
  assert.equal((sql.match(/create or replace function public\./g) ?? []).length, 3);
  for (const functionName of ['apply_planning_operation', 'pull_planning_changes', 'list_owned_planning_workspaces']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${functionName}\\(`));
  }
  assert.match(sql, /returns table\(status text, applied_revision integer, applied_cursor bigint, remote_payload jsonb, remote_deleted boolean\)/);
  assert.match(sql, /select po\.applied_revision, po\.change_cursor/);
  assert.match(sql, /from public\.planning_operations as po/);
  for (const column of ['applied_revision', 'change_cursor', 'operation_id', 'owner_id']) {
    assert.match(sql, new RegExp(`po\\.${column}`));
  }
  assert.doesNotMatch(sql, /select applied_revision, change_cursor/);
  assert.match(sql, /select pc\.entity_type, pc\.entity_id, pc\.workspace_id, pc\.revision, pc\.change_cursor, pc\.deleted, pc\.payload/);
  assert.match(sql, /where pc\.owner_id = caller and pc\.workspace_id = p_workspace_id and pc\.change_cursor > p_after_cursor/);
  assert.match(sql, /order by pc\.change_cursor/);
  assert.match(sql, /select pw\.id, pw\.revision, pw\.change_cursor, pw\.deleted_at is not null, pw\.payload/);
  assert.match(sql, /where pw\.owner_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /on conflict \(id, owner_id\) do update/);
  assert.equal((sql.match(/security definer/g) ?? []).length, 3);
  assert.equal((sql.match(/set search_path = ''/g) ?? []).length, 3);
  assert.doesNotMatch(sql, /drop function|delete_my_planning_data|grant execute|revoke all/);
});

test('remote schema carries tombstones without unsafe cleanup', async () => {
  const sql = await readFile(`${root}/supabase/migrations/202608140001_resilient_sync.sql`, 'utf8');
  assert.match(sql, /deleted_at timestamptz/);
  assert.match(sql, /tombstone_cursor_idx/);
  assert.doesNotMatch(sql, /delete from public\.planning_changes where created_at/);
});

test('account deletion function validates the bearer session before privileged deletion', async () => {
  const source = await readFile(`${root}/supabase/functions/delete-account/index.ts`, 'utf8');
  assert.match(source, /auth\.getUser\(token\)/);
  assert.match(source, /auth\.admin\.deleteUser\(data\.user\.id/);
  assert.doesNotMatch(source, /console\./);
});

test('provider isolates account state and cancels account-switched runs', async () => {
  const source = await readFile(`${root}/src/providers/sync-provider.tsx`, 'utf8');
  assert.match(source, /filter: \{ workspaceId: activeWorkspaceId, accountId, status: 'open' \}/);
  assert.match(source, /filter: \{ workspaceId: activeWorkspaceId, accountId \}/);
  assert.match(source, /activeAccount\.current === accountId/);
});

test('device clearing validates confirmation before device integration removal', async () => {
  const source = await readFile(`${root}/src/providers/sync-provider.tsx`, 'utf8');
  const validation = source.indexOf("confirmationMatches(confirmation, 'clear_device')");
  const removal = source.indexOf('reminders.clearDeviceIntegrations(removeCalendarEvents)');
  assert.ok(validation > 0);
  assert.ok(removal > validation);
});

test('missing account configuration remains a safe local-only state', () => {
  assert.deepEqual(validateAuthConfiguration({}), { status: 'unavailable', reason: 'missing' });
});

test('all five catalogs include complete Phase 9 strings and matching placeholders', () => {
  assert.deepEqual(validateTranslationCatalogs(), []);
});
