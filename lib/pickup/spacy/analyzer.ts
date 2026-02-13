import type { PickupModelStatus, PickupToken } from '@/lib/pickup/messages';
import {
  PICKUP_TYPE_ID_GRAMMAR,
  PICKUP_TYPE_ID_VOCABULARY,
  getPickupTypeByKind,
  type PickupTokenKind,
} from '@/lib/pickup/pickup-types';

export type SpacyAnalyzeToken = {
  i: number;
  start: number;
  end: number;
  pos?: string;
  tag?: string;
  dep?: string;
  head?: number;
  sent?: number;
  isRoot?: boolean;
  text?: string;
};

export type SpacyAnalyzeDoc = {
  text: string;
  tokens: SpacyAnalyzeToken[];
};

type PyodideLike = {
  runPythonAsync: (code: string) => Promise<unknown>;
  globals?: {
    get: (name: string) => unknown;
  };
};

type LoadPyodideFn = (options?: { indexURL?: string }) => Promise<PyodideLike>;

type GlobalWithPyodide = {
  loadPyodide?: LoadPyodideFn;
  __xenLoadPyodidePromise?: Promise<LoadPyodideFn | null>;
};

type AnalyzerRuntime = {
  analyze: (text: string) => SpacyAnalyzeDoc | null;
};

const TOKEN_TEXT_PATTERN = /[A-Za-z0-9]/;
const GRAMMAR_POS = new Set(['AUX', 'ADP', 'SCONJ', 'CCONJ', 'PART', 'DET', 'PRON']);
const GRAMMAR_DEPS = new Set(['aux', 'auxpass', 'cop', 'mark', 'det', 'case', 'neg', 'expl']);
const PREP_PHRASE_DEPS = new Set(['prep', 'pcomp', 'agent']);
const CLAUSE_DEPS = new Set(['advcl', 'acl', 'relcl', 'ccomp', 'xcomp', 'parataxis']);
const CONJ_DEPS = new Set(['cc', 'conj', 'mark', 'preconj']);
const PYODIDE_RUNTIME_VERSION = '0.21.3';
const PYODIDE_RUNTIME_BASE_PATH = `pyodide/${PYODIDE_RUNTIME_VERSION}`;
const PYODIDE_RUNTIME_SCRIPT_PATH = `${PYODIDE_RUNTIME_BASE_PATH}/pyodide.js`;
const PYODIDE_RUNTIME_INDEX_PATH = `${PYODIDE_RUNTIME_BASE_PATH}/`;
const SPACY_BOOTSTRAP_SCRIPT_PATH = 'spacy/visualize.py';
const SPACY_PACKAGES_BASE_PATH = 'spacy/packages';
const SPACY_PACKAGES_BASE_URL_TOKEN = '__SPACY_PACKAGES_BASE_URL__';

let analyzerRuntimePromise: Promise<AnalyzerRuntime | null> | null = null;
let runtimeStatus: PickupModelStatus = {
  status: 'idle',
  error: null,
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: '等待初始化',
};

function setRuntimeStatus(
  status: PickupModelStatus['status'],
  options: Partial<PickupModelStatus> = {},
) {
  runtimeStatus = {
    ...runtimeStatus,
    ...options,
    status,
  };
}

function setRuntimeProgress(progress: number, stage: string) {
  const normalized = Math.max(0, Math.min(100, Math.round(progress)));
  runtimeStatus = {
    ...runtimeStatus,
    progress: normalized,
    stage,
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    const stack = typeof error.stack === 'string'
      ? error.stack.split('\n').slice(0, 3).join(' | ')
      : '';
    return stack.length > 0 ? `${error.message} | ${stack}` : error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'unknown_error';
}

function getRuntimeUrl(path: string): string {
  const normalized = path.replace(/^\/+/, '');
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(normalized);
  }
  return `/${normalized}`;
}

function hydrateBootstrapScript(rawScript: string): string {
  const packagesBaseUrl = getRuntimeUrl(SPACY_PACKAGES_BASE_PATH).replace(/\/+$/, '');
  return rawScript.replaceAll(SPACY_PACKAGES_BASE_URL_TOKEN, packagesBaseUrl);
}

function resolveLoadPyodide(): LoadPyodideFn | null {
  const scope = globalThis as unknown as GlobalWithPyodide;
  if (typeof scope.loadPyodide === 'function') {
    return scope.loadPyodide;
  }
  return null;
}

