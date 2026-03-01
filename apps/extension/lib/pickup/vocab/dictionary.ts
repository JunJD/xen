const DICT_INDEX_PATH = 'dicts/index.json';
const DEFAULT_DICT_FILES = ['dicts/merged.json'];
const DEFAULT_DICTIONARY_ID = 'default';
const DEFAULT_DICTIONARY_NAME = 'Default Dictionary';
const TOKEN_AFFIX_PATTERN = /^([^A-Za-z0-9\u4e00-\u9fff]*)(.*?)([^A-Za-z0-9\u4e00-\u9fff]*)$/;

type RawDictEntry = Record<string, unknown>;

export type VocabDictionaryEntry = {
  plain: string;
  byPos?: Record<string, string[]>;
  usphone?: string;
  ukphone?: string;
};

export type VocabDictionary = Map<string, VocabDictionaryEntry>;

export type VocabDictionaryDescriptor = {
  id: string;
  name: string;
  files: string[];
  description?: string;
  source?: string;
  icon?: string;
};

export type VocabDictionaryManifest = {
  dictionaries: VocabDictionaryDescriptor[];
  defaultDictionaryIds: string[];
};

let manifestCache: VocabDictionaryManifest | null = null;
let manifestPromise: Promise<VocabDictionaryManifest> | null = null;
const dictionaryCache = new Map<string, VocabDictionary>();
const dictionaryPromiseCache = new Map<string, Promise<VocabDictionary>>();

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

function normalizeDictionaryId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function normalizeDictionaryIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  value.forEach((item) => {
    const id = normalizeDictionaryId(item);
    if (!id || ids.includes(id)) {
      return;
    }
    ids.push(id);
  });
  return ids;
}

function normalizeDictionaryFilePath(file: string) {
  if (!file) {
    return '';
  }
  const normalized = file.replace(/^\/+/, '').trim();
  if (!normalized) {
    return '';
  }
  return normalized.startsWith('dicts/') ? normalized : `dicts/${normalized}`;
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

function normalizeTranslationList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => normalizeBlockText(item))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const normalized = normalizeBlockText(value);
    return normalized ? [normalized] : [];
  }
  return [];
}

function normalizePhoneValue(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function normalizePosKey(raw: string): string | null {
  const normalized = raw
    .toLowerCase()
    .replace(/[.：:\s]/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!normalized) {
    return null;
  }
  const map: Record<string, string> = {
    n: 'NOUN',
    noun: 'NOUN',
    名词: 'NOUN',
    v: 'VERB',
    vt: 'VERB',
    vi: 'VERB',
    verb: 'VERB',
    动词: 'VERB',
    adj: 'ADJ',
    a: 'ADJ',
    adjective: 'ADJ',
    形容词: 'ADJ',
    adv: 'ADV',
    adverb: 'ADV',
    副词: 'ADV',
    prep: 'ADP',
    preposition: 'ADP',
    介词: 'ADP',
    conj: 'CCONJ',
    conjunction: 'CCONJ',
    连词: 'CCONJ',
    sconj: 'SCONJ',
    subconj: 'SCONJ',
    从属连词: 'SCONJ',
    pron: 'PRON',
    pronoun: 'PRON',
    代词: 'PRON',
    det: 'DET',
    determiner: 'DET',
    限定词: 'DET',
    num: 'NUM',
    numeral: 'NUM',
    数词: 'NUM',
    int: 'INTJ',
    interj: 'INTJ',
    interjection: 'INTJ',
    感叹词: 'INTJ',
    叹词: 'INTJ',
    aux: 'AUX',
    auxiliary: 'AUX',
    助动词: 'AUX',
    part: 'PART',
    particle: 'PART',
    助词: 'PART',
    propn: 'PROPN',
    propernoun: 'PROPN',
    专有名词: 'PROPN',
    sym: 'SYM',
    symbol: 'SYM',
    符号: 'SYM',
    abbr: 'X',
    abbrev: 'X',
    abbrv: 'X',
    phrase: 'X',
    phr: 'X',
    idiom: 'X',
    modal: 'AUX',
  };
  return map[normalized] ?? null;
}

function normalizeTransByPos(raw: unknown): Record<string, string[]> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const normalized: Record<string, string[]> = {};
  Object.entries(record).forEach(([key, value]) => {
    const posKey = normalizePosKey(key) ?? key.trim().toUpperCase();
    if (!posKey) {
      return;
    }
    const list = normalizeTranslationList(value);
    if (list.length === 0) {
      return;
    }
    normalized[posKey] = list;
  });
  return Object.keys(normalized).length > 0 ? normalized : null;
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
  const plainTranslation = normalizeTranslationValue(entry.transPlain ?? extractTranslation(entry));
  const byPos = normalizeTransByPos(entry.transByPos) ?? undefined;
  const usphone = normalizePhoneValue(entry.usphone);
  const ukphone = normalizePhoneValue(entry.ukphone);
  const hasTranslation = Boolean(plainTranslation) || Boolean(byPos);
  const hasPhone = Boolean(usphone) || Boolean(ukphone);
  if (!hasTranslation && !hasPhone) {
    return null;
  }
  return {
    key: normalizeKey(rawName),
    entry: {
      plain: plainTranslation,
      byPos,
      usphone: usphone || undefined,
      ukphone: ukphone || undefined,
    },
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
  if (!Array.isArray(raw)) {
    return [];
  }
  const files: string[] = [];
  raw.forEach((item) => {
    if (typeof item !== 'string') {
      return;
    }
    const normalized = normalizeDictionaryFilePath(item);
    if (!normalized || files.includes(normalized)) {
      return;
    }
    files.push(normalized);
  });
  return files;
}

function normalizeDictionaryDescriptor(raw: unknown): VocabDictionaryDescriptor | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = normalizeDictionaryId(record.id ?? record.key ?? record.name ?? record.label);
  if (!id) {
    return null;
  }
  const files = normalizeDictionaryFiles(record.files ?? record.dicts ?? record.paths);
  if (files.length === 0) {
    return null;
  }
  const nameRaw = record.name ?? record.label ?? record.title ?? id;
  const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : id;
  const description = typeof record.description === 'string' && record.description.trim()
    ? record.description.trim()
    : undefined;
  const source = typeof record.source === 'string' && record.source.trim()
    ? record.source.trim()
    : undefined;
  const icon = typeof record.icon === 'string' && record.icon.trim()
    ? record.icon.trim()
    : undefined;
  return {
    id,
    name,
    files,
    description,
    source,
    icon,
  };
}

