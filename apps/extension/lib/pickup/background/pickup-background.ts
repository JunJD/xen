import { sha256 } from 'js-sha256';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupToken,
} from '@/lib/pickup/messages';
import { createPickupCache } from '@/lib/pickup/cache';
import {
  CACHE_PRUNE_REASONS,
  MESSAGE_TYPES,
  STATUS_ERROR_CODES,
} from '@/lib/pickup/constants';
import { buildWebAuthUrl } from '@/lib/auth/clerk';
import {
  PICKUP_OFFSCREEN_ACTION_ANALYZE,
  PICKUP_OFFSCREEN_ACTION_STATUS,
  PICKUP_OFFSCREEN_ACTION_WARMUP,
  PICKUP_OFFSCREEN_CHANNEL,
  PICKUP_OFFSCREEN_DOCUMENT_PATH,
  type PickupOffscreenRequest,
  type PickupOffscreenResponse,
} from '@/lib/pickup/offscreen-protocol';
import { onMessage } from '@/lib/pickup/messaging';
import {
  getBackgroundAuthStatus,
  getBackgroundSessionToken,
  signOutBackgroundSession,
} from '@/lib/pickup/background/auth/clerk';
import {
  ensureTranslateProviderConfig,
  ensureTranslateProvidersRegistered,
  getStoredTranslateProvider,
  isTranslateProvider,
  setStoredTranslateProvider,
} from './translate';
import { buildTranslationPreviews } from './translate/preview';

const OFFSCREEN_CONFIG = {
  contextType: 'OFFSCREEN_DOCUMENT',
  createReason: 'WORKERS',
  alreadyExistsMessage: 'Only a single offscreen document',
  justification: 'Run spaCy model warmup and analysis outside MV3 service worker lifecycle.',
  stageUnavailable: 'offscreen 不可用',
} as const;

const OFFSCREEN_CONTEXT_TYPES = [OFFSCREEN_CONFIG.contextType];

const FALLBACK_MODEL_STATUS: PickupModelStatus = {
  status: 'error',
  error: STATUS_ERROR_CODES.offscreenUnavailable,
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: OFFSCREEN_CONFIG.stageUnavailable,
};

type OffscreenClient = {
  send: (request: PickupOffscreenRequest) => Promise<PickupOffscreenResponse | null>;
  warmup: () => Promise<void>;
};

type PickupCache = ReturnType<typeof createPickupCache>;

export type PickupBackgroundOptions = {
  modelKey?: string | (() => string);
};

function createOffscreenClient(): OffscreenClient {
  let warmupInFlight = false;
  let creatingOffscreenDocument: Promise<void> | null = null;
  let offscreenDocumentReady = false;

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
          contextTypes: OFFSCREEN_CONTEXT_TYPES,
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
        reasons: [OFFSCREEN_CONFIG.createReason],
        justification: OFFSCREEN_CONFIG.justification,
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
      if (message.includes(OFFSCREEN_CONFIG.alreadyExistsMessage)) {
        offscreenDocumentReady = true;
        return true;
      }
      console.warn('Failed to create offscreen document:', error);
      return false;
    }
  }

  async function send(request: PickupOffscreenRequest): Promise<PickupOffscreenResponse | null> {
    const runtime = chrome?.runtime;
    if (!runtime?.sendMessage) {
      return null;
    }

    const ok = await ensureOffscreenDocument();
    if (!ok) {
      return null;
    }

    try {
      return await runtime.sendMessage<PickupOffscreenResponse>(request);
    }
    catch (error) {
      console.warn('Offscreen request failed:', error);
      return null;
    }
  }

  async function warmup() {
    if (warmupInFlight) {
      return;
    }

    warmupInFlight = true;
    try {
      await send({
        channel: PICKUP_OFFSCREEN_CHANNEL,
        action: PICKUP_OFFSCREEN_ACTION_WARMUP,
      });
    }
    finally {
      warmupInFlight = false;
    }
  }

  return {
    send,
    warmup,
  };
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

