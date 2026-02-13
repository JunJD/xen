import { buildCacheKey } from './key';
import type {
  CacheEntry,
  CacheLayer,
  CacheManagerOptions,
  CachePolicy,
  CachePruneOptions,
} from './types';

export class CacheManager<T> {
  private layers: CacheLayer<T>[];
  private policy: CachePolicy;
  private getModelKey: () => string;
  private buildKey: (sourceHash: string, modelKey: string) => string;
  private lastPruneAt = 0;
  private pruneInFlight: Promise<void> | null = null;

  constructor(options: CacheManagerOptions<T>) {
    this.layers = options.layers;
    this.policy = options.policy;
    this.getModelKey = options.getModelKey;
    this.buildKey = options.buildKey ?? buildCacheKey;
  }

  async get(sourceHash: string): Promise<CacheEntry<T> | null> {
    const modelKey = this.getModelKey();
    const hash = this.buildKey(sourceHash, modelKey);
    const now = Date.now();

    for (let index = 0; index < this.layers.length; index += 1) {
      const layer = this.layers[index];
      let entry: CacheEntry<T> | null = null;

      try {
        entry = await layer.get(hash);
      }
      catch {
        entry = null;
      }

      if (!entry) {
        continue;
      }

      const normalized = this.normalizeEntry(entry, sourceHash, modelKey, now);
      if (!normalized.entry) {
        await this.safeDelete(layer, hash);
        continue;
      }

      if (normalized.needsPersist) {
        await this.safeSet(layer, normalized.entry);
      }

      if (this.shouldTouch(normalized.entry, now)) {
        await this.safeTouch(layer, hash, now, normalized.entry);
        normalized.entry.lastAccessed = now;
      }

      if (index > 0) {
        const warmEntry = { ...normalized.entry };
        for (let warmIndex = 0; warmIndex < index; warmIndex += 1) {
          await this.safeSet(this.layers[warmIndex], warmEntry);
        }
      }

      return normalized.entry;
    }

    return null;
  }

  async set(sourceHash: string, value: T): Promise<void> {
    const modelKey = this.getModelKey();
    const hash = this.buildKey(sourceHash, modelKey);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      hash,
      sourceHash,
      modelKey,
      version: this.policy.entryVersion,
      value,
      updatedAt: now,
      lastAccessed: now,
    };

    await Promise.all(this.layers.map(layer => this.safeSet(layer, entry)));
  }

  async delete(sourceHash: string): Promise<void> {
    const modelKey = this.getModelKey();
    const hash = this.buildKey(sourceHash, modelKey);
    await Promise.all(this.layers.map(layer => this.safeDelete(layer, hash)));
  }

  async clear(): Promise<void> {
    await Promise.all(this.layers.map(layer => this.safeClear(layer)));
  }

  async maybePrune(reason: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastPruneAt < this.policy.pruneIntervalMs) {
      return;
    }

    this.lastPruneAt = now;
    const options: CachePruneOptions = {
      ttlMs: this.policy.ttlMs,
      maxEntries: this.policy.maxEntries,
      entryVersion: this.policy.entryVersion,
      now,
    };

    await this.runPrune(reason, options);
  }

  private async runPrune(_reason: string, options: CachePruneOptions) {
    if (this.pruneInFlight) {
      return this.pruneInFlight;
    }

    this.pruneInFlight = Promise.all(
      this.layers.map(async (layer) => {
        if (!layer.prune) {
          return;
        }
        try {
          await layer.prune(options);
        }
        catch {
          return;
        }
      }),
    ).then(() => undefined).finally(() => {
      this.pruneInFlight = null;
    });

    return this.pruneInFlight;
  }

  private normalizeEntry(
    entry: CacheEntry<T>,
    sourceHash: string,
    modelKey: string,
    now: number,
  ): { entry: CacheEntry<T> | null; needsPersist: boolean } {
    let needsPersist = false;

    let version = entry.version;
    if (typeof version !== 'number') {
      version = this.policy.entryVersion === 1 ? 1 : -1;
      needsPersist = true;
    }

    let resolvedModelKey = entry.modelKey;
    if (!resolvedModelKey) {
      resolvedModelKey = version === this.policy.entryVersion && version === 1 ? modelKey : '';
      needsPersist = true;
    }

    const updatedAt = typeof entry.updatedAt === 'number' ? entry.updatedAt : now;
    if (updatedAt !== entry.updatedAt) {
      needsPersist = true;
    }

    const lastAccessed = typeof entry.lastAccessed === 'number'
      ? entry.lastAccessed
      : updatedAt;
    if (lastAccessed !== entry.lastAccessed) {
      needsPersist = true;
    }

    const sourceHashValue = entry.sourceHash || sourceHash;
    if (sourceHashValue !== entry.sourceHash) {
      needsPersist = true;
    }

    if (version !== this.policy.entryVersion) {
      return { entry: null, needsPersist: false };
    }

    if (resolvedModelKey !== modelKey) {
      return { entry: null, needsPersist: false };
    }

    if (now - updatedAt > this.policy.ttlMs) {
      return { entry: null, needsPersist: false };
    }

    if (entry.value === undefined) {
      return { entry: null, needsPersist: false };
    }

    return {
      entry: {
        ...entry,
        version,
        modelKey: resolvedModelKey,
        updatedAt,
        lastAccessed,
        sourceHash: sourceHashValue,
      },
      needsPersist,
    };
  }

  private shouldTouch(entry: CacheEntry<T>, now: number) {
    if (!entry.lastAccessed) {
      return true;
    }
    return now - entry.lastAccessed > this.policy.accessUpdateIntervalMs;
  }

  private async safeSet(layer: CacheLayer<T>, entry: CacheEntry<T>) {
    try {
      await layer.set(entry);
    }
    catch {
      return;
    }
  }

  private async safeTouch(layer: CacheLayer<T>, hash: string, now: number, entry: CacheEntry<T>) {
    if (layer.touch) {
      try {
        await layer.touch(hash, now);
      }
      catch {
        return;
      }
      return;
    }

    await this.safeSet(layer, { ...entry, lastAccessed: now });
  }

  private async safeDelete(layer: CacheLayer<T>, hash: string) {
    try {
      await layer.delete(hash);
    }
    catch {
      return;
    }
  }

  private async safeClear(layer: CacheLayer<T>) {
    try {
      await layer.clear();
    }
    catch {
      return;
    }
  }
}

export function createCacheManager<T>(options: CacheManagerOptions<T>) {
  return new CacheManager(options);
}
