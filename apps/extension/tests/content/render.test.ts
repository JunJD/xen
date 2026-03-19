// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/pickup/ast/adapter-registry', () => ({
  buildSentenceAst: vi.fn(),
}));

vi.mock('@/lib/pickup/render-model', () => ({
  buildRenderModelFromSentenceAst: vi.fn(),
}));

vi.mock('@/lib/pickup/pickup-types', () => ({
  getPickupTypeById: vi.fn(() => ({
    kind: 'vocabulary',
    name: 'Vocabulary',
    border: '#059669',
    background: 'rgba(5, 150, 105, 0.12)',
  })),
}));

vi.mock('../../lib/pickup/content/interactions', () => ({
  attachPickupInteractions: vi.fn(),
}));

vi.mock('../../lib/pickup/content/web-components', () => ({
  applyPickupTokenRuby: vi.fn(),
  createPickupTokenElement: vi.fn(() => document.createElement('span')),
  syncPickupTokenHostStates: vi.fn(),
}));

vi.mock('../../lib/pickup/content/render-annotator', () => ({
  annotateElementWithTokens: vi.fn(() => []),
}));

vi.mock('../../lib/pickup/content/render-translation', () => ({
  buildRenderableTokenList: vi.fn(() => []),
  buildTranslationOverrideLookup: vi.fn(() => new Map()),
  buildTranslationPreviewInputs: vi.fn(() => []),
  resolveVocabInfusionTokenText: vi.fn(),
  resolveVocabTooltipMeaning: vi.fn(() => ''),
}));

vi.mock('../../lib/pickup/content/transport', () => ({
  requestTranslationPreview: vi.fn(),
}));

import { applyParagraphTranslationOverrides } from '../../lib/pickup/content/render';
import {
  PICKUP_TRANSLATION_OWNER_ATTR,
  PICKUP_TRANSLATION_PARAGRAPH_ATTR,
  PICKUP_TRANSLATION_PARAGRAPH_CLASS,
} from '../../lib/pickup/content/markers';

describe('段落翻译补丁渲染', () => {
  it('inserts translated paragraph text after the annotated source element', () => {
    document.body.innerHTML = '<p id="source">The quick fox jumps.</p>';
    const sourceElement = document.getElementById('source') as HTMLElement;

    applyParagraphTranslationOverrides(
      new Map([['paragraph-1', sourceElement]]),
      new Map([
        ['paragraph-1', {
          paragraphText: '敏捷的狐狸跳了起来。',
          units: new Map(),
        }],
      ]),
    );

    const translationElement = sourceElement.nextElementSibling as HTMLElement | null;

    expect(translationElement).not.toBeNull();
    expect(translationElement?.textContent).toBe('敏捷的狐狸跳了起来。');
    expect(translationElement?.classList.contains(PICKUP_TRANSLATION_PARAGRAPH_CLASS)).toBe(true);
    expect(translationElement?.getAttribute(PICKUP_TRANSLATION_PARAGRAPH_ATTR)).toBe('true');
    expect(translationElement?.getAttribute(PICKUP_TRANSLATION_OWNER_ATTR)).toBe('paragraph-1');
  });
});
