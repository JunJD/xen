import type { PickupToken } from '@/lib/pickup/messages';
import type { CacheLayer, CachePolicy } from './types';
import { createCacheManager } from './manager';
import { createDexieCacheLayer } from './providers/dexie-cache';
import { createMemoryCacheLayer } from './providers/memory-cache';

const DEFAULT_MODEL_KEY = 'spacy-pyodide-0.21.3';

const DEFAULT_POLICY: CachePolicy = {
  ttlMs: 1000 * 60 * 60 * 24 * 30,
  maxEntries: 5000,
  pruneIntervalMs: 1000 * 60 * 30,
  accessUpdateIntervalMs: 1000 * 60 * 5,
  entryVersion: 1,
};

type PickupCacheOptions = {
  modelKey?: () => string;
  policy?: Partial<CachePolicy>;
  dbName?: string;
  tableName?: string;
  memoryMaxEntries?: number;
  layers?: CacheLayer<PickupToken[]>[];
};

export function createPickupCache(options: PickupCacheOptions = {}) {
  const policy = { ...DEFAULT_POLICY, ...options.policy };
  const getModelKey = options.modelKey ?? (() => DEFAULT_MODEL_KEY);
  const memoryMaxEntries = Math.min(
    options.memoryMaxEntries ?? 500,
    policy.maxEntries,
  );

  const layers = options.layers ?? [
    createMemoryCacheLayer<PickupToken[]>({
      name: 'memory',
      maxEntries: memoryMaxEntries,
    }),
    createDexieCacheLayer<PickupToken[]>({
      dbName: options.dbName,
      tableName: options.tableName,
      entryVersion: policy.entryVersion,
    }),
  ];

  return createCacheManager<PickupToken[]>({
    layers,
    policy,
    getModelKey,
  });
}

export const DEFAULT_PICKUP_CACHE_MODEL_KEY = DEFAULT_MODEL_KEY;
export const DEFAULT_PICKUP_CACHE_POLICY = DEFAULT_POLICY;
