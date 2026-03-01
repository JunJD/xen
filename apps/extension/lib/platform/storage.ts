type StorageAreaName = 'local' | 'sync' | 'session';

type GlobalWithBrowserStorage = typeof globalThis & {
  browser?: {
    storage?: ChromeStorageLike;
  };
};

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return Boolean(
    value
    && typeof value === 'object'
    && 'then' in (value as Record<string, unknown>)
    && typeof (value as { then?: unknown }).then === 'function',
  );
}

function withSingleResolve<T>(
  resolve: (value: T) => void,
  reject: (reason?: unknown) => void,
) {
  let settled = false;
  return {
    resolve(value: T) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
    },
    reject(reason?: unknown) {
      if (settled) {
        return;
      }
      settled = true;
      reject(reason);
    },
  };
}

export function getStorageArea(areaName: StorageAreaName = 'local'): ChromeStorageAreaLike | null {
  const chromeStorage = chrome?.storage;
  if (chromeStorage?.[areaName]) {
    return chromeStorage[areaName] ?? null;
  }

  const browserStorage = (globalThis as GlobalWithBrowserStorage).browser?.storage;
  return browserStorage?.[areaName] ?? null;
}

export async function storageGet<T = unknown>(
  key: string,
  areaName: StorageAreaName = 'local',
): Promise<T | undefined> {
  const storage = getStorageArea(areaName);
  if (!storage?.get) {
    throw new Error('Storage unavailable.');
  }

  return new Promise<T | undefined>((resolve, reject) => {
    const once = withSingleResolve(resolve, reject);

    try {
      const result = storage.get!([key], (items) => {
        once.resolve(items?.[key] as T | undefined);
      });

      if (isPromiseLike<Record<string, unknown>>(result)) {
        result
          .then(items => once.resolve(items?.[key] as T | undefined))
          .catch(error => once.reject(error));
      }
    } catch (error) {
      once.reject(error);
    }
  });
}

export async function storageSet(
  key: string,
  value: unknown,
  areaName: StorageAreaName = 'local',
): Promise<void> {
  const storage = getStorageArea(areaName);
  if (!storage?.set) {
    throw new Error('Storage unavailable.');
  }

  return new Promise<void>((resolve, reject) => {
    const once = withSingleResolve(resolve, reject);

    try {
      const result = storage.set!({ [key]: value }, () => {
        once.resolve();
      });

      if (isPromiseLike<void>(result)) {
        result.then(() => once.resolve()).catch(error => once.reject(error));
      }
    } catch (error) {
      once.reject(error);
    }
  });
}