function createDefaultManifest(): VocabDictionaryManifest {
  return {
    dictionaries: [
      {
        id: DEFAULT_DICTIONARY_ID,
        name: DEFAULT_DICTIONARY_NAME,
        files: DEFAULT_DICT_FILES.map(normalizeDictionaryFilePath).filter(Boolean),
      },
    ],
    defaultDictionaryIds: [DEFAULT_DICTIONARY_ID],
  };
}

function buildManifestFromPayload(payload: unknown): VocabDictionaryManifest {
  if (!payload || typeof payload !== 'object') {
    return createDefaultManifest();
  }

  const record = payload as Record<string, unknown>;
  const dictionariesRaw = Array.isArray(record.dictionaries) ? record.dictionaries : [];
  let dictionaries = dictionariesRaw
    .map(item => normalizeDictionaryDescriptor(item))
    .filter((item): item is VocabDictionaryDescriptor => item !== null);

  if (dictionaries.length === 0) {
    const legacyFiles = normalizeDictionaryFiles(record.files ?? record.dicts ?? record.dictionaries);
    if (legacyFiles.length > 0) {
      dictionaries = [
        {
          id: DEFAULT_DICTIONARY_ID,
          name: DEFAULT_DICTIONARY_NAME,
          files: legacyFiles,
        },
      ];
    }
  }

  if (dictionaries.length === 0) {
    return createDefaultManifest();
  }

  const dictionaryIds = new Set(dictionaries.map(item => item.id));
  const defaultIdsFromArray = normalizeDictionaryIdList(
    record.defaultDictionaryIds ?? record.defaultDictionaries,
  ).filter(id => dictionaryIds.has(id));
  const singleDefaultId = normalizeDictionaryId(record.defaultDictionaryId);
  const defaultDictionaryIds = defaultIdsFromArray.length > 0
    ? defaultIdsFromArray
    : singleDefaultId && dictionaryIds.has(singleDefaultId)
      ? [singleDefaultId]
      : [dictionaries[0].id];

  return {
    dictionaries,
    defaultDictionaryIds,
  };
}

async function resolveDictionaryManifest(): Promise<VocabDictionaryManifest> {
  if (manifestCache) {
    return manifestCache;
  }
  if (manifestPromise) {
    return manifestPromise;
  }
  manifestPromise = (async () => {
    const indexUrl = resolveRuntimeUrl(DICT_INDEX_PATH);
    const payload = await fetchJson(indexUrl);
    return buildManifestFromPayload(payload);
  })();

  try {
    manifestCache = await manifestPromise;
    return manifestCache;
  }
  finally {
    manifestPromise = null;
  }
}

export async function getVocabDictionaryManifest(): Promise<VocabDictionaryManifest> {
  return resolveDictionaryManifest();
}

