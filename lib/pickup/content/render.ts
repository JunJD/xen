import type {
  PickupAnnotation,
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
} from '@/lib/pickup/messages';
import { buildSentenceAst } from '@/lib/pickup/ast/adapter-registry';
import type { SentenceAst, UnitAst } from '@/lib/pickup/ast/types';
import { buildRenderModelFromSentenceAst, type RenderToken } from '@/lib/pickup/render-model';
import { getPickupTypeById } from '@/lib/pickup/pickup-types';
import { attachPickupInteractions } from './interactions';
import { requestTranslationPreview } from './transport';
import { GRAMMAR_ROLE_MEANINGS } from './grammar-role-meanings';
import type { GrammarPointAst } from '@/lib/pickup/ast/types';

const PICKUP_IGNORE_ATTR = 'data-pickup-ignore';
const PICKUP_CATEGORY_ATTR = 'data-pickup-category';
const PICKUP_ACCENT_VARIABLE = '--xen-pickup-accent';
const PICKUP_SOFT_BG_VARIABLE = '--xen-pickup-soft-bg';
const PICKUP_THREE_LANE_CLASS = 'xen-pickup-three-lane';
const PICKUP_LANE_CLASS = 'xen-pickup-lane';
const PICKUP_LANE_CONTENT_CLASS = 'xen-pickup-lane-content';
const PICKUP_ROLE_BADGE_CLASS = 'xen-pickup-role-badge';
const PICKUP_ROLE_BADGE_KIND_ATTR = 'data-pickup-badge';
const STRUCTURE_ROLE_LABELS = new Set([
  '定语从句',
  '状语从句',
  '补语从句',
  '开放补语',
  '并列分句',
]);

const LANE_ORIGINAL = 'original';
const LANE_TARGET = 'target';
const LANE_VOCAB_INFUSION = 'vocab_infusion';
const LANE_SYNTAX_REBUILD = 'syntax_rebuild';
type PickupLane =
  | typeof LANE_ORIGINAL
  | typeof LANE_TARGET
  | typeof LANE_VOCAB_INFUSION
  | typeof LANE_SYNTAX_REBUILD;

const MOCK_MEANING_PREFIX_PATTERN = /^(语法|词汇)释义（mock）：/;
const EMPTY_TEXT = '';
const TOKEN_AFFIX_PATTERN = /^([^A-Za-z0-9\u4e00-\u9fff]*)(.*?)([^A-Za-z0-9\u4e00-\u9fff]*)$/;

type RenderableToken = RenderToken & {
  start: number;
  end: number;
  renderedText: string;
};

type RenderedToken = RenderToken & {
  renderedText: string;
  sourceText: string;
  element: HTMLSpanElement;
};

type TokenTextResolver = (token: RenderableToken) => string;

type AnnotatedFragmentResult = {
  fragment: DocumentFragment;
  renderedTokens: RenderedToken[];
};

type UnitTranslationOverride = {
  vocabInfusionText: string;
  vocabInfusionHint?: string;
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
  const wrapper = document.createElement('span');
  wrapper.className = 'xen-pickup-token';
  wrapper.style.setProperty(PICKUP_ACCENT_VARIABLE, type.border);
  wrapper.style.setProperty(PICKUP_SOFT_BG_VARIABLE, type.background);
  wrapper.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  wrapper.setAttribute(PICKUP_CATEGORY_ATTR, token.kind ?? type.kind);
  if (token.pos) {
    wrapper.dataset.pickupPos = token.pos;
  }
  if (token.tag) {
    wrapper.dataset.pickupTag = token.tag;
  }
  if (token.dep) {
    wrapper.dataset.pickupDep = token.dep;
  }
  wrapper.title = token.label ?? type.name;
  wrapper.textContent = tokenText;
  return wrapper;
}

function buildFallbackFragment(
  tokens: RenderToken[],
  resolveTokenText: (token: RenderToken) => string = token => token.text,
): AnnotatedFragmentResult {
  const fragment = document.createDocumentFragment();
  const renderedTokens: RenderedToken[] = [];
  tokens.forEach((token, index) => {
    if (index > 0) {
      fragment.appendChild(document.createTextNode(' '));
    }
    const renderedText = resolveTokenText(token) || token.text || EMPTY_TEXT;
    const element = buildTokenSpan(token, renderedText);
    fragment.appendChild(element);
    renderedTokens.push({
      ...token,
      renderedText,
      sourceText: token.text ?? EMPTY_TEXT,
      element,
    });
  });
  return { fragment, renderedTokens };
}

