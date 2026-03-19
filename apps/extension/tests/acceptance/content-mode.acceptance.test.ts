import { afterEach, expect } from 'vitest';
import {
  applyModeState,
  persistModeState,
  resolveModeState,
} from '../../lib/pickup/content/mode-state';
import { defineFeatureAcceptance } from './bdd-harness';

type GlobalDocumentWindowScope = typeof globalThis & {
  window?: Window;
  document?: Document;
};

type ModeValue = 'default' | 'on' | 'off';

const scope = globalThis as GlobalDocumentWindowScope;
const originalWindow = scope.window;
const originalDocument = scope.document;
const GLOBAL_MODE_KEY = '__acceptanceModeStateTestKey';

const modeConfig = {
  globalKey: GLOBAL_MODE_KEY,
  storageKey: 'acceptance-mode-state-test-storage-key',
  datasetKey: 'acceptanceModeStateTestDataset',
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

defineFeatureAcceptance({
  featurePath: './features/content-mode.feature',
  metaUrl: import.meta.url,
  handlers: {
    'Persisting an explicit content mode': (scenario) => {
      expect(scenario.steps.map((step) => `${step.keyword} ${step.text}`)).toEqual([
        'Given the content page starts in the default mode',
        'When the user switches pickup mode to "on"',
        'Then the active mode is cached globally',
        'And the mode is saved in local storage',
        'And the page dataset reflects "on"',
      ]);

      const { storage, dataset } = setupDomAndStorage();

      expect(resolveModeState(modeConfig)).toBe('default');

      persistModeState(modeConfig, 'on');
      applyModeState(modeConfig, 'on');

      expect((globalThis as Record<string, unknown>)[GLOBAL_MODE_KEY]).toBe('on');
      expect(storage.getItem(modeConfig.storageKey)).toBe('on');
      expect(dataset[modeConfig.datasetKey]).toBe('on');
      expect(resolveModeState(modeConfig)).toBe('on');
    },
  },
});
