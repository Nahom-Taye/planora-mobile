import { Platform } from 'react-native';
import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

export type SqlValue = string | number | null | Uint8Array;

export interface SqlExecutor {
  executeStatic(sql: string): Promise<void>;
  run(sql: string, parameters?: SqlValue[]): Promise<SQLiteRunResult>;
  first<TRow>(sql: string, parameters?: SqlValue[]): Promise<TRow | null>;
  all<TRow>(sql: string, parameters?: SqlValue[]): Promise<TRow[]>;
}

export interface SqlConnection extends SqlExecutor {
  transaction<TResult>(
    operation: (executor: SqlExecutor) => Promise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

function executorFor(database: SQLiteDatabase): SqlExecutor {
  return {
    executeStatic: (sql) => database.execAsync(sql),
    run: (sql, parameters = []) => database.runAsync(sql, parameters),
    first: <TRow>(sql: string, parameters: SqlValue[] = []) =>
      database.getFirstAsync<TRow>(sql, parameters),
    all: <TRow>(sql: string, parameters: SqlValue[] = []) =>
      database.getAllAsync<TRow>(sql, parameters),
  };
}

export class ExpoSqlConnection implements SqlConnection {
  private readonly executor: SqlExecutor;

  constructor(private readonly database: SQLiteDatabase) {
    this.executor = executorFor(database);
  }

  executeStatic(sql: string) {
    return this.executor.executeStatic(sql);
  }

  run(sql: string, parameters?: SqlValue[]) {
    return this.executor.run(sql, parameters);
  }

  first<TRow>(sql: string, parameters?: SqlValue[]) {
    return this.executor.first<TRow>(sql, parameters);
  }

  all<TRow>(sql: string, parameters?: SqlValue[]) {
    return this.executor.all<TRow>(sql, parameters);
  }

  async transaction<TResult>(
    operation: (executor: SqlExecutor) => Promise<TResult>,
  ): Promise<TResult> {
    let result: TResult | undefined;

    if (Platform.OS === 'web') {
      await this.database.withTransactionAsync(async () => {
        result = await operation(this.executor);
      });
    } else {
      await this.database.withExclusiveTransactionAsync(async (transaction) => {
        result = await operation(executorFor(transaction));
      });
    }

    return result as TResult;
  }

  close() {
    return this.database.closeAsync();
  }
}
