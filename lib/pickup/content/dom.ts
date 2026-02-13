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
]);

export function isHTMLElement(node: Node): node is HTMLElement {
  return node instanceof HTMLElement;
}

export function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}

export function isElementVisible(element: Element) {
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return element.getClientRects().length > 0;
}

export function isEligibleElement(element: Element) {
  if (!isHTMLElement(element)) {
    return false;
  }
  if (element.dataset.pickupProcessed === 'true') {
    return false;
  }
  if (element.dataset.pickupStatus === 'loading' || element.dataset.pickupStatus === 'done') {
    return false;
  }
  if (element.isContentEditable || element.closest('[contenteditable="true"]')) {
    return false;
  }
  if (element.closest('[data-pickup-ui]')) {
    return false;
  }
  if (element.hasAttribute('data-pickup-ignore')) {
    return false;
  }
  if (SKIP_TAGS.has(element.tagName)) {
    return false;
  }
  if (element.childElementCount > 0) {
    return false;
  }
  return isElementVisible(element);
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

  if (isHTMLElement(node) && node.tagName === 'BR') {
    return '\n';
  }

  if (isHTMLElement(node)) {
    if (SKIP_TAGS.has(node.tagName)) {
      return '';
    }
    if (node.hasAttribute('data-pickup-ignore')) {
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
