import { afterEach, describe, expect, it } from 'vitest';
import {
  applyModeState,
  getStoredModeState,
  initModeState,
  persistModeState,
  resolveModeState,
} from '../../lib/pickup/content/mode-state';

type GlobalDocumentWindowScope = typeof globalThis & {
  window?: Window;
  document?: Document;
};

type ModeValue = 'default' | 'on' | 'off';

const scope = globalThis as GlobalDocumentWindowScope;
const originalWindow = scope.window;
const originalDocument = scope.document;
const GLOBAL_MODE_KEY = '__modeStateTestKey';

const modeConfig = {
  globalKey: GLOBAL_MODE_KEY,
  storageKey: 'mode-state-test-storage-key',
  datasetKey: 'modeStateTestDataset',
  defaultValue: 'default' as ModeValue,
  normalize: (value: unknown): ModeValue | null => {
    if (value === 'default' || value === 'on' || value === 'off') {
      return value;
    }
    return null;
  },
};

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key) ?? null : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function setupDomAndStorage() {
  const storage = createMemoryStorage();
  const windowStub = { localStorage: storage } as unknown as Window;
  const documentStub = {
    documentElement: {
      dataset: {} as Record<string, string>,
    },
  } as unknown as Document;

  Object.defineProperty(scope, 'window', {
    value: windowStub,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(scope, 'document', {
    value: documentStub,
    configurable: true,
    writable: true,
  });

  return {
    storage,
    dataset: (documentStub.documentElement as HTMLElement).dataset as Record<string, string>,
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)[GLOBAL_MODE_KEY];
  Object.defineProperty(scope, 'window', {
    value: originalWindow,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(scope, 'document', {
    value: originalDocument,
    configurable: true,
    writable: true,
  });
});

describe('内容模式状态管理', () => {
  it('resolves from global cache before localStorage', () => {
    const { storage } = setupDomAndStorage();
    storage.setItem(modeConfig.storageKey, 'off');
    (globalThis as Record<string, unknown>)[GLOBAL_MODE_KEY] = 'on';

    expect(resolveModeState(modeConfig)).toBe('on');
  });

  it('resolves from localStorage when global cache is invalid', () => {
    const { storage } = setupDomAndStorage();
    storage.setItem(modeConfig.storageKey, 'off');
    (globalThis as Record<string, unknown>)[GLOBAL_MODE_KEY] = 'invalid';

    expect(resolveModeState(modeConfig)).toBe('off');
  });

  it('persists global cache and serialized storage value', () => {
    const { storage } = setupDomAndStorage();
    const config = {
      ...modeConfig,
      serialize: (value: ModeValue) => `mode:${value}`,
    };

    persistModeState(config, 'on');

    expect((globalThis as Record<string, unknown>)[GLOBAL_MODE_KEY]).toBe('on');
    expect(storage.getItem(modeConfig.storageKey)).toBe('mode:on');
  });

  it('applies mode into dataset with custom formatter', () => {
    const { dataset } = setupDomAndStorage();
    const config = {
      ...modeConfig,
      toDatasetValue: (value: ModeValue) => value.toUpperCase(),
    };

    applyModeState(config, 'off');

    expect(dataset[modeConfig.datasetKey]).toBe('OFF');
  });

  it('initializes mode by resolving and applying dataset', () => {
    const { storage, dataset } = setupDomAndStorage();
    storage.setItem(modeConfig.storageKey, 'on');

    const value = initModeState(modeConfig);

    expect(value).toBe('on');
    expect(dataset[modeConfig.datasetKey]).toBe('on');
  });

  it('reads stored mode and returns null for invalid data', () => {
    const { storage } = setupDomAndStorage();
    storage.setItem(modeConfig.storageKey, 'invalid');
    expect(getStoredModeState(modeConfig)).toBeNull();

    storage.setItem(modeConfig.storageKey, 'off');
    expect(getStoredModeState(modeConfig)).toBe('off');
  });
});
