import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from '../../lib/pickup/messages';

const { requestTranslationPreviewMock } = vi.hoisted(() => ({
  requestTranslationPreviewMock: vi.fn(),
}));

vi.mock('../../lib/pickup/content/transport', () => ({
  requestTranslationPreview: requestTranslationPreviewMock,
}));

vi.mock('../../lib/pickup/content/interactions', () => ({
  attachPickupInteractions: vi.fn(),
}));

vi.mock('../../lib/pickup/content/web-components', () => ({
  applyPickupTokenRuby: vi.fn(),
  createPickupTokenElement: vi.fn(),
  syncPickupTokenHostStates: vi.fn(),
}));

vi.mock('../../lib/pickup/content/render-annotator', () => ({
  annotateElementWithTokens: vi.fn(),
}));

vi.mock('@/lib/pickup/ast/adapter-registry', () => ({
  buildSentenceAst: vi.fn(),
}));

vi.mock('@/lib/pickup/render-model', () => ({
  buildRenderModelFromSentenceAst: vi.fn(),
}));

vi.mock('@/lib/pickup/pickup-types', () => ({
  getPickupTypeById: vi.fn(),
}));

import { requestParagraphTranslationPreview } from '../../lib/pickup/content/render';

function createParagraph(id: string, sourceText: string): PickupTranslateParagraphInput {
  return {
    id,
    sourceText,
    units: [],
  };
}

function createPreview(
  paragraph: PickupTranslateParagraphInput,
  paragraphText: string,
): PickupTranslateParagraphPreview {
  return {
    id: paragraph.id,
    sourceText: paragraph.sourceText,
    paragraphText,
    units: [],
  };
}

describe('段落翻译失败隔离', () => {
  beforeEach(() => {
    requestTranslationPreviewMock.mockReset();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps successful paragraph previews when one paragraph fails the batch', async () => {
    const paragraphA = createParagraph('paragraph-a', 'Alpha.');
    const paragraphB = createParagraph('paragraph-b', 'Bravo.');
    const paragraphC = createParagraph('paragraph-c', 'Charlie.');

    requestTranslationPreviewMock.mockImplementation(async (paragraphs: PickupTranslateParagraphInput[]) => {
      const [paragraph] = paragraphs;
      if (paragraphs.length === 3) {
        throw new Error('batch failed because paragraph-b is poison');
      }
      if (paragraph.id === paragraphA.id) {
        return [createPreview(paragraphA, '阿尔法。')];
      }
      if (paragraph.id === paragraphB.id) {
        throw new Error('paragraph-b failed');
      }
      return [createPreview(paragraphC, '查理。')];
    });

    const lookup = await requestParagraphTranslationPreview([paragraphA, paragraphB, paragraphC], {
      includeParagraphTranslation: true,
      includeUnitTranslation: false,
    });

    expect(lookup.get(paragraphA.id)?.paragraphText).toBe('阿尔法。');
    expect(lookup.has(paragraphB.id)).toBe(false);
    expect(lookup.get(paragraphC.id)?.paragraphText).toBe('查理。');
    expect(requestTranslationPreviewMock).toHaveBeenCalledTimes(4);
    expect(
      requestTranslationPreviewMock.mock.calls.map(([paragraphs]) =>
        (paragraphs as PickupTranslateParagraphInput[]).map(paragraph => paragraph.id),
      ),
    ).toEqual([
      [paragraphA.id, paragraphB.id, paragraphC.id],
      [paragraphA.id],
      [paragraphB.id],
      [paragraphC.id],
    ]);
  });

  it('allows a later retry to recover after an earlier failed paragraph attempt', async () => {
    const paragraphA = createParagraph('paragraph-a', 'Alpha.');
    const paragraphB = createParagraph('paragraph-b', 'Bravo.');

    requestTranslationPreviewMock
      .mockRejectedValueOnce(new Error('initial batch failed'))
      .mockResolvedValueOnce([createPreview(paragraphA, '阿尔法。')])
      .mockRejectedValueOnce(new Error('paragraph-b failed'))
      .mockResolvedValueOnce([
        createPreview(paragraphA, '阿尔法。'),
        createPreview(paragraphB, '布拉沃。'),
      ]);

    const firstLookup = await requestParagraphTranslationPreview([paragraphA, paragraphB], {
      includeParagraphTranslation: true,
      includeUnitTranslation: false,
    });

    expect(firstLookup.get(paragraphA.id)?.paragraphText).toBe('阿尔法。');
    expect(firstLookup.has(paragraphB.id)).toBe(false);

    const secondLookup = await requestParagraphTranslationPreview([paragraphA, paragraphB], {
      includeParagraphTranslation: true,
      includeUnitTranslation: false,
    });

    expect(secondLookup.get(paragraphA.id)?.paragraphText).toBe('阿尔法。');
    expect(secondLookup.get(paragraphB.id)?.paragraphText).toBe('布拉沃。');
    expect(requestTranslationPreviewMock).toHaveBeenCalledTimes(4);
  });
});
