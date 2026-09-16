// A tab owns its namespace. A cookie change in another tab must never silently
// turn player A's in-memory state into player B's save. Guest keys stay intact.
let accountId: string | null = null;
export const setPlayerAccount = (id: string | null) => { accountId = id; };
export const getPlayerAccount = () => accountId;
export const playerStorage = (id: string | null = accountId, source?: Storage): Storage | undefined => {
  const storage = source ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  if (!storage) return undefined;
  if (!id) return storage;
  const prefix = `typomancer:account:${encodeURIComponent(id)}:`;
  const keys = () => Array.from({ length: storage.length }, (_, i) => storage.key(i))
    .filter((key): key is string => Boolean(key?.startsWith(prefix)));
  return {
    get length() { return keys().length; },
    key: index => keys()[index]?.slice(prefix.length) ?? null,
    getItem: key => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: key => storage.removeItem(prefix + key),
    clear: () => keys().forEach(key => storage.removeItem(key))
  };
};
