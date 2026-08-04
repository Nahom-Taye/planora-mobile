import assert from 'node:assert/strict';
import test from 'node:test';

import {
  toCalendarDate,
  toInstant,
  toLocalTime,
  toTimeZone,
  type Task,
} from '../src/domain/entities/index.ts';
import type {
  SqlConnection,
  SqlExecutor,
  SqlValue,
} from '../src/storage/database/connection.ts';
import { runMigrations } from '../src/storage/database/migration-runner.ts';
import type { Migration } from '../src/storage/database/migrations/types.ts';
import { taskMapper } from '../src/storage/mappers/entity-mappers.ts';
import type { DatabaseRow } from '../src/storage/mappers/types.ts';
import { SqliteEntityRepository } from '../src/storage/repositories/sqlite-entity-repository.ts';

type RunResult = { changes: number; lastInsertRowId: number };

class RecordingConnection implements SqlConnection {
  readonly statements: string[] = [];
  readonly applied = new Map<number, string>();

  async executeStatic(sql: string) {
    this.statements.push(sql);
  }

  async run(sql: string, parameters: SqlValue[] = []): Promise<RunResult> {
    this.statements.push(sql);

    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.applied.set(parameters[0] as number, parameters[1] as string);
    }

    return { changes: 1, lastInsertRowId: 0 };
  }

  async first<TRow>(): Promise<TRow | null> {
    return null;
  }

  async all<TRow>(sql: string): Promise<TRow[]> {
    if (sql.startsWith('SELECT version FROM schema_migrations')) {
      return [...this.applied.keys()].map((version) => ({ version }) as TRow);
    }

    return [];
  }

  async transaction<TResult>(
    operation: (executor: SqlExecutor) => Promise<TResult>,
  ): Promise<TResult> {
    const snapshot = new Map(this.applied);

    try {
      return await operation(this);
    } catch (error) {
      this.applied.clear();
      snapshot.forEach((name, version) => this.applied.set(version, name));
      throw error;
    }
  }

  async close() {}
}

class RepositoryExecutor implements SqlExecutor {
  firstRow: DatabaseRow | null = null;
  allRows: DatabaseRow[] = [];
  readonly calls: { sql: string; parameters: SqlValue[] }[] = [];

  async executeStatic() {}

  async run(sql: string, parameters: SqlValue[] = []): Promise<RunResult> {
    this.calls.push({ sql, parameters });
    return { changes: 1, lastInsertRowId: 0 };
  }

  async first<TRow>(sql: string, parameters: SqlValue[] = []) {
    this.calls.push({ sql, parameters });
    return this.firstRow as TRow | null;
  }

  async all<TRow>(sql: string, parameters: SqlValue[] = []) {
    this.calls.push({ sql, parameters });
    return this.allRows as TRow[];
  }
}

function sampleTask(): Task {
  return {
    id: 'task-1',
    workspaceId: 'workspace-1',
    title: 'Prepare the week',
    notes: null,
    status: 'pending',
    priority: 'high',
    dueDate: toCalendarDate('2026-08-05'),
    scheduledTime: toLocalTime('09:30'),
    timeZone: toTimeZone('America/Asuncion'),
    completedAt: null,
    areaId: null,
    goalId: null,
    parentTaskId: null,
    createdAt: toInstant('2026-08-04T12:00:00.000Z'),
    updatedAt: toInstant('2026-08-04T12:00:00.000Z'),
    revision: 1,
    deletedAt: null,
  };
}

test('domain date and time values are deterministic', () => {
  assert.equal(toCalendarDate('2024-02-29'), '2024-02-29');
  assert.equal(toLocalTime('23:59'), '23:59');
  assert.equal(toInstant('2026-08-04T08:30:00-04:00'), '2026-08-04T12:30:00.000Z');
  assert.throws(() => toCalendarDate('2025-02-29'));
  assert.throws(() => toLocalTime('24:00'));
});

test('task rows round trip without changing date semantics', () => {
  const task = sampleTask();
  const row = taskMapper.toRow(task);
  assert.deepEqual(taskMapper.fromRow(row), task);
});

test('migrations run in order and do not repeat', async () => {
  const connection = new RecordingConnection();
  const appliedOrder: number[] = [];
  const migrations: Migration[] = [1, 2].map((version) => ({
    version,
    name: `migration-${version}`,
    migrate: async () => {
      appliedOrder.push(version);
    },
  }));

  assert.equal(await runMigrations(connection, migrations), 2);
  assert.deepEqual(appliedOrder, [1, 2]);
  assert.equal(await runMigrations(connection, migrations), 2);
  assert.deepEqual(appliedOrder, [1, 2]);
});

test('an interrupted migration keeps only earlier committed versions', async () => {
  const connection = new RecordingConnection();
  const migrations: Migration[] = [
    { version: 1, name: 'first', migrate: async () => undefined },
    {
      version: 2,
      name: 'second',
      migrate: async () => {
        throw new Error('interrupted');
      },
    },
  ];

  await assert.rejects(() => runMigrations(connection, migrations));
  assert.deepEqual([...connection.applied.keys()], [1]);
});

test('repository writes are bound and revisions advance safely', async () => {
  const executor = new RepositoryExecutor();
  const repository = new SqliteEntityRepository(executor, taskMapper, {
    createId: () => 'task-new',
    now: () => new Date('2026-08-04T12:00:00.000Z'),
  });
  const task = sampleTask();
  const { id, createdAt, updatedAt, revision, deletedAt, ...createInput } = task;
  const created = await repository.create(createInput);

  assert.equal(created.id, 'task-new');
  assert.equal(created.revision, 1);
  assert.match(executor.calls[0].sql, /VALUES \(\?,/);
  assert.equal(executor.calls[0].sql.includes(task.title), false);

  executor.firstRow = taskMapper.toRow(task);
  const updated = await repository.update(task.id, {
    expectedRevision: 1,
    title: 'Prepare a calm week',
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.title, 'Prepare a calm week');

  const removed = await repository.softDelete(task.id, 1);
  assert.equal(removed.revision, 2);
  assert.equal(removed.deletedAt, '2026-08-04T12:00:00.000Z');
});

test('repository lists use deterministic ordering and bounded pagination', async () => {
  const executor = new RepositoryExecutor();
  const task = sampleTask();
  executor.allRows = [taskMapper.toRow(task)];
  const repository = new SqliteEntityRepository(executor, taskMapper, {
    createId: () => 'unused',
    now: () => new Date('2026-08-04T12:00:00.000Z'),
  });
  const page = await repository.list({
    filter: { workspaceId: 'workspace-1' },
    page: { limit: 20, offset: 0 },
  });
  const call = executor.calls.at(-1);

  assert.equal(page.items[0].id, task.id);
  assert.match(call?.sql ?? '', /ORDER BY updated_at DESC, id ASC/);
  assert.deepEqual(call?.parameters, ['workspace-1', 21, 0]);
});
