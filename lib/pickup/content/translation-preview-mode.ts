const DEFAULT_TRANSLATION_PREVIEW_ENABLED = false;
const GLOBAL_KEY = '__xenPickupTranslationPreviewEnabled';
const STORAGE_KEY = 'xenPickupTranslationPreviewEnabled';
const DATASET_KEY = 'xenPickupTranslationLineEnabled';

type GlobalWithTranslationPreview = typeof globalThis & {
  __xenPickupTranslationPreviewEnabled?: unknown;
};

function normalizeTranslationPreviewEnabled(value: unknown): boolean | null {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return null;
}

export function resolvePickupTranslationPreviewEnabled() {
  if (typeof globalThis === 'undefined') {
    return DEFAULT_TRANSLATION_PREVIEW_ENABLED;
  }

  const scope = globalThis as GlobalWithTranslationPreview;
  const globalValue = normalizeTranslationPreviewEnabled(scope[GLOBAL_KEY]);
  if (globalValue !== null) {
    return globalValue;
  }

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    const storageValue = normalizeTranslationPreviewEnabled(stored);
    if (storageValue !== null) {
      return storageValue;
    }
  } catch {
    // Ignore storage access issues in restricted contexts.
  }

  return DEFAULT_TRANSLATION_PREVIEW_ENABLED;
}

export function persistPickupTranslationPreviewEnabled(enabled: boolean) {
  if (typeof globalThis === 'undefined') {
    return;
  }

  const scope = globalThis as GlobalWithTranslationPreview;
  scope[GLOBAL_KEY] = enabled;

  try {
    window.localStorage?.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage access issues in restricted contexts.
  }
}

export function applyPickupTranslationPreviewEnabled(enabled: boolean) {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  const datasetValue = enabled ? 'true' : 'false';
  if (root.dataset[DATASET_KEY] !== datasetValue) {
    root.dataset[DATASET_KEY] = datasetValue;
  }
}

export function initPickupTranslationPreviewEnabled() {
  const enabled = resolvePickupTranslationPreviewEnabled();
  applyPickupTranslationPreviewEnabled(enabled);
  return enabled;
}
