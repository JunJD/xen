export type LayoutKind = 'inline' | 'three-lane' | 'ellipsis';

export type LayoutDecision = {
  layout: LayoutKind;
  priority: number;
  reason: string;
  ruleId: string;
};

export type LayoutContext = {
  element: HTMLElement;
  sourceText: string;
  translationText?: string;
  computedStyle: CSSStyleDeclaration;
  metrics: {
    height: number;
    lineHeight: number;
    wordCount: number;
    isTruncated: boolean;
    isEllipsis: boolean;
  };
};

export type LayoutRule = {
  id: string;
  priority: number;
  match: (ctx: LayoutContext) => LayoutDecision | null;
};
