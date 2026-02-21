import type { TranslateProvider } from '@/lib/pickup/messages';
import { DEFAULT_TRANSLATE_PROVIDER, isTranslateProvider } from '@/lib/pickup/translate/options';

const TRANSLATE_PROVIDER_STORAGE_KEY = 'xenTranslateProvider';
const LLM_API_KEY_STORAGE_KEY = 'xenTranslateLlmApiKey';
const LLM_MODEL_STORAGE_KEY = 'xenTranslateLlmModel';
const LLM_MODEL_LIST_STORAGE_KEY = 'xenTranslateLlmModels';
export const DEFAULT_LLM_MODEL = 'gpt-4o-mini';
export const DEFAULT_LLM_MODEL_LIST = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'];

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

export async function ensureTranslateModelStored(
  fallbackModel: string = DEFAULT_LLM_MODEL,
): Promise<string> {
  const raw = await storageGet(LLM_MODEL_STORAGE_KEY);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  await storageSet(LLM_MODEL_STORAGE_KEY, fallbackModel);
  return fallbackModel;
}

function normalizeModelList(value: unknown): string[] {
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
  return cleaned;
}

export async function ensureTranslateModelListStored(
  fallbackModels: string[] = DEFAULT_LLM_MODEL_LIST,
): Promise<string[]> {
  const raw = await storageGet(LLM_MODEL_LIST_STORAGE_KEY);
  const normalized = normalizeModelList(raw);
  if (normalized.length > 0) {
    return normalized;
  }
  const fallback = normalizeModelList(fallbackModels);
  await storageSet(LLM_MODEL_LIST_STORAGE_KEY, fallback);
  return fallback;
}

export async function getStoredLlmModelList(): Promise<string[]> {
  const raw = await storageGet(LLM_MODEL_LIST_STORAGE_KEY);
  const normalized = normalizeModelList(raw);
  if (normalized.length > 0) {
    return normalized;
  }
  return ensureTranslateModelListStored(DEFAULT_LLM_MODEL_LIST);
}

export async function setStoredLlmModelList(nextModels: string[]): Promise<string[]> {
  const normalized = normalizeModelList(nextModels);
  if (normalized.length === 0) {
    throw new Error('LLM model list is empty.');
  }
  await storageSet(LLM_MODEL_LIST_STORAGE_KEY, normalized);
  return normalized;
}

export async function getStoredLlmModel(): Promise<string> {
  const raw = await storageGet(LLM_MODEL_STORAGE_KEY);
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return ensureTranslateModelStored(DEFAULT_LLM_MODEL);
}

export async function setStoredLlmModel(nextModel: string): Promise<string> {
  const normalized = typeof nextModel === 'string' ? nextModel.trim() : '';
  if (!normalized) {
    throw new Error('LLM model is required.');
  }
  await storageSet(LLM_MODEL_STORAGE_KEY, normalized);
  return normalized;
}

export async function getStoredLlmApiKey(): Promise<string> {
  const raw = await storageGet(LLM_API_KEY_STORAGE_KEY);
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('LLM API key not configured.');
  }
  return raw.trim();
}

export async function hasStoredLlmApiKey(): Promise<boolean> {
  const raw = await storageGet(LLM_API_KEY_STORAGE_KEY);
  return typeof raw === 'string' && raw.trim().length > 0;
}

export async function setStoredLlmApiKey(nextKey: string): Promise<void> {
  const normalized = typeof nextKey === 'string' ? nextKey.trim() : '';
  await storageSet(LLM_API_KEY_STORAGE_KEY, normalized);
}
