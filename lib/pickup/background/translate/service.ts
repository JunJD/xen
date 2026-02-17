import type { TranslateProvider } from '@/lib/pickup/messages';
import type { TranslateProviderAdapter, TranslateRequest } from './types';

const providers = new Map<TranslateProvider, TranslateProviderAdapter>();

export function registerTranslateProvider(provider: TranslateProviderAdapter) {
  if (providers.has(provider.id)) {
    throw new Error(`Translate provider already registered: ${provider.id}`);
  }
  providers.set(provider.id, provider);
}

export function getTranslateProvider(providerId: TranslateProvider): TranslateProviderAdapter {
  const provider = providers.get(providerId);
  if (!provider) {
    throw new Error(`Translate provider not registered: ${providerId}`);
  }
  return provider;
}

export function listTranslateProviders(): TranslateProviderAdapter[] {
  return Array.from(providers.values());
}

export async function translateText(providerId: TranslateProvider, request: TranslateRequest): Promise<string> {
  const provider = getTranslateProvider(providerId);
  const response = await provider.translate(request);
  return response.text;
}
