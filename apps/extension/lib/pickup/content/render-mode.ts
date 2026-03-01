import { PICKUP_DATASET_MODE_KEY } from './markers';
import {
  applyModeState,
  getStoredModeState,
  initModeState,
  persistModeState,
  resolveModeState,
} from './mode-state';

export const PICKUP_RENDER_MODE_VOCAB_INFUSION = 'vocab_infusion';
export const PICKUP_RENDER_MODE_SYNTAX_REBUILD = 'syntax_rebuild';

export type PickupRenderMode =
  | typeof PICKUP_RENDER_MODE_VOCAB_INFUSION
  | typeof PICKUP_RENDER_MODE_SYNTAX_REBUILD;

const DEFAULT_RENDER_MODE = PICKUP_RENDER_MODE_VOCAB_INFUSION;

const MODE_STATE_CONFIG = {
  globalKey: '__xenPickupRenderMode',
  storageKey: 'xenPickupRenderMode',
  datasetKey: PICKUP_DATASET_MODE_KEY,
  defaultValue: DEFAULT_RENDER_MODE as PickupRenderMode,
  normalize: (value: unknown): PickupRenderMode | null => (isPickupRenderMode(value) ? value : null),
};

export function resolvePickupRenderMode(): PickupRenderMode {
  return resolveModeState(MODE_STATE_CONFIG);
}

export function getStoredPickupRenderMode(): PickupRenderMode | null {
  return getStoredModeState(MODE_STATE_CONFIG);
}

export function persistPickupRenderMode(mode: PickupRenderMode) {
  persistModeState(MODE_STATE_CONFIG, mode);
}

export function applyPickupRenderMode(mode: PickupRenderMode) {
  applyModeState(MODE_STATE_CONFIG, mode);
}

export function initPickupRenderMode(): PickupRenderMode {
  return initModeState(MODE_STATE_CONFIG);
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
