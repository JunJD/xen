import {
  INLINE_DISPLAY_KEYWORDS,
  PARAGRAPH_FORCE_BLOCK_TAGS,
} from './constants';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
  'IMG',
  'PICTURE',
  'SOURCE',
  'INPUT',
  'TEXTAREA',
  'SELECT',
  'OPTION',
  'BUTTON',
  'FORM',
  'CODE',
  'PRE',
  'HEADER',
  'FOOTER',
  'NAV',
  'ASIDE',
]);

const PICKUP_IGNORE_ATTRIBUTE = 'data-pickup-ignore';
const PICKUP_IGNORE_SELECTOR = '[data-pickup-ignore="true"]';
const PICKUP_UI_SELECTOR = '[data-pickup-ui]';
const CONTENT_EDITABLE_SELECTOR = '[contenteditable="true"]';
const PICKUP_PROCESSED_VALUE = 'true';
const PICKUP_STATUS_PENDING = 'pending';
const PICKUP_STATUS_LOADING = 'loading';
const PICKUP_STATUS_DONE = 'done';
const HIDDEN_DISPLAY_VALUE = 'none';
const HIDDEN_VISIBILITY_VALUE = 'hidden';
const BR_TAG_NAME = 'BR';
const DISPLAY_CONTENTS_VALUE = 'contents';

const ACTIVE_PICKUP_STATUSES = new Set([
  PICKUP_STATUS_PENDING,
  PICKUP_STATUS_LOADING,
  PICKUP_STATUS_DONE,
]);


function hasReadableText(node: Node) {
  return Boolean(node.textContent?.trim());
}

function isInlineDisplay(element: HTMLElement) {
  const display = window.getComputedStyle(element).display;
  if (display === DISPLAY_CONTENTS_VALUE) {
    return false;
  }
  return INLINE_DISPLAY_KEYWORDS.some(keyword => display.includes(keyword));
}

export function isDisplayContentsElement(element: HTMLElement) {
  return window.getComputedStyle(element).display === DISPLAY_CONTENTS_VALUE;
}

export function isHTMLElement(node: Node): node is HTMLElement {
  return node instanceof HTMLElement;
}

export function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === HIDDEN_DISPLAY_VALUE || style.visibility === HIDDEN_VISIBILITY_VALUE) {
    return false;
  }
  if (style.display === DISPLAY_CONTENTS_VALUE) {
    return Array.from(element.childNodes).some((child) => {
      if (isTextNode(child)) {
        return Boolean(child.textContent?.trim());
      }
      if (isHTMLElement(child)) {
        return isElementVisible(child);
      }
      return false;
    });
  }
  return element.getClientRects().length > 0;
}

export function isWalkableElement(element: Element): element is HTMLElement {
  if (!isHTMLElement(element)) {
    return false;
  }
  if (!hasReadableText(element)) {
    return false;
  }
  if (element.closest(PICKUP_IGNORE_SELECTOR)) {
    return false;
  }
  if (element.closest(PICKUP_UI_SELECTOR)) {
    return false;
  }
  if (element.isContentEditable || element.closest(CONTENT_EDITABLE_SELECTOR)) {
    return false;
  }
  if (element.hasAttribute(PICKUP_IGNORE_ATTRIBUTE)) {
    return false;
  }
  if (SKIP_TAGS.has(element.tagName)) {
    return false;
  }
  return isElementVisible(element);
}

export function isEligibleElement(element: Element): element is HTMLElement {
  if (!isWalkableElement(element)) {
    return false;
  }
  if (element.dataset.pickupProcessed === PICKUP_PROCESSED_VALUE) {
    return false;
  }
  if (ACTIVE_PICKUP_STATUSES.has(element.dataset.pickupStatus ?? '')) {
    return false;
  }
  return true;
}

export function isShallowInlineHTMLElement(element: HTMLElement) {
  if (!hasReadableText(element)) {
    return false;
  }
  if (PARAGRAPH_FORCE_BLOCK_TAGS.has(element.tagName)) {
    return false;
  }
  return isInlineDisplay(element);
}

export function isShallowBlockHTMLElement(element: HTMLElement) {
  if (PARAGRAPH_FORCE_BLOCK_TAGS.has(element.tagName)) {
    return true;
  }
  return !isInlineDisplay(element);
}

export function isShallowInlineTransNode(node: Node) {
  if (isTextNode(node) && hasReadableText(node)) {
    return true;
  }
  if (isHTMLElement(node)) {
    return isShallowInlineHTMLElement(node);
  }
  return false;
}

export function isShallowBlockTransNode(node: Node) {
  if (isTextNode(node)) {
    return false;
  }
  if (isHTMLElement(node)) {
    return isShallowBlockHTMLElement(node);
  }
  return false;
}

export function extractTextContent(node: Node): string {
  if (isTextNode(node)) {
    const text = node.textContent ?? '';
    const trimmed = text.trim();
    if (trimmed === '') {
      return ' ';
    }
    const leading = text.slice(0, text.length - text.trimStart().length);
    const trailing = text.slice(text.trimEnd().length);
    const hasLeading = /[^\S\n]/.test(leading);
    const hasTrailing = /[^\S\n]/.test(trailing);
    return `${hasLeading ? ' ' : ''}${trimmed}${hasTrailing ? ' ' : ''}`;
  }

  if (isHTMLElement(node) && node.tagName === BR_TAG_NAME) {
    return '\n';
  }

  if (isHTMLElement(node)) {
    if (SKIP_TAGS.has(node.tagName)) {
      return '';
    }
    if (node.hasAttribute(PICKUP_IGNORE_ATTRIBUTE)) {
      return '';
    }
  }

  return Array.from(node.childNodes).reduce((text, child) => {
    if (isTextNode(child) || isHTMLElement(child)) {
      return text + extractTextContent(child);
    }
    return text;
  }, '');
}
