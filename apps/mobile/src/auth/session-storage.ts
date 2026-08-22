export type SupabaseSessionStorage = Readonly<{
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}>;

export type SessionStorageBackend = SupabaseSessionStorage;

export function createNamespacedSessionStorage(
  backend: SessionStorageBackend,
  namespace: string,
): SupabaseSessionStorage {
  if (!/^[a-z0-9._-]+$/i.test(namespace)) {
    throw new Error("Session storage namespace is invalid.");
  }
  const prefix = `everaft:${namespace}:`;
  return Object.freeze({
    getItem: (key: string) => backend.getItem(prefixed(prefix, key)),
    setItem: (key: string, value: string) => backend.setItem(prefixed(prefix, key), value),
    removeItem: (key: string) => backend.removeItem(prefixed(prefix, key)),
  });
}

function prefixed(prefix: string, key: string) {
  if (!key || key.includes("\0")) throw new Error("Session storage key is invalid.");
  return `${prefix}${key}`;
}

export function createMemorySessionStorage(
  initial: Readonly<Record<string, string>> = {},
): SessionStorageBackend & { snapshot(): Readonly<Record<string, string>> } {
  const values = new Map(Object.entries(initial));
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
    snapshot() {
      return Object.fromEntries(values);
    },
  };
}
