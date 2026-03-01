import { STYLE_ID } from './constants';
import {
  PICKUP_DATASET_THEME_KEY as THEME_DATASET_KEY,
  PICKUP_ROLE_BADGE_CLASS,
  PICKUP_ROLE_BADGE_STRUCTURE_CLASS,
  PICKUP_ROLE_BADGE_TOKEN_CLASS,
  PICKUP_ROOT_MODE_ATTR,
  PICKUP_ROOT_THEME_ATTR,
  PICKUP_ROOT_TRANSLATION_BLUR_ATTR,
  PICKUP_ROOT_TRANSLATION_LINE_ENABLED_ATTR,
  PICKUP_TOKEN_TAG,
  PICKUP_TRANSLATION_PARAGRAPH_CLASS,
  PICKUP_TRANSLATION_PARAGRAPH_INLINE_CLASS,
} from './markers';

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';
const THEME_ATTRIBUTE_FILTER = [
  'class',
  'style',
  'data-theme',
  'data-mode',
  'data-color-scheme',
  'data-color-mode',
];

const DARK_BACKGROUND_THRESHOLD = 0.55;
const LIGHT_TEXT_THRESHOLD = 0.65;
const MIN_ALPHA = 0.08;

let themeObserver: MutationObserver | null = null;
let themeMediaQuery: MediaQueryList | null = null;
let themeUpdateTimer: number | undefined;

function parseHexColor(value: string): RgbaColor | null {
  const normalized = value.replace('#', '').trim();
  if (![3, 4, 6, 8].includes(normalized.length)) {
    return null;
  }
  const expanded = normalized.length <= 4
    ? normalized
        .split('')
        .map(char => char + char)
        .join('')
    : normalized;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  const a = expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) || Number.isNaN(a)) {
    return null;
  }
  return { r, g, b, a };
}

function parseRgbColor(value: string): RgbaColor | null {
  const rgbMatch = value.match(/rgba?\((.*)\)/);
  if (!rgbMatch) {
    return null;
  }
  const raw = rgbMatch[1].replace(/\s*\/\s*/g, ',');
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  const toChannel = (input: string, max: number) => {
    if (input.endsWith('%')) {
      const percent = Number.parseFloat(input);
      if (Number.isNaN(percent)) {
        return null;
      }
      return Math.min(max, Math.max(0, (percent / 100) * max));
    }
    const value = Number.parseFloat(input);
    if (Number.isNaN(value)) {
      return null;
    }
    return Math.min(max, Math.max(0, value));
  };
  const r = toChannel(parts[0], 255);
  const g = toChannel(parts[1], 255);
  const b = toChannel(parts[2], 255);
  const a = parts[3] !== undefined ? toChannel(parts[3], 1) : 1;
  if (r === null || g === null || b === null || a === null) {
    return null;
  }
  return { r, g, b, a };
}

function parseColor(value: string): RgbaColor | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  if (normalized.startsWith('#')) {
    return parseHexColor(normalized);
  }
  return parseRgbColor(normalized);
}

function readComputedColor(element: Element | null, property: string): RgbaColor | null {
  if (!element) {
    return null;
  }
  const value = window.getComputedStyle(element).getPropertyValue(property);
  return parseColor(value);
}

function isVisibleColor(color: RgbaColor | null): color is RgbaColor {
  return Boolean(color && color.a > MIN_ALPHA);
}

function brightness(color: RgbaColor) {
  return (color.r * 299 + color.g * 587 + color.b * 114) / 255000;
}

function detectDarkBackground() {
  const bodyBackground = readComputedColor(document.body, 'background-color');
  if (isVisibleColor(bodyBackground)) {
    return brightness(bodyBackground) < DARK_BACKGROUND_THRESHOLD;
  }
  const rootBackground = readComputedColor(document.documentElement, 'background-color');
  if (isVisibleColor(rootBackground)) {
    return brightness(rootBackground) < DARK_BACKGROUND_THRESHOLD;
  }
  const bodyText = readComputedColor(document.body, 'color');
  if (isVisibleColor(bodyText)) {
    return brightness(bodyText) > LIGHT_TEXT_THRESHOLD;
  }
  const rootText = readComputedColor(document.documentElement, 'color');
  if (isVisibleColor(rootText)) {
    return brightness(rootText) > LIGHT_TEXT_THRESHOLD;
  }
  return false;
}

