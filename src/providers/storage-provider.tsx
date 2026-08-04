import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { RepositoryStore } from '@/domain/repositories';
import {
  getRepositoryStore,
  getStorageSnapshot,
  initializeStorage,
  retryStorageInitialization,
  subscribeToStorage,
  type StorageSnapshot,
} from '@/storage/database';

type StorageContextValue = StorageSnapshot & {
  repositories: RepositoryStore | null;
  retry: () => Promise<void>;
};

const StorageContext = createContext<StorageContextValue | undefined>(undefined);

export function StorageProvider({ children }: PropsWithChildren) {
  const [snapshot, setSnapshot] = useState(getStorageSnapshot);
  const [repositories, setRepositories] = useState<RepositoryStore | null>(
    getRepositoryStore,
  );

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToStorage(setSnapshot);
    void initializeStorage()
      .then((store) => {
        if (active) setRepositories(store);
      })
      .catch(() => undefined);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const retry = useCallback(async () => {
    const store = await retryStorageInitialization().catch(() => null);
    setRepositories(store);
  }, []);

  const value = useMemo<StorageContextValue>(
    () => ({
      ...snapshot,
      repositories,
      retry,
    }),
    [repositories, retry, snapshot],
  );

  return (
    <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
  );
}

export function useStorage() {
  const value = useContext(StorageContext);

  if (!value) {
    throw new Error('useStorage must be used within StorageProvider.');
  }

  return value;
}
