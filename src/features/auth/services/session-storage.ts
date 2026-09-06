import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  createAtomicChunkStorage,
  createGuardedSessionStorage,
  createMemoryStorage,
  type KeyValueStorage,
} from './session-storage-core.ts';

function webStorage(): KeyValueStorage {
  if (typeof window === 'undefined') return createMemoryStorage();
  return {
    async getItem(key) { return window.localStorage.getItem(key); },
    async setItem(key, value) {
      if (value.length > 32768) throw new Error('Session storage capacity exceeded.');
      window.localStorage.setItem(key, value);
    },
    async removeItem(key) { window.localStorage.removeItem(key); },
  };
}

export const authSessionStorage = createGuardedSessionStorage(
  Platform.OS === 'web' ? webStorage() : createAtomicChunkStorage({
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  }),
);
