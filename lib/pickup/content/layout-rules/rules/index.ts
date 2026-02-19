import type { LayoutRule } from '../types';
import { ellipsisTruncatedRule } from './ellipsis-truncated';
import { displayInlineRule } from './display-inline';
import { shortWordsRule } from './short-words';
import { incompleteSentenceRule } from './incomplete-sentence';
import { paragraphBlockRule } from './paragraph-block';
import { longTextRule } from './long-text';
import { inlineTagOrTruncateRule } from './inline-tag-or-truncate';
import { compactBlockRule } from './compact-block';

export const DEFAULT_LAYOUT_RULES: LayoutRule[] = [
  ellipsisTruncatedRule,
  displayInlineRule,
  shortWordsRule,
  incompleteSentenceRule,
  paragraphBlockRule,
  longTextRule,
  inlineTagOrTruncateRule,
  compactBlockRule,
];
