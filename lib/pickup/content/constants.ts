export const PARAGRAPH_FORCE_BLOCK_TAGS = new Set([
  'P',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
]);

export const INLINE_DISPLAY_KEYWORDS = ['inline'] as const;
export const MIN_BLOCK_CHILDREN_FOR_FORCE_BLOCK = 1;
export const MIN_TRANSLATABLE_CHILDREN_FOR_FORCE_BLOCK = 2;

export const MIN_TEXT_LENGTH = 10;
export const MAX_ORIGINAL_TEXT_LENGTH = 100000;
export const STYLE_ID = 'xen-pickup-style';
export const REQUEST_TIMEOUT_MS = 3000;
