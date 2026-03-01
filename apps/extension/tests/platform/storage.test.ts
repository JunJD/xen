import { afterEach, describe, expect, it, vi } from 'vitest';
import { getStorageArea, storageGet, storageSet } from '../../lib/platform/storage';

type GlobalStorageScope = typeof globalThis & {
  chrome?: ChromeLike;
  browser?: {
    storage?: ChromeStorageLike;
  };
};

const scope = globalThis as GlobalStorageScope;
const originalChrome = scope.chrome;
const originalBrowser = scope.browser;

afterEach(() => {
  scope.chrome = originalChrome;
  scope.browser = originalBrowser;
  vi.restoreAllMocks();
});

describe('平台存储适配层', () => {
  it('prefers chrome storage area when available', () => {
    const chromeLocal: ChromeStorageAreaLike = {};
    const browserLocal: ChromeStorageAreaLike = {};
    scope.chrome = { storage: { local: chromeLocal } };
    scope.browser = { storage: { local: browserLocal } };

    expect(getStorageArea()).toBe(chromeLocal);
  });

  it('falls back to browser storage area when chrome is missing', () => {
    const browserLocal: ChromeStorageAreaLike = {};
    scope.chrome = undefined;
    scope.browser = { storage: { local: browserLocal } };

    expect(getStorageArea()).toBe(browserLocal);
  });

  it('reads values from callback-style storage API', async () => {
    const chromeLocal: ChromeStorageAreaLike = {
      get: (_keys, callback) => {
        callback?.({ answer: 123 });
      },
    };
    scope.chrome = { storage: { local: chromeLocal } };

    await expect(storageGet<number>('answer')).resolves.toBe(123);
  });

  it('reads values from promise-style storage API', async () => {
    const chromeLocal: ChromeStorageAreaLike = {
      get: () => Promise.resolve({ answer: 456 }),
    };
    scope.chrome = { storage: { local: chromeLocal } };

    await expect(storageGet<number>('answer')).resolves.toBe(456);
  });

  it('writes values through callback-style storage API', async () => {
    const set = vi.fn((_items: Record<string, unknown>, callback?: () => void) => {
      callback?.();
    });
    const chromeLocal: ChromeStorageAreaLike = { set };
    scope.chrome = { storage: { local: chromeLocal } };

    await storageSet('greeting', 'hello');

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ greeting: 'hello' }, expect.any(Function));
  });

  it('writes values through promise-style storage API', async () => {
    const set = vi.fn((_items: Record<string, unknown>) => Promise.resolve());
    const chromeLocal: ChromeStorageAreaLike = { set };
    scope.chrome = { storage: { local: chromeLocal } };

    await storageSet('greeting', 'hello');

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith({ greeting: 'hello' }, expect.any(Function));
  });

  it('throws when no storage backend exists', async () => {
    scope.chrome = undefined;
    scope.browser = undefined;

    await expect(storageGet('missing')).rejects.toThrow('Storage unavailable.');
    await expect(storageSet('missing', 'value')).rejects.toThrow('Storage unavailable.');
  });
});
