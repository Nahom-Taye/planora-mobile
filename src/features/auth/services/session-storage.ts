import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  createGuardedSessionStorage,
  createMemoryStorage,
  type KeyValueStorage,
} from './session-storage-core.ts';

const chunkSize = 1800;
const maxChunks = 16;
const maxWebSize = 32768;
const memoryStorage = createMemoryStorage();

function secureStoreStorage(): KeyValueStorage {
  return {
    async getItem(key) {
      const manifestValue = await SecureStore.getItemAsync(`${key}.manifest`);

      if (!manifestValue) {
        return null;
      }

      const count = Number(manifestValue);

      if (!Number.isInteger(count) || count < 1 || count > maxChunks) {
        await clearSecureValue(key, maxChunks);
        return null;
      }

      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.getItemAsync(`${key}.${index}`),
        ),
      );

      if (chunks.some((chunk) => chunk === null)) {
        await clearSecureValue(key, count);
        return null;
      }

      return chunks.join('');
    },
    async setItem(key, value) {
      const chunks = Array.from(
        { length: Math.ceil(value.length / chunkSize) },
        (_, index) => value.slice(index * chunkSize, (index + 1) * chunkSize),
      );

      if (chunks.length === 0 || chunks.length > maxChunks) {
        throw new Error('Session storage capacity exceeded.');
      }

      await Promise.all(
        chunks.map((chunk, index) =>
          SecureStore.setItemAsync(`${key}.${index}`, chunk),
        ),
      );
      await SecureStore.setItemAsync(`${key}.manifest`, String(chunks.length));

      await Promise.all(
        Array.from({ length: maxChunks - chunks.length }, (_, offset) =>
          SecureStore.deleteItemAsync(`${key}.${chunks.length + offset}`),
        ),
      );
    },
    async removeItem(key) {
      await clearSecureValue(key, maxChunks);
    },
  };
}

function webStorage(): KeyValueStorage {
  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryStorage;
  }

  return {
    async getItem(key) {
      return window.localStorage.getItem(key);
    },
    async setItem(key, value) {
      if (value.length > maxWebSize) {
        throw new Error('Session storage capacity exceeded.');
      }
      window.localStorage.setItem(key, value);
    },
    async removeItem(key) {
      window.localStorage.removeItem(key);
    },
  };
}

async function clearSecureValue(key: string, count: number) {
  await Promise.all([
    SecureStore.deleteItemAsync(`${key}.manifest`),
    ...Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(`${key}.${index}`),
    ),
  ]);
}

export const authSessionStorage = createGuardedSessionStorage(
  Platform.OS === 'web' ? webStorage() : secureStoreStorage(),
);
