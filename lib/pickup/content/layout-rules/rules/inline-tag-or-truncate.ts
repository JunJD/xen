import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 60;

const INLINE_LAYOUT_TAGS = new Set([
  'SPAN',
  'A',
  'B',
  'STRONG',
  'EM',
  'I',
  'U',
  'S',
  'SMALL',
  'LABEL',
  'MARK',
  'ABBR',
  'CITE',
  'Q',
  'CODE',
  'KBD',
]);

export const inlineTagOrTruncateRule: LayoutRule = {
  id: 'inline-tag-or-truncate',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    if (!INLINE_LAYOUT_TAGS.has(ctx.element.tagName) && !ctx.metrics.isTruncated) {
      return null;
    }
    return {
      layout: 'inline',
      priority: PRIORITY,
      reason: 'inline tag or truncated text',
      ruleId: 'inline-tag-or-truncate',
    };
  },
};
