import type { PickupModelStatus, PickupToken } from './messages';

export const PICKUP_OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
export const PICKUP_OFFSCREEN_CHANNEL = 'pickup-offscreen';
export const PICKUP_OFFSCREEN_ACTION_WARMUP = 'warmup';
export const PICKUP_OFFSCREEN_ACTION_STATUS = 'status';
export const PICKUP_OFFSCREEN_ACTION_ANALYZE = 'analyze';

export type PickupOffscreenRequest =
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: typeof PICKUP_OFFSCREEN_ACTION_WARMUP;
  }
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: typeof PICKUP_OFFSCREEN_ACTION_STATUS;
  }
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: typeof PICKUP_OFFSCREEN_ACTION_ANALYZE;
    text: string;
  };

export type PickupOffscreenResponse =
  | {
    ok: true;
    status: PickupModelStatus;
  }
  | {
    ok: true;
    tokens: PickupToken[];
  }
  | {
    ok: false;
    error: string;
    status?: PickupModelStatus;
  };

export function isPickupOffscreenRequest(value: unknown): value is PickupOffscreenRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const message = value as Record<string, unknown>;
  if (message.channel !== PICKUP_OFFSCREEN_CHANNEL) {
    return false;
  }

  if (message.action === PICKUP_OFFSCREEN_ACTION_WARMUP || message.action === PICKUP_OFFSCREEN_ACTION_STATUS) {
    return true;
  }

  if (message.action === PICKUP_OFFSCREEN_ACTION_ANALYZE && typeof message.text === 'string') {
    return true;
  }

  return false;
}
