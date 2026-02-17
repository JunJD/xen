import type { TranslateProvider } from '@/lib/pickup/messages';

export type TranslateRequest = {
  text: string;
  sourceLang?: string;
  targetLang?: string;
  targetLangName?: string;
};

export type TranslateResponse = {
  provider: TranslateProvider;
  text: string;
};

export type TranslateProviderAdapter = {
  id: TranslateProvider;
  label: string;
  translate: (request: TranslateRequest) => Promise<TranslateResponse>;
};
