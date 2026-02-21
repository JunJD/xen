import type { PickupSettings } from '@/lib/pickup/settings';

const STYLE_DATASET_KEY = 'xenPickupStyle';
const TRANSLATION_BLUR_DATASET_KEY = 'xenPickupTranslationBlur';
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
  const blurFlag = settings.translationBlurEnabled ? 'true' : 'false';
  if (root.dataset[TRANSLATION_BLUR_DATASET_KEY] !== blurFlag) {
    root.dataset[TRANSLATION_BLUR_DATASET_KEY] = blurFlag;
  }
  const highlightOpacity = clampOpacity(settings.highlightOpacity);
  root.style.setProperty(HIGHLIGHT_OPACITY_VAR, `${highlightOpacity}%`);
  const underlineOpacity = clampOpacity(Math.max(30, Math.min(100, highlightOpacity + 20)));
  root.style.setProperty(UNDERLINE_OPACITY_VAR, `${underlineOpacity}%`);
}
