type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Persist inside this tab only. The client key is fresh on every page load:
 * Supabase also uses it as its BroadcastChannel name, so even duplicated tabs
 * cannot broadcast login/logout events to each other.
 * Map that transient key to a stable sessionStorage key to survive reloads.
 * Never import the old shared localStorage session.
 */
export function tabSessionOptions(namespace: string, storage?: SessionStorage) {
  const storageKey = namespace + '-' + crypto.randomUUID();
  const memory = new Map<string, string>();
  const keyFor = (key: string) => namespace + key.slice(storageKey.length);
  return {
    storageKey,
    persistSession: !!storage,
    autoRefreshToken: !!storage,
    detectSessionInUrl: !!storage,
    storage: {
      getItem(key: string): string | null {
        const savedKey = keyFor(key);
        try { return storage ? storage.getItem(savedKey) : memory.get(savedKey) ?? null; }
        catch { return memory.get(savedKey) ?? null; }
      },
      setItem(key: string, value: string) {
        const savedKey = keyFor(key);
        memory.set(savedKey, value);
        try { storage?.setItem(savedKey, value); } catch { /* Private mode: memory fallback. */ }
      },
      removeItem(key: string) {
        const savedKey = keyFor(key);
        memory.delete(savedKey);
        try { storage?.removeItem(savedKey); } catch { /* No shared storage fallback. */ }
      }
    }
  };
}
