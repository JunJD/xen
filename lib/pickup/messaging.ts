import { defineExtensionMessaging } from '@webext-core/messaging';
import type { PickupAnnotation, PickupModelStatus, PickupParagraph } from './messages';

interface PickupProtocolMap {
  pickupAnnotate: (data: { paragraphs: PickupParagraph[] }) => Promise<{ annotations: PickupAnnotation[] }>;
  pickupModelWarmup: () => Promise<{ status: PickupModelStatus }>;
  pickupModelStatus: () => Promise<{ status: PickupModelStatus }>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<PickupProtocolMap>();
