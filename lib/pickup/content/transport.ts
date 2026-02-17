import type {
  PickupAnnotation,
  PickupParagraph,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from '@/lib/pickup/messages';
import { sendMessage, MESSAGE_TYPES } from '@/lib/pickup/messaging';

export async function requestAnnotations(paragraphs: PickupParagraph[]) {
  const response = await sendMessage(MESSAGE_TYPES.annotate, { paragraphs });
  return (response?.annotations ?? []) as PickupAnnotation[];
}

export async function requestTranslationPreview(paragraphs: PickupTranslateParagraphInput[]) {
  const response = await sendMessage(MESSAGE_TYPES.translatePreview, { paragraphs });
  if (!response?.translations) {
    throw new Error('Translation preview failed.');
  }
  return response.translations as PickupTranslateParagraphPreview[];
}
