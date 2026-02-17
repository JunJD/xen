import type { TranslateProvider } from '@/lib/pickup/messages';

export const TRANSLATE_PROVIDERS: TranslateProvider[] = ['google', 'llm'];

export const TRANSLATE_PROVIDER_LABELS: Record<TranslateProvider, string> = {
  google: 'Google（免费）',
  llm: 'LLM（付费）',
};

export const DEFAULT_TRANSLATE_PROVIDER: TranslateProvider = 'google';

export function isTranslateProvider(value: unknown): value is TranslateProvider {
  return TRANSLATE_PROVIDERS.includes(value as TranslateProvider);
}
