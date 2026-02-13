import type { PickupAnnotation, PickupParagraph } from '@/lib/pickup/messages';
import { sendMessage } from '@/lib/pickup/messaging';

export async function requestAnnotations(paragraphs: PickupParagraph[]) {
  const response = await sendMessage('pickupAnnotate', { paragraphs });
  return (response?.annotations ?? []) as PickupAnnotation[];
}
