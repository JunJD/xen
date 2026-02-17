import type { TranslateProvider } from '@/lib/pickup/messages';
import { DEFAULT_TRANSLATE_PROVIDER, isTranslateProvider } from '@/lib/pickup/translate/options';

const TRANSLATE_PROVIDER_STORAGE_KEY = 'xenTranslateProvider';
const LLM_API_KEY_STORAGE_KEY = 'xenTranslateLlmApiKey';

function getStorageArea() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return chrome.storage.local;
  }
  const browserStorage = (globalThis as { browser?: { storage?: { local?: chrome.storage.StorageArea } } })
    .browser?.storage?.local;
  return browserStorage ?? null;
}

async function storageGet(key: string): Promise<unknown> {
  const storage = getStorageArea();
  if (!storage) {
    throw new Error('Storage unavailable.');
  }
  return new Promise((resolve, reject) => {
    try {
      storage.get([key], (result) => resolve(result?.[key]));
    } catch (error) {
      reject(error);
    }
  });
}

async function storageSet(key: string, value: unknown): Promise<void> {
  const storage = getStorageArea();
  if (!storage) {
    throw new Error('Storage unavailable.');
  }
  return new Promise((resolve, reject) => {
    try {
      storage.set({ [key]: value }, () => resolve());
    } catch (error) {
      reject(error);
    }
  });
}

export async function ensureTranslateProviderStored(
  fallbackProvider: TranslateProvider = DEFAULT_TRANSLATE_PROVIDER,
): Promise<TranslateProvider> {
  const raw = await storageGet(TRANSLATE_PROVIDER_STORAGE_KEY);
  if (isTranslateProvider(raw)) {
    return raw;
  }
  await storageSet(TRANSLATE_PROVIDER_STORAGE_KEY, fallbackProvider);
  return fallbackProvider;
}

export async function getStoredTranslateProvider(): Promise<TranslateProvider> {
  const raw = await storageGet(TRANSLATE_PROVIDER_STORAGE_KEY);
  if (!isTranslateProvider(raw)) {
    throw new Error('Translate provider not configured.');
  }
  return raw;
}

export async function setStoredTranslateProvider(nextProvider: TranslateProvider): Promise<TranslateProvider> {
  if (!isTranslateProvider(nextProvider)) {
    throw new Error(`Invalid translate provider: ${String(nextProvider)}`);
  }
  await storageSet(TRANSLATE_PROVIDER_STORAGE_KEY, nextProvider);
  return nextProvider;
}

export async function getStoredLlmApiKey(): Promise<string> {
  const raw = await storageGet(LLM_API_KEY_STORAGE_KEY);
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('LLM API key not configured.');
  }
  return raw.trim();
}
