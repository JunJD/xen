import type { PickupModelStatus, PickupToken } from './messages';

export const PICKUP_OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
export const PICKUP_OFFSCREEN_CHANNEL = 'pickup-offscreen';

export type PickupOffscreenRequest =
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: 'warmup';
  }
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: 'status';
  }
  | {
    channel: typeof PICKUP_OFFSCREEN_CHANNEL;
    action: 'analyze';
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

  if (message.action === 'warmup' || message.action === 'status') {
    return true;
  }

  if (message.action === 'analyze' && typeof message.text === 'string') {
    return true;
  }

  return false;
}
