import type {
  PickupAnnotation,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from '@/lib/pickup/messages';
import type { SentenceAst, UnitAst } from '@/lib/pickup/ast/types';
import type { RenderToken } from '@/lib/pickup/render-model';
import type { RenderableToken, RenderedToken } from './render-annotator';

const EMPTY_TEXT = '';

export type UnitTranslationOverride = {
  vocabInfusionText: string;
  vocabInfusionHint?: string;
  usphone?: string;
  ukphone?: string;
  syntaxRebuildText: string;
};

export type ParagraphTranslationOverride = {
  paragraphText?: string;
  units: Map<string, UnitTranslationOverride>;
};

export type TranslationPreviewEntry = {
  annotation: PickupAnnotation;
  sourceText: string;
  sentenceAst: SentenceAst;
};

export type TokenRenderDecision = 'render' | 'skip';

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isTranslatableVocabularyUnit(unit: UnitAst) {
  return unit.kind === 'token' && unit.category === 'vocabulary' && unit.surface.trim().length > 0;
}

export function buildTranslationPreviewInputs(entries: TranslationPreviewEntry[]): PickupTranslateParagraphInput[] {
  return entries.map(({ annotation, sourceText, sentenceAst }) => ({
    id: annotation.id,
    sourceText,
    units: sentenceAst.units
      .filter(isTranslatableVocabularyUnit)
      .map(unit => ({
        unitId: unit.id,
        text: unit.surface,
        kind: unit.category,
        role: unit.role,
        pos: unit.pos,
        dep: unit.dep,
        tokenIndex: unit.tokenIndex,
        span: unit.span,
      })),
  }));
}

export function buildTranslationOverrideLookup(
  translations: PickupTranslateParagraphPreview[],
): Map<string, ParagraphTranslationOverride> {
  const paragraphLookup = new Map<string, ParagraphTranslationOverride>();

  translations.forEach((paragraphPreview) => {
    const unitLookup = new Map<string, UnitTranslationOverride>();
    paragraphPreview.units.forEach((unitPreview) => {
      unitLookup.set(unitPreview.unitId, {
        vocabInfusionText: unitPreview.vocabInfusionText,
        vocabInfusionHint: unitPreview.vocabInfusionHint,
        usphone: unitPreview.usphone,
        ukphone: unitPreview.ukphone,
        syntaxRebuildText: unitPreview.syntaxRebuildText,
      });
    });
    paragraphLookup.set(paragraphPreview.id, {
      paragraphText: paragraphPreview.paragraphText,
      units: unitLookup,
    });
  });

  return paragraphLookup;
}

export function resolveVocabInfusionTokenText(
  token: RenderableToken,
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (token.kind !== 'vocabulary') {
    return token.renderedText;
  }
  const override = overrides?.get(token.id);
  if (override?.vocabInfusionText?.trim()) {
    return override.vocabInfusionText;
  }
  return token.renderedText;
}

function resolveVocabTranslatedText(
  token: Pick<RenderToken, 'id' | 'kind' | 'text'>,
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (token.kind !== 'vocabulary') {
    return null;
  }
  const translated = overrides?.get(token.id)?.vocabInfusionText?.trim();
  if (!translated) {
    return null;
  }
  const source = (token.text ?? '').trim();
  if (source && normalizeComparableText(source) === normalizeComparableText(translated)) {
    return null;
  }
  return translated;
}

export function decideTokenRender(
  token: Pick<RenderToken, 'id' | 'kind' | 'text'>,
  overrides?: Map<string, UnitTranslationOverride>,
): TokenRenderDecision {
  return resolveVocabTranslatedText(token, overrides) ? 'render' : 'skip';
}

export function buildRenderableTokenList(
  tokens: RenderToken[],
  overrides?: Map<string, UnitTranslationOverride>,
): RenderToken[] {
  return tokens.filter(token => decideTokenRender(token, overrides) === 'render');
}

export function resolveVocabTooltipMeaning(
  token: RenderedToken,
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (token.kind !== 'vocabulary') {
    return EMPTY_TEXT;
  }
  const override = overrides?.get(token.id);
  const meaning = override?.vocabInfusionHint?.trim() || EMPTY_TEXT;
  const lines: string[] = [];
  const formatPhone = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    if (trimmed.startsWith('[') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return `/${trimmed}/`;
  };
  const usphone = formatPhone(override?.usphone ?? '');
  const ukphone = formatPhone(override?.ukphone ?? '');
  const phoneParts: string[] = [];
  if (usphone) {
    phoneParts.push(`美式(US) ${usphone}`);
  }
  if (ukphone) {
    phoneParts.push(`英式(UK) ${ukphone}`);
  }
  if (phoneParts.length > 0) {
    lines.push(phoneParts.join('  '));
  }
  if (meaning) {
    lines.push(meaning);
  }
  return lines.join('\n');
}
