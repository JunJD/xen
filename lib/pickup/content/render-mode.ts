export const PICKUP_RENDER_MODE_VOCAB_INFUSION = 'vocab_infusion';
export const PICKUP_RENDER_MODE_SYNTAX_REBUILD = 'syntax_rebuild';

export type PickupRenderMode =
  | typeof PICKUP_RENDER_MODE_VOCAB_INFUSION
  | typeof PICKUP_RENDER_MODE_SYNTAX_REBUILD;

const DEFAULT_RENDER_MODE = PICKUP_RENDER_MODE_SYNTAX_REBUILD;
const GLOBAL_MODE_KEY = '__xenPickupRenderMode';
const STORAGE_KEY = 'xenPickupRenderMode';
const DATASET_KEY = 'xenPickupMode';

type GlobalWithPickupMode = typeof globalThis & {
  __xenPickupRenderMode?: unknown;
};

export function resolvePickupRenderMode(): PickupRenderMode {
  if (typeof globalThis === 'undefined') {
    return DEFAULT_RENDER_MODE;
  }

  const scope = globalThis as GlobalWithPickupMode;
  const cached = scope[GLOBAL_MODE_KEY];
  if (cached === PICKUP_RENDER_MODE_VOCAB_INFUSION || cached === PICKUP_RENDER_MODE_SYNTAX_REBUILD) {
    return cached;
  }

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    if (stored === PICKUP_RENDER_MODE_VOCAB_INFUSION || stored === PICKUP_RENDER_MODE_SYNTAX_REBUILD) {
      return stored;
    }
  } catch {
    // Ignore storage access issues in restricted contexts.
  }

  return DEFAULT_RENDER_MODE;
}

export function persistPickupRenderMode(mode: PickupRenderMode) {
  if (typeof globalThis === 'undefined') {
    return;
  }

  const scope = globalThis as GlobalWithPickupMode;
  scope[GLOBAL_MODE_KEY] = mode;

  try {
    window.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage access issues in restricted contexts.
  }
}

export function applyPickupRenderMode(mode: PickupRenderMode) {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  if (root.dataset[DATASET_KEY] !== mode) {
    root.dataset[DATASET_KEY] = mode;
  }
}

export function initPickupRenderMode(): PickupRenderMode {
  const mode = resolvePickupRenderMode();
  applyPickupRenderMode(mode);
  return mode;
}

export function togglePickupRenderMode(current?: PickupRenderMode): PickupRenderMode {
  const mode = current ?? resolvePickupRenderMode();
  return mode === PICKUP_RENDER_MODE_VOCAB_INFUSION
    ? PICKUP_RENDER_MODE_SYNTAX_REBUILD
    : PICKUP_RENDER_MODE_VOCAB_INFUSION;
}

export function isPickupRenderMode(value: unknown): value is PickupRenderMode {
  return value === PICKUP_RENDER_MODE_VOCAB_INFUSION || value === PICKUP_RENDER_MODE_SYNTAX_REBUILD;
}
