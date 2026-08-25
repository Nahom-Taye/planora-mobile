import type { RepositoryScope, RepositoryStore } from '../../domain/repositories/contracts.ts';
import type { SqlConnection, SqlExecutor } from '../database/connection.ts';
import {
  accountLinkMapper,
  appSettingsMapper,
  areaMapper,
  deviceCalendarEventMapper,
  deviceNotificationScheduleMapper,
  goalMapper,
  goalRoutineLinkMapper,
  localChangeMapper,
  syncBindingMapper,
  syncConflictMapper,
  syncDiagnosticMapper,
  syncEntityStateMapper,
  milestoneMapper,
  planBlockMapper,
  planBlockSeriesMapper,
  reflectionMapper,
  reminderIntentMapper,
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
  SqliteSyncControlRepository,
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
    planBlockSeries: new SqliteEntityRepository(
      executor,
      planBlockSeriesMapper,
      dependencies,
    ),
    routines: new SqliteEntityRepository(executor, routineMapper, dependencies),
    routineCheckIns: new SqliteEntityRepository(
      executor,
      routineCheckInMapper,
      dependencies,
    ),
    goals: new SqliteEntityRepository(executor, goalMapper, dependencies),
    goalRoutineLinks: new SqliteEntityRepository(
      executor,
      goalRoutineLinkMapper,
      dependencies,
    ),
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
    reminderIntents: new SqliteEntityRepository(
      executor,
      reminderIntentMapper,
      dependencies,
    ),
    deviceNotificationSchedules: new SqliteEntityRepository(
      executor,
      deviceNotificationScheduleMapper,
      dependencies,
    ),
    deviceCalendarEvents: new SqliteEntityRepository(
      executor,
      deviceCalendarEventMapper,
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
    syncBindings: new SqliteEntityRepository(executor, syncBindingMapper, dependencies),
    syncEntityStates: new SqliteEntityRepository(executor, syncEntityStateMapper, dependencies),
    syncConflicts: new SqliteEntityRepository(executor, syncConflictMapper, dependencies),
    syncDiagnostics: new SqliteEntityRepository(executor, syncDiagnosticMapper, dependencies),
    syncControl: new SqliteSyncControlRepository(executor),
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
