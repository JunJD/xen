import type { PickupSettings } from '@/lib/pickup/settings';

const STYLE_DATASET_KEY = 'xenPickupStyle';
const HIGHLIGHT_OPACITY_VAR = '--xen-pickup-highlight-opacity';
const UNDERLINE_OPACITY_VAR = '--xen-pickup-underline-opacity';

function clampOpacity(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function applyPickupStyleSettings(settings: PickupSettings) {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (!root) {
    return;
  }
  if (root.dataset[STYLE_DATASET_KEY] !== settings.stylePreset) {
    root.dataset[STYLE_DATASET_KEY] = settings.stylePreset;
  }
  const highlightOpacity = clampOpacity(settings.highlightOpacity);
  root.style.setProperty(HIGHLIGHT_OPACITY_VAR, `${highlightOpacity}%`);
  const underlineOpacity = clampOpacity(Math.max(30, Math.min(100, highlightOpacity + 20)));
  root.style.setProperty(UNDERLINE_OPACITY_VAR, `${underlineOpacity}%`);
}
