import type { CacheEntry, CacheLayer, CachePruneOptions, CachePruneReport } from '../types';

type MemoryCacheOptions = {
  name?: string;
  maxEntries: number;
};

export function createMemoryCacheLayer<T>(options: MemoryCacheOptions): CacheLayer<T> {
  const name = options.name ?? 'memory';
  const maxEntries = Math.max(1, options.maxEntries);
  const entries = new Map<string, CacheEntry<T>>();

  function markAsRecent(hash: string, entry: CacheEntry<T>) {
    entries.delete(hash);
    entries.set(hash, entry);
  }

  function enforceMaxEntries(): number {
    let removed = 0;
    while (entries.size > maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      entries.delete(oldestKey);
      removed += 1;
    }
    return removed;
  }

  function pruneInternal(options: CachePruneOptions): CachePruneReport {
    let removedExpired = 0;
    let removedVersionMismatch = 0;

    entries.forEach((entry, hash) => {
      if (options.now - entry.updatedAt > options.ttlMs) {
        entries.delete(hash);
        removedExpired += 1;
        return;
      }
      if (entry.version !== options.entryVersion) {
        entries.delete(hash);
        removedVersionMismatch += 1;
      }
    });

    const removedOverflow = enforceMaxEntries();

    return {
      removedExpired,
      removedVersionMismatch,
      removedOverflow,
      total: entries.size,
    };
  }

  return {
    name,
    async get(hash) {
      const entry = entries.get(hash) ?? null;
      if (entry) {
        markAsRecent(hash, entry);
      }
      return entry;
    },
    async set(entry) {
      markAsRecent(entry.hash, entry);
      enforceMaxEntries();
    },
    async delete(hash) {
      entries.delete(hash);
    },
    async clear() {
      entries.clear();
    },
    async prune(options) {
      return pruneInternal(options);
    },
    async touch(hash, lastAccessed) {
      const entry = entries.get(hash);
      if (!entry) {
        return;
      }
      const updated = { ...entry, lastAccessed };
      markAsRecent(hash, updated);
    },
  };
}
