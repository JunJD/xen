import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from './messages';
import { MESSAGE_TYPES } from './constants';

interface PickupProtocolMap {
  [MESSAGE_TYPES.annotate]: (data: { paragraphs: PickupParagraph[] }) => Promise<{ annotations: PickupAnnotation[] }>;
  [MESSAGE_TYPES.translatePreview]: (data: {
    paragraphs: PickupTranslateParagraphInput[];
  }) => Promise<{ translations: PickupTranslateParagraphPreview[] }>;
  [MESSAGE_TYPES.modelWarmup]: () => Promise<{ status: PickupModelStatus }>;
  [MESSAGE_TYPES.modelStatus]: () => Promise<{ status: PickupModelStatus }>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<PickupProtocolMap>();
export { MESSAGE_TYPES };
