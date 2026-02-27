import type { PickupSettings } from '@/lib/pickup/settings';
import { syncPickupTokenHostStates } from './web-components';

const ANNOTATION_STYLE_DATASET_KEY = 'xenPickupAnnotationStyle';
const HIGHLIGHT_STYLE_DATASET_KEY = 'xenPickupHighlightStyle';
const TRANSLATION_BLUR_DATASET_KEY = 'xenPickupTranslationBlur';
const WORD_LINE_DATASET_KEY = 'xenPickupWordLineEnabled';
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
  if (root.dataset[ANNOTATION_STYLE_DATASET_KEY] !== settings.annotationStyle) {
    root.dataset[ANNOTATION_STYLE_DATASET_KEY] = settings.annotationStyle;
  }
  if (root.dataset[HIGHLIGHT_STYLE_DATASET_KEY] !== settings.highlightStyle) {
    root.dataset[HIGHLIGHT_STYLE_DATASET_KEY] = settings.highlightStyle;
  }
  const blurFlag = settings.translationBlurEnabled ? 'true' : 'false';
  if (root.dataset[TRANSLATION_BLUR_DATASET_KEY] !== blurFlag) {
    root.dataset[TRANSLATION_BLUR_DATASET_KEY] = blurFlag;
  }
  if (root.dataset[WORD_LINE_DATASET_KEY] !== 'true') {
    root.dataset[WORD_LINE_DATASET_KEY] = 'true';
  }
  const highlightOpacity = clampOpacity(settings.highlightOpacity);
  root.style.setProperty(HIGHLIGHT_OPACITY_VAR, `${highlightOpacity}%`);
  const underlineOpacity = clampOpacity(Math.max(30, Math.min(100, highlightOpacity + 20)));
  root.style.setProperty(UNDERLINE_OPACITY_VAR, `${underlineOpacity}%`);
  syncPickupTokenHostStates();
}
