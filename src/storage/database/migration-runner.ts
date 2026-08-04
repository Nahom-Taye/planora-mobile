import type { SqlConnection } from './connection.ts';
import { StorageError, toStorageError } from './errors.ts';
import type { Migration } from './migrations/index.ts';

type MigrationRow = { version: number };

export async function runMigrations(
  connection: SqlConnection,
  migrations: readonly Migration[],
): Promise<number> {
  validateMigrations(migrations);
  await connection.executeStatic(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )`,
  );

  const rows = await connection.all<MigrationRow>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  );
  const latestVersion = migrations.at(-1)?.version ?? 0;

  if (
    rows.some(
      (row, index) => row.version !== index + 1 || row.version > latestVersion,
    )
  ) {
    throw new StorageError(
      'MIGRATION_FAILED',
      'Local storage uses an unsupported schema version.',
      false,
    );
  }

  const applied = new Set(rows.map((row) => row.version));

  try {
    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      await connection.transaction(async (executor) => {
        await migration.migrate(executor);
        await executor.run(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, new Date().toISOString()],
        );
      });
    }
  } catch (error) {
    throw toStorageError(
      error,
      'MIGRATION_FAILED',
      'Planora could not finish preparing local storage.',
    );
  }

  return latestVersion;
}

function validateMigrations(migrations: readonly Migration[]) {
  let previousVersion = 0;

  for (const migration of migrations) {
    if (migration.version !== previousVersion + 1) {
      throw new StorageError(
        'MIGRATION_FAILED',
        'Local storage migrations are not in a valid order.',
        false,
      );
    }

    previousVersion = migration.version;
  }
}
