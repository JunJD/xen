import { DEFAULT_PICKUP_CACHE_POLICY } from './pickup-cache';
import { createDexieCacheLayer } from './providers/dexie-cache';

export async function clearPickupCaches() {
  const entryVersion = DEFAULT_PICKUP_CACHE_POLICY.entryVersion;
  const annotationCache = createDexieCacheLayer({
    entryVersion,
    dbName: 'xenPickupCache',
    tableName: 'annotations',
  });
  const translationCache = createDexieCacheLayer({
    entryVersion,
    dbName: 'xenPickupTranslationCache',
    tableName: 'translations',
  });
  await Promise.all([
    annotationCache.clear(),
    translationCache.clear(),
  ]);
}
