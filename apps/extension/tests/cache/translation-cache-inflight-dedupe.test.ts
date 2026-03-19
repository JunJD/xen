import { describe, expect, it, vi } from 'vitest';
import { createMemoryCacheLayer } from '../../lib/pickup/cache/providers/memory-cache';
import { createTranslationCache } from '../../lib/pickup/cache/translation-cache';

function createDeferred<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | undefined;
  let reject: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  if (!resolve || !reject) {
    throw new Error('Failed to create deferred promise.');
  }

  return { promise, resolve, reject };
}

async function flushPendingWork() {
  await Promise.resolve();
  await new Promise(resolve => {
    globalThis.setTimeout(resolve, 0);
  });
}

function createTestTranslationCache() {
  return createTranslationCache({
    modelKey: () => 'translate:google',
    layers: [
      createMemoryCacheLayer<string>({
        name: 'memory',
        maxEntries: 10,
      }),
    ],
  });
}

const shouldPersistTranslation = (value: string) => value.trim().length > 0;

describe('translation cache in-flight dedupe', () => {
  it('calls the loader only once for duplicate in-flight requests', async () => {
    const cache = createTestTranslationCache();
    const sourceHash = 'paragraph-hash';
    const deferred = createDeferred<string>();
    const provider = vi.fn(() => deferred.promise);

    const first = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });
    const second = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });

    await flushPendingWork();
    expect(provider).toHaveBeenCalledTimes(1);

    deferred.resolve('translated paragraph');
    await Promise.all([first, second]);
  });

  it('returns the same translated result to duplicate callers and stores it once', async () => {
    const cache = createTestTranslationCache();
    const sourceHash = 'paragraph-hash';
    const deferred = createDeferred<string>();
    const provider = vi.fn(() => deferred.promise);

    const first = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });
    const second = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });

    deferred.resolve('translated paragraph');

    const [firstResult, secondResult] = await Promise.all([first, second]);
    const cached = await cache.get(sourceHash);

    expect(firstResult).toEqual({
      value: 'translated paragraph',
      cacheHit: false,
      persisted: true,
    });
    expect(secondResult).toEqual(firstResult);
    expect(cached?.value).toBe('translated paragraph');

    const cachedResult = await cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });

    expect(cachedResult).toEqual({
      value: 'translated paragraph',
      cacheHit: true,
      persisted: false,
    });
    await flushPendingWork();
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('shares failures across duplicate callers and clears stale in-flight state after rejection', async () => {
    const cache = createTestTranslationCache();
    const sourceHash = 'paragraph-hash';
    const deferred = createDeferred<string>();
    const error = new Error('provider failed');
    const provider = vi.fn(() => deferred.promise);

    const first = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });
    const second = cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });

    await flushPendingWork();
    expect(provider).toHaveBeenCalledTimes(1);

    deferred.reject(error);

    const [firstResult, secondResult] = await Promise.allSettled([first, second]);

    expect(firstResult).toEqual({
      status: 'rejected',
      reason: error,
    });
    expect(secondResult).toEqual(firstResult);
    expect(await cache.get(sourceHash)).toBeNull();

    provider.mockImplementationOnce(() => Promise.resolve('translated after retry'));

    const retry = await cache.getOrLoad(sourceHash, provider, {
      shouldPersist: shouldPersistTranslation,
    });

    expect(retry).toEqual({
      value: 'translated after retry',
      cacheHit: false,
      persisted: true,
    });
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
