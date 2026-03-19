import { sha256 } from 'js-sha256';
import type {
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  PickupTranslateUnitInput,
  PickupTranslateUnitPreview,
  TranslateProvider,
} from '../../messages';
import { createTranslationCache } from '../../cache';
import { CACHE_PRUNE_REASONS } from '../../constants';
import {
  getVocabDictionaryManifest,
  loadVocabDictionary,
  lookupVocabAllPos,
  lookupVocabPhones,
  lookupVocabTranslation,
  type VocabDictionary,
} from '../../vocab/dictionary';
import { translateText as defaultTranslateText } from './service';
import {
  DEFAULT_LLM_MODEL,
  getStoredLlmModel,
  getStoredPickupDictionaryIds,
  setStoredPickupDictionaryIds,
} from './storage';
import type { TranslateRequest } from './types';

type TranslationCache = Pick<ReturnType<typeof createTranslationCache>, 'get' | 'set' | 'maybePrune'>;

export type TranslationPreviewOptions = {
  includeParagraphTranslation?: boolean;
  includeUnitTranslation?: boolean;
};

export type TranslationPreviewGatewayDeps = {
  resolveTranslationModelKey: (provider: TranslateProvider) => Promise<string>;
  getTranslationCache: (modelKey: string) => TranslationCache;
  translateText: (provider: TranslateProvider, request: TranslateRequest) => Promise<string>;
  hashText: (text: string) => string;
  loadDictionary: () => Promise<VocabDictionary>;
  warn: (message: string, error: unknown) => void;
};

const translationCaches = new Map<string, TranslationCache>();

async function resolveTranslationModelKey(provider: TranslateProvider) {
  if (provider !== 'llm') {
    return `translate:${provider}`;
  }
  const model = await getStoredLlmModel().catch(() => DEFAULT_LLM_MODEL);
  return `translate:${provider}:${model}`;
}

function getTranslationCache(modelKey: string): TranslationCache {
  let cache = translationCaches.get(modelKey);
  if (!cache) {
    cache = createTranslationCache({ modelKey: () => modelKey });
    translationCaches.set(modelKey, cache);
  }
  return cache;
}

async function loadActiveDictionary(): Promise<VocabDictionary> {
  const manifest = await getVocabDictionaryManifest();
  const availableDictionaryIds = new Set(manifest.dictionaries.map(item => item.id));
  const storedDictionaryIds = await getStoredPickupDictionaryIds();
  let resolvedDictionaryIds = (storedDictionaryIds ?? []).filter(id => availableDictionaryIds.has(id));

  if (resolvedDictionaryIds.length === 0) {
    resolvedDictionaryIds = manifest.defaultDictionaryIds.filter(id => availableDictionaryIds.has(id));
  }
  if (resolvedDictionaryIds.length === 0) {
    const firstId = manifest.dictionaries[0]?.id;
    if (firstId) {
      resolvedDictionaryIds = [firstId];
    }
  }
  if (resolvedDictionaryIds.length === 0) {
    throw new Error('Dictionary manifest has no valid dictionary ids.');
  }

  const needsMigration = !storedDictionaryIds
    || storedDictionaryIds.length !== resolvedDictionaryIds.length
    || storedDictionaryIds.some((id, index) => id !== resolvedDictionaryIds[index]);
  if (needsMigration) {
    await setStoredPickupDictionaryIds(resolvedDictionaryIds);
  }

  return loadVocabDictionary({
    dictionaryIds: resolvedDictionaryIds,
  });
}

function buildUnitTranslationPreview(
  unit: PickupTranslateUnitInput,
  dictionary: VocabDictionary,
): PickupTranslateUnitPreview {
  const vocabTranslation = lookupVocabTranslation(unit.text, dictionary, unit.pos) ?? '';
  const vocabHint = lookupVocabAllPos(unit.text, dictionary) ?? '';
  const phones = lookupVocabPhones(unit.text, dictionary);
  return {
    unitId: unit.unitId,
    vocabInfusionText: vocabTranslation,
    vocabInfusionHint: vocabHint,
    usphone: phones?.usphone,
    ukphone: phones?.ukphone,
    syntaxRebuildText: '',
    context: unit,
  };
}

