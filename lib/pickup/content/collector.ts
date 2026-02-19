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
  isDisplayContentsElement,
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
const MIN_INLINE_ALPHA_COUNT = 2;

function isShortEnglishText(text: string) {
  const compact = text.replace(/\s+/g, '');
  if (!compact) {
    return false;
  }
  const asciiLetters = (compact.match(/[A-Za-z]/g) ?? []).length;
  if (asciiLetters < MIN_INLINE_ALPHA_COUNT) {
    return false;
  }
  const nonAscii = (compact.match(/[^\x00-\x7F]/g) ?? []).length;
  return nonAscii === 0;
}

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
  // 递归遍历：用“是否含可翻译文本 + 是否是块级结构”组合推断“段落候选”。
  if (!isWalkableElement(element)) {
    return {
      forceBlock: false,
      isInlineNode: false,
    };
  }

  let hasInlineNodeChild = false;
  let forceBlock = false;
  let descendantForceBlock = false;

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
    if (result.forceBlock) {
      descendantForceBlock = true;
    }
    if (result.isInlineNode) {
      hasInlineNodeChild = true;
    }
  }

  if (element.shadowRoot) {
    const shadowChildren = Array.from(element.shadowRoot.children).filter(isHTMLElement);
    for (const shadowChild of shadowChildren) {
      const result = walkAndCollectParagraphElements(shadowChild, paragraphCandidates);
      forceBlock = forceBlock || result.forceBlock;
      if (result.forceBlock) {
        descendantForceBlock = true;
      }
      if (result.isInlineNode) {
        hasInlineNodeChild = true;
      }
    }
  }

  const translatableChildCount = validChildNodes.filter(child =>
    isShallowBlockTransNode(child) || isShallowInlineTransNode(child),
  ).length;
  const blockChildCount = validChildNodes.filter(isShallowBlockTransNode).length;

  const hasBlockDescendant = descendantForceBlock;

  forceBlock = forceBlock
    || (
      blockChildCount >= MIN_BLOCK_CHILDREN_FOR_FORCE_BLOCK
      && translatableChildCount >= MIN_TRANSLATABLE_CHILDREN_FOR_FORCE_BLOCK
    )
    || PARAGRAPH_FORCE_BLOCK_TAGS.has(element.tagName);

  if (
    hasInlineNodeChild
    && blockChildCount === 0
    && !hasBlockDescendant
    && isEligibleElement(element)
    && !isDisplayContentsElement(element)
  ) {
    paragraphCandidates.add(element);
  }

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
  // 采集入口：先做“整页英文”判定，非英文页面直接不采集（常见的“段落没加上”原因之一）。
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
    // 段落级二次筛选：短文本放宽规则，否则必须判定为英文。
    if (text.length < MIN_TEXT_LENGTH) {
      if (!isShortEnglishText(text)) {
        return;
      }
    } else if (!isEnglishText(text)) {
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