async function requestTokens(client: OffscreenClient, text: string): Promise<PickupToken[]> {
  const response = await client.send({
    channel: PICKUP_OFFSCREEN_CHANNEL,
    action: PICKUP_OFFSCREEN_ACTION_ANALYZE,
    text,
  });

  if (response?.ok && 'tokens' in response) {
    return response.tokens;
  }

  return [];
}

async function annotateParagraphs(
  client: OffscreenClient,
  cache: PickupCache,
  paragraphs: PickupParagraph[],
): Promise<PickupAnnotation[]> {
  const annotations: PickupAnnotation[] = [];
  let wroteCache = false;

  for (const paragraph of paragraphs) {
    const sourceHash = paragraph.hash ?? sha256(paragraph.text);
    const cached = await cache.get(sourceHash);
    if (cached?.value && cached.value.length > 0) {
      annotations.push({ id: paragraph.id, tokens: cached.value });
      continue;
    }

    const tokens = await requestTokens(client, paragraph.text);
    if (tokens.length === 0) {
      continue;
    }

    annotations.push({ id: paragraph.id, tokens });
    await cache.set(sourceHash, tokens);
    wroteCache = true;
  }

  if (wroteCache) {
    void cache.maybePrune(CACHE_PRUNE_REASONS.annotate);
  }

  return annotations;
}

function resolveModelKey(modelKey?: string | (() => string)) {
  if (!modelKey) {
    return undefined;
  }

  return annotations;
}
function resolveModelKey(modelKey?: string | (() => string)) {
  if (!modelKey) {
    return undefined;
  }
  if (typeof modelKey === 'function') {
    return modelKey;
  }
  return () => modelKey;
}

