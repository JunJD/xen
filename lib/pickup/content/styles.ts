import { STYLE_ID } from './constants';

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

const THEME_DATASET_KEY = 'xenPickupTheme';
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
    }
    :root[data-xen-pickup-theme="dark"] {
      --xen-pickup-loading-outline: rgba(148, 163, 184, 0.55);
      --xen-pickup-loading-bg: linear-gradient(120deg, rgba(15, 23, 42, 0.88) 0%, rgba(59, 130, 246, 0.22) 45%, rgba(15, 23, 42, 0.88) 80%);
      --xen-pickup-loading-glow-weak: rgba(59, 130, 246, 0.1);
      --xen-pickup-loading-glow-strong: rgba(59, 130, 246, 0.26);
      --xen-pickup-error-outline: rgba(248, 113, 113, 0.7);
      --xen-pickup-error-bg: rgba(127, 29, 29, 0.25);
      --xen-pickup-annotated-outline: rgba(56, 189, 248, 0.25);
    }
    .xen-pickup-token {
      display: inline;
      color: inherit;
      font: inherit;
      line-height: inherit;
      text-decoration-line: underline;
      text-decoration-color: var(--xen-pickup-accent, #2563eb);
      text-decoration-thickness: 2px;
      text-underline-offset: 2px;
      background-color: var(--xen-pickup-soft-bg, rgba(37, 99, 235, 0.12));
      border-radius: 2px;
      transition: background-color 0.15s ease;
    }
    .xen-pickup-token[data-pickup-category="grammar"] {
      --xen-pickup-accent: #2563eb;
      --xen-pickup-soft-bg: rgba(37, 99, 235, 0.12);
    }
    .xen-pickup-token[data-pickup-category="vocabulary"] {
      --xen-pickup-accent: #059669;
      --xen-pickup-soft-bg: rgba(5, 150, 105, 0.12);
    }
    .xen-pickup-token:hover {
      filter: brightness(0.98);
    }
    .xen-pickup-token[data-pickup-active="true"] {
      outline: 1px solid var(--xen-pickup-accent, #2563eb);
      outline-offset: 1px;
      border-radius: 3px;
    }
    [data-pickup-annotated="true"] {
      outline: 1px dotted var(--xen-pickup-annotated-outline, rgba(14, 116, 144, 0.25));
      outline-offset: 2px;
      border-radius: 4px;
    }
    .tippy-box {
      position: relative;
      outline: 0;
    }
    .tippy-content {
      position: relative;
      z-index: 1;
    }
    .tippy-box[data-theme~="xen-pickup"] {
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
      pointer-events: none;
    }
    .tippy-box[data-theme~="xen-pickup"] .tippy-content {
      padding: 6px 8px;
    }
    [data-pickup-status="loading"] {
      position: relative;
      outline: 1px dashed var(--xen-pickup-loading-outline, #cfd8dc);
      background: var(
        --xen-pickup-loading-bg,
        linear-gradient(120deg, #ffffff 0%, #e6f0ff 40%, #ffffff 80%)
      );
      background-size: 200% 100%;
      animation: xen-pickup-pulse 1.2s ease-in-out infinite,
        xen-pickup-glow 2.4s ease-in-out infinite;
    }
    [data-pickup-status="error"] {
      outline: 1px dashed var(--xen-pickup-error-outline, #ff4b4b);
      background: var(--xen-pickup-error-bg, #fff7f7);
    }
    @keyframes xen-pickup-pulse {
      0% {
        background-position: 0% 50%;
      }
      100% {
        background-position: 200% 50%;
      }
    }
    @keyframes xen-pickup-glow {
      0% {
        box-shadow: 0 0 0 var(--xen-pickup-loading-glow-weak, rgba(0, 67, 255, 0.12));
      }
      50% {
        box-shadow: 0 0 12px var(--xen-pickup-loading-glow-strong, rgba(0, 67, 255, 0.28));
      }
      100% {
        box-shadow: 0 0 0 var(--xen-pickup-loading-glow-weak, rgba(0, 67, 255, 0.12));
      }
    }
  `;
    document.head.appendChild(style);
  }

  applyPickupTheme();
  ensurePickupThemeObserver();
}
