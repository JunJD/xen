const DICT_INDEX_PATH = 'dicts/index.json';
const DEFAULT_DICT_FILES = ['dicts/merged.json'];
const TOKEN_AFFIX_PATTERN = /^([^A-Za-z0-9\u4e00-\u9fff]*)(.*?)([^A-Za-z0-9\u4e00-\u9fff]*)$/;

type RawDictEntry = Record<string, unknown>;

type VocabDictionary = Map<string, string>;

let cachedDictionary: VocabDictionary | null = null;
let dictionaryPromise: Promise<VocabDictionary> | null = null;

function resolveRuntimeUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(normalized);
  }
  if (typeof location !== 'undefined') {
    return new URL(normalized, location.origin).toString();
  }
  return `/${normalized}`;
}

function splitTokenAffixes(text: string) {
  const match = text.match(TOKEN_AFFIX_PATTERN);
  if (!match) {
    return { prefix: '', core: text, suffix: '' };
  }
  const [, prefix, core, suffix] = match;
  return { prefix, core, suffix };
}

function normalizeKey(value: string) {
  return value.toLowerCase().trim();
}

function normalizeBlockText(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n');
  const lines = normalized
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean);
  return lines.join('\n');
}

function normalizeTranslationValue(value: unknown): string {
  if (Array.isArray(value)) {
    const parts = value
      .filter(item => typeof item === 'string')
      .map(item => normalizeBlockText(item))
      .filter(Boolean);
    return parts.join('\n');
  }
  if (typeof value === 'string') {
    return normalizeBlockText(value);
  }
  return '';
}

function extractTranslation(entry: RawDictEntry): string {
  if ('trans' in entry) {
    return normalizeTranslationValue(entry.trans);
  }
  if ('translation' in entry) {
    return normalizeTranslationValue(entry.translation);
  }
  if ('meaning' in entry) {
    return normalizeTranslationValue(entry.meaning);
  }
  if ('definition' in entry) {
    return normalizeTranslationValue(entry.definition);
  }
  return '';
}

function normalizeEntry(entry: RawDictEntry) {
  const rawName = entry.name ?? entry.word ?? entry.text ?? entry.term ?? entry.key;
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    return null;
  }
  const translation = extractTranslation(entry);
  if (!translation) {
    return null;
  }
  return {
    key: normalizeKey(rawName),
    translation,
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeDictionaryFiles(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter(item => typeof item === 'string') as string[];
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const list = record.files ?? record.dicts ?? record.dictionaries;
    if (Array.isArray(list)) {
      return list.filter(item => typeof item === 'string') as string[];
    }
  }
  return [];
}

async function resolveDictionaryFiles(): Promise<string[]> {
  const indexUrl = resolveRuntimeUrl(DICT_INDEX_PATH);
  const payload = await fetchJson(indexUrl);
  const files = normalizeDictionaryFiles(payload);
  const resolved = (files.length > 0 ? files : DEFAULT_DICT_FILES)
    .map((file) => {
      if (!file) {
        return '';
      }
      const normalized = file.replace(/^\/+/, '');
      return normalized.startsWith('dicts/') ? normalized : `dicts/${normalized}`;
    })
    .filter(Boolean);
  return Array.from(new Set(resolved));
}

async function loadDictionaryFile(path: string): Promise<VocabDictionary> {
  const url = resolveRuntimeUrl(path);
  const payload = await fetchJson(url);
  if (!Array.isArray(payload)) {
    return new Map();
  }
  const map: VocabDictionary = new Map();
  payload.forEach((raw) => {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    const normalized = normalizeEntry(raw as RawDictEntry);
    if (!normalized) {
      return;
    }
    if (!map.has(normalized.key)) {
      map.set(normalized.key, normalized.translation);
    }
  });
  return map;
}

export async function loadVocabDictionary(): Promise<VocabDictionary> {
  if (cachedDictionary) {
    return cachedDictionary;
  }
  if (dictionaryPromise) {
    return dictionaryPromise;
  }
  dictionaryPromise = (async () => {
    const files = await resolveDictionaryFiles();
    if (files.length === 0) {
      return new Map();
    }
    const maps = await Promise.all(files.map(loadDictionaryFile));
    const merged: VocabDictionary = new Map();
    maps.forEach((map) => {
      map.forEach((value, key) => {
        if (!merged.has(key)) {
          merged.set(key, value);
        }
      });
    });
    return merged;
  })();

  try {
    cachedDictionary = await dictionaryPromise;
    return cachedDictionary;
  } finally {
    dictionaryPromise = null;
  }
}

function buildLookupKeys(core: string): string[] {
  const keys = new Set<string>();
  if (!core) {
    return [];
  }
  keys.add(core);
  if (core.endsWith("'s")) {
    keys.add(core.slice(0, -2));
  }
  if (core.endsWith('’s')) {
    keys.add(core.slice(0, -2));
  }
  if (core.endsWith('ies') && core.length > 3) {
    keys.add(`${core.slice(0, -3)}y`);
  }
  if (core.endsWith('es') && core.length > 2) {
    keys.add(core.slice(0, -2));
  }
  if (core.endsWith('s') && core.length > 1) {
    keys.add(core.slice(0, -1));
  }
  if (core.endsWith('ing') && core.length > 3) {
    keys.add(core.slice(0, -3));
  }
  if (core.endsWith('ed') && core.length > 2) {
    keys.add(core.slice(0, -2));
  }
  return Array.from(keys);
}

export function lookupVocabTranslation(text: string, dictionary: VocabDictionary): string | null {
  if (!dictionary || dictionary.size === 0) {
    return null;
  }
  const { prefix, core, suffix } = splitTokenAffixes(text);
  if (!core.trim()) {
    return null;
  }
  const normalized = normalizeKey(core);
  const keys = buildLookupKeys(normalized);
  for (const key of keys) {
    const translation = dictionary.get(key);
    if (translation) {
      return `${prefix}${translation}${suffix}`;
    }
  }
  return null;
}