export function setupPickupBackground(options: PickupBackgroundOptions = {}) {
  const runtime = chrome?.runtime;
  const tabs = chrome?.tabs;
  const offscreenClient = createOffscreenClient();
  const cache = createPickupCache({ modelKey: resolveModelKey(options.modelKey) });
  ensureTranslateProvidersRegistered();
  void ensureTranslateProviderConfig().catch((error) => {
    console.error('Translate provider config failed:', error);
  });

  runtime?.onInstalled?.addListener(() => {
    void offscreenClient.warmup();
  });
  runtime?.onStartup?.addListener(() => {
    void offscreenClient.warmup();
  });

  const authTabIds = new Set<number>();
  let authPollTimer: ReturnType<typeof setTimeout> | null = null;
  let authPollRunning = false;

  const stopAuthPolling = () => {
    if (authPollTimer !== null) {
      globalThis.clearTimeout(authPollTimer);
      authPollTimer = null;
    }
  };

  const scheduleAuthPoll = () => {
    if (authPollTimer !== null) {
      return;
    }
    authPollTimer = globalThis.setTimeout(() => {
      authPollTimer = null;
      void pollAuthAndCloseTabs();
    }, 900);
  };

  const closeTrackedAuthTabs = async () => {
    if (!tabs?.remove || authTabIds.size === 0) {
      authTabIds.clear();
      stopAuthPolling();
      return;
    }
    const tabIds = [...authTabIds];
    authTabIds.clear();
    await tabs.remove(tabIds);
    stopAuthPolling();
  };

  const pollAuthAndCloseTabs = async () => {
    if (authPollRunning || authTabIds.size === 0) {
      if (authTabIds.size === 0) {
        stopAuthPolling();
      }
      return;
    }
    authPollRunning = true;
    try {
      const status = await getBackgroundAuthStatus();
      if (status.authenticated) {
        await closeTrackedAuthTabs();
      } else {
        scheduleAuthPoll();
      }
    } finally {
      authPollRunning = false;
    }
  };

  tabs?.onRemoved?.addListener((tabId) => {
    if (authTabIds.delete(tabId) && authTabIds.size === 0) {
      stopAuthPolling();
    }
  });

  tabs?.onUpdated?.addListener((tabId, changeInfo) => {
    if (!authTabIds.has(tabId)) {
      return;
    }
    if (changeInfo.status === 'complete' || typeof changeInfo.url === 'string') {
      void pollAuthAndCloseTabs();
    }
  });

  void offscreenClient.warmup();
  void cache.maybePrune(CACHE_PRUNE_REASONS.startup);

  onMessage(MESSAGE_TYPES.modelWarmup, async () => {
    await offscreenClient.warmup();
    const response = await offscreenClient.send({
      channel: PICKUP_OFFSCREEN_CHANNEL,
      action: PICKUP_OFFSCREEN_ACTION_STATUS,
    });
    return {
      status: pickStatusFromResponse(response, STATUS_ERROR_CODES.warmupUnavailable),
    };
  });

  onMessage(MESSAGE_TYPES.modelStatus, async () => {
    const response = await offscreenClient.send({
      channel: PICKUP_OFFSCREEN_CHANNEL,
      action: PICKUP_OFFSCREEN_ACTION_STATUS,
    });
    return {
      status: pickStatusFromResponse(response, STATUS_ERROR_CODES.modelUnavailable),
    };
  });

  onMessage(MESSAGE_TYPES.annotate, async (message) => {
    const paragraphs = (message.data?.paragraphs ?? []) as PickupParagraph[];
    const annotations = await annotateParagraphs(offscreenClient, cache, paragraphs);
    return { annotations };
  });

  onMessage(MESSAGE_TYPES.translateProviderGet, async () => {
    const provider = await getStoredTranslateProvider();
    return { provider };
  });

  onMessage(MESSAGE_TYPES.translateProviderSet, async (message) => {
    const nextProvider = message.data?.provider;
    if (!isTranslateProvider(nextProvider)) {
      throw new Error('Translate provider is required.');
    }
    const provider = await setStoredTranslateProvider(nextProvider);
    return { provider };
  });

  onMessage(MESSAGE_TYPES.authTokenGet, async () => {
    const token = await getBackgroundSessionToken();
    return { token };
  });

  onMessage(MESSAGE_TYPES.authStatusGet, async () => {
    return await getBackgroundAuthStatus();
  });

  onMessage(MESSAGE_TYPES.authSignOut, async () => {
    const ok = await signOutBackgroundSession();
    return { ok };
  });

  onMessage(MESSAGE_TYPES.authOpen, async (message) => {
    const mode = message.data?.mode;
    if (mode !== 'sign-in' && mode !== 'sign-up') {
      throw new Error('Auth mode is required.');
    }
    if (!tabs?.create) {
      throw new Error('chrome.tabs.create is unavailable in background.');
    }
    const authUrl = buildWebAuthUrl(mode);
    const createdTab = await tabs.create({ url: authUrl });
    if (typeof createdTab.id !== 'number') {
      throw new Error('Failed to create auth tab.');
    }
    authTabIds.add(createdTab.id);
    scheduleAuthPoll();
    return { ok: true, tabId: createdTab.id };
  });

  onMessage(MESSAGE_TYPES.openOptions, async () => {
    if (!chrome?.runtime?.getURL || !chrome?.tabs?.create) {
      throw new Error('Options page open API is unavailable.');
    }
    const optionsUrl = chrome.runtime.getURL('options.html#general');
    await chrome.tabs.create({ url: optionsUrl });
    return { ok: true };
  });

  onMessage(MESSAGE_TYPES.translatePreview, async (message) => {
    const paragraphs = (message.data?.paragraphs ?? []) as PickupTranslateParagraphInput[];
    const provider = isTranslateProvider(message.data?.provider)
      ? message.data.provider
      : await getStoredTranslateProvider();
    const includeParagraphTranslation = message.data?.includeParagraphTranslation !== false;
    const includeUnitTranslation = message.data?.includeUnitTranslation !== false;
    const translations = await buildTranslationPreviews(paragraphs, provider, {
      includeParagraphTranslation,
      includeUnitTranslation,
    });
    return { translations };
  });
}
