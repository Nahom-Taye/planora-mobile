export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createGuardedSessionStorage(
  backing: KeyValueStorage,
): KeyValueStorage {
  return {
    async getItem(key) {
      let value: string | null;

      try {
        value = await backing.getItem(key);
      } catch {
        await safelyRemove(backing, key);
        return null;
      }

      if (value === null || !isSessionKey(key)) {
        return value;
      }

      try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid session shape');
        }
        return value;
      } catch {
        await safelyRemove(backing, key);
        return null;
      }
    },
    async setItem(key, value) {
      await backing.setItem(key, value);
    },
    async removeItem(key) {
      await safelyRemove(backing, key);
    },
  };
}

export function createMemoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();

  return {
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

function isSessionKey(key: string) {
  return key.endsWith('-auth-token');
}

async function safelyRemove(storage: KeyValueStorage, key: string) {
  try {
    await storage.removeItem(key);
  } catch {
    return;
  }
}
