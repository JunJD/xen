import type { RenderToken } from '@/lib/pickup/render-model';
import { extractTextContentWithSegments } from './dom';

const EMPTY_TEXT = '';

export type RenderableToken = RenderToken & {
  start: number;
  end: number;
  renderedText: string;
};

export type RenderedToken = RenderToken & {
  renderedText: string;
  sourceText: string;
  element: HTMLElement;
};

type TokenTextResolver = (token: RenderableToken) => string;
type TokenElementFactory = (token: RenderToken, tokenText: string) => HTMLElement;

type ElementTextSegment = {
  node: Text;
  start: number;
  end: number;
  nodeOffsetStart: number;
};

type NodeTokenPlacement = {
  token: RenderableToken;
  localStart: number;
  localEnd: number;
  mappedText: string;
  sourceText: string;
};

type AnnotateElementWithTokensOptions = {
  resolveTokenText?: TokenTextResolver;
  createTokenElement: TokenElementFactory;
  tokenOriginalTextAttr: string;
};

function isValidOffset(value: number, sourceLength: number) {
  return Number.isInteger(value) && value >= 0 && value <= sourceLength;
}

function isAsciiWordChar(char: string) {
  return /[A-Za-z0-9]/.test(char);
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function findTokenTextSpan(sourceText: string, tokenText: string, cursor: number) {
  if (!tokenText) {
    return null;
  }

  const directStart = sourceText.indexOf(tokenText, cursor);
  if (directStart >= 0) {
    return {
      start: directStart,
      end: directStart + tokenText.length,
    };
  }

  const lowerStart = sourceText.toLowerCase().indexOf(tokenText.toLowerCase(), cursor);
  if (lowerStart >= 0) {
    return {
      start: lowerStart,
      end: lowerStart + tokenText.length,
    };
  }

  return null;
}

function repairWordBoundarySpan(
  span: { start: number; end: number },
  sourceText: string,
  token: RenderToken,
) {
  if (!/[A-Za-z]/.test(token.text ?? '')) {
    return span;
  }

  let start = span.start;
  let end = span.end;

  while (start > 0 && isAsciiWordChar(sourceText[start - 1] ?? '') && isAsciiWordChar(sourceText[start] ?? '')) {
    start -= 1;
  }

  while (end < sourceText.length && isAsciiWordChar(sourceText[end - 1] ?? '') && isAsciiWordChar(sourceText[end] ?? '')) {
    end += 1;
  }

  return { start, end };
}

function resolveTokenSpan(
  token: RenderToken,
  sourceText: string,
  cursor: number,
) {
  const tokenText = token.text ?? '';
  const resolveByText = () => findTokenTextSpan(sourceText, tokenText, cursor);

  if (typeof token.start === 'number' && typeof token.end === 'number') {
    if (!isValidOffset(token.start, sourceText.length) || !isValidOffset(token.end, sourceText.length)) {
      return resolveByText();
    }

    const span = repairWordBoundarySpan(
      {
        start: token.start,
        end: token.end,
      },
      sourceText,
      token,
    );

    if (span.end <= span.start || span.start < cursor) {
      return resolveByText();
    }

    if (tokenText) {
      const spanText = sourceText.slice(span.start, span.end);
      if (normalizeComparableText(spanText) !== normalizeComparableText(tokenText)) {
        const recovered = resolveByText();
        if (recovered) {
          return recovered;
        }
      }
    }

    return span;
  }

  if (!tokenText) {
    return null;
  }

  const span = resolveByText();
  if (!span) {
    return null;
  }

  return span;
}

function buildRenderableTokens(
  tokens: RenderToken[],
  sourceText: string,
) {
  const renderableTokens: RenderableToken[] = [];
  let cursor = 0;

  tokens.forEach((token) => {
    // 只接受单调递增且落在原文范围内的 span，避免 DOM 归一化后偏移漂移。
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

function buildElementTextSegments(
  element: HTMLElement,
  sourceText: string,
) {
  const extracted = extractTextContentWithSegments(element);
  const rawText = extracted.text;
  const trimmedText = rawText.trim();
  if (!trimmedText || trimmedText !== sourceText) {
    return [];
  }

  const trimStart = rawText.length - rawText.trimStart().length;
  const trimEnd = rawText.trimEnd().length;
  const segments: ElementTextSegment[] = [];

  extracted.segments.forEach((segment) => {
    const overlapStart = Math.max(segment.start, trimStart);
    const overlapEnd = Math.min(segment.end, trimEnd);
    if (overlapEnd <= overlapStart) {
      return;
    }
    segments.push({
      node: segment.node,
      start: overlapStart - trimStart,
      end: overlapEnd - trimStart,
      nodeOffsetStart: overlapStart - segment.start,
    });
  });

  return segments;
}

function findSegmentByOffset(segments: ElementTextSegment[], offset: number) {
  for (const segment of segments) {
    if (offset >= segment.start && offset < segment.end) {
      return segment;
    }
  }
  return null;
}

function buildTokenPlacementByNode(
  renderableTokens: RenderableToken[],
  segments: ElementTextSegment[],
  resolveTokenText: TokenTextResolver,
) {
  const placementsByNode = new Map<Text, NodeTokenPlacement[]>();

  renderableTokens.forEach((token) => {
    if (token.end <= token.start) {
      return;
    }
    const startSegment = findSegmentByOffset(segments, token.start);
    const endSegment = findSegmentByOffset(segments, token.end - 1);
    if (!startSegment || !endSegment || startSegment.node !== endSegment.node) {
      return;
    }
    const localStart = startSegment.nodeOffsetStart + (token.start - startSegment.start);
    const localEnd = startSegment.nodeOffsetStart + (token.end - startSegment.start);
    if (!Number.isFinite(localStart) || !Number.isFinite(localEnd) || localEnd <= localStart) {
      return;
    }
    const mappedText = resolveTokenText(token) || token.renderedText || EMPTY_TEXT;
    const placements = placementsByNode.get(startSegment.node) ?? [];
    placements.push({
      token,
      localStart,
      localEnd,
      mappedText,
      sourceText: token.renderedText ?? EMPTY_TEXT,
    });
    placementsByNode.set(startSegment.node, placements);
  });

  return placementsByNode;
}

function applyTokenPlacements(
  placementsByNode: Map<Text, NodeTokenPlacement[]>,
  options: {
    createTokenElement: TokenElementFactory;
    tokenOriginalTextAttr: string;
  },
) {
  const renderedTokens: RenderedToken[] = [];

  placementsByNode.forEach((placements, textNode) => {
    if (placements.length === 0 || !textNode.isConnected) {
      return;
    }
    const originalNodeText = textNode.textContent ?? EMPTY_TEXT;
    if (!originalNodeText) {
      return;
    }
    const sorted = [...placements].sort((a, b) => a.localStart - b.localStart);
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let applied = false;

    sorted.forEach((placement) => {
      const start = Math.max(cursor, placement.localStart);
      const end = Math.min(originalNodeText.length, placement.localEnd);
      if (end <= start) {
        return;
      }
      if (start > cursor) {
        fragment.appendChild(document.createTextNode(originalNodeText.slice(cursor, start)));
      }
      const element = options.createTokenElement(placement.token, placement.mappedText);
      element.setAttribute(options.tokenOriginalTextAttr, placement.sourceText);
      fragment.appendChild(element);
      renderedTokens.push({
        ...placement.token,
        renderedText: placement.mappedText,
        sourceText: placement.sourceText,
        element,
      });
      cursor = end;
      applied = true;
    });

    if (!applied) {
      return;
    }
    if (cursor < originalNodeText.length) {
      fragment.appendChild(document.createTextNode(originalNodeText.slice(cursor)));
    }
    textNode.replaceWith(fragment);
  });

  return renderedTokens;
}

export function annotateElementWithTokens(
  element: HTMLElement,
  tokens: RenderToken[],
  sourceText: string,
  options: AnnotateElementWithTokensOptions,
) {
  if (!sourceText) {
    return [];
  }

  const renderableTokens = buildRenderableTokens(tokens, sourceText);
  if (renderableTokens.length === 0) {
    return [];
  }
  const segments = buildElementTextSegments(element, sourceText);
  if (segments.length === 0) {
    return [];
  }
  const resolveTokenText = options.resolveTokenText ?? (token => token.renderedText);
  const placementsByNode = buildTokenPlacementByNode(renderableTokens, segments, resolveTokenText);
  if (placementsByNode.size === 0) {
    return [];
  }
  return applyTokenPlacements(placementsByNode, {
    createTokenElement: options.createTokenElement,
    tokenOriginalTextAttr: options.tokenOriginalTextAttr,
  });
}