function buildAnnotatedFragment(
  tokens: RenderToken[],
  sourceText: string,
  resolveTokenText: TokenTextResolver = token => token.renderedText,
): AnnotatedFragmentResult {
  if (!sourceText) {
    return buildFallbackFragment(tokens, (token) => {
      const fallbackToken: RenderableToken = {
        ...token,
        start: 0,
        end: 0,
        renderedText: token.text,
      };
      return resolveTokenText(fallbackToken);
    });
  }

  const renderableTokens = buildRenderableTokens(tokens, sourceText);
  if (renderableTokens.length === 0) {
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
    .replace(MOCK_MEANING_PREFIX_PATTERN, EMPTY_TEXT)
    .replace(/\s+/g, ' ')
    .trim();
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function hasEnglish(text: string) {
  return /[A-Za-z]/.test(text);
}

function normalizeEnglishLookupKey(text: string) {
  return text.toLowerCase().trim();
}

function splitTokenAffixes(text: string) {
  const match = text.match(TOKEN_AFFIX_PATTERN);
  if (!match) {
    return { prefix: EMPTY_TEXT, core: text, suffix: EMPTY_TEXT };
  }
  const [, prefix, core, suffix] = match;
  return { prefix, core, suffix };
}

function translateByFallbackDictionary(text: string, dictionary: Record<string, string>, normalize = false) {
  const { prefix, core, suffix } = splitTokenAffixes(text);
  if (!core) {
    return EMPTY_TEXT;
  }
  const key = normalize ? normalizeEnglishLookupKey(core) : core.trim();
  if (!key) {
    return EMPTY_TEXT;
  }
  const translatedCore = dictionary[key];
  if (!translatedCore) {
    return EMPTY_TEXT;
  }
  return `${prefix}${translatedCore}${suffix}`;
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

function resolveSyntaxRebuildTokenText(
  token: RenderableToken,
  overrides?: Map<string, UnitTranslationOverride>,
) {
  return token.renderedText;
}

function createLaneShell(lane: PickupLane) {
  const laneElement = document.createElement('section');
  laneElement.className = PICKUP_LANE_CLASS;
  laneElement.dataset.pickupLane = lane;
  laneElement.setAttribute(PICKUP_IGNORE_ATTR, 'true');

  const contentElement = document.createElement('div');
  contentElement.className = PICKUP_LANE_CONTENT_CLASS;

  laneElement.append(contentElement);
  return { laneElement, contentElement };
}

function buildThreeLaneLayout(
  tokens: RenderToken[],
  sourceText: string,
  overrides?: ParagraphTranslationOverride,
) {
  const container = document.createElement('div');
  container.className = PICKUP_THREE_LANE_CLASS;
  container.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  container.setAttribute('data-pickup-layout', 'three-lane');

  const originalLane = createLaneShell(LANE_ORIGINAL);
  originalLane.contentElement.textContent = sourceText;
  container.appendChild(originalLane.laneElement);

  const targetLane = createLaneShell(LANE_TARGET);
  if (typeof overrides?.paragraphText === 'string') {
    targetLane.contentElement.textContent = overrides.paragraphText;
  } else {
    targetLane.contentElement.textContent = EMPTY_TEXT;
  }
  container.appendChild(targetLane.laneElement);

  const vocabLane = createLaneShell(LANE_VOCAB_INFUSION);
  const vocabRender = buildAnnotatedFragment(
    tokens,
    sourceText,
    token => resolveVocabInfusionTokenText(token, overrides?.units),
  );
  vocabLane.contentElement.appendChild(vocabRender.fragment);
  container.appendChild(vocabLane.laneElement);

  const syntaxLane = createLaneShell(LANE_SYNTAX_REBUILD);
  const syntaxRender = buildAnnotatedFragment(
    tokens,
    sourceText,
    token => resolveSyntaxRebuildTokenText(token, overrides?.units),
  );
  syntaxLane.contentElement.appendChild(syntaxRender.fragment);
  container.appendChild(syntaxLane.laneElement);

  return {
    container,
    renderedTokens: [...vocabRender.renderedTokens, ...syntaxRender.renderedTokens],
  };
}

function resolveVocabTooltipMeaning(
  token: RenderedToken,
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (token.kind !== 'vocabulary') {
    return EMPTY_TEXT;
  }
  const override = overrides?.get(token.id);
  if (override?.vocabInfusionHint?.trim()) {
    return override.vocabInfusionHint;
  }
  if (override?.vocabInfusionText?.trim()) {
    return override.vocabInfusionText;
  }
  return EMPTY_TEXT;
}

function decorateRenderedTokens(
  renderedTokens: RenderedToken[],
  grammarPoints: GrammarPointAst[],
  overrides?: Map<string, UnitTranslationOverride>,
) {
  if (renderedTokens.length === 0) {
    return;
  }
  const tokenElements: HTMLSpanElement[] = [];
  const badgeElements: HTMLSpanElement[] = [];
  const renderedByUnitId = new Map<string, RenderedToken>();
  renderedTokens.forEach((token) => {
    renderedByUnitId.set(token.id, token);
  });

  renderedTokens.forEach((token) => {
    const element = token.element;
    tokenElements.push(element);

    element.dataset.pickupUnit = token.id;
    if (token.groupId) {
      element.dataset.pickupGroup = token.groupId;
    }
    if (token.role) {
      element.dataset.pickupRole = token.role;
    }
    const lane = element.closest<HTMLElement>('[data-pickup-lane]')?.dataset.pickupLane;
    const vocabMeaning = lane === LANE_VOCAB_INFUSION
      ? resolveVocabTooltipMeaning(token, overrides)
      : EMPTY_TEXT;
    if (vocabMeaning) {
      element.dataset.pickupMeaning = vocabMeaning;
    } else if (token.meaning) {
      element.dataset.pickupMeaning = token.meaning;
    }
    if (lane === LANE_VOCAB_INFUSION && token.kind === 'vocabulary') {
      const override = overrides?.get(token.id);
      const translated = override?.vocabInfusionText?.trim() ?? '';
      const original = token.sourceText?.trim() ?? '';
      if (translated && original && translated !== original) {
        element.dataset.pickupOriginal = token.sourceText;
      }
    }

    if (token.kind === 'grammar') {
      const role = normalizeMeaning(token.role ?? token.label ?? token.meaning);
      if (role && role !== '标点' && !STRUCTURE_ROLE_LABELS.has(role)) {
        const badge = document.createElement('span');
        badge.className = PICKUP_ROLE_BADGE_CLASS;
        badge.textContent = role;
        badge.setAttribute(PICKUP_ROLE_BADGE_KIND_ATTR, 'token');
        badge.dataset.pickupRole = role;
        badge.dataset.pickupCategory = 'grammar';
        const mappedMeaning = GRAMMAR_ROLE_MEANINGS[role];
        if (mappedMeaning) {
          badge.dataset.pickupMeaning = mappedMeaning;
        }
        element.appendChild(badge);
        badgeElements.push(badge);
      }
    }
  });

  grammarPoints.forEach((point) => {
    if (!point.evidenceUnitIds || point.evidenceUnitIds.length === 0) {
      return;
    }
    const candidates = point.evidenceUnitIds
      .map(unitId => renderedByUnitId.get(unitId))
      .filter((token): token is RenderedToken => Boolean(token));
    if (candidates.length === 0) {
      return;
    }
    let anchor = candidates[0];
    candidates.forEach((token) => {
      if (typeof token.start === 'number' && typeof anchor.start === 'number') {
        if (token.start < anchor.start) {
          anchor = token;
        }
      }
    });
    const label = normalizeMeaning(point.label);
    if (!label || label === '标点') {
      return;
    }
    const badge = document.createElement('span');
    badge.className = PICKUP_ROLE_BADGE_CLASS;
    badge.textContent = label;
    badge.setAttribute(PICKUP_ROLE_BADGE_KIND_ATTR, 'structure');
    badge.dataset.pickupRole = label;
    badge.dataset.pickupCategory = 'grammar';
    const mappedMeaning = GRAMMAR_ROLE_MEANINGS[label];
    if (mappedMeaning) {
      badge.dataset.pickupMeaning = mappedMeaning;
    } else if (point.explanation) {
      badge.dataset.pickupMeaning = normalizeMeaning(point.explanation);
    }
    badge.dataset.pickupGroup = point.id;
    anchor.element.appendChild(badge);
    badgeElements.push(badge);
  });

  attachPickupInteractions([...tokenElements, ...badgeElements]);
}

export async function applyAnnotations(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
) {
  const appliedIds = new Set<string>();
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

  let translationOverridesByParagraph = new Map<string, ParagraphTranslationOverride>();
  const translationInputs = buildTranslationPreviewInputs(entries);

  if (translationInputs.some(input => input.units.length > 0)) {
    try {
      const translations = await requestTranslationPreview(translationInputs);
      translationOverridesByParagraph = buildTranslationOverrideLookup(translations);
    }
    catch (error) {
      console.warn('Pickup translation preview request failed:', error);
    }
  }

  entries.forEach(({ annotation, element, sourceText, sentenceAst }) => {
    const overrides = translationOverridesByParagraph.get(annotation.id);
    const renderModel = buildRenderModelFromSentenceAst(sentenceAst);
    const { container, renderedTokens } = buildThreeLaneLayout(renderModel.tokens, sourceText, overrides);

    element.textContent = EMPTY_TEXT;
    element.appendChild(container);
    element.dataset.pickupProcessed = 'true';
    element.dataset.pickupStatus = 'done';
    element.dataset.pickupAnnotated = 'true';
    decorateRenderedTokens(renderedTokens, sentenceAst.grammarPoints, overrides?.units);
    appliedIds.add(annotation.id);
  });

  elementMap.forEach((element, id) => {
    if (!appliedIds.has(id)) {
      (element as HTMLElement).dataset.pickupStatus = 'error';
    }
  });
}
