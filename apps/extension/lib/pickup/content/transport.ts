import type {
  PickupAnnotation,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  TranslateProvider,
} from '@/lib/pickup/messages';
import { sendMessage, MESSAGE_TYPES } from '@/lib/pickup/messaging';

export async function requestAnnotations(paragraphs: PickupParagraph[]) {
  const response = await sendMessage(MESSAGE_TYPES.annotate, { paragraphs });
  return (response?.annotations ?? []) as PickupAnnotation[];
}

type RequestTranslationPreviewOptions = {
  provider?: TranslateProvider;
  includeParagraphTranslation?: boolean;
};

export async function requestTranslationPreview(
  paragraphs: PickupTranslateParagraphInput[],
  options: RequestTranslationPreviewOptions = {},
) {
  const response = await sendMessage(MESSAGE_TYPES.translatePreview, {
    paragraphs,
    provider: options.provider,
    includeParagraphTranslation: options.includeParagraphTranslation,
  });
  if (!response?.translations) {
    throw new Error('Translation preview failed.');
  }
  return response.translations as PickupTranslateParagraphPreview[];
}
