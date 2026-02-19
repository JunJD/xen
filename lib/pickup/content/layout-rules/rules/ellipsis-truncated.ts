import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 100;

export const ellipsisTruncatedRule: LayoutRule = {
  id: 'ellipsis-truncated',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    if (!ctx.translationText) {
      return null;
    }
    if (!ctx.metrics.isEllipsis) {
      return null;
    }
    return {
      layout: 'ellipsis',
      priority: PRIORITY,
      reason: 'ellipsis overflow with translation',
      ruleId: 'ellipsis-truncated',
    };
  },
};
