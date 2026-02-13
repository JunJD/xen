import Dexie, { type Table } from 'dexie';
import type { CacheEntry, CacheLayer, CachePruneOptions, CachePruneReport } from '../types';

type DexieCacheOptions = {
  dbName?: string;
  tableName?: string;
  dbVersion?: number;
  entryVersion: number;
};

type LegacyEntry<T> = Omit<CacheEntry<T>, 'value'> & { value?: T; tokens?: T };

class DexieCacheDB<T> extends Dexie {
  private tableName: string;
  private entryVersion: number;

  constructor(options: DexieCacheOptions) {
    const dbName = options.dbName ?? 'xenPickupCache';
    const tableName = options.tableName ?? 'annotations';
    const dbVersion = options.dbVersion ?? 2;
    super(dbName);
    this.tableName = tableName;
    this.entryVersion = options.entryVersion;

    const schemaV1: Record<string, string> = {
      [tableName]: '&hash, updatedAt',
    };
    const schemaV2: Record<string, string> = {
      [tableName]: '&hash, updatedAt, lastAccessed, modelKey, version',
    };

    this.version(1).stores(schemaV1);
    this.version(dbVersion).stores(schemaV2).upgrade((tx) => {
      return tx.table(tableName).toCollection().modify((record: LegacyEntry<T>) => {
        const now = Date.now();
        if (record.value === undefined && record.tokens !== undefined) {
          record.value = record.tokens;
          delete record.tokens;
        }
        record.lastAccessed = record.lastAccessed ?? record.updatedAt ?? now;
        record.version = record.version ?? this.entryVersion;
        record.sourceHash = record.sourceHash ?? record.hash;
        record.updatedAt = record.updatedAt ?? now;
      });
    });
  }

  tableHandle(): Table<CacheEntry<T>, string> {
    return this.table(this.tableName);
  }
}

function normalizeLegacyEntry<T>(
  record: LegacyEntry<T> | undefined,
): { entry: CacheEntry<T> | null; shouldPersist: boolean } {
  if (!record) {
    return { entry: null, shouldPersist: false };
  }
  let shouldPersist = false;
  if (record.value === undefined && record.tokens !== undefined) {
    record.value = record.tokens;
    delete record.tokens;
    shouldPersist = true;
  }
  return { entry: record as CacheEntry<T>, shouldPersist };
}

export function createDexieCacheLayer<T>(options: DexieCacheOptions): CacheLayer<T> {
  const db = new DexieCacheDB<T>(options);
  const table = () => db.tableHandle();

  return {
    name: 'dexie',
    async get(hash) {
      const entry = await table().get(hash);
      const normalized = normalizeLegacyEntry(entry as LegacyEntry<T> | undefined);
      if (normalized.shouldPersist && normalized.entry) {
        await table().put(normalized.entry);
      }
      return normalized.entry;
    },
    async set(entry) {
      await table().put(entry);
    },
    async delete(hash) {
      await table().delete(hash);
    },
    async clear() {
      await table().clear();
    },
    async prune(options) {
      const expireBefore = options.now - options.ttlMs;
      const removedExpired = await table().where('updatedAt').below(expireBefore).delete();
      const removedVersionMismatch = await table().where('version').notEqual(options.entryVersion).delete();

      let removedOverflow = 0;
      const total = await table().count();
      if (total > options.maxEntries) {
        const toRemove = total - options.maxEntries;
        const keys = await table().orderBy('lastAccessed').limit(toRemove).primaryKeys();
        if (keys.length > 0) {
          await table().bulkDelete(keys);
          removedOverflow = keys.length;
        }
      }

      const remaining = await table().count();
      const report: CachePruneReport = {
        removedExpired,
        removedVersionMismatch,
        removedOverflow,
        total: remaining,
      };
      return report;
    },
    async touch(hash, lastAccessed) {
      await table().update(hash, { lastAccessed });
    },
  };
}
