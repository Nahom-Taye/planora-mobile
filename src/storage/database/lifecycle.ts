import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import type { RepositoryStore } from '../../domain/repositories/contracts.ts';
import { ExpoSqlConnection, type SqlConnection } from './connection.ts';
import { toStorageError } from './errors.ts';
import { runMigrations } from './migration-runner.ts';
import { migrations } from './migrations/index.ts';
import { createSqliteRepositoryStore } from '../repositories/sqlite-repository-store.ts';

export type StorageStatus = 'idle' | 'initializing' | 'ready' | 'error';

export type StorageSnapshot = {
  status: StorageStatus;
  localDataAvailable: boolean;
  offlineReady: boolean;
  errorMessage: string | null;
};

const databaseName = 'planora.db';
const listeners = new Set<(snapshot: StorageSnapshot) => void>();
let connection: SqlConnection | null = null;
let repositories: RepositoryStore | null = null;
let initialization: Promise<RepositoryStore> | null = null;
let snapshot: StorageSnapshot = {
  status: 'idle',
  localDataAvailable: false,
  offlineReady: false,
  errorMessage: null,
};

export function getStorageSnapshot() {
  return snapshot;
}

export function subscribeToStorage(
  listener: (nextSnapshot: StorageSnapshot) => void,
) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRepositoryStore() {
  return repositories;
}

export async function initializeStorage(): Promise<RepositoryStore> {
  if (repositories) {
    return repositories;
  }

  if (initialization) {
    return initialization;
  }

  updateSnapshot({
    status: 'initializing',
    localDataAvailable: false,
    offlineReady: false,
    errorMessage: null,
  });

  initialization = createStorage();

  try {
    repositories = await initialization;
    updateSnapshot({
      status: 'ready',
      localDataAvailable: true,
      offlineReady: true,
      errorMessage: null,
    });
    return repositories;
  } catch (error) {
    const storageError = toStorageError(
      error,
      'INITIALIZATION_FAILED',
      'Local data is temporarily unavailable. Your existing data has not been removed.',
    );
    updateSnapshot({
      status: 'error',
      localDataAvailable: false,
      offlineReady: false,
      errorMessage: storageError.message,
    });
    initialization = null;
    throw storageError;
  }
}

export async function retryStorageInitialization() {
  if (connection) {
    await connection.close().catch(() => undefined);
    connection = null;
  }

  repositories = null;
  initialization = null;
  return initializeStorage();
}

async function createStorage() {
  const database = await SQLite.openDatabaseAsync(databaseName);
  connection = new ExpoSqlConnection(database);

  try {
    await connection.executeStatic('PRAGMA foreign_keys = ON');

    if (Platform.OS !== 'web') {
      await connection.executeStatic('PRAGMA journal_mode = WAL');
    }

    const foreignKeys = await connection.first<{ foreign_keys: number }>(
      'PRAGMA foreign_keys',
    );

    if (foreignKeys?.foreign_keys !== 1) {
      throw new Error('Foreign-key enforcement is unavailable.');
    }

    await runMigrations(connection, migrations);

    return createSqliteRepositoryStore(connection, {
      createId: () => Crypto.randomUUID(),
      now: () => new Date(),
    });
  } catch (error) {
    await connection.close().catch(() => undefined);
    connection = null;
    throw error;
  }
}

function updateSnapshot(nextSnapshot: StorageSnapshot) {
  snapshot = nextSnapshot;
  listeners.forEach((listener) => listener(snapshot));
}
