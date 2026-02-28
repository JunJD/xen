import type {
  PickupAnnotation,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from '@/lib/pickup/messages';
import { buildSentenceAst } from '@/lib/pickup/ast/adapter-registry';
import type { SentenceAst, UnitAst } from '@/lib/pickup/ast/types';
import { buildRenderModelFromSentenceAst, type RenderToken } from '@/lib/pickup/render-model';
import { getPickupTypeById } from '@/lib/pickup/pickup-types';
import { attachPickupInteractions, type PickupInteractionTarget } from './interactions';
import {
  applyPickupTokenRuby,
  createPickupTokenElement,
  syncPickupTokenHostStates,
} from './web-components';
import { requestTranslationPreview } from './transport';

const PICKUP_IGNORE_ATTR = 'data-pickup-ignore';
const PICKUP_ACCENT_VARIABLE = '--xen-pickup-accent';
const PICKUP_SOFT_BG_VARIABLE = '--xen-pickup-soft-bg';
const PICKUP_TOKEN_TRANSLATED_CLASS = 'xen-pickup-token-translated';
const PICKUP_THREE_LANE_CLASS = 'xen-pickup-three-lane';
const PICKUP_LANE_CLASS = 'xen-pickup-lane';
const PICKUP_LANE_CONTENT_CLASS = 'xen-pickup-lane-content';
const PICKUP_SOURCE_LANE_CLASS = 'xen-pickup-lane-vocab-infusion';
const PICKUP_TARGET_LANE_CLASS = 'xen-pickup-lane-target';
const PICKUP_PARAGRAPH_TRANSLATION_CONTENT_CLASS = 'xen-pickup-paragraph-translation';

const EMPTY_TEXT = '';

type RenderableToken = RenderToken & {
  start: number;
  end: number;
  renderedText: string;
};

type RenderedToken = RenderToken & {
  renderedText: string;
  sourceText: string;
  element: HTMLElement;
};

type TokenTextResolver = (token: RenderableToken) => string;

type AnnotatedFragmentResult = {
  fragment: DocumentFragment;
  renderedTokens: RenderedToken[];
};

type UnitTranslationOverride = {
  vocabInfusionText: string;
  vocabInfusionHint?: string;
  usphone?: string;
  ukphone?: string;
  syntaxRebuildText: string;
};

type ParagraphTranslationOverride = {
  paragraphText?: string;
  units: Map<string, UnitTranslationOverride>;
};

type SentenceRenderEntry = {
  annotation: PickupAnnotation;
  element: HTMLElement;
  sourceText: string;
  sentenceAst: SentenceAst;
};

function isValidOffset(value: number, sourceLength: number) {
  return Number.isInteger(value) && value >= 0 && value <= sourceLength;
}

function resolveTokenSpan(
  token: RenderToken,
  sourceText: string,
  cursor: number,
) {
  if (typeof token.start === 'number' && typeof token.end === 'number') {
    if (!isValidOffset(token.start, sourceText.length) || !isValidOffset(token.end, sourceText.length)) {
      return null;
    }
    if (token.end <= token.start || token.start < cursor) {
      return null;
    }
    return { start: token.start, end: token.end };
  }

  if (!token.text) {
    return null;
  }

  const start = sourceText.indexOf(token.text, cursor);
  if (start < 0) {
    return null;
  }

  return {
    start,
    end: start + token.text.length,
  };
}

function buildRenderableTokens(
  tokens: RenderToken[],
  sourceText: string,
) {
  const renderableTokens: RenderableToken[] = [];
  let cursor = 0;

  tokens.forEach((token) => {
    // 只接受单调递增且落在原文范围内的 span，避免 DOM 归一化后偏移漂移。
    const span = resolveTokenSpan(token, sourceText, cursor);
    if (!span) {
      return;
    }

    const renderedText = sourceText.slice(span.start, span.end);
    if (!renderedText) {
      return;
    }

    renderableTokens.push({
      ...token,
      start: span.start,
      end: span.end,
      renderedText,
    });
    cursor = span.end;
  });

  return renderableTokens;
}

export function buildTokenSpan(token: RenderToken, tokenText: string) {
  const type = getPickupTypeById(token.typeId);
  const resolvedKind = token.kind ?? type.kind;
  const wrapper = createPickupTokenElement({
    text: tokenText,
    title: token.label ?? type.name,
    kind: resolvedKind === 'vocabulary' || resolvedKind === 'grammar' ? resolvedKind : 'other',
    accentColor: type.border,
    softBgColor: type.background,
    ignoreAttrName: PICKUP_IGNORE_ATTR,
    accentVariableName: PICKUP_ACCENT_VARIABLE,
    softBgVariableName: PICKUP_SOFT_BG_VARIABLE,
  });
  return wrapper;
}

function buildAnnotatedFragment(
  tokens: RenderToken[],
  sourceText: string,
  resolveTokenText: TokenTextResolver = token => token.renderedText,
): AnnotatedFragmentResult {
  if (!sourceText) {
    const fragment = document.createDocumentFragment();
    const fallbackText = tokens.map(token => token.text).filter(Boolean).join(' ');
    fragment.appendChild(document.createTextNode(fallbackText));
    return { fragment, renderedTokens: [] };
  }

  const renderableTokens = buildRenderableTokens(tokens, sourceText);
  if (renderableTokens.length === 0) {
    // 没有可靠 span 时保留原文，避免破坏布局。
    const fallback = document.createDocumentFragment();
    fallback.appendChild(document.createTextNode(sourceText));
    return { fragment: fallback, renderedTokens: [] };
  }

  const fragment = document.createDocumentFragment();
  const renderedTokens: RenderedToken[] = [];
  let cursor = 0;
  renderableTokens.forEach((token) => {
    if (token.start > cursor) {
      fragment.appendChild(document.createTextNode(sourceText.slice(cursor, token.start)));
    }
    const mappedText = resolveTokenText(token) || token.renderedText || EMPTY_TEXT;
    const element = buildTokenSpan(token, mappedText);
    fragment.appendChild(element);
    renderedTokens.push({
      ...token,
      renderedText: mappedText,
      sourceText: token.renderedText ?? EMPTY_TEXT,
      element,
    });
    cursor = token.end;
  });

  if (cursor < sourceText.length) {
    fragment.appendChild(document.createTextNode(sourceText.slice(cursor)));
  }

  return { fragment, renderedTokens };
}

function normalizeMeaning(rawMeaning: string | undefined) {
  if (!rawMeaning) {
    return EMPTY_TEXT;
  }
  return rawMeaning
    .replace(/\s+/g, ' ')
    .trim();
}

function isTranslatableVocabularyUnit(unit: UnitAst) {
  return unit.kind === 'token' && unit.category === 'vocabulary' && unit.surface.trim().length > 0;
}

function buildTranslationPreviewInputs(entries: SentenceRenderEntry[]): PickupTranslateParagraphInput[] {
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

function buildTranslationOverrideLookup(
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

function resolveVocabInfusionTokenText(
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

function resolveVocabTooltipMeaning(
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

function decorateRenderedTokens(
  renderedTokens: RenderedToken[],
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (renderedTokens.length === 0) {
    return;
  }
  const interactionTargets: PickupInteractionTarget[] = [];

  renderedTokens.forEach((token) => {
    const element = token.element;
    const vocabMeaning = resolveVocabTooltipMeaning(token, overrides);
    const resolvedMeaning = vocabMeaning || token.meaning || EMPTY_TEXT;
    if (token.kind === 'vocabulary') {
      const override = overrides?.get(token.id);
      const translated = override?.vocabInfusionText?.trim() ?? '';
      const original = token.sourceText?.trim() ?? '';
      if (translated && original && translated !== original) {
        element.classList.add(PICKUP_TOKEN_TRANSLATED_CLASS);
        applyPickupTokenRuby(element, token.sourceText, translated);
      }
    }
    interactionTargets.push({
      element,
      meaning: resolvedMeaning || undefined,
      groupId: token.groupId || undefined,
    });
  });

  attachPickupInteractions(interactionTargets);
}

function buildLaneContentElement() {
  const laneContentElement = document.createElement('span');
  laneContentElement.className = PICKUP_LANE_CONTENT_CLASS;
  laneContentElement.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  return laneContentElement;
}

function buildLaneElement(variantClassName: string) {
  const laneElement = document.createElement('span');
  laneElement.className = `${PICKUP_LANE_CLASS} ${variantClassName}`;
  laneElement.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  return laneElement;
}

function mountAnnotatedParagraph(
  element: HTMLElement,
  inlineFragment: DocumentFragment,
  paragraphTranslationText: string,
) {
  element.textContent = EMPTY_TEXT;

  const cleanTranslation = paragraphTranslationText.trim();
  if (!cleanTranslation) {
    element.appendChild(inlineFragment);
    return;
  }

  const container = document.createElement('span');
  container.className = PICKUP_THREE_LANE_CLASS;
  container.setAttribute(PICKUP_IGNORE_ATTR, 'true');

  const sourceLane = buildLaneElement(PICKUP_SOURCE_LANE_CLASS);
  const sourceLaneContent = buildLaneContentElement();
  sourceLaneContent.appendChild(inlineFragment);
  sourceLane.appendChild(sourceLaneContent);

  const targetLane = buildLaneElement(PICKUP_TARGET_LANE_CLASS);
  const targetLaneContent = buildLaneContentElement();
  targetLaneContent.classList.add(PICKUP_PARAGRAPH_TRANSLATION_CONTENT_CLASS);
  targetLaneContent.textContent = cleanTranslation;
  targetLane.appendChild(targetLaneContent);

  container.append(sourceLane, targetLane);
  element.appendChild(container);
}

type ApplyAnnotationsOptions = {
  translationOverridesByParagraph?: Map<string, ParagraphTranslationOverride>;
};

type AnnotationTranslationPreviewOptions = {
  includeParagraphTranslation?: boolean;
};

function buildSentenceRenderEntries(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
) {
  const entries: SentenceRenderEntry[] = [];

  annotations.forEach((annotation) => {
    const element = elementMap.get(annotation.id);
    if (!element) {
      return;
    }

    const htmlElement = element as HTMLElement;
    const sourceText = htmlElement.dataset.pickupOriginal ?? htmlElement.textContent ?? EMPTY_TEXT;
    const sentenceAst = buildSentenceAst({ annotation, text: sourceText });
    entries.push({
      annotation,
      element: htmlElement,
      sourceText,
      sentenceAst,
    });
  });

  return entries;
}

async function requestTranslationOverridesByEntries(
  entries: SentenceRenderEntry[],
  options: AnnotationTranslationPreviewOptions = {},
) {
  const translationInputs = buildTranslationPreviewInputs(entries);
  if (translationInputs.length === 0) {
    return new Map<string, ParagraphTranslationOverride>();
  }

  try {
    const translations = await requestTranslationPreview(translationInputs, {
      includeParagraphTranslation: options.includeParagraphTranslation,
    });
    return buildTranslationOverrideLookup(translations);
  }
  catch (error) {
    console.warn('Pickup translation preview request failed:', error);
    return new Map<string, ParagraphTranslationOverride>();
  }
}

export async function requestAnnotationTranslationPreview(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
  options: AnnotationTranslationPreviewOptions = {},
) {
  const entries = buildSentenceRenderEntries(annotations, elementMap);
  return requestTranslationOverridesByEntries(entries, options);
}

export async function applyAnnotations(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
  options: ApplyAnnotationsOptions = {},
) {
  const appliedIds = new Set<string>();
  const entries = buildSentenceRenderEntries(annotations, elementMap);
  const translationOverridesByParagraph = options.translationOverridesByParagraph
    ?? new Map<string, ParagraphTranslationOverride>();

  entries.forEach(({ annotation, element, sourceText, sentenceAst }) => {
    const overrides = translationOverridesByParagraph.get(annotation.id);
    const renderModel = buildRenderModelFromSentenceAst(sentenceAst);
    const inlineRender = buildAnnotatedFragment(
      renderModel.tokens,
      sourceText,
      token => resolveVocabInfusionTokenText(token, overrides?.units),
    );

    mountAnnotatedParagraph(
      element,
      inlineRender.fragment,
      overrides?.paragraphText ?? EMPTY_TEXT,
    );
    element.dataset.pickupProcessed = 'true';
    element.dataset.pickupStatus = 'done';
    element.dataset.pickupAnnotated = 'true';
    decorateRenderedTokens(inlineRender.renderedTokens, overrides?.units);
    appliedIds.add(annotation.id);
  });

  syncPickupTokenHostStates();

  elementMap.forEach((element, id) => {
    if (!appliedIds.has(id)) {
      (element as HTMLElement).dataset.pickupStatus = 'error';
    }
  });
}
