import type { PickupSettings } from '@/lib/pickup/settings';
import {
  PICKUP_DATASET_ANNOTATION_STYLE_KEY as ANNOTATION_STYLE_DATASET_KEY,
  PICKUP_DATASET_HIGHLIGHT_STYLE_KEY as HIGHLIGHT_STYLE_DATASET_KEY,
  PICKUP_DATASET_TRANSLATION_BLUR_KEY as TRANSLATION_BLUR_DATASET_KEY,
  PICKUP_HIGHLIGHT_OPACITY_CSS_VAR as HIGHLIGHT_OPACITY_VAR,
  PICKUP_UNDERLINE_OPACITY_CSS_VAR as UNDERLINE_OPACITY_VAR,
} from './markers';
import { syncPickupTokenHostStates } from './web-components';

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
  const highlightOpacity = clampOpacity(settings.highlightOpacity);
  root.style.setProperty(HIGHLIGHT_OPACITY_VAR, `${highlightOpacity}%`);
  const underlineOpacity = clampOpacity(Math.max(30, Math.min(100, highlightOpacity + 20)));
  root.style.setProperty(UNDERLINE_OPACITY_VAR, `${underlineOpacity}%`);
  syncPickupTokenHostStates();
}
