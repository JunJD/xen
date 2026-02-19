const DICT_INDEX_PATH = 'dicts/index.json';
const DEFAULT_DICT_FILES = ['dicts/merged.json'];
const TOKEN_AFFIX_PATTERN = /^([^A-Za-z0-9\u4e00-\u9fff]*)(.*?)([^A-Za-z0-9\u4e00-\u9fff]*)$/;

type RawDictEntry = Record<string, unknown>;

export type VocabDictionaryEntry = {
  plain: string;
  byPos?: Record<string, string[]>;
  usphone?: string;
  ukphone?: string;
};

export type VocabDictionary = Map<string, VocabDictionaryEntry>;

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
      map.set(normalized.key, normalized.entry);
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

function joinPosList(list: string[]): string {
  return list.join('；');
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
  const keys = buildLookupKeys(normalized);
  const posKey = resolvePosKey(pos);
  for (const key of keys) {
    const entry = dictionary.get(key);
    if (!entry) {
      continue;
    }
    if (posKey) {
      if (entry.byPos?.[posKey]?.length) {
        return `${prefix}${entry.byPos[posKey][0]}${suffix}`;
      }
      continue;
    }
    if (entry.plain) {
      return `${prefix}${entry.plain}${suffix}`;
    }
    if (entry.byPos) {
      const first = Object.values(entry.byPos).find(list => list.length > 0);
      if (first && first.length > 0) {
        return `${prefix}${joinPosList(first)}${suffix}`;
      }
    }
  }
  return null;
}

const POS_LABELS: Record<string, string> = {
  NOUN: 'n.',
  VERB: 'v.',
  ADJ: 'adj.',
  ADV: 'adv.',
  ADP: 'prep.',
  PRON: 'pron.',
  DET: 'det.',
  NUM: 'num.',
  CCONJ: 'conj.',
  SCONJ: 'conj.',
  AUX: 'aux.',
  PART: 'part.',
  PROPN: 'propn.',
  INTJ: 'int.',
  SYM: 'sym.',
  X: 'x.',
};

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
  for (const key of keys) {
    const entry = dictionary.get(key);
    if (!entry) {
      continue;
    }
    if (entry.byPos && Object.keys(entry.byPos).length > 0) {
      const lines = Object.entries(entry.byPos).map(([pos, list]) => {
        const label = POS_LABELS[pos] ?? pos.toLowerCase();
        return `${label} ${joinPosList(list)}`;
      });
      return lines.join('\n');
    }
    if (entry.plain) {
      return entry.plain;
    }
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
  for (const key of keys) {
    const entry = dictionary.get(key);
    if (!entry) {
      continue;
    }
    const usphone = entry.usphone?.trim() ?? '';
    const ukphone = entry.ukphone?.trim() ?? '';
    if (usphone || ukphone) {
      return {
        usphone: usphone || undefined,
        ukphone: ukphone || undefined,
      };
    }
  }
  return null;
}
