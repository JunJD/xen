export type CacheEntry<T> = {
  hash: string;
  sourceHash: string;
  modelKey: string;
  version: number;
  value: T;
  updatedAt: number;
  lastAccessed: number;
};

export type CachePolicy = {
  ttlMs: number;
  maxEntries: number;
  pruneIntervalMs: number;
  accessUpdateIntervalMs: number;
  entryVersion: number;
};

export type CachePruneOptions = {
  ttlMs: number;
  maxEntries: number;
  entryVersion: number;
  now: number;
};

export type CachePruneReport = {
  removedExpired: number;
  removedVersionMismatch: number;
  removedOverflow: number;
  total?: number;
};

export interface CacheLayer<T> {
  name: string;
  get: (hash: string) => Promise<CacheEntry<T> | null>;
  set: (entry: CacheEntry<T>) => Promise<void>;
  delete: (hash: string) => Promise<void>;
  clear: () => Promise<void>;
  prune?: (options: CachePruneOptions) => Promise<CachePruneReport>;
  touch?: (hash: string, lastAccessed: number) => Promise<void>;
}

export type CacheManagerOptions<T> = {
  layers: CacheLayer<T>[];
  policy: CachePolicy;
  getModelKey: () => string;
  buildKey?: (sourceHash: string, modelKey: string) => string;
};
