export type LocalDataChange = {
  table: string;
};

type LocalDataChangeListener = (change: LocalDataChange) => void;

const listeners = new Set<LocalDataChangeListener>();

export function publishLocalDataChange(table: string) {
  for (const listener of listeners) listener({ table });
}

export function subscribeLocalDataChanges(listener: LocalDataChangeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
