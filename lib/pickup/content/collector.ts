import { sha256 } from 'js-sha256';
import type { PickupParagraph } from '@/lib/pickup/messages';
import {
  MAX_ORIGINAL_TEXT_LENGTH,
  MIN_BLOCK_CHILDREN_FOR_FORCE_BLOCK,
  MIN_TEXT_LENGTH,
  MIN_TRANSLATABLE_CHILDREN_FOR_FORCE_BLOCK,
  PARAGRAPH_FORCE_BLOCK_TAGS,
} from './constants';
import {
  extractTextContent,
  isEligibleElement,
  isHTMLElement,
  isShallowBlockTransNode,
  isShallowInlineHTMLElement,
  isShallowInlineTransNode,
  isTextNode,
  isWalkableElement,
} from './dom';
import { isEnglishText, isPageEnglish } from './language';

type WalkResult = {
  forceBlock: boolean;
  isInlineNode: boolean;
};

const PICKUP_ID_PREFIX = 'xen-pickup';
const PICKUP_STATUS_PENDING = 'pending';
const WHITESPACE_PATTERN = /\s+/g;

function getTraversalRoots(root: ParentNode): HTMLElement[] {
  if (root instanceof Document) {
    return root.body ? [root.body] : [];
  }

  if (root instanceof HTMLElement) {
    return [root];
  }

  if (root instanceof ShadowRoot || root instanceof DocumentFragment) {
    return Array.from(root.children).filter(isHTMLElement);
  }

  return [];
}

function getParentElementAcrossRoots(element: HTMLElement): HTMLElement | null {
  if (element.parentElement) {
    return element.parentElement;
  }
  const rootNode = element.getRootNode();
  if (rootNode instanceof ShadowRoot) {
    return isHTMLElement(rootNode.host) ? rootNode.host : null;
  }
  return null;
}

function isTopLevelParagraph(element: HTMLElement, paragraphSet: Set<HTMLElement>) {
  let ancestor = getParentElementAcrossRoots(element);
  while (ancestor) {
    if (paragraphSet.has(ancestor)) {
      return false;
    }
    ancestor = getParentElementAcrossRoots(ancestor);
  }
  return true;
}

function walkAndCollectParagraphElements(
  element: HTMLElement,
  paragraphCandidates: Set<HTMLElement>,
): WalkResult {
  if (!isWalkableElement(element)) {
    return {
      forceBlock: false,
      isInlineNode: false,
    };
  }

  let hasInlineNodeChild = false;
  let forceBlock = false;

  const validChildNodes = Array.from(element.childNodes).filter((child) => {
    if (isTextNode(child)) {
      return true;
    }
    if (isHTMLElement(child)) {
      return isWalkableElement(child);
    }
    return false;
  });

  for (const child of validChildNodes) {
    if (isTextNode(child)) {
      if (child.textContent?.trim()) {
        hasInlineNodeChild = true;
      }
      continue;
    }
    if (!isHTMLElement(child)) {
      continue;
    }

    const result = walkAndCollectParagraphElements(child, paragraphCandidates);
    forceBlock = forceBlock || result.forceBlock;
    if (result.isInlineNode) {
      hasInlineNodeChild = true;
    }
  }

  if (element.shadowRoot) {
    const shadowChildren = Array.from(element.shadowRoot.children).filter(isHTMLElement);
    for (const shadowChild of shadowChildren) {
      const result = walkAndCollectParagraphElements(shadowChild, paragraphCandidates);
      forceBlock = forceBlock || result.forceBlock;
      if (result.isInlineNode) {
        hasInlineNodeChild = true;
      }
    }
  }

  const translatableChildCount = validChildNodes.filter(child =>
    isShallowBlockTransNode(child) || isShallowInlineTransNode(child),
  ).length;
  const blockChildCount = validChildNodes.filter(isShallowBlockTransNode).length;

  if (hasInlineNodeChild && blockChildCount === 0 && isEligibleElement(element)) {
    paragraphCandidates.add(element);
  }

  forceBlock = forceBlock
    || (
      blockChildCount >= MIN_BLOCK_CHILDREN_FOR_FORCE_BLOCK
      && translatableChildCount >= MIN_TRANSLATABLE_CHILDREN_FOR_FORCE_BLOCK
    )
    || PARAGRAPH_FORCE_BLOCK_TAGS.has(element.tagName);

  if (!element.textContent?.trim() && !forceBlock) {
    return {
      forceBlock: false,
      isInlineNode: false,
    };
  }

  const isInlineNode = isShallowInlineHTMLElement(element);
  return {
    forceBlock,
    isInlineNode,
  };
}

function collectTopLevelParagraphElements(root: ParentNode) {
  const paragraphCandidates = new Set<HTMLElement>();
  getTraversalRoots(root).forEach((traversalRoot) => {
    walkAndCollectParagraphElements(traversalRoot, paragraphCandidates);
  });

  return Array.from(paragraphCandidates).filter(element => isTopLevelParagraph(element, paragraphCandidates));
}

export function collectParagraphs(root: ParentNode = document) {
  if (!isPageEnglish()) {
    return { paragraphs: [], elementMap: new Map<string, Element>() };
  }

  const elements = collectTopLevelParagraphElements(root);

  const paragraphs: PickupParagraph[] = [];
  const elementMap = new Map<string, Element>();
  const timestamp = Date.now();
  let index = 0;

  elements.forEach((element) => {
    const text = extractTextContent(element).replace(WHITESPACE_PATTERN, ' ').trim();
    if (text.length < MIN_TEXT_LENGTH) {
      return;
    }
    if (!isEnglishText(text)) {
      return;
    }
    if (!element.dataset.pickupOriginal && text.length <= MAX_ORIGINAL_TEXT_LENGTH) {
      element.dataset.pickupOriginal = text;
    }
    const id = `${PICKUP_ID_PREFIX}-${timestamp}-${index++}`;
    const hash = sha256(text);
    element.dataset.pickupId = id;
    element.dataset.pickupStatus = PICKUP_STATUS_PENDING;
    paragraphs.push({ id, text, hash });
    elementMap.set(id, element);
  });

  return { paragraphs, elementMap };
}
