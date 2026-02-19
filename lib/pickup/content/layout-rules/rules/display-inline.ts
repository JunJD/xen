import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 90;

export const displayInlineRule: LayoutRule = {
  id: 'display-inline',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    if (!ctx.computedStyle.display.includes('inline')) {
      return null;
    }
    return {
      layout: 'inline',
      priority: PRIORITY,
      reason: 'display: inline',
      ruleId: 'display-inline',
    };
  },
};