function applyPickupTheme() {
  const root = document.documentElement;
  if (!root) {
    return;
  }
  const theme = detectDarkBackground() ? THEME_DARK : THEME_LIGHT;
  if (root.dataset[THEME_DATASET_KEY] !== theme) {
    root.dataset[THEME_DATASET_KEY] = theme;
  }
}


function schedulePickupThemeUpdate() {
  if (themeUpdateTimer !== undefined) {
    return;
  }
  themeUpdateTimer = window.setTimeout(() => {
    themeUpdateTimer = undefined;
    applyPickupTheme();
  }, 80);
}

function ensurePickupThemeObserver() {
  if (themeObserver) {
    return;
  }
  themeObserver = new MutationObserver(() => {
    schedulePickupThemeUpdate();
  });
  if (document.documentElement) {
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: THEME_ATTRIBUTE_FILTER,
    });
  }
  if (document.body) {
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: THEME_ATTRIBUTE_FILTER,
    });
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        if (document.body) {
          themeObserver?.observe(document.body, {
            attributes: true,
            attributeFilter: THEME_ATTRIBUTE_FILTER,
          });
        }
        schedulePickupThemeUpdate();
      },
      { once: true },
    );
  }
  if (window.matchMedia) {
    themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    themeMediaQuery.addEventListener('change', schedulePickupThemeUpdate);
  }
}

