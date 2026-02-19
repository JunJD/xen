import { registerTranslateProvider } from './service';
import { googleTranslateProvider } from './providers/google';
import { createOpenAITranslateProvider } from './providers/openai';
import {
  getStoredLlmApiKey,
  getStoredLlmModel,
  ensureTranslateModelListStored,
  ensureTranslateModelStored,
  ensureTranslateProviderStored,
} from './storage';
import { DEFAULT_TRANSLATE_PROVIDER, isTranslateProvider } from '@/lib/pickup/translate/options';

let providersRegistered = false;

export function ensureTranslateProvidersRegistered() {
  if (providersRegistered) {
    return;
  }
  registerTranslateProvider(googleTranslateProvider);
  registerTranslateProvider(
    createOpenAITranslateProvider({
      targetLangName: 'Simplified Chinese',
      resolveApiKey: getStoredLlmApiKey,
      resolveModel: getStoredLlmModel,
    }),
  );
  providersRegistered = true;
}

export async function ensureTranslateProviderConfig() {
  await ensureTranslateProviderStored(DEFAULT_TRANSLATE_PROVIDER);
  await ensureTranslateModelStored();
  await ensureTranslateModelListStored();
}

export * from './service';
export * from './storage';
export * from './types';
export { isTranslateProvider };
