import { franc } from 'franc';
import { getArticleText } from './article';

const ENGLISH_LANG = 'eng';
const MIN_LENGTH_FOR_FRANC = 50;
const MIN_ALPHA_COUNT = 6;
const MIN_ENGLISH_RATIO = 0.55;
const MAX_NON_ASCII_RATIO = 0.12;

let cachedPageLang: { url: string; isEnglish: boolean } | null = null;

function fallbackEnglishHeuristic(text: string) {
  const compact = text.replace(/\s+/g, '');
  if (!compact) {
    return false;
  }
  const asciiLetters = (compact.match(/[A-Za-z]/g) ?? []).length;
  if (asciiLetters < MIN_ALPHA_COUNT) {
    return false;
  }
  const alphaNumeric = (compact.match(/[A-Za-z0-9]/g) ?? []).length;
  const nonAscii = (compact.match(/[^\x00-\x7F]/g) ?? []).length;
  const englishRatio = asciiLetters / Math.max(1, alphaNumeric);
  const nonAsciiRatio = nonAscii / compact.length;
  return englishRatio >= MIN_ENGLISH_RATIO && nonAsciiRatio <= MAX_NON_ASCII_RATIO;
}

function detectWithFranc(text: string) {
  if (text.length < MIN_LENGTH_FOR_FRANC) {
    return 'und';
  }
  return franc(text);
}

export function isEnglishText(text: string) {
  const code = detectWithFranc(text);
  if (code === 'und') {
    return fallbackEnglishHeuristic(text);
  }
  return code === ENGLISH_LANG;
}

export function isPageEnglish() {
  if (cachedPageLang && cachedPageLang.url === window.location.href) {
    return cachedPageLang.isEnglish;
  }
  const articleText = getArticleText();
  const code = detectWithFranc(articleText);
  const isEnglish = code === ENGLISH_LANG || (code === 'und' && fallbackEnglishHeuristic(articleText));
  cachedPageLang = {
    url: window.location.href,
    isEnglish,
  };
  return isEnglish;
}
