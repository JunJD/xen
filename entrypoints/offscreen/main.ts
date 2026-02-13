import type { PickupModelStatus } from '@/lib/pickup/messages';
import {
  PICKUP_OFFSCREEN_ACTION_ANALYZE,
  PICKUP_OFFSCREEN_ACTION_STATUS,
  PICKUP_OFFSCREEN_ACTION_WARMUP,
  PICKUP_OFFSCREEN_CHANNEL,
  isPickupOffscreenRequest,
  type PickupOffscreenResponse,
} from '@/lib/pickup/offscreen-protocol';
import {
  analyzeTextWithSpacy,
  getSpacyRuntimeStatus,
  warmupSpacyRuntime,
} from '@/lib/pickup/spacy/analyzer';

const STATUS_ERROR_RUNTIME_UNAVAILABLE = 'offscreen_runtime_unavailable';
const STATUS_STAGE_RUNTIME_UNAVAILABLE = 'offscreen runtime 不可用';

const FALLBACK_STATUS: PickupModelStatus = {
  status: 'error',
  error: STATUS_ERROR_RUNTIME_UNAVAILABLE,
  startedAt: null,
  readyAt: null,
  progress: 0,
  stage: STATUS_STAGE_RUNTIME_UNAVAILABLE,
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
    if (message.action === PICKUP_OFFSCREEN_ACTION_WARMUP) {
      const status = await warmupSpacyRuntime();
      sendResponse({ ok: true, status });
      return;
    }

    if (message.action === PICKUP_OFFSCREEN_ACTION_STATUS) {
      sendResponse({ ok: true, status: getSpacyRuntimeStatus() });
      return;
    }

    if (message.action === PICKUP_OFFSCREEN_ACTION_ANALYZE) {
      const tokens = await analyzeTextWithSpacy(message.text);
      sendResponse({
        ok: true,
        tokens: tokens ?? [],
      });
      return;
    }

    sendResponse({ ok: true, tokens: [] });
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
