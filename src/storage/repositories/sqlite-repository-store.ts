import type { RepositoryScope, RepositoryStore } from '../../domain/repositories/contracts.ts';
import type { SqlConnection, SqlExecutor } from '../database/connection.ts';
import {
  accountLinkMapper,
  appSettingsMapper,
  areaMapper,
  goalMapper,
  localChangeMapper,
  milestoneMapper,
  planBlockMapper,
  reflectionMapper,
  routineCheckInMapper,
  routineMapper,
  tagMapper,
  taskMapper,
  userProfileMapper,
  workspaceMapper,
} from '../mappers/entity-mappers.ts';
import {
  SqliteEntityRepository,
  SqliteLocalChangeRepository,
  type RepositoryDependencies,
} from './sqlite-entity-repository.ts';

function createScope(
  executor: SqlExecutor,
  dependencies: RepositoryDependencies,
): RepositoryScope {
  return {
    userProfiles: new SqliteEntityRepository(
      executor,
      userProfileMapper,
      dependencies,
    ),
    workspaces: new SqliteEntityRepository(
      executor,
      workspaceMapper,
      dependencies,
    ),
    tasks: new SqliteEntityRepository(executor, taskMapper, dependencies),
    planBlocks: new SqliteEntityRepository(
      executor,
      planBlockMapper,
      dependencies,
    ),
    routines: new SqliteEntityRepository(executor, routineMapper, dependencies),
    routineCheckIns: new SqliteEntityRepository(
      executor,
      routineCheckInMapper,
      dependencies,
    ),
    goals: new SqliteEntityRepository(executor, goalMapper, dependencies),
    milestones: new SqliteEntityRepository(
      executor,
      milestoneMapper,
      dependencies,
    ),
    areas: new SqliteEntityRepository(executor, areaMapper, dependencies),
    tags: new SqliteEntityRepository(executor, tagMapper, dependencies),
    reflections: new SqliteEntityRepository(
      executor,
      reflectionMapper,
      dependencies,
    ),
    appSettings: new SqliteEntityRepository(
      executor,
      appSettingsMapper,
      dependencies,
    ),
    accountLinks: new SqliteEntityRepository(
      executor,
      accountLinkMapper,
      dependencies,
    ),
    localChanges: new SqliteLocalChangeRepository(
      executor,
      localChangeMapper,
      dependencies,
    ),
  };
}

export function createSqliteRepositoryStore(
  connection: SqlConnection,
  dependencies: RepositoryDependencies,
): RepositoryStore {
  const scope = createScope(connection, dependencies);

  return {
    ...scope,
    transaction: (operation) =>
      connection.transaction((executor) =>
        operation(createScope(executor, dependencies)),
      ),
  };
}
