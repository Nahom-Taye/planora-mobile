import type { SqlValue } from '../database/connection.ts';

export type DatabaseRow = Record<string, unknown>;
export type DatabaseRecord = Record<string, SqlValue>;

export type FilterClause = {
  sql: string;
  parameters: SqlValue[];
};

export type EntityMapper<TEntity, TFilter> = {
  table: string;
  columns: readonly string[];
  orderBy: string;
  toRow: (entity: TEntity) => DatabaseRecord;
  fromRow: (row: DatabaseRow) => TEntity;
  buildFilters: (filter: TFilter | undefined) => FilterClause[];
};
