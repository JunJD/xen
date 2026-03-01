import { describe, expect, it } from 'vitest';
import type { SentenceAst } from '../../lib/pickup/ast/types';
import type { PickupTranslateParagraphPreview } from '../../lib/pickup/messages';
import type { RenderableToken, RenderedToken } from '../../lib/pickup/content/render-annotator';
import {
  buildRenderableTokenList,
  buildTranslationOverrideLookup,
  buildTranslationPreviewInputs,
  decideTokenRender,
  resolveVocabInfusionTokenText,
  resolveVocabTooltipMeaning,
  type TranslationPreviewEntry,
  type UnitTranslationOverride,
} from '../../lib/pickup/content/render-translation';

function createSentenceAst(units: SentenceAst['units']): SentenceAst {
  return {
    id: 'sentence-1',
    sourceId: 'annotation-1',
    text: 'The quick fox jumps.',
    units,
    relations: [],
    grammarPoints: [],
  };
}

function createRenderableToken(partial?: Partial<RenderableToken>): RenderableToken {
  return {
    id: 'unit-1',
    text: 'fox',
    typeId: 1,
    kind: 'vocabulary',
    start: 10,
    end: 13,
    renderedText: 'fox',
    ...partial,
  };
}

function createRenderedToken(partial?: Partial<RenderedToken>): RenderedToken {
  return {
    ...createRenderableToken(),
    sourceText: 'fox',
    element: {} as HTMLElement,
    ...partial,
  };
}

describe('翻译预览与覆盖映射', () => {
  it('builds translation preview inputs using only translatable vocabulary tokens', () => {
    const entries: TranslationPreviewEntry[] = [
      {
        annotation: { id: 'annotation-1', tokens: [] },
        sourceText: 'The quick fox jumps.',
        sentenceAst: createSentenceAst([
          {
            id: 'unit-vocab',
            kind: 'token',
            category: 'vocabulary',
            surface: 'fox',
            span: [10, 13],
            tokenIndex: 2,
            role: 'subject',
            pos: 'NOUN',
            dep: 'nsubj',
          },
          {
            id: 'unit-grammar',
            kind: 'token',
            category: 'grammar',
            surface: 'The',
            span: [0, 3],
            tokenIndex: 0,
          },
          {
            id: 'unit-phrase',
            kind: 'phrase',
            category: 'vocabulary',
            surface: 'quick fox',
            span: [4, 13],
          },
          {
            id: 'unit-empty',
            kind: 'token',
            category: 'vocabulary',
            surface: '   ',
            span: [14, 17],
          },
        ]),
      },
    ];

    const inputs = buildTranslationPreviewInputs(entries);

    expect(inputs).toEqual([
      {
        id: 'annotation-1',
        sourceText: 'The quick fox jumps.',
        units: [
          {
            unitId: 'unit-vocab',
            text: 'fox',
            kind: 'vocabulary',
            role: 'subject',
            pos: 'NOUN',
            dep: 'nsubj',
            tokenIndex: 2,
            span: [10, 13],
          },
        ],
      },
    ]);
  });

  it('builds override lookup map from translation previews', () => {
    const previews: PickupTranslateParagraphPreview[] = [
      {
        id: 'annotation-1',
        sourceText: 'The quick fox jumps.',
        paragraphText: '那只敏捷的狐狸跳跃。',
        units: [
          {
            unitId: 'unit-vocab',
            vocabInfusionText: '狐狸',
            vocabInfusionHint: 'fox 的常见释义',
            usphone: 'fɑːks',
            ukphone: 'fɒks',
            syntaxRebuildText: 'fox',
            context: {
              unitId: 'unit-vocab',
              text: 'fox',
              kind: 'vocabulary',
            },
          },
        ],
      },
    ];

    const lookup = buildTranslationOverrideLookup(previews);
    const paragraph = lookup.get('annotation-1');

    expect(paragraph?.paragraphText).toBe('那只敏捷的狐狸跳跃。');
    expect(paragraph?.units.get('unit-vocab')).toEqual({
      vocabInfusionText: '狐狸',
      vocabInfusionHint: 'fox 的常见释义',
      usphone: 'fɑːks',
      ukphone: 'fɒks',
      syntaxRebuildText: 'fox',
    });
  });

  it('resolves vocab infusion token text only for vocabulary tokens', () => {
    const overrides = new Map<string, UnitTranslationOverride>([
      ['unit-1', { vocabInfusionText: '狐狸', syntaxRebuildText: 'fox' }],
    ]);

    expect(resolveVocabInfusionTokenText(createRenderableToken(), overrides)).toBe('狐狸');
    expect(
      resolveVocabInfusionTokenText(createRenderableToken({ kind: 'grammar', renderedText: 'and' }), overrides),
    ).toBe('and');
  });

  it('decides render only when vocabulary has effective translation', () => {
    const overrides = new Map<string, UnitTranslationOverride>([
      ['unit-1', { vocabInfusionText: '狐狸', syntaxRebuildText: 'fox' }],
      ['unit-same', { vocabInfusionText: 'fox', syntaxRebuildText: 'fox' }],
    ]);

    expect(decideTokenRender({ id: 'unit-1', kind: 'vocabulary', text: 'fox' }, overrides)).toBe('render');
    expect(decideTokenRender({ id: 'unit-same', kind: 'vocabulary', text: 'fox' }, overrides)).toBe('skip');
    expect(decideTokenRender({ id: 'unit-2', kind: 'vocabulary', text: 'wolf' }, overrides)).toBe('skip');
    expect(decideTokenRender({ id: 'unit-3', kind: 'grammar', text: 'the' }, overrides)).toBe('skip');
  });

  it('builds renderable token list using pre-filter strategy', () => {
    const overrides = new Map<string, UnitTranslationOverride>([
      ['unit-a', { vocabInfusionText: '苹果', syntaxRebuildText: 'apple' }],
    ]);
    const tokens = [
      { id: 'unit-a', kind: 'vocabulary', text: 'apple', typeId: 1 },
      { id: 'unit-b', kind: 'vocabulary', text: 'banana', typeId: 1 },
      { id: 'unit-c', kind: 'grammar', text: 'the', typeId: 1 },
    ] as const;

    const renderable = buildRenderableTokenList([...tokens], overrides);

    expect(renderable).toEqual([{ id: 'unit-a', kind: 'vocabulary', text: 'apple', typeId: 1 }]);
  });

  it('formats tooltip meaning with phones and meaning lines', () => {
    const overrides = new Map<string, UnitTranslationOverride>([
      ['unit-1', {
        vocabInfusionText: '狐狸',
        vocabInfusionHint: '狡猾的人',
        usphone: 'fɑːks',
        ukphone: '/fɒks/',
        syntaxRebuildText: 'fox',
      }],
    ]);

    const tooltip = resolveVocabTooltipMeaning(createRenderedToken(), overrides);

    expect(tooltip).toBe('美式(US) /fɑːks/  英式(UK) /fɒks/\n狡猾的人');
  });

  it('returns empty tooltip for non-vocabulary tokens', () => {
    const tooltip = resolveVocabTooltipMeaning(createRenderedToken({ kind: 'grammar' }), undefined);
    expect(tooltip).toBe('');
  });
});
