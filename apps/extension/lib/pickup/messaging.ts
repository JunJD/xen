import { defineExtensionMessaging } from '@webext-core/messaging';
import type {
  PickupAnnotation,
  PickupModelStatus,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  TranslateProvider,
} from './messages';
import { MESSAGE_TYPES } from './constants';

interface PickupProtocolMap {
  [MESSAGE_TYPES.annotate]: (data: { paragraphs: PickupParagraph[] }) => Promise<{ annotations: PickupAnnotation[] }>;
  [MESSAGE_TYPES.translatePreview]: (data: {
    paragraphs: PickupTranslateParagraphInput[];
    provider?: TranslateProvider;
    includeParagraphTranslation?: boolean;
    includeUnitTranslation?: boolean;
  }) => Promise<{ translations: PickupTranslateParagraphPreview[] }>;
  [MESSAGE_TYPES.modelWarmup]: () => Promise<{ status: PickupModelStatus }>;
  [MESSAGE_TYPES.modelStatus]: () => Promise<{ status: PickupModelStatus }>;
  [MESSAGE_TYPES.translateProviderGet]: () => Promise<{ provider: TranslateProvider }>;
  [MESSAGE_TYPES.translateProviderSet]: (data: { provider: TranslateProvider }) => Promise<{ provider: TranslateProvider }>;
  [MESSAGE_TYPES.authTokenGet]: () => Promise<{ token: string | null }>;
  [MESSAGE_TYPES.authStatusGet]: () => Promise<{ enabled: boolean; authenticated: boolean; userId: string | null }>;
  [MESSAGE_TYPES.authSignOut]: () => Promise<{ ok: boolean }>;
  [MESSAGE_TYPES.authOpen]: (data: { mode: 'sign-in' | 'sign-up' }) => Promise<{ ok: boolean; tabId: number }>;
  [MESSAGE_TYPES.openOptions]: () => Promise<{ ok: boolean }>;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<PickupProtocolMap>();
export { MESSAGE_TYPES };
