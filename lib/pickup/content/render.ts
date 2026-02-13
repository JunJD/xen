import type { PickupAnnotation } from '@/lib/pickup/messages';
import { getPickupTypeById } from '@/lib/pickup/pickup-types';

const PICKUP_IGNORE_ATTR = 'data-pickup-ignore';
const PICKUP_CATEGORY_ATTR = 'data-pickup-category';
const PICKUP_ACCENT_VARIABLE = '--xen-pickup-accent';
const PICKUP_SOFT_BG_VARIABLE = '--xen-pickup-soft-bg';

type RenderableToken = PickupAnnotation['tokens'][number] & {
  start: number;
  end: number;
  renderedText: string;
};

function isValidOffset(value: number, sourceLength: number) {
  return Number.isInteger(value) && value >= 0 && value <= sourceLength;
}

function resolveTokenSpan(
  token: PickupAnnotation['tokens'][number],
  sourceText: string,
  cursor: number,
) {
  if (typeof token.start === 'number' && typeof token.end === 'number') {
    if (!isValidOffset(token.start, sourceText.length) || !isValidOffset(token.end, sourceText.length)) {
      return null;
    }
    if (token.end <= token.start || token.start < cursor) {
      return null;
    }
    return { start: token.start, end: token.end };
  }

  if (!token.text) {
    return null;
  }

  const start = sourceText.indexOf(token.text, cursor);
  if (start < 0) {
    return null;
  }

  return {
    start,
    end: start + token.text.length,
  };
}

function buildRenderableTokens(
  tokens: PickupAnnotation['tokens'],
  sourceText: string,
) {
  const renderableTokens: RenderableToken[] = [];
  let cursor = 0;

  tokens.forEach((token) => {
    const span = resolveTokenSpan(token, sourceText, cursor);
    if (!span) {
      return;
    }

    const renderedText = sourceText.slice(span.start, span.end);
    if (!renderedText) {
      return;
    }

    renderableTokens.push({
      ...token,
      start: span.start,
      end: span.end,
      renderedText,
    });
    cursor = span.end;
  });

  return renderableTokens;
}

export function buildTokenSpan(token: PickupAnnotation['tokens'][number], tokenText: string) {
  const type = getPickupTypeById(token.typeId);
  const wrapper = document.createElement('span');
  wrapper.className = 'xen-pickup-token';
  wrapper.style.setProperty(PICKUP_ACCENT_VARIABLE, type.border);
  wrapper.style.setProperty(PICKUP_SOFT_BG_VARIABLE, type.background);
  wrapper.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  wrapper.setAttribute(PICKUP_CATEGORY_ATTR, token.kind ?? type.kind);
  wrapper.title = token.label ?? type.name;
  wrapper.textContent = tokenText;
  return wrapper;
}

function buildFallbackFragment(tokens: PickupAnnotation['tokens']) {
  const fragment = document.createDocumentFragment();
  tokens.forEach((token, index) => {
    if (index > 0) {
      fragment.appendChild(document.createTextNode(' '));
    }
    fragment.appendChild(buildTokenSpan(token, token.text));
  });
  return fragment;
}

function buildAnnotatedFragment(tokens: PickupAnnotation['tokens'], sourceText: string) {
  if (!sourceText) {
    return buildFallbackFragment(tokens);
  }

  const renderableTokens = buildRenderableTokens(tokens, sourceText);
  if (renderableTokens.length === 0) {
    const fallback = document.createDocumentFragment();
    fallback.appendChild(document.createTextNode(sourceText));
    return fallback;
  }

  const fragment = document.createDocumentFragment();
  let cursor = 0;
  renderableTokens.forEach((token) => {
    if (token.start > cursor) {
      fragment.appendChild(document.createTextNode(sourceText.slice(cursor, token.start)));
    }
    fragment.appendChild(buildTokenSpan(token, token.renderedText));
    cursor = token.end;
  });

  if (cursor < sourceText.length) {
    fragment.appendChild(document.createTextNode(sourceText.slice(cursor)));
  }

  return fragment;
}

export function applyAnnotations(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
) {
  const appliedIds = new Set<string>();
  annotations.forEach((annotation) => {
    const element = elementMap.get(annotation.id);
    if (!element) {
      return;
    }

    const htmlElement = element as HTMLElement;
    const sourceText = htmlElement.dataset.pickupOriginal ?? htmlElement.textContent ?? '';
    const fragment = buildAnnotatedFragment(annotation.tokens, sourceText);

    htmlElement.textContent = '';
    htmlElement.appendChild(fragment);
    htmlElement.dataset.pickupProcessed = 'true';
    htmlElement.dataset.pickupStatus = 'done';
    appliedIds.add(annotation.id);
  });

  elementMap.forEach((element, id) => {
    if (!appliedIds.has(id)) {
      (element as HTMLElement).dataset.pickupStatus = 'error';
    }
  });
}
