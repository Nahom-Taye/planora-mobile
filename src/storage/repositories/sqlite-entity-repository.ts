import type { EntityMetadata, LocalChange, PortableEntityType } from '../../domain/entities/index.ts';
import { toInstant } from '../../domain/entities/common.ts';
import type {
  CreateEntityInput,
  EntityRepository,
  ListOptions,
  LocalChangeFilter,
  LocalChangeRepository,
  SyncControlRepository,
  Page,
  UpdateEntityInput,
} from '../../domain/repositories/contracts.ts';
import type { SqlExecutor, SqlValue } from '../database/connection.ts';
import { StorageError, toStorageError } from '../database/errors.ts';
import type { DatabaseRecord, DatabaseRow, EntityMapper } from '../mappers/types.ts';

export type RepositoryDependencies = {
  createId: () => string;
  now: () => Date;
};

export class SqliteEntityRepository<
  TEntity extends EntityMetadata,
  TFilter,
> implements EntityRepository<TEntity, TFilter> {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly mapper: EntityMapper<TEntity, TFilter>,
    private readonly dependencies: RepositoryDependencies,
  ) {}

  async getById(id: string, includeDeleted = false): Promise<TEntity | null> {
    const deletedClause = includeDeleted ? '' : ' AND deleted_at IS NULL';

    try {
      const row = await this.executor.first<DatabaseRow>(
        `SELECT ${this.mapper.columns.join(', ')} FROM ${this.mapper.table} WHERE id = ?${deletedClause}`,
        [id],
      );

      return row ? this.mapper.fromRow(row) : null;
    } catch (error) {
      throw toStorageError(error, 'READ_FAILED', 'Local data could not be read.');
    }
  }

  async list(options: ListOptions<TFilter> = {}): Promise<Page<TEntity>> {
    const limit = Math.min(100, Math.max(1, options.page?.limit ?? 50));
    const offset = Math.max(0, options.page?.offset ?? 0);
    const filters = this.mapper.buildFilters(options.filter);

    if (!options.includeDeleted) {
      filters.push({ sql: 'deleted_at IS NULL', parameters: [] });
    }

    const where = filters.length
      ? ` WHERE ${filters.map((filter) => filter.sql).join(' AND ')}`
      : '';
    const parameters = filters.flatMap((filter) => filter.parameters);

    try {
      const rows = await this.executor.all<DatabaseRow>(
        `SELECT ${this.mapper.columns.join(', ')} FROM ${this.mapper.table}${where} ORDER BY ${this.mapper.orderBy} LIMIT ? OFFSET ?`,
        [...parameters, limit + 1, offset],
      );
      const hasNextPage = rows.length > limit;

      return {
        items: rows.slice(0, limit).map(this.mapper.fromRow),
        nextOffset: hasNextPage ? offset + limit : null,
      };
    } catch (error) {
      throw toStorageError(error, 'READ_FAILED', 'Local data could not be listed.');
    }
  }

  async create(input: CreateEntityInput<TEntity>): Promise<TEntity> {
    const timestamp = toInstant(this.dependencies.now());
    const entity = {
      ...input,
      id: input.id ?? this.dependencies.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      deletedAt: null,
    } as TEntity;
    const row = this.mapper.toRow(entity);
    const placeholders = this.mapper.columns.map(() => '?').join(', ');

    try {
      await this.executor.run(
        `INSERT INTO ${this.mapper.table} (${this.mapper.columns.join(', ')}) VALUES (${placeholders})`,
        valuesFor(this.mapper.columns, row),
      );

      return entity;
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local data could not be saved.');
    }
  }

  async update(
    id: string,
    input: UpdateEntityInput<TEntity>,
  ): Promise<TEntity> {
    const current = await this.getById(id);

    if (!current) {
      throw new StorageError('NOT_FOUND', 'The local item was not found.', false);
    }

    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      throw revisionConflict();
    }

    const { expectedRevision, ...changes } = input;
    const entity = {
      ...current,
      ...definedValues(changes),
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: toInstant(this.dependencies.now()),
      revision: current.revision + 1,
      deletedAt: current.deletedAt,
    } as TEntity;
    const row = this.mapper.toRow(entity);
    const mutableColumns = this.mapper.columns.filter((column) => column !== 'id');

    try {
      const result = await this.executor.run(
        `UPDATE ${this.mapper.table} SET ${mutableColumns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        [
          ...valuesFor(mutableColumns, row),
          id,
          current.revision,
        ],
      );

      if (result.changes !== 1) {
        throw revisionConflict();
      }

      return entity;
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local data could not be updated.');
    }
  }

  async softDelete(id: string, expectedRevision?: number): Promise<TEntity> {
    const current = await this.getById(id);

    if (!current) {
      throw new StorageError('NOT_FOUND', 'The local item was not found.', false);
    }

    if (expectedRevision !== undefined && expectedRevision !== current.revision) {
      throw revisionConflict();
    }

    const deletedAt = toInstant(this.dependencies.now());
    const entity = {
      ...current,
      updatedAt: deletedAt,
      revision: current.revision + 1,
      deletedAt,
    };

    try {
      const result = await this.executor.run(
        `UPDATE ${this.mapper.table} SET updated_at = ?, revision = ?, deleted_at = ? WHERE id = ? AND revision = ? AND deleted_at IS NULL`,
        [deletedAt, entity.revision, deletedAt, id, current.revision],
      );

      if (result.changes !== 1) {
        throw revisionConflict();
      }

      return entity;
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local data could not be removed.');
    }
  }

}

export class SqliteSyncControlRepository implements SyncControlRepository {
  constructor(private readonly executor: SqlExecutor) {}

  async portableType(localChangeId: string): Promise<PortableEntityType | null> {
    const row = await this.executor.first<{ portable_entity_type: SqlValue }>(
      `SELECT portable_entity_type FROM sync_change_details WHERE local_change_id = ?`,
      [localChangeId],
    );
    return typeof row?.portable_entity_type === 'string'
      ? (row.portable_entity_type as PortableEntityType)
      : null;
  }

  async setPortableType(localChangeId: string, entityType: PortableEntityType) {
    if (!['plan_block_series', 'goal_routine_link', 'reminder_intent'].includes(entityType)) return;
    await this.executor.run(
      `INSERT OR REPLACE INTO sync_change_details (local_change_id, portable_entity_type) VALUES (?, ?)`,
      [localChangeId, entityType],
    );
  }

  async suppress(workspaceId: string) {
    await this.executor.run(
      `INSERT OR IGNORE INTO sync_suppression (workspace_id) VALUES (?)`,
      [workspaceId],
    );
  }

  async resume(workspaceId: string) {
    await this.executor.run(`DELETE FROM sync_suppression WHERE workspace_id = ?`, [workspaceId]);
  }


  async clearWorkspace(workspaceId: string) {
    await this.executor.run(`UPDATE goals SET next_action_task_id = NULL WHERE workspace_id = ?`, [workspaceId]);
    const tables = [
      'device_notification_schedules',
      'device_calendar_events',
      'reminder_intents',
      'sync_conflicts',
      'sync_diagnostics',
      'sync_entity_states',
      'local_changes',
      'reflections',
      'goal_routine_links',
      'milestones',
      'plan_blocks',
      'plan_block_series',
      'routine_check_ins',
      'tasks',
      'goals',
      'routines',
      'tags',
      'areas',
      'sync_suppression',
      'sync_bindings',
    ];
    for (const table of tables) {
      await this.executor.run(`DELETE FROM ${table} WHERE workspace_id = ?`, [workspaceId]);
    }
  }
}

export class SqliteLocalChangeRepository implements LocalChangeRepository {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly mapper: EntityMapper<LocalChange, LocalChangeFilter>,
    private readonly dependencies: RepositoryDependencies,
  ) {}

  async getById(id: string): Promise<LocalChange | null> {
    try {
      const row = await this.executor.first<DatabaseRow>(
        `SELECT ${this.mapper.columns.join(', ')} FROM ${this.mapper.table} WHERE id = ?`,
        [id],
      );

      return row ? this.mapper.fromRow(row) : null;
    } catch (error) {
      throw toStorageError(error, 'READ_FAILED', 'Local change data could not be read.');
    }
  }

  async list(
    options: ListOptions<LocalChangeFilter> = {},
  ): Promise<Page<LocalChange>> {
    const limit = Math.min(100, Math.max(1, options.page?.limit ?? 50));
    const offset = Math.max(0, options.page?.offset ?? 0);
    const filters = this.mapper.buildFilters(options.filter);
    const where = filters.length
      ? ` WHERE ${filters.map((filter) => filter.sql).join(' AND ')}`
      : '';
    const parameters = filters.flatMap((filter) => filter.parameters);

    try {
      const rows = await this.executor.all<DatabaseRow>(
        `SELECT ${this.mapper.columns.join(', ')} FROM ${this.mapper.table}${where} ORDER BY ${this.mapper.orderBy} LIMIT ? OFFSET ?`,
        [...parameters, limit + 1, offset],
      );

      return {
        items: rows.slice(0, limit).map(this.mapper.fromRow),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    } catch (error) {
      throw toStorageError(error, 'READ_FAILED', 'Local change data could not be listed.');
    }
  }

  async create(
    input: Omit<LocalChange, 'id' | 'createdAt' | 'updatedAt' | 'revision'> & {
      id?: string;
    },
  ): Promise<LocalChange> {
    const timestamp = toInstant(this.dependencies.now());
    const entity: LocalChange = {
      ...input,
      id: input.id ?? this.dependencies.createId(),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
    };
    const row = this.mapper.toRow(entity);

    try {
      await this.executor.run(
        `INSERT INTO ${this.mapper.table} (${this.mapper.columns.join(', ')}) VALUES (${this.mapper.columns.map(() => '?').join(', ')})`,
        valuesFor(this.mapper.columns, row),
      );
      return entity;
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local change data could not be saved.');
    }
  }

  async update(
    id: string,
    input: Partial<
      Omit<LocalChange, 'id' | 'createdAt' | 'updatedAt' | 'revision'>
    > & { expectedRevision?: number },
  ): Promise<LocalChange> {
    const current = await this.getById(id);

    if (!current) {
      throw new StorageError('NOT_FOUND', 'The local change was not found.', false);
    }

    if (
      input.expectedRevision !== undefined &&
      input.expectedRevision !== current.revision
    ) {
      throw revisionConflict();
    }

    const { expectedRevision, ...changes } = input;
    const entity: LocalChange = {
      ...current,
      ...definedValues(changes),
      updatedAt: toInstant(this.dependencies.now()),
      revision: current.revision + 1,
    };
    const row = this.mapper.toRow(entity);
    const mutableColumns = this.mapper.columns.filter((column) => column !== 'id');

    try {
      const result = await this.executor.run(
        `UPDATE ${this.mapper.table} SET ${mutableColumns.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND revision = ?`,
        [...valuesFor(mutableColumns, row), id, current.revision],
      );

      if (result.changes !== 1) {
        throw revisionConflict();
      }

      return entity;
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local change data could not be updated.');
    }
  }

  async remove(id: string) {
    try {
      await this.executor.run(`DELETE FROM ${this.mapper.table} WHERE id = ?`, [id]);
    } catch (error) {
      throw toStorageError(error, 'WRITE_FAILED', 'Local change data could not be cleared.');
    }
  }
}

function valuesFor(
  columns: readonly string[],
  row: DatabaseRecord,
): SqlValue[] {
  return columns.map((column) => row[column]);
}

function revisionConflict() {
  return new StorageError(
    'REVISION_CONFLICT',
    'This local item changed before the update could be saved.',
    true,
  );
}

function definedValues<TRecord extends object>(record: TRecord): Partial<TRecord> {
  return Object.fromEntries(
    Object.entries(record).filter((entry) => entry[1] !== undefined),
  ) as Partial<TRecord>;
}
