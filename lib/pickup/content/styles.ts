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
      --xen-pickup-highlight-opacity: 45%;
      --xen-pickup-underline-opacity: 85%;
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
      text-decoration-style: dashed;
      text-decoration-color: color-mix(in srgb, var(--xen-pickup-accent, #415ccc) var(--xen-pickup-underline-opacity, 85%), transparent);
      text-decoration-thickness: 1.5px;
      text-underline-offset: 2px;
      background-color: color-mix(in srgb, var(--xen-pickup-soft-bg, transparent) var(--xen-pickup-highlight-opacity, 45%), transparent);
      border-radius: 0;
      transition: text-decoration-color 0.15s ease, text-decoration-thickness 0.15s ease;
    }
    :root[data-xen-pickup-style="underline"] .xen-pickup-token {
      background-color: transparent;
    }
    :root[data-xen-pickup-style="soft-bg"] .xen-pickup-token {
      text-decoration-line: none;
    }
    :root[data-xen-pickup-mode="vocab_infusion"] [data-pickup-lane="vocab_infusion"] .xen-pickup-token[data-pickup-original]::after {
      content: attr(data-pickup-original);
      margin-left: 2px;
      font-size: 0.62em;
      vertical-align: super;
      text-decoration: none;
      cursor: help;
      opacity: 0.7;
      color: rgba(71, 85, 105, 0.9);
    }
    :root[data-xen-pickup-theme="dark"] [data-pickup-lane="vocab_infusion"] .xen-pickup-token[data-pickup-original]::after {
      color: rgba(226, 232, 240, 0.85);
    }
    .xen-pickup-three-lane {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .xen-pickup-lane {
      margin: 0;
      padding: 0;
    }
    .xen-pickup-lane-content {
      line-height: inherit;
    }
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content {
      position: relative;
      filter: blur(4px) saturate(0.6) grayscale(0.28);
      opacity: 0.6;
      transition: filter 0.18s ease, opacity 0.18s ease;
    }
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content::after {
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
    :root[data-xen-pickup-theme="dark"][data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content::after {
      background: linear-gradient(120deg,
        color-mix(in srgb, rgba(15, 23, 42, 0.82) 68%, transparent),
        color-mix(in srgb, rgba(15, 23, 42, 0.86) 78%, transparent));
    }
    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content {
        filter: blur(4.5px) saturate(0.55);
        opacity: 0.55;
      }
    }
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content:hover,
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content:focus-within {
      filter: none;
      opacity: 1;
    }
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content:hover::after,
    :root[data-xen-pickup-translation-blur="true"] [data-pickup-lane="target"] .xen-pickup-lane-content:focus-within::after {
      opacity: 0;
    }
    .xen-pickup-inline {
      display: inline;
    }
    .xen-pickup-inline .xen-pickup-lane {
      display: inline;
    }
    .xen-pickup-inline .xen-pickup-lane-content {
      display: inline;
    }
    .xen-pickup-lane + .xen-pickup-lane {
      padding-top: 4px;
    }
    .xen-pickup-inline .xen-pickup-lane + .xen-pickup-lane {
      border-top: 0;
      padding-top: 0;
      margin-left: 4px;
    }
    :root[data-xen-pickup-mode="vocab_infusion"] .xen-pickup-three-lane [data-pickup-lane="syntax_rebuild"] {
      display: none;
    }
    :root[data-xen-pickup-mode="syntax_rebuild"] .xen-pickup-three-lane [data-pickup-lane="vocab_infusion"] {
      display: none;
    }
    :root[data-xen-pickup-mode="vocab_infusion"] .xen-pickup-role-badge {
      display: none;
    }
    .xen-pickup-role-badge {
      margin-left: 2px;
      font-size: 0.58em;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: rgba(71, 85, 105, 0.82);
      vertical-align: super;
      cursor: help;
    }
    .xen-pickup-role-badge[data-pickup-badge="structure"] {
      color: rgba(14, 116, 144, 0.9);
      font-weight: 700;
    }
    .xen-pickup-role-badge[data-pickup-badge="token"] {
      color: rgba(71, 85, 105, 0.72);
      font-weight: 600;
    }
    :root[data-xen-pickup-theme="dark"] .xen-pickup-role-badge {
      color: rgba(226, 232, 240, 0.78);
    }
    :root[data-xen-pickup-theme="dark"] .xen-pickup-role-badge[data-pickup-badge="structure"] {
      color: rgba(56, 189, 248, 0.9);
    }
    :root[data-xen-pickup-theme="dark"] .xen-pickup-role-badge[data-pickup-badge="token"] {
      color: rgba(226, 232, 240, 0.68);
    }
    .xen-pickup-token:hover {
      text-decoration-color: var(--xen-pickup-accent, #415ccc);
    }
    .xen-pickup-token[data-pickup-active="true"] {
      text-decoration-color: var(--xen-pickup-accent, #415ccc);
      text-decoration-thickness: 2px;
      border-radius: 0;
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
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .xen-pickup-tooltip-lines {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .xen-pickup-tooltip-line {
      max-width: 280px;
      white-space: pre-line;
      overflow: visible;
      text-overflow: clip;
    }
    .xen-pickup-tooltip-line-desc {
      opacity: 0.92;
    }
    .xen-pickup-tooltip-line-phone {
      font-size: 11px;
      line-height: 1.3;
      opacity: 0.78;
      letter-spacing: 0.02em;
    }
    .xen-pickup-tooltip-actions {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 2px;
      pointer-events: auto;
    }
    .xen-pickup-tooltip-action {
      border: 0;
      border-radius: 4px;
      padding: 1px 6px;
      font: inherit;
      font-size: 11px;
      line-height: 1.4;
      color: #e2e8f0;
      background: rgba(148, 163, 184, 0.24);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .xen-pickup-tooltip-action[data-pickup-active="true"] {
      color: #f8fafc;
      background: rgba(56, 189, 248, 0.38);
    }
    .tippy-box[data-theme~="xen-pickup"] {
      background: rgba(15, 23, 42, 0.92);
      color: #f8fafc;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
      pointer-events: auto;
    }
    .tippy-box[data-theme~="xen-pickup"] .tippy-content {
      padding: 6px 8px;
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
