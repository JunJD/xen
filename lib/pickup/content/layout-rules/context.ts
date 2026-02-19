import type { LayoutContext } from './types';

type LayoutContextInput = {
  element: HTMLElement;
  sourceText: string;
  translationText?: string;
};

function countEnglishWords(text: string) {
  const matches = text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
  return matches ? matches.length : 0;
}

function parseLineHeight(style: CSSStyleDeclaration) {
  const fontSize = Number.parseFloat(style.fontSize) || 16;
  if (style.lineHeight === 'normal') {
    return fontSize * 1.2;
  }
  return Number.parseFloat(style.lineHeight) || fontSize * 1.2;
}

function isEllipsisTruncated(element: HTMLElement, style: CSSStyleDeclaration) {
  const isNoWrap = style.whiteSpace === 'nowrap';
  const hasEllipsis = style.textOverflow === 'ellipsis';
  if (!isNoWrap && !hasEllipsis) {
    return false;
  }
  const clientWidth = element.clientWidth;
  const scrollWidth = element.scrollWidth;
  if (clientWidth <= 0 || scrollWidth <= 0) {
    return false;
  }
  return scrollWidth - clientWidth > 1;
}

export function buildLayoutContext({ element, sourceText, translationText }: LayoutContextInput): LayoutContext {
  // 布局上下文：结合 DOM 实测尺寸 + 计算样式，用于布局规则判定。
  // 难点：元素未进入布局或 display/visibility 异常时，client/rect 可能为 0。
  const computedStyle = window.getComputedStyle(element);
  const lineHeight = parseLineHeight(computedStyle);
  const rect = element.getBoundingClientRect();
  const height = rect.height || Number.parseFloat(computedStyle.height) || 0;
  const wordCount = countEnglishWords(sourceText);
  const isTruncated = computedStyle.whiteSpace === 'nowrap' || computedStyle.textOverflow === 'ellipsis';
  const isEllipsis = isEllipsisTruncated(element, computedStyle);

  return {
    element,
    sourceText,
    translationText,
    computedStyle,
    metrics: {
      height,
      lineHeight,
      wordCount,
      isTruncated,
      isEllipsis,
    },
  };
}
