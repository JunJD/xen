export const DEFAULT_AST_ADAPTER_ID = 'spacy-rules';
const GLOBAL_ADAPTER_KEY = '__xenPickupAstAdapter';
const STORAGE_KEY = 'xenPickupAstAdapter';

type GlobalWithAdapter = typeof globalThis & {
  __xenPickupAstAdapter?: unknown;
};

export function resolveAstAdapterId(): string {
  if (typeof globalThis === 'undefined') {
    return DEFAULT_AST_ADAPTER_ID;
  }

  const scope = globalThis as GlobalWithAdapter;
  if (typeof scope[GLOBAL_ADAPTER_KEY] === 'string') {
    return scope[GLOBAL_ADAPTER_KEY] as string;
  }

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored) {
      return stored;
    }
  }
  catch {
    // Ignore storage access issues in restricted contexts.
  }

  return DEFAULT_AST_ADAPTER_ID;
}

export function persistAstAdapterId(adapterId: string) {
  if (typeof globalThis === 'undefined') {
    return;
  }

  const scope = globalThis as GlobalWithAdapter;
  scope[GLOBAL_ADAPTER_KEY] = adapterId;

  try {
    window.localStorage?.setItem(STORAGE_KEY, adapterId);
  }
  catch {
    // Ignore storage access issues in restricted contexts.
  }
}