async function ensureLoadPyodide(): Promise<LoadPyodideFn | null> {
  const existing = resolveLoadPyodide();
  if (existing) {
    return existing;
  }

  const scope = globalThis as unknown as GlobalWithPyodide;
  if (scope.__xenLoadPyodidePromise) {
    return scope.__xenLoadPyodidePromise;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const scriptUrl = getRuntimeUrl(PYODIDE_RUNTIME_SCRIPT_PATH);

  scope.__xenLoadPyodidePromise = new Promise<LoadPyodideFn | null>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(resolveLoadPyodide());
    };
    const fail = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(null);
    };

    const scripts = Array.from(document.getElementsByTagName('script'));
    const existingScript = scripts.find(script => script.src === scriptUrl);
    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true });
      existingScript.addEventListener('error', fail, { once: true });
      window.setTimeout(finish, 0);
      return;
    }

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = false;
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', fail, { once: true });
    (document.head ?? document.documentElement).appendChild(script);
  }).finally(() => {
    delete scope.__xenLoadPyodidePromise;
  });

  return scope.__xenLoadPyodidePromise;
}

function safeJsonParse(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown;
  }
  catch {
    return payload;
  }
}

function normalizeToken(raw: unknown): SpacyAnalyzeToken | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const token = raw as Record<string, unknown>;
  const start = token.start;
  const end = token.end;

  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }

  return {
    i: typeof token.i === 'number' ? token.i : 0,
    start,
    end,
    pos: typeof token.pos === 'string' ? token.pos : undefined,
    tag: typeof token.tag === 'string' ? token.tag : undefined,
    dep: typeof token.dep === 'string' ? token.dep : undefined,
    head: typeof token.head === 'number' ? token.head : undefined,
    sent: typeof token.sent === 'number' ? token.sent : undefined,
    isRoot: typeof token.is_root === 'boolean'
      ? token.is_root
      : typeof token.isRoot === 'boolean'
        ? token.isRoot
        : undefined,
    text: typeof token.text === 'string' ? token.text : undefined,
  };
}

function normalizeSpacyDoc(payload: unknown): SpacyAnalyzeDoc | null {
  if (typeof payload === 'string') {
    return normalizeSpacyDoc(safeJsonParse(payload));
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const text = record.text;
  const tokens = record.tokens;

  if (typeof text !== 'string' || !Array.isArray(tokens)) {
    return null;
  }

  const normalizedTokens = tokens
    .map(item => normalizeToken(item))
    .filter((item): item is SpacyAnalyzeToken => item !== null)
    .sort((a, b) => a.i - b.i);

  if (normalizedTokens.length === 0) {
    return null;
  }

  return {
    text,
    tokens: normalizedTokens,
  };
}

function resolveTokenKind(token: SpacyAnalyzeToken): PickupTokenKind {
  const dep = token.dep?.toLowerCase() ?? '';
  const pos = token.pos?.toUpperCase() ?? '';

  if (
    GRAMMAR_DEPS.has(dep)
    || PREP_PHRASE_DEPS.has(dep)
    || CLAUSE_DEPS.has(dep)
    || CONJ_DEPS.has(dep)
    || GRAMMAR_POS.has(pos)
  ) {
    return 'grammar';
  }

  return 'vocabulary';
}

function resolveTypeId(tokenKind: PickupTokenKind): number {
  if (tokenKind === 'grammar') {
    return PICKUP_TYPE_ID_GRAMMAR;
  }
  return PICKUP_TYPE_ID_VOCABULARY;
}

function isRenderableTokenText(text: string): boolean {
  return TOKEN_TEXT_PATTERN.test(text);
}

function extractTokenText(docText: string, token: SpacyAnalyzeToken): string {
  const start = Math.max(0, Math.min(docText.length, token.start));
  const end = Math.max(start, Math.min(docText.length, token.end));
  const bySpan = docText.slice(start, end);
  if (bySpan.length > 0) {
    return bySpan;
  }
  return token.text ?? '';
}

function tryDestroyProxy(value: unknown) {
  if (!value || typeof value !== 'object') {
    return;
  }

  const maybeDestroy = (value as { destroy?: () => void }).destroy;
  if (typeof maybeDestroy === 'function') {
    maybeDestroy.call(value);
  }
}

function toJsonText(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return null;
  }

  try {
    return String(value);
  }
  catch {
    return null;
  }
}

