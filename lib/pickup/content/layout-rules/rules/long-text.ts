import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 70;
const MAX_INLINE_LAYOUT_TEXT_LENGTH = 80;

export const longTextRule: LayoutRule = {
  id: 'long-text',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    if (ctx.sourceText.length <= MAX_INLINE_LAYOUT_TEXT_LENGTH) {
      return null;
    }
    return {
      layout: 'three-lane',
      priority: PRIORITY,
      reason: 'long text',
      ruleId: 'long-text',
    };
  },
};
