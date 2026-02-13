import { defineBackground } from '#imports';
import Dexie, { type Table } from 'dexie';
import { sha256 } from 'js-sha256';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupToken,
} from '@/lib/pickup/messages';
import {
  PICKUP_OFFSCREEN_CHANNEL,
  PICKUP_OFFSCREEN_DOCUMENT_PATH,
  type PickupOffscreenRequest,
  type PickupOffscreenResponse,
} from '@/lib/pickup/offscreen-protocol';
import { onMessage } from '@/lib/pickup/messaging';

declare const chrome:
  | {
    runtime?: {
      getURL?: (path: string) => string;
      sendMessage?: (message: PickupOffscreenRequest) => Promise<PickupOffscreenResponse>;
      getContexts?: (query: {
        contextTypes?: string[];
        documentUrls?: string[];
      }) => Promise<Array<{ contextType?: string; documentUrl?: string }>>;
      onInstalled?: { addListener: (callback: () => void) => void };
      onStartup?: { addListener: (callback: () => void) => void };
    };
    offscreen?: {
      createDocument?: (options: {
        url: string;
        reasons: string[];
        justification: string;
      }) => Promise<void>;
    };
  }
  | undefined;

type PickupCacheEntry = {
  hash: string;
  sourceHash: string;
  modelKey: string;
  version: number;
  tokens: PickupToken[];
  updatedAt: number;
  lastAccessed: number;
};

const CACHE_DB_VERSION = 2;
const CACHE_ENTRY_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const CACHE_MAX_ENTRIES = 5000;
const CACHE_CLEAN_INTERVAL_MS = 1000 * 60 * 30; // 30 minutes
const CACHE_ACCESS_UPDATE_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes
const CACHE_MODEL_KEY = 'spacy-pyodide-0.21.3';

const FALLBACK_MODEL_STATUS: PickupModelStatus = {
  status: 'error',
  error: 'offscreen_unavailable',
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: 'offscreen 不可用',
};

class PickupCacheDB extends Dexie {
  annotations!: Table<PickupCacheEntry, string>;

  constructor() {
    super('xenPickupCache');
    this.version(1).stores({
      annotations: '&hash, updatedAt',
    });
    this.version(CACHE_DB_VERSION).stores({
      annotations: '&hash, updatedAt, lastAccessed, modelKey, version',
    }).upgrade((tx) => {
      return tx.table('annotations').toCollection().modify((entry: PickupCacheEntry) => {
        const now = Date.now();
        entry.lastAccessed = entry.lastAccessed ?? entry.updatedAt ?? now;
        entry.version = entry.version ?? CACHE_ENTRY_VERSION;
        entry.modelKey = entry.modelKey ?? 'unknown';
        entry.sourceHash = entry.sourceHash ?? entry.hash;
        entry.updatedAt = entry.updatedAt ?? now;
      });
    });
  }
}

const db = new PickupCacheDB();
let warmupInFlight = false;
let creatingOffscreenDocument: Promise<void> | null = null;
let offscreenDocumentReady = false;
let lastCachePruneAt = 0;
let cachePruneInFlight: Promise<void> | null = null;

function getCacheModelKey() {
  return CACHE_MODEL_KEY;
}

function buildCacheKey(sourceHash: string, modelKey: string) {
  return sha256(`${modelKey}|${sourceHash}`);
}

function isEntryExpired(entry: PickupCacheEntry, now: number) {
  return now - entry.updatedAt > CACHE_TTL_MS;
}

async function pruneCache(reason: string) {
  if (cachePruneInFlight) {
    return cachePruneInFlight;
  }

  cachePruneInFlight = (async () => {
    const now = Date.now();
    const expireBefore = now - CACHE_TTL_MS;

    try {
      await db.annotations.where('updatedAt').below(expireBefore).delete();
      await db.annotations.where('version').notEqual(CACHE_ENTRY_VERSION).delete();

      const total = await db.annotations.count();
      if (total > CACHE_MAX_ENTRIES) {
        const toRemove = total - CACHE_MAX_ENTRIES;
        const keys = await db.annotations
          .orderBy('lastAccessed')
          .limit(toRemove)
          .primaryKeys();
        if (keys.length > 0) {
          await db.annotations.bulkDelete(keys);
        }
      }
    }
    catch (error) {
      console.warn('Cache prune failed:', reason, error);
    }
  })().finally(() => {
    cachePruneInFlight = null;
  });

  return cachePruneInFlight;
}

function maybePruneCache(reason: string) {
  const now = Date.now();
  if (now - lastCachePruneAt < CACHE_CLEAN_INTERVAL_MS) {
    return;
  }
  lastCachePruneAt = now;
  void pruneCache(reason);
}

