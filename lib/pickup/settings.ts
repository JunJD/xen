import {
  PICKUP_RENDER_MODE_SYNTAX_REBUILD,
  isPickupRenderMode,
  type PickupRenderMode,
} from '@/lib/pickup/content/render-mode';

export type PickupStylePreset = 'underline' | 'soft-bg' | 'underline-soft';

export type PickupSettings = {
  enabled: boolean;
  defaultRenderMode: PickupRenderMode;
  ignoreList: string[];
  stylePreset: PickupStylePreset;
  highlightOpacity: number;
  translationBlurEnabled: boolean;
  floatingSidebarEnabled: boolean;
};

const STORAGE_KEY = 'xenPickupSettings';
const MAX_IGNORE_ITEMS = 200;

export const DEFAULT_PICKUP_SETTINGS: PickupSettings = {
  enabled: true,
  defaultRenderMode: PICKUP_RENDER_MODE_SYNTAX_REBUILD,
  ignoreList: [],
  stylePreset: 'underline-soft',
  highlightOpacity: 45,
  translationBlurEnabled: false,
  floatingSidebarEnabled: true,
};

function getStorageArea() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  const browserStorage = (globalThis as { browser?: { storage?: { local?: ChromeStorageAreaLike } } })
    .browser?.storage?.local;
  return browserStorage ?? null;
}

async function storageGet(key: string): Promise<unknown> {
  const storage = getStorageArea();
  if (!storage || !storage.get) {
    throw new Error('Storage unavailable.');
  }
  const storageGet = storage.get.bind(storage);
  return new Promise((resolve, reject) => {
    try {
      storageGet([key], (result) => resolve(result?.[key]));
    } catch (error) {
      reject(error);
    }
  });
}

async function storageSet(key: string, value: unknown): Promise<void> {
  const storage = getStorageArea();
  if (!storage || !storage.set) {
    throw new Error('Storage unavailable.');
  }
  const storageSet = storage.set.bind(storage);
  return new Promise((resolve, reject) => {
    try {
      storageSet({ [key]: value }, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeIgnoreList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const cleaned: string[] = [];
  value.forEach((item) => {
    if (typeof item !== 'string') {
      return;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      return;
    }
    if (cleaned.includes(trimmed)) {
      return;
    }
    cleaned.push(trimmed);
  });
  return cleaned.slice(0, MAX_IGNORE_ITEMS);
}

function normalizeStylePreset(value: unknown): PickupStylePreset {
  if (value === 'underline' || value === 'soft-bg' || value === 'underline-soft') {
    return value;
  }
  return DEFAULT_PICKUP_SETTINGS.stylePreset;
}

export function normalizePickupSettings(input?: Partial<PickupSettings> | null): PickupSettings {
  return {
    enabled: typeof input?.enabled === 'boolean' ? input.enabled : DEFAULT_PICKUP_SETTINGS.enabled,
    defaultRenderMode: isPickupRenderMode(input?.defaultRenderMode)
      ? input.defaultRenderMode
      : DEFAULT_PICKUP_SETTINGS.defaultRenderMode,
    ignoreList: normalizeIgnoreList(input?.ignoreList),
    stylePreset: normalizeStylePreset(input?.stylePreset),
    highlightOpacity: clampNumber(
      input?.highlightOpacity,
      0,
      100,
      DEFAULT_PICKUP_SETTINGS.highlightOpacity,
    ),
    translationBlurEnabled: typeof input?.translationBlurEnabled === 'boolean'
      ? input.translationBlurEnabled
      : DEFAULT_PICKUP_SETTINGS.translationBlurEnabled,
    floatingSidebarEnabled: typeof input?.floatingSidebarEnabled === 'boolean'
      ? input.floatingSidebarEnabled
      : DEFAULT_PICKUP_SETTINGS.floatingSidebarEnabled,
  };
}

export async function getPickupSettings(): Promise<PickupSettings> {
  const raw = await storageGet(STORAGE_KEY);
  return normalizePickupSettings(raw as Partial<PickupSettings> | null);
}

export async function setPickupSettings(next: Partial<PickupSettings>): Promise<PickupSettings> {
  const current = await getPickupSettings().catch(() => DEFAULT_PICKUP_SETTINGS);
  const merged = normalizePickupSettings({ ...current, ...next });
  await storageSet(STORAGE_KEY, merged);
  return merged;
}

export async function resetPickupSettings(): Promise<PickupSettings> {
  await storageSet(STORAGE_KEY, DEFAULT_PICKUP_SETTINGS);
  return DEFAULT_PICKUP_SETTINGS;
}

export function isUrlIgnored(url: string, ignoreList: string[]): boolean {
  if (!ignoreList || ignoreList.length === 0) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const targetHost = parsed.hostname.toLowerCase();
  const targetUrl = parsed.href.toLowerCase();
  return ignoreList.some((raw) => {
    if (typeof raw !== 'string') {
      return false;
    }
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) {
      return false;
    }
    if (trimmed.includes('://')) {
      return targetUrl.startsWith(trimmed);
    }
    const normalizedHost = trimmed.replace(/^\*\./, '').replace(/^\./, '');
    if (!normalizedHost) {
      return false;
    }
    if (targetHost === normalizedHost) {
      return true;
    }
    return targetHost.endsWith(`.${normalizedHost}`);
  });
}
