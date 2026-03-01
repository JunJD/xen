import { PICKUP_DATASET_TRANSLATION_LINE_ENABLED_KEY } from './markers';
import { applyModeState, initModeState, persistModeState, resolveModeState } from './mode-state';

const DEFAULT_TRANSLATION_PREVIEW_ENABLED = false;

const TRANSLATION_PREVIEW_MODE_CONFIG = {
  globalKey: '__xenPickupTranslationPreviewEnabled',
  storageKey: 'xenPickupTranslationPreviewEnabled',
  datasetKey: PICKUP_DATASET_TRANSLATION_LINE_ENABLED_KEY,
  defaultValue: DEFAULT_TRANSLATION_PREVIEW_ENABLED,
  normalize: normalizeTranslationPreviewEnabled,
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
  return resolveModeState(TRANSLATION_PREVIEW_MODE_CONFIG);
}

export function persistPickupTranslationPreviewEnabled(enabled: boolean) {
  persistModeState(TRANSLATION_PREVIEW_MODE_CONFIG, enabled);
}

export function applyPickupTranslationPreviewEnabled(enabled: boolean) {
  applyModeState(TRANSLATION_PREVIEW_MODE_CONFIG, enabled);
}

export function initPickupTranslationPreviewEnabled() {
  return initModeState(TRANSLATION_PREVIEW_MODE_CONFIG);
}
