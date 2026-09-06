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
        throw new Error('Secure session storage unavailable.');
      }

      if (value === null || !isSessionKey(key)) {
        return value;
      }

      try {
        const parsed = JSON.parse(value) as unknown;
        if (!validStoredSession(parsed)) {
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
      await backing.removeItem(key);
    },
  };
}

export function validStoredSession(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  const user = session.user as Record<string, unknown> | undefined;
  return typeof session.access_token === 'string' && session.access_token.length > 0 &&
    typeof session.refresh_token === 'string' && session.refresh_token.length > 0 &&
    typeof session.expires_at === 'number' && Number.isFinite(session.expires_at) &&
    typeof user?.id === 'string' && user.id.length > 0;
}

export function createAtomicChunkStorage(backing: KeyValueStorage): KeyValueStorage {
  const pending = new Map<string, Promise<unknown>>();
  const serialize = <T>(key: string, work: () => Promise<T>): Promise<T> => {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
    pending.set(key, result);
    void result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    }).catch(() => undefined);
    return result;
  };
  const parse = (value: string | null) => {
    if (!value) return null;
    const parts = value.split(':');
    const count = Number(parts.at(-1));
    if (!Number.isInteger(count) || count < 1 || count > 64) return null;
    const slot = parts.length === 1 ? '' : parts[0];
    return slot === '' || slot === 'a' || slot === 'b' ? { slot, count } : null;
  };
  const chunkKey = (key: string, slot: string, index: number) => `${key}.${slot ? `${slot}.` : ''}${index}`;
  return {
    getItem: (key) => serialize(key, async () => {
      const manifest = parse(await backing.getItem(`${key}.manifest`));
      if (!manifest) return null;
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
        backing.getItem(chunkKey(key, manifest.slot, index))));
      return chunks.some((chunk) => chunk === null) ? null : chunks.join('');
    }),
    setItem: (key, value) => serialize(key, async () => {
      const previous = parse(await backing.getItem(`${key}.manifest`));
      const slot = previous?.slot === 'a' ? 'b' : 'a';
      const characters = Array.from(value);
      const chunks = Array.from({ length: Math.ceil(characters.length / 450) }, (_, index) =>
        characters.slice(index * 450, (index + 1) * 450).join(''));
      if (chunks.length < 1 || chunks.length > 64) throw new Error('Session storage capacity exceeded.');
      await Promise.all(chunks.map((chunk, index) => backing.setItem(chunkKey(key, slot, index), chunk)));
      await backing.setItem(`${key}.manifest`, `${slot}:${chunks.length}`);
      if (previous) {
        await Promise.all(Array.from({ length: previous.count }, (_, index) =>
          safelyRemove(backing, chunkKey(key, previous.slot, index))));
      }
    }),
    removeItem: (key) => serialize(key, async () => {
      await backing.removeItem(`${key}.manifest`);
      await Promise.all(['', 'a', 'b'].flatMap((slot) => Array.from({ length: 64 }, (_, index) =>
        backing.removeItem(chunkKey(key, slot, index)))));
    }),
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
