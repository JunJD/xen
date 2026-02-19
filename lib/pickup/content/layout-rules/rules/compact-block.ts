import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 50;

export const compactBlockRule: LayoutRule = {
  id: 'compact-block',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    const display = ctx.computedStyle.display;
    const isCompactSingleLine = ctx.metrics.height > 0
      && ctx.metrics.height <= ctx.metrics.lineHeight * 2.2;
    const isCompactBlock = (
      display.includes('flex')
      || display.includes('grid')
      || display === 'block'
      || display === 'list-item'
    ) && isCompactSingleLine;

    if (!isCompactBlock) {
      return null;
    }

    return {
      layout: 'inline',
      priority: PRIORITY,
      reason: 'compact single-line block',
      ruleId: 'compact-block',
    };
  },
};
