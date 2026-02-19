import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 88;
const MIN_LINE_COUNT = 2;

export const paragraphBlockRule: LayoutRule = {
  id: 'paragraph-block',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    const tag = ctx.element.tagName;
    const display = ctx.computedStyle.display;
    const isBlockLike = (
      display === 'block'
      || display.includes('flex')
      || display.includes('grid')
      || display === 'list-item'
    );
    const isParagraphTag = tag === 'P';

    if (!isParagraphTag && !isBlockLike) {
      return null;
    }

    if (!ctx.metrics.lineHeight || !ctx.metrics.height) {
      return null;
    }

    const lineCount = ctx.metrics.height / ctx.metrics.lineHeight;
    if (lineCount < MIN_LINE_COUNT) {
      return null;
    }

    return {
      layout: 'three-lane',
      priority: PRIORITY,
      reason: 'multi-line paragraph block',
      ruleId: 'paragraph-block',
    };
  },
};
