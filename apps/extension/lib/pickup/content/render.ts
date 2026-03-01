import type {
  PickupAnnotation,
} from '@/lib/pickup/messages';
import { buildSentenceAst } from '@/lib/pickup/ast/adapter-registry';
import { buildRenderModelFromSentenceAst, type RenderToken } from '@/lib/pickup/render-model';
import { getPickupTypeById } from '@/lib/pickup/pickup-types';
import { attachPickupInteractions, type PickupInteractionTarget } from './interactions';
import {
  PICKUP_ACCENT_CSS_VAR as PICKUP_ACCENT_VARIABLE,
  PICKUP_IGNORE_ATTR,
  PICKUP_SOFT_BG_CSS_VAR as PICKUP_SOFT_BG_VARIABLE,
  PICKUP_TOKEN_ORIGINAL_TEXT_ATTR,
  PICKUP_TOKEN_TRANSLATED_CLASS,
  PICKUP_TRANSLATION_OWNER_ATTR,
  PICKUP_TRANSLATION_PARAGRAPH_ATTR,
  PICKUP_TRANSLATION_PARAGRAPH_CLASS,
  PICKUP_TRANSLATION_PARAGRAPH_INLINE_CLASS,
} from './markers';
import {
  applyPickupTokenRuby,
  createPickupTokenElement,
  syncPickupTokenHostStates,
} from './web-components';
import {
  annotateElementWithTokens,
  type RenderedToken,
} from './render-annotator';
import {
  buildRenderableTokenList,
  buildTranslationOverrideLookup,
  buildTranslationPreviewInputs,
  resolveVocabInfusionTokenText,
  resolveVocabTooltipMeaning,
  type ParagraphTranslationOverride,
  type TranslationPreviewEntry,
  type UnitTranslationOverride,
} from './render-translation';
import { requestTranslationPreview } from './transport';

const EMPTY_TEXT = '';

type SentenceRenderEntry = {
  annotation: TranslationPreviewEntry['annotation'];
  element: HTMLElement;
  sourceText: string;
  sentenceAst: TranslationPreviewEntry['sentenceAst'];
};

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

function removeTranslationParagraphElementsByOwner(annotationId: string) {
  const escapedOwnerId = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(annotationId)
    : annotationId;
  const selector = `[${PICKUP_TRANSLATION_PARAGRAPH_ATTR}="true"][${PICKUP_TRANSLATION_OWNER_ATTR}="${escapedOwnerId}"]`;
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => node.remove());
}

function upsertTranslationParagraphElement(
  annotationId: string,
  sourceElement: HTMLElement,
  paragraphTranslationText: string,
) {
  removeTranslationParagraphElementsByOwner(annotationId);

  const cleanTranslation = paragraphTranslationText.trim();
  if (!cleanTranslation) {
    return;
  }

  const translationElement = document.createElement('span');
  translationElement.className = PICKUP_TRANSLATION_PARAGRAPH_CLASS;
  const sourceDisplay = window.getComputedStyle(sourceElement).display;
  if (sourceDisplay.includes('inline')) {
    translationElement.classList.add(PICKUP_TRANSLATION_PARAGRAPH_INLINE_CLASS);
  }
  translationElement.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  translationElement.setAttribute(PICKUP_TRANSLATION_PARAGRAPH_ATTR, 'true');
  translationElement.setAttribute(PICKUP_TRANSLATION_OWNER_ATTR, annotationId);
  translationElement.textContent = cleanTranslation;
  if (sourceElement.parentElement) {
    sourceElement.insertAdjacentElement('afterend', translationElement);
  }
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
    const renderableTokens = buildRenderableTokenList(renderModel.tokens, overrides?.units);
    const renderedTokens = annotateElementWithTokens(
      element,
      renderableTokens,
      sourceText,
      {
        resolveTokenText: token => resolveVocabInfusionTokenText(token, overrides?.units),
        createTokenElement: buildTokenSpan,
        tokenOriginalTextAttr: PICKUP_TOKEN_ORIGINAL_TEXT_ATTR,
      },
    );

    element.dataset.pickupProcessed = 'true';
    element.dataset.pickupStatus = 'done';
    element.dataset.pickupAnnotated = 'true';
    upsertTranslationParagraphElement(annotation.id, element, overrides?.paragraphText ?? EMPTY_TEXT);
    decorateRenderedTokens(renderedTokens, overrides?.units);
    appliedIds.add(annotation.id);
  });

  syncPickupTokenHostStates();

  elementMap.forEach((element, id) => {
    if (!appliedIds.has(id)) {
      (element as HTMLElement).dataset.pickupStatus = 'error';
    }
  });
}
