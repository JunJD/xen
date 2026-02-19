import { sha256 } from 'js-sha256';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  PickupTranslateUnitInput,
  PickupTranslateUnitPreview,
  PickupToken,
  TranslateProvider,
} from '@/lib/pickup/messages';
import { createPickupCache, createTranslationCache } from '@/lib/pickup/cache';
import {
  CACHE_PRUNE_REASONS,
  MESSAGE_TYPES,
  STATUS_ERROR_CODES,
} from '@/lib/pickup/constants';
import {
  loadVocabDictionary,
  lookupVocabAllPos,
  lookupVocabPhones,
  lookupVocabTranslation,
  type VocabDictionary,
} from '@/lib/pickup/vocab/dictionary';
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
  ensureTranslateProviderConfig,
  ensureTranslateProvidersRegistered,
  getStoredLlmModel,
  getStoredTranslateProvider,
  isTranslateProvider,
  setStoredTranslateProvider,
  translateText,
} from './translate';

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
type TranslationCache = ReturnType<typeof createTranslationCache>;

export type PickupBackgroundOptions = {
  modelKey?: string | (() => string);
};

async function resolveTranslationModelKey(provider: TranslateProvider) {
  if (provider !== 'llm') {
    return `translate:${provider}`;
  }
  const model = await getStoredLlmModel().catch(() => 'gpt-4o-mini');
  return `translate:${provider}:${model}`;
}

const translationCaches = new Map<string, TranslationCache>();

function getTranslationCache(modelKey: string) {
  let cache = translationCaches.get(modelKey);
  if (!cache) {
    cache = createTranslationCache({ modelKey: () => modelKey });
    translationCaches.set(modelKey, cache);
  }
  return cache;
}

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

function buildUnitTranslationPreview(
  unit: PickupTranslateUnitInput,
  dictionary: VocabDictionary,
): PickupTranslateUnitPreview {
  const vocabTranslation = lookupVocabTranslation(unit.text, dictionary, unit.pos) ?? '';
  const vocabHint = lookupVocabAllPos(unit.text, dictionary) ?? '';
  const phones = lookupVocabPhones(unit.text, dictionary);
  return {
    unitId: unit.unitId,
    vocabInfusionText: vocabTranslation,
    vocabInfusionHint: vocabHint,
    usphone: phones?.usphone,
    ukphone: phones?.ukphone,
    syntaxRebuildText: '',
    context: unit,
  };
}

function buildParagraphTranslationPreview(
  paragraph: PickupTranslateParagraphInput,
  dictionary: VocabDictionary,
  paragraphText: string,
): PickupTranslateParagraphPreview {
  return {
    id: paragraph.id,
    sourceText: paragraph.sourceText,
    paragraphText,
    units: paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary)),
  };
}

async function buildTranslationPreviews(
  paragraphs: PickupTranslateParagraphInput[],
  provider: TranslateProvider,
): Promise<PickupTranslateParagraphPreview[]> {
  if (paragraphs.length === 0) {
    return [];
  }
  const modelKey = await resolveTranslationModelKey(provider);
  const translationCache = getTranslationCache(modelKey);
  const dictionary = await loadVocabDictionary();
  const previews: PickupTranslateParagraphPreview[] = [];
  let wroteCache = false;
  for (const paragraph of paragraphs) {
    const sourceText = paragraph.sourceText ?? '';
    const cleanText = sourceText.replace(/\u200B/g, '').trim();
    let paragraphText = '';
    if (cleanText) {
      const sourceHash = sha256(cleanText);
      const cached = await translationCache.get(sourceHash);
      const cachedValue = cached?.value?.trim() ?? '';
      if (cachedValue) {
        paragraphText = cached!.value;
      } else {
        paragraphText = await translateText(provider, { text: cleanText });
        if (paragraphText.trim()) {
          await translationCache.set(sourceHash, paragraphText);
          wroteCache = true;
        }
      }
    }
    previews.push(buildParagraphTranslationPreview(paragraph, dictionary, paragraphText));
  }
  if (wroteCache) {
    void translationCache.maybePrune(CACHE_PRUNE_REASONS.translate);
  }
  return previews;
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

  onMessage(MESSAGE_TYPES.openOptions, async () => {
    const optionsUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('options.html#general')
      : null;
    try {
      if (chrome?.tabs?.create && optionsUrl) {
        await chrome.tabs.create({ url: optionsUrl });
        return { ok: true };
      }
    } catch (error) {
      console.warn('Open options page failed:', error);
    }
    try {
      if (chrome?.runtime?.openOptionsPage) {
        await chrome.runtime.openOptionsPage();
        return { ok: true };
      }
    } catch (error) {
      console.warn('Fallback openOptionsPage failed:', error);
    }
    return { ok: false };
  });

  onMessage(MESSAGE_TYPES.translatePreview, async (message) => {
    const paragraphs = (message.data?.paragraphs ?? []) as PickupTranslateParagraphInput[];
    const provider = isTranslateProvider(message.data?.provider)
      ? message.data.provider
      : await getStoredTranslateProvider();
    const translations = await buildTranslationPreviews(paragraphs, provider);
    return { translations };
  });
}
