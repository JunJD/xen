import type { CacheLayer, CachePolicy } from './types';
import { createCacheManager } from './manager';
import { createDexieCacheLayer } from './providers/dexie-cache';
import { createMemoryCacheLayer } from './providers/memory-cache';
import { DEFAULT_PICKUP_CACHE_POLICY } from './pickup-cache';

const DEFAULT_POLICY: CachePolicy = {
  ...DEFAULT_PICKUP_CACHE_POLICY,
};

type TranslationCacheOptions = {
  modelKey: () => string;
  policy?: Partial<CachePolicy>;
  dbName?: string;
  tableName?: string;
  memoryMaxEntries?: number;
  layers?: CacheLayer<string>[];
};

export function createTranslationCache(options: TranslationCacheOptions) {
  const policy = { ...DEFAULT_POLICY, ...options.policy };
  const memoryMaxEntries = Math.min(
    options.memoryMaxEntries ?? 500,
    policy.maxEntries,
  );

  const layers = options.layers ?? [
    createMemoryCacheLayer<string>({
      name: 'memory',
      maxEntries: memoryMaxEntries,
    }),
    createDexieCacheLayer<string>({
      dbName: options.dbName ?? 'xenPickupTranslationCache',
      tableName: options.tableName ?? 'translations',
      entryVersion: policy.entryVersion,
    }),
  ];

  return createCacheManager<string>({
    layers,
    policy,
    getModelKey: options.modelKey,
  });
}

export const DEFAULT_TRANSLATION_CACHE_POLICY = DEFAULT_POLICY;