function resolveSelectedDictionaries(
  manifest: VocabDictionaryManifest,
  dictionaryIds?: string[],
): VocabDictionaryDescriptor[] {
  const idsByDescriptor = new Map(manifest.dictionaries.map(item => [item.id, item] as const));
  const selectedIds = dictionaryIds && dictionaryIds.length > 0
    ? normalizeDictionaryIdList(dictionaryIds)
    : manifest.defaultDictionaryIds;

  if (selectedIds.length === 0) {
    throw new Error('No dictionaries selected.');
  }

  const selected: VocabDictionaryDescriptor[] = [];
  const unknownIds: string[] = [];

  selectedIds.forEach((id) => {
    const descriptor = idsByDescriptor.get(id);
    if (!descriptor) {
      unknownIds.push(id);
      return;
    }
    if (!selected.some(item => item.id === descriptor.id)) {
      selected.push(descriptor);
    }
  });

  if (unknownIds.length > 0) {
    throw new Error(`Unknown dictionary id(s): ${unknownIds.join(', ')}`);
  }

  if (selected.length === 0) {
    throw new Error('No valid dictionaries selected.');
  }

  return selected;
}

function buildDictionaryCacheKey(selected: VocabDictionaryDescriptor[]) {
  return selected.map(item => item.id).join('::');
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
      map.set(normalized.key, normalized.entry);
    }
  });
  return map;
}

export async function loadVocabDictionary(
  options: { dictionaryIds?: string[] } = {},
): Promise<VocabDictionary> {
  const manifest = await resolveDictionaryManifest();
  const selected = resolveSelectedDictionaries(manifest, options.dictionaryIds);
  const cacheKey = buildDictionaryCacheKey(selected);

  const cached = dictionaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = dictionaryPromiseCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    const files = selected.flatMap(item => item.files);
    if (files.length === 0) {
      throw new Error('Selected dictionaries have no files.');
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

  dictionaryPromiseCache.set(cacheKey, promise);
  try {
    const resolved = await promise;
    dictionaryCache.set(cacheKey, resolved);
    return resolved;
  }
  finally {
    dictionaryPromiseCache.delete(cacheKey);
  }
}

function buildLookupKeys(core: string): string[] {
  if (!core) {
    return [];
  }
  return [core];
}

function resolvePosKey(pos?: string): string | null {
  if (!pos) {
    return null;
  }
  const direct = normalizePosKey(pos);
  if (direct) {
    return direct;
  }
  const upper = pos.toUpperCase().trim();
  if (!upper) {
    return null;
  }
  return upper;
}

export function lookupVocabTranslation(
  text: string,
  dictionary: VocabDictionary,
  pos?: string,
): string | null {
  if (!dictionary || dictionary.size === 0) {
    return null;
  }
  const { prefix, core, suffix } = splitTokenAffixes(text);
  if (!core.trim()) {
    return null;
  }
  const normalized = normalizeKey(core);
  const posKey = resolvePosKey(pos);
  const keys = buildLookupKeys(normalized);
  const entry = keys.length > 0 ? dictionary.get(keys[0]) : undefined;
  if (!entry) {
    return null;
  }
  if (posKey) {
    if (entry.byPos?.[posKey]?.length) {
      return `${prefix}${entry.byPos[posKey][0]}${suffix}`;
    }
    // For dictionaries without POS labels, allow explicit unknown bucket.
    if (entry.byPos?.X?.length) {
      return `${prefix}${entry.byPos.X[0]}${suffix}`;
    }
    return null;
  }
  if (entry.plain) {
    return `${prefix}${entry.plain}${suffix}`;
  }
  return null;
}

export function lookupVocabAllPos(text: string, dictionary: VocabDictionary): string | null {
  if (!dictionary || dictionary.size === 0) {
    return null;
  }
  const { core } = splitTokenAffixes(text);
  if (!core.trim()) {
    return null;
  }
  const normalized = normalizeKey(core);
  const keys = buildLookupKeys(normalized);
  const entry = keys.length > 0 ? dictionary.get(keys[0]) : undefined;
  if (!entry) {
    return null;
  }
  if (entry.plain) {
    return entry.plain;
  }
  return null;
}

export function lookupVocabPhones(
  text: string,
  dictionary: VocabDictionary,
): { usphone?: string; ukphone?: string } | null {
  if (!dictionary || dictionary.size === 0) {
    return null;
  }
  const { core } = splitTokenAffixes(text);
  if (!core.trim()) {
    return null;
  }
  const normalized = normalizeKey(core);
  const keys = buildLookupKeys(normalized);
  const entry = keys.length > 0 ? dictionary.get(keys[0]) : undefined;
  if (!entry) {
    return null;
  }
  const usphone = entry.usphone?.trim() ?? '';
  const ukphone = entry.ukphone?.trim() ?? '';
  if (usphone || ukphone) {
    return {
      usphone: usphone || undefined,
      ukphone: ukphone || undefined,
    };
  }
  return null;
}
