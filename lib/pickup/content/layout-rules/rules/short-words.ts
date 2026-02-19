import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 85;
const MIN_WORDS_FOR_INLINE = 3;

export const shortWordsRule: LayoutRule = {
  id: 'short-words',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    const wordCount = ctx.metrics.wordCount;
    if (wordCount <= 0 || wordCount >= MIN_WORDS_FOR_INLINE) {
      return null;
    }
    return {
      layout: 'inline',
      priority: PRIORITY,
      reason: 'short word count',
      ruleId: 'short-words',
    };
  },
};
