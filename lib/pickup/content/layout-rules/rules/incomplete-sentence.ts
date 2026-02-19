import type { LayoutDecision, LayoutRule } from '../types';

const PRIORITY = 84;
const SENTENCE_END_PATTERN = /[.!?。！？]\s*$/;

function isCompleteSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  return SENTENCE_END_PATTERN.test(trimmed);
}

export const incompleteSentenceRule: LayoutRule = {
  id: 'incomplete-sentence',
  priority: PRIORITY,
  match(ctx): LayoutDecision | null {
    const wordCount = ctx.metrics.wordCount;
    if (wordCount <= 0) {
      return null;
    }
    if (isCompleteSentence(ctx.sourceText)) {
      return null;
    }
    return {
      layout: 'inline',
      priority: PRIORITY,
      reason: 'not a complete sentence',
      ruleId: 'incomplete-sentence',
    };
  },
};
