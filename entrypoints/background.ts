import { defineBackground } from '#imports';
import { sha256 } from 'js-sha256';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupToken,
} from '@/lib/pickup/messages';
import { createPickupCache } from '@/lib/pickup/cache';
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

const FALLBACK_MODEL_STATUS: PickupModelStatus = {
  status: 'error',
  error: 'offscreen_unavailable',
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: 'offscreen 不可用',
};

let warmupInFlight = false;
let creatingOffscreenDocument: Promise<void> | null = null;
let offscreenDocumentReady = false;

const cache = createPickupCache();

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

export default defineBackground(() => {
  const runtime = chrome?.runtime;
  runtime?.onInstalled?.addListener(() => {
    void triggerWarmup();
  });
  runtime?.onStartup?.addListener(() => {
    void triggerWarmup();
  });
  void triggerWarmup();
  void cache.maybePrune('startup');

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
    let wroteCache = false;

    for (const paragraph of paragraphs) {
      const sourceHash = paragraph.hash ?? sha256(paragraph.text);
      const cached = await cache.get(sourceHash);
      if (cached?.value && cached.value.length > 0) {
        annotations.push({ id: paragraph.id, tokens: cached.value });
        continue;
      }

      const tokens = await buildTokens(paragraph.text);
      if (tokens.length === 0) {
        continue;
      }

      annotations.push({ id: paragraph.id, tokens });
      await cache.set(sourceHash, tokens);
      wroteCache = true;
    }

    if (wroteCache) {
      void cache.maybePrune('annotate');
    }

    return { annotations };
  });
});
