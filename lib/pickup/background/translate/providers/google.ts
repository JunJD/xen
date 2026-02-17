import type { TranslateProviderAdapter } from '../types';

const DEFAULT_SOURCE_LANG = 'auto';
const DEFAULT_TARGET_LANG = 'zh-CN';

function buildGoogleTranslateUrl(sourceText: string, fromLang: string, toLang: string) {
  const params = {
    client: 'gtx',
    sl: fromLang,
    tl: toLang,
    dt: 't',
    strip: 1,
    nonced: 1,
    q: encodeURIComponent(sourceText),
  };

  const queryString = Object.keys(params)
    .map(key => `${key}=${params[key as keyof typeof params]}`)
    .join('&');

  return `https://translate.googleapis.com/translate_a/single?${queryString}`;
}

export const googleTranslateProvider: TranslateProviderAdapter = {
  id: 'google',
  label: 'Google Translate',
  async translate(request) {
    const sourceText = request.text;
    const fromLang = request.sourceLang ?? DEFAULT_SOURCE_LANG;
    const toLang = request.targetLang ?? DEFAULT_TARGET_LANG;
    const url = buildGoogleTranslateUrl(sourceText, fromLang, toLang);

    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) {
      throw new Error(`Google translate request failed: ${resp.status} ${resp.statusText}`);
    }

    const result = await resp.json();
    if (!Array.isArray(result) || !Array.isArray(result[0])) {
      throw new TypeError('Unexpected response format from Google translate');
    }

    const text = result[0]
      .filter(Array.isArray)
      .map(chunk => chunk[0])
      .filter(Boolean)
      .join('');

    return { provider: 'google', text };
  },
};