function buildParagraphTranslationPreview(
  paragraph: PickupTranslateParagraphInput,
  units: PickupTranslateUnitPreview[],
  paragraphText: string,
): PickupTranslateParagraphPreview {
  return {
    id: paragraph.id,
    sourceText: paragraph.sourceText,
    paragraphText,
    units,
  };
}

async function resolveParagraphTranslationTexts(
  paragraphs: PickupTranslateParagraphInput[],
  provider: TranslateProvider,
  deps: TranslationPreviewGatewayDeps,
): Promise<string[]> {
  const modelKey = await deps.resolveTranslationModelKey(provider);
  const translationCache = deps.getTranslationCache(modelKey);
  const paragraphTexts: string[] = [];
  let wroteCache = false;

  for (const paragraph of paragraphs) {
    const sourceText = paragraph.sourceText ?? '';
    const cleanText = sourceText.replace(/\u200B/g, '').trim();
    let paragraphText = '';

    if (cleanText) {
      try {
        const sourceHash = deps.hashText(cleanText);
        const cached = await translationCache.get(sourceHash);
        const cachedValue = cached?.value?.trim() ?? '';
        if (cachedValue) {
          paragraphText = cached?.value ?? '';
        }
        else {
          paragraphText = await deps.translateText(provider, { text: cleanText });
          if (paragraphText.trim()) {
            await translationCache.set(sourceHash, paragraphText);
            wroteCache = true;
          }
        }
      }
      catch (error) {
        deps.warn('Pickup paragraph translation failed, fallback to token-only preview:', error);
      }
    }

    paragraphTexts.push(paragraphText);
  }

  if (wroteCache) {
    void translationCache.maybePrune(CACHE_PRUNE_REASONS.translate);
  }

  return paragraphTexts;
}

export function createTranslationPreviewGateway(
  overrides: Partial<TranslationPreviewGatewayDeps> = {},
) {
  const deps: TranslationPreviewGatewayDeps = {
    resolveTranslationModelKey,
    getTranslationCache,
    translateText: defaultTranslateText,
    hashText: sha256,
    loadDictionary: loadActiveDictionary,
    warn: (message, error) => {
      console.warn(message, error);
    },
    ...overrides,
  };

  return {
    async buildPreviews(
      paragraphs: PickupTranslateParagraphInput[],
      provider: TranslateProvider,
      options: TranslationPreviewOptions = {},
    ): Promise<PickupTranslateParagraphPreview[]> {
      if (paragraphs.length === 0) {
        return [];
      }

      const includeParagraphTranslation = options.includeParagraphTranslation !== false;
      const includeUnitTranslation = options.includeUnitTranslation !== false;
      const dictionary = includeUnitTranslation
        ? await deps.loadDictionary()
        : null;
      const paragraphTexts = includeParagraphTranslation
        ? await resolveParagraphTranslationTexts(paragraphs, provider, deps)
        : paragraphs.map(() => '');

      return paragraphs.map((paragraph, index) => {
        const units = dictionary
          ? paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary))
          : [];
        return buildParagraphTranslationPreview(paragraph, units, paragraphTexts[index] ?? '');
      });
    },
  };
}

export type TranslationPreviewGateway = ReturnType<typeof createTranslationPreviewGateway>;

const defaultTranslationPreviewGateway = createTranslationPreviewGateway();

export async function buildTranslationPreviews(
  paragraphs: PickupTranslateParagraphInput[],
  provider: TranslateProvider,
  options: TranslationPreviewOptions = {},
): Promise<PickupTranslateParagraphPreview[]> {
  return defaultTranslationPreviewGateway.buildPreviews(paragraphs, provider, options);
}