export function ensurePickupStyles() {
  const existingStyle = document.getElementById(STYLE_ID);
  if (!existingStyle) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
    :root {
      --xen-pickup-loading-outline: #cfd8dc;
      --xen-pickup-loading-bg: linear-gradient(120deg, #ffffff 0%, #e6f0ff 40%, #ffffff 80%);
      --xen-pickup-loading-glow-weak: rgba(0, 67, 255, 0.12);
      --xen-pickup-loading-glow-strong: rgba(0, 67, 255, 0.28);
      --xen-pickup-error-outline: #ff4b4b;
      --xen-pickup-error-bg: #fff7f7;
      --xen-pickup-annotated-outline: rgba(14, 116, 144, 0.25);
      --xen-pickup-highlight-opacity: 45%;
      --xen-pickup-underline-opacity: 85%;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] {
      --xen-pickup-loading-outline: rgba(148, 163, 184, 0.55);
      --xen-pickup-loading-bg: linear-gradient(120deg, rgba(15, 23, 42, 0.88) 0%, rgba(59, 130, 246, 0.22) 45%, rgba(15, 23, 42, 0.88) 80%);
      --xen-pickup-loading-glow-weak: rgba(59, 130, 246, 0.1);
      --xen-pickup-loading-glow-strong: rgba(59, 130, 246, 0.26);
      --xen-pickup-error-outline: rgba(248, 113, 113, 0.7);
      --xen-pickup-error-bg: rgba(127, 29, 29, 0.25);
      --xen-pickup-annotated-outline: rgba(56, 189, 248, 0.25);
    }
    ${PICKUP_TOKEN_TAG} {
      display: inline;
      color: inherit;
      font: inherit;
      line-height: inherit;
    }
    .${PICKUP_TRANSLATION_PARAGRAPH_CLASS} {
      display: block;
      margin-top: 4px;
      line-height: 1.45;
      color: color-mix(in srgb, currentColor 76%, transparent);
      font-size: 0.95em;
    }
    .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}.${PICKUP_TRANSLATION_PARAGRAPH_INLINE_CLASS} {
      display: inline;
      margin-top: 0;
      margin-left: 0.4em;
      vertical-align: baseline;
    }
    :root[${PICKUP_ROOT_TRANSLATION_LINE_ENABLED_ATTR}="false"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS} {
      display: none;
    }
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS} {
      position: relative;
      filter: blur(4px) saturate(0.6) grayscale(0.28);
      opacity: 0.6;
      transition: filter 0.18s ease, opacity 0.18s ease;
    }
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}::after {
      content: '';
      position: absolute;
      inset: -1px -2px;
      pointer-events: none;
      border-radius: 4px;
      opacity: 0.9;
      background: linear-gradient(120deg,
        color-mix(in srgb, var(--xen-pickup-soft-bg, rgba(248, 250, 252, 0.88)) 68%, transparent),
        color-mix(in srgb, var(--xen-pickup-soft-bg, rgba(248, 250, 252, 0.88)) 78%, transparent));
      backdrop-filter: blur(8px) saturate(0.7);
      -webkit-backdrop-filter: blur(8px) saturate(0.7);
      transition: opacity 0.18s ease;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"][${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}::after {
      background: linear-gradient(120deg,
        color-mix(in srgb, rgba(15, 23, 42, 0.82) 68%, transparent),
        color-mix(in srgb, rgba(15, 23, 42, 0.86) 78%, transparent));
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS} {
        filter: blur(4.5px) saturate(0.55);
        opacity: 0.55;
      }
    }
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}:hover,
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}:focus-within {
      filter: none;
      opacity: 1;
    }
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}:hover::after,
    :root[${PICKUP_ROOT_TRANSLATION_BLUR_ATTR}="true"] .${PICKUP_TRANSLATION_PARAGRAPH_CLASS}:focus-within::after {
      opacity: 0;
    }
    :root[${PICKUP_ROOT_MODE_ATTR}="vocab_infusion"] .${PICKUP_ROLE_BADGE_CLASS} {
      display: none;
    }
    .${PICKUP_ROLE_BADGE_CLASS} {
      margin-left: 2px;
      font-size: 0.58em;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: rgba(71, 85, 105, 0.82);
      vertical-align: super;
      cursor: help;
    }
    .${PICKUP_ROLE_BADGE_CLASS}.${PICKUP_ROLE_BADGE_STRUCTURE_CLASS} {
      color: rgba(14, 116, 144, 0.9);
      font-weight: 700;
    }
    .${PICKUP_ROLE_BADGE_CLASS}.${PICKUP_ROLE_BADGE_TOKEN_CLASS} {
      color: rgba(71, 85, 105, 0.72);
      font-weight: 600;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .${PICKUP_ROLE_BADGE_CLASS} {
      color: rgba(226, 232, 240, 0.78);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .${PICKUP_ROLE_BADGE_CLASS}.${PICKUP_ROLE_BADGE_STRUCTURE_CLASS} {
      color: rgba(56, 189, 248, 0.9);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .${PICKUP_ROLE_BADGE_CLASS}.${PICKUP_ROLE_BADGE_TOKEN_CLASS} {
      color: rgba(226, 232, 240, 0.68);
    }
    [data-pickup-annotated="true"] {
      outline: none;
    }
    .tippy-box {
      position: relative;
      outline: 0;
    }
    .tippy-content {
      position: relative;
      z-index: 1;
    }
    .xen-pickup-tooltip {
      width: min(304px, 72vw);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .xen-pickup-tooltip-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .xen-pickup-tooltip-title-wrap {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .xen-pickup-tooltip-line {
      max-width: 100%;
      white-space: pre-line;
      overflow: visible;
      text-overflow: clip;
    }
    .xen-pickup-tooltip-line-main {
      font-size: 31px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #2f2a24;
      text-transform: none;
    }
    .xen-pickup-tooltip-line-phone {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 12px;
      line-height: 1.2;
      color: #5f5243;
    }
    .xen-pickup-tooltip-phone-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 8px;
      border: 1px solid #e6dac8;
      background: #f3eee6;
      padding: 2px 6px;
    }
    .xen-pickup-tooltip-phone-region {
      font-weight: 600;
      color: #685948;
    }
    .xen-pickup-tooltip-phone-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      letter-spacing: 0.01em;
      color: #4a3f34;
    }
    .xen-pickup-tooltip-divider {
      height: 1px;
      background: linear-gradient(90deg, #ff8d2b 0%, rgba(255, 141, 43, 0.26) 100%);
    }
    .xen-pickup-tooltip-line-desc {
      font-size: 14px;
      line-height: 1.55;
      color: #2d2a26;
      white-space: pre-wrap;
    }
    .xen-pickup-tooltip-line-words {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }
    .xen-pickup-tooltip-word {
      display: inline-flex;
      align-items: center;
      border-radius: 8px;
      border: 1px solid #e7ddcf;
      background: #f8f4ed;
      color: #6b5b49;
      font-size: 12px;
      line-height: 1.2;
      padding: 3px 8px;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      cursor: default;
    }
    .xen-pickup-tooltip-word:hover {
      background: #fff1e3;
      border-color: rgba(255, 122, 0, 0.52);
      color: #b44a00;
      transform: translateY(-1px);
    }
    .xen-pickup-tooltip-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      pointer-events: auto;
    }
    .xen-pickup-tooltip-action {
      border: 1px solid #d9d2c6;
      border-radius: 999px;
      width: 22px;
      height: 22px;
      padding: 0;
      font: inherit;
      font-size: 11px;
      line-height: 1;
      font-weight: 600;
      color: #6d5f50;
      background: rgba(255, 255, 255, 0.82);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
    }
    .xen-pickup-tooltip-action:hover {
      border-color: rgba(255, 122, 0, 0.46);
      color: #b44a00;
      background: #fff3e8;
    }
    .xen-pickup-tooltip-action:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .xen-pickup-tooltip-action[data-pickup-active="true"] {
      color: #fff7ef;
      border-color: #ff8d2b;
      background: linear-gradient(180deg, #ff9b47 0%, #ff7a00 100%);
    }
    .tippy-box[data-theme~="xen-pickup"] {
      background: #f5f1e9;
      color: #2d2a26;
      border: 1px solid #e7ddce;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.45;
      box-shadow: 0 12px 34px rgba(84, 60, 27, 0.16);
      pointer-events: auto;
    }
    .tippy-box[data-theme~="xen-pickup"] .tippy-content {
      padding: 10px 12px;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .tippy-box[data-theme~="xen-pickup"] {
      background: #1f2430;
      color: #e2e8f0;
      border-color: rgba(226, 232, 240, 0.18);
      box-shadow: 0 14px 36px rgba(2, 6, 23, 0.45);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-line-main {
      color: #f8fafc;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-line-desc {
      color: rgba(241, 245, 249, 0.94);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-line-phone {
      color: rgba(226, 232, 240, 0.86);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-phone-chip {
      border-color: rgba(226, 232, 240, 0.2);
      background: rgba(148, 163, 184, 0.18);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-phone-region {
      color: rgba(248, 250, 252, 0.92);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-phone-value {
      color: rgba(226, 232, 240, 0.9);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-divider {
      background: linear-gradient(90deg, rgba(255, 149, 64, 0.95) 0%, rgba(255, 149, 64, 0.24) 100%);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-word {
      border-color: rgba(255, 170, 96, 0.36);
      background: rgba(255, 170, 96, 0.14);
      color: rgba(255, 229, 198, 0.95);
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-word:hover {
      border-color: rgba(255, 170, 96, 0.62);
      background: rgba(255, 170, 96, 0.24);
      color: #fff4e8;
    }
    :root[${PICKUP_ROOT_THEME_ATTR}="${THEME_DARK}"] .xen-pickup-tooltip-action {
      border-color: rgba(226, 232, 240, 0.22);
      color: rgba(226, 232, 240, 0.9);
      background: rgba(148, 163, 184, 0.2);
    }
    [data-pickup-status="loading"] {
      position: relative;
      outline: none;
      background: transparent;
      animation: none;
    }
    [data-pickup-status="loading"]::after {
      content: '';
      display: inline-block;
      margin-left: 6px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      border: 2px solid color-mix(in srgb, var(--xen-pickup-spinner-color, var(--action-link, #0043ff)) 25%, transparent);
      border-top-color: var(--xen-pickup-spinner-color, var(--action-link, #0043ff));
      border-right-color: color-mix(in srgb, var(--xen-pickup-spinner-color, var(--action-link, #0043ff)) 60%, transparent);
      opacity: 0.8;
      animation: xen-pickup-loading-spin 0.8s linear infinite;
    }
    @keyframes xen-pickup-loading-spin {
      to { transform: rotate(360deg); }
    }
    [data-pickup-status="error"] {
      outline: 1px dashed var(--xen-pickup-error-outline, #ff4b4b);
      background: var(--xen-pickup-error-bg, #fff7f7);
    }
  `;
    document.head.appendChild(style);
  }

  applyPickupTheme();
  ensurePickupThemeObserver();
}
