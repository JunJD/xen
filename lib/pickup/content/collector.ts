import { sha256 } from 'js-sha256';
import type { PickupParagraph } from '@/lib/pickup/messages';
import { MAX_ORIGINAL_TEXT_LENGTH, MIN_TEXT_LENGTH, PARAGRAPH_SELECTOR } from './constants';
import { extractTextContent, isEligibleElement } from './dom';
import { isEnglishText, isPageEnglish } from './language';

export function collectParagraphs(root: ParentNode = document) {
  if (!isPageEnglish()) {
    return { paragraphs: [], elementMap: new Map<string, Element>() };
  }

  const elements = Array.from(root.querySelectorAll(PARAGRAPH_SELECTOR)).filter(
    element => isEligibleElement(element),
  );

  const paragraphs: PickupParagraph[] = [];
  const elementMap = new Map<string, Element>();
  const timestamp = Date.now();
  let index = 0;

  elements.forEach((element) => {
    const text = extractTextContent(element).replace(/\s+/g, ' ').trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return;
    }
    if (!isEnglishText(text)) {
      return;
    }
    const htmlElement = element as HTMLElement;
    if (!htmlElement.dataset.pickupOriginal && text.length <= MAX_ORIGINAL_TEXT_LENGTH) {
      htmlElement.dataset.pickupOriginal = text;
    }
    const id = `xen-pickup-${timestamp}-${index++}`;
    const hash = sha256(text);
    htmlElement.dataset.pickupId = id;
    htmlElement.dataset.pickupStatus = 'pending';
    paragraphs.push({ id, text, hash });
    elementMap.set(id, element);
  });

  return { paragraphs, elementMap };
}