async function ensureOffscreenDocument(): Promise<boolean> {
  const runtime = chrome?.runtime;
  const offscreen = chrome?.offscreen;

  if (!runtime?.getURL || !offscreen?.createDocument) {
    return false;
  }

  if (offscreenDocumentReady) {
    return true;
  }

  const documentUrl = runtime.getURL(PICKUP_OFFSCREEN_DOCUMENT_PATH);

  if (runtime.getContexts) {
    try {
      const contexts = await runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [documentUrl],
      });
      if (contexts.length > 0) {
        offscreenDocumentReady = true;
        return true;
      }
    }
    catch (error) {
      console.warn('Failed to query offscreen contexts:', error);
    }
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = offscreen.createDocument({
      url: PICKUP_OFFSCREEN_DOCUMENT_PATH,
      reasons: ['WORKERS'],
      justification: 'Run spaCy model warmup and analysis outside MV3 service worker lifecycle.',
    }).finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  try {
    await creatingOffscreenDocument;
    offscreenDocumentReady = true;
    return true;
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.includes('Only a single offscreen document')) {
      offscreenDocumentReady = true;
      return true;
    }
    console.warn('Failed to create offscreen document:', error);
    return false;
  }
}

async function sendOffscreenRequest(
  request: PickupOffscreenRequest,
): Promise<PickupOffscreenResponse | null> {
  const runtime = chrome?.runtime;
  if (!runtime?.sendMessage) {
    return null;
  }

  const ok = await ensureOffscreenDocument();
  if (!ok) {
    return null;
  }

  try {
    return await runtime.sendMessage(request);
  }
  catch (error) {
    console.warn('Offscreen request failed:', error);
    return null;
  }
}

async function triggerWarmup() {
  if (warmupInFlight) {
    return;
  }

  warmupInFlight = true;
  try {
    await sendOffscreenRequest({
      channel: PICKUP_OFFSCREEN_CHANNEL,
      action: 'warmup',
    });
  }
  finally {
    warmupInFlight = false;
  }
}

function pickStatusFromResponse(
  response: PickupOffscreenResponse | null,
  fallbackError: string,
): PickupModelStatus {
  if (response?.ok && 'status' in response) {
    return response.status;
  }

  if (response && !response.ok && response.status) {
    return response.status;
  }

  return {
    ...FALLBACK_MODEL_STATUS,
    error: fallbackError,
  };
}

async function buildTokens(text: string): Promise<PickupToken[]> {
  const response = await sendOffscreenRequest({
    channel: PICKUP_OFFSCREEN_CHANNEL,
    action: 'analyze',
    text,
  });

  if (response?.ok && 'tokens' in response) {
    return response.tokens;
  }

  return [];
}

async function getCachedTokens(hash: string, modelKey: string) {
  try {
    const entry = await db.annotations.get(hash);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (entry.version !== CACHE_ENTRY_VERSION || entry.modelKey !== modelKey || isEntryExpired(entry, now)) {
      await db.annotations.delete(hash);
      return null;
    }

    if (!entry.lastAccessed || now - entry.lastAccessed > CACHE_ACCESS_UPDATE_INTERVAL_MS) {
      await db.annotations.update(hash, { lastAccessed: now });
    }

    return entry;
  }
  catch {
    return null;
  }
}

async function setCachedTokens(hash: string, sourceHash: string, modelKey: string, tokens: PickupToken[]) {
  try {
    const now = Date.now();
    await db.annotations.put({
      hash,
      sourceHash,
      modelKey,
      version: CACHE_ENTRY_VERSION,
      tokens,
      updatedAt: now,
      lastAccessed: now,
    });
  }
  catch {
    return;
  }
}

export default defineBackground(() => {
  const runtime = chrome?.runtime;
  runtime?.onInstalled?.addListener(() => {
    void triggerWarmup();
  });
  runtime?.onStartup?.addListener(() => {
    void triggerWarmup();
  });
  void triggerWarmup();
  maybePruneCache('startup');

  onMessage('pickupModelWarmup', async () => {
    await triggerWarmup();
    const response = await sendOffscreenRequest({
      channel: PICKUP_OFFSCREEN_CHANNEL,
      action: 'status',
    });
    return {
      status: pickStatusFromResponse(response, 'warmup_status_unavailable'),
    };
  });

  onMessage('pickupModelStatus', async () => {
    const response = await sendOffscreenRequest({
      channel: PICKUP_OFFSCREEN_CHANNEL,
      action: 'status',
    });
    return {
      status: pickStatusFromResponse(response, 'model_status_unavailable'),
    };
  });

  onMessage('pickupAnnotate', async (message) => {
    const paragraphs = (message.data?.paragraphs ?? []) as PickupParagraph[];
    const annotations: PickupAnnotation[] = [];
    const modelKey = getCacheModelKey();
    let wroteCache = false;

    for (const paragraph of paragraphs) {
      const sourceHash = paragraph.hash ?? sha256(paragraph.text);
      const cacheKey = buildCacheKey(sourceHash, modelKey);
      const cached = await getCachedTokens(cacheKey, modelKey);
      if (cached?.tokens && cached.tokens.length > 0) {
        annotations.push({ id: paragraph.id, tokens: cached.tokens });
        continue;
      }

      const tokens = await buildTokens(paragraph.text);
      if (tokens.length === 0) {
        continue;
      }

      annotations.push({ id: paragraph.id, tokens });
      await setCachedTokens(cacheKey, sourceHash, modelKey, tokens);
      wroteCache = true;
    }

    if (wroteCache) {
      maybePruneCache('annotate');
    }

    return { annotations };
  });
});
