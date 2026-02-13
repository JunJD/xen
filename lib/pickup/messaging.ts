import { defineExtensionMessaging } from '@webext-core/messaging';
import type { PickupAnnotation, PickupParagraph } from './messages';

interface PickupProtocolMap {
  pickupAnnotate: (data: { paragraphs: PickupParagraph[] }) => Promise<{ annotations: PickupAnnotation[] }>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<PickupProtocolMap>();
