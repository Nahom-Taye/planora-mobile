import type { SqlExecutor } from '../connection.ts';

export type Migration = {
  version: number;
  name: string;
  migrate: (executor: SqlExecutor) => Promise<void>;
};

export function sqlMigration(
  version: number,
  name: string,
  statements: string[],
): Migration {
  return {
    version,
    name,
    migrate: async (executor) => {
      for (const statement of statements) {
        await executor.executeStatic(statement);
      }
    },
  };
}