async function createAnalyzerRuntime(): Promise<AnalyzerRuntime | null> {
  setRuntimeStatus('initializing', {
    error: null,
    startedAt: Date.now(),
    readyAt: null,
    progress: 2,
    stage: '准备加载 Pyodide 运行时',
  });

  try {
    const loadPyodide = await ensureLoadPyodide();
    if (!loadPyodide) {
      setRuntimeStatus('error', {
        error: 'load_pyodide_unavailable',
        stage: 'Pyodide 加载入口不可用',
      });
      return null;
    }

    setRuntimeProgress(8, '加载 Pyodide 核心');
    const pyodide = await loadPyodide({
      indexURL: getRuntimeUrl(PYODIDE_RUNTIME_INDEX_PATH),
    });

    if (!pyodide || typeof pyodide.runPythonAsync !== 'function') {
      setRuntimeStatus('error', {
        error: 'pyodide_runtime_invalid',
        stage: 'Pyodide 运行时不可用',
      });
      return null;
    }

    setRuntimeProgress(34, '加载 spaCy 引导脚本');
    const bootstrapScriptUrl = `${getRuntimeUrl(SPACY_BOOTSTRAP_SCRIPT_PATH)}?v=${PYODIDE_RUNTIME_VERSION}`;
    const response = await fetch(bootstrapScriptUrl);
    if (!response.ok) {
      setRuntimeStatus('error', {
        error: `spacy_bootstrap_fetch_failed_${response.status}`,
        stage: 'spaCy 引导脚本加载失败',
      });
      return null;
    }

    const bootstrapScript = hydrateBootstrapScript(await response.text());
    setRuntimeProgress(55, '安装 spaCy 与模型文件');
    await pyodide.runPythonAsync(bootstrapScript);

    setRuntimeProgress(90, '绑定 analyze 函数');
    const analyzeFn = pyodide.globals?.get('analyze');
    if (!analyzeFn || (typeof analyzeFn !== 'function' && typeof analyzeFn !== 'object')) {
      setRuntimeStatus('error', {
        error: 'analyze_function_missing',
        stage: 'analyze 函数注册失败',
      });
      return null;
    }

    setRuntimeStatus('ready', {
      error: null,
      readyAt: Date.now(),
      progress: 100,
      stage: '模型已就绪',
    });

    return {
      analyze(text: string) {
        try {
          const callable = analyzeFn as (value: string) => unknown;
          const raw = callable(text);
          const payload = toJsonText(raw);
          tryDestroyProxy(raw);
          if (!payload) {
            return null;
          }
          return normalizeSpacyDoc(payload);
        }
        catch (error) {
          console.warn('spaCy analyze call failed:', error);
          return null;
        }
      },
    };
  }
  catch (error) {
    console.warn('Pyodide spaCy initialization failed:', error);
    setRuntimeStatus('error', {
      error: describeError(error),
      stage: '初始化失败，等待重试',
    });
    return null;
  }
}

async function getAnalyzerRuntime(forceRetry = false): Promise<AnalyzerRuntime | null> {
  if (forceRetry && runtimeStatus.status === 'error') {
    analyzerRuntimePromise = null;
  }

  if (!analyzerRuntimePromise) {
    analyzerRuntimePromise = createAnalyzerRuntime();
  }

  return analyzerRuntimePromise;
}

export function getSpacyRuntimeStatus(): PickupModelStatus {
  return { ...runtimeStatus };
}

export async function warmupSpacyRuntime(): Promise<PickupModelStatus> {
  await getAnalyzerRuntime(true);
  return getSpacyRuntimeStatus();
}

export function mapSpacyDocToPickupTokens(doc: SpacyAnalyzeDoc): PickupToken[] {
  return doc.tokens
    .map((token) => {
      const kind = resolveTokenKind(token);
      const type = getPickupTypeByKind(kind);
      const text = extractTokenText(doc.text, token);
      return {
        text,
        typeId: resolveTypeId(kind),
        tag: type.tag,
        kind,
        label: type.name,
        start: token.start,
        end: token.end,
        tokenIndex: token.i,
        headIndex: token.head,
        pos: token.pos,
        dep: token.dep,
        spacyTag: token.tag,
        sentence: token.sent,
        isRoot: token.isRoot,
      };
    })
    .filter(token => isRenderableTokenText(token.text));
}

export async function analyzeTextWithSpacy(text: string): Promise<PickupToken[] | null> {
  const runtime = await getAnalyzerRuntime();
  if (!runtime) {
    return null;
  }

  const doc = runtime.analyze(text);
  if (!doc) {
    return null;
  }

  const tokens = mapSpacyDocToPickupTokens(doc);
  if (tokens.length === 0) {
    return null;
  }

  return tokens;
}
