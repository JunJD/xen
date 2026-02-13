import type { PickupModelStatus } from '@/lib/pickup/messages';
import {
  PICKUP_OFFSCREEN_CHANNEL,
  isPickupOffscreenRequest,
  type PickupOffscreenResponse,
} from '@/lib/pickup/offscreen-protocol';
import {
  analyzeTextWithSpacy,
  getSpacyRuntimeStatus,
  warmupSpacyRuntime,
} from '@/lib/pickup/spacy/analyzer';

declare const chrome:
  | {
    runtime?: {
      onMessage?: {
        addListener: (
          callback: (
            message: unknown,
            sender: unknown,
            sendResponse: (response: PickupOffscreenResponse) => void,
          ) => boolean | void,
        ) => void;
      };
    };
  }
  | undefined;

const FALLBACK_STATUS: PickupModelStatus = {
  status: 'error',
  error: 'offscreen_runtime_unavailable',
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: 'offscreen runtime 不可用',
};

function buildErrorResponse(error: unknown): PickupOffscreenResponse {
  const message = error instanceof Error ? error.message : String(error ?? 'unknown_error');
  return {
    ok: false,
    error: message,
    status: getSpacyRuntimeStatus(),
  };
}

chrome?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (!isPickupOffscreenRequest(message)) {
    return;
  }

  void (async () => {
    if (message.action === 'warmup') {
      const status = await warmupSpacyRuntime();
      sendResponse({ ok: true, status });
      return;
    }

    if (message.action === 'status') {
      sendResponse({ ok: true, status: getSpacyRuntimeStatus() });
      return;
    }

    const tokens = await analyzeTextWithSpacy(message.text);
    sendResponse({
      ok: true,
      tokens: tokens ?? [],
    });
  })().catch((error) => {
    console.warn('Offscreen handler failed:', error);
    sendResponse(buildErrorResponse(error));
  });

  return true;
});

void warmupSpacyRuntime().catch((error) => {
  console.warn('Offscreen warmup failed:', error);
});

if (!chrome?.runtime?.onMessage) {
  console.warn(PICKUP_OFFSCREEN_CHANNEL, FALLBACK_STATUS.error);
}
