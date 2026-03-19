import { sha256 } from 'js-sha256';
import type {
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  PickupTranslateUnitInput,
  PickupTranslateUnitPreview,
  TranslateProvider,
} from '@/lib/pickup/messages';
import { createTranslationCache } from '@/lib/pickup/cache';
import { CACHE_PRUNE_REASONS } from '@/lib/pickup/constants';
import {
  getVocabDictionaryManifest,
  loadVocabDictionary,
  lookupVocabAllPos,
  lookupVocabPhones,
  lookupVocabTranslation,
  type VocabDictionary,
} from '@/lib/pickup/vocab/dictionary';
import { DEFAULT_LLM_MODEL, getStoredLlmModel, getStoredPickupDictionaryIds, setStoredPickupDictionaryIds } from './storage';
import { translateText } from './service';

type TranslationCache = ReturnType<typeof createTranslationCache>;
type TranslationCacheLoadResult = {
  value: string;
  cacheHit: boolean;
  persisted: boolean;
};

export type BuildTranslationPreviewsOptions = {
  includeParagraphTranslation?: boolean;
  includeUnitTranslation?: boolean;
};

export type BuildTranslationPreviewsDependencies = {
  getTranslationCache: (modelKey: string) => TranslationCache;
  resolveTranslationModelKey: (provider: TranslateProvider) => Promise<string>;
  translateText: (provider: TranslateProvider, request: { text: string }) => Promise<string>;
  getVocabDictionaryManifest: typeof getVocabDictionaryManifest;
  getStoredPickupDictionaryIds: typeof getStoredPickupDictionaryIds;
  setStoredPickupDictionaryIds: typeof setStoredPickupDictionaryIds;
  loadVocabDictionary: typeof loadVocabDictionary;
  lookupVocabTranslation: typeof lookupVocabTranslation;
  lookupVocabAllPos: typeof lookupVocabAllPos;
  lookupVocabPhones: typeof lookupVocabPhones;
};

const translationCaches = new Map<string, TranslationCache>();

async function resolveTranslationModelKey(provider: TranslateProvider) {
  if (provider !== 'llm') {
    return `translate:${provider}`;
  }

  const model = await getStoredLlmModel().catch(() => DEFAULT_LLM_MODEL);
  return `translate:${provider}:${model}`;
}

function getTranslationCache(modelKey: string) {
  let cache = translationCaches.get(modelKey);
  if (!cache) {
    cache = createTranslationCache({ modelKey: () => modelKey });
    translationCaches.set(modelKey, cache);
  }
  return cache;
}

function buildUnitTranslationPreview(
  unit: PickupTranslateUnitInput,
  dictionary: VocabDictionary,
  dependencies: BuildTranslationPreviewsDependencies,
): PickupTranslateUnitPreview {
  const vocabTranslation = dependencies.lookupVocabTranslation(unit.text, dictionary, unit.pos) ?? '';
  const vocabHint = dependencies.lookupVocabAllPos(unit.text, dictionary) ?? '';
  const phones = dependencies.lookupVocabPhones(unit.text, dictionary);
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

async function resolveDictionary(
  includeUnitTranslation: boolean,
  dependencies: BuildTranslationPreviewsDependencies,
): Promise<VocabDictionary | null> {
  if (!includeUnitTranslation) {
    return null;
  }

  const manifest = await dependencies.getVocabDictionaryManifest();
  const availableDictionaryIds = new Set(manifest.dictionaries.map(item => item.id));
  const storedDictionaryIds = await dependencies.getStoredPickupDictionaryIds();
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
    await dependencies.setStoredPickupDictionaryIds(resolvedDictionaryIds);
  }

  return dependencies.loadVocabDictionary({ dictionaryIds: resolvedDictionaryIds });
}

const defaultDependencies: BuildTranslationPreviewsDependencies = {
  getTranslationCache,
  resolveTranslationModelKey,
  translateText,
  getVocabDictionaryManifest,
  getStoredPickupDictionaryIds,
  setStoredPickupDictionaryIds,
  loadVocabDictionary,
  lookupVocabTranslation,
  lookupVocabAllPos,
  lookupVocabPhones,
};

export async function buildTranslationPreviews(
  paragraphs: PickupTranslateParagraphInput[],
  provider: TranslateProvider,
  options: BuildTranslationPreviewsOptions = {},
  overrides: Partial<BuildTranslationPreviewsDependencies> = {},
): Promise<PickupTranslateParagraphPreview[]> {
  if (paragraphs.length === 0) {
    return [];
  }

  const dependencies: BuildTranslationPreviewsDependencies = {
    ...defaultDependencies,
    ...overrides,
  };
  const includeParagraphTranslation = options.includeParagraphTranslation !== false;
  const includeUnitTranslation = options.includeUnitTranslation !== false;
  const dictionary = await resolveDictionary(includeUnitTranslation, dependencies);

  if (!includeParagraphTranslation) {
    return paragraphs.map((paragraph) => {
      const units = includeUnitTranslation && dictionary
        ? paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary, dependencies))
        : [];
      return buildParagraphTranslationPreview(paragraph, units, '');
    });
  }

  const modelKey = await dependencies.resolveTranslationModelKey(provider);
  const translationCache = dependencies.getTranslationCache(modelKey);
  const inFlightParagraphTranslations = new Map<string, Promise<TranslationCacheLoadResult>>();
  let wroteCache = false;

  const paragraphTexts = await Promise.all(paragraphs.map(async (paragraph) => {
    const sourceText = paragraph.sourceText ?? '';
    const cleanText = sourceText.replace(/\u200B/g, '').trim();
    if (!cleanText) {
      return '';
    }

    try {
      const sourceHash = sha256(cleanText);
      const getOrLoad = (translationCache as TranslationCache & {
        getOrLoad?: (
          sourceHash: string,
          load: () => Promise<string>,
          options?: { shouldPersist?: (value: string) => boolean },
        ) => Promise<TranslationCacheLoadResult>;
      }).getOrLoad;

      const result = getOrLoad
        ? await getOrLoad(
          sourceHash,
          () => dependencies.translateText(provider, { text: cleanText }),
          {
            shouldPersist: value => value.trim().length > 0,
          },
        )
        : await (async () => {
          const cached = await translationCache.get(sourceHash);
          const cachedValue = cached?.value?.trim() ?? '';
          if (cachedValue) {
            return {
              value: cached?.value ?? '',
              cacheHit: true,
              persisted: false,
            };
          }

          let pending = inFlightParagraphTranslations.get(sourceHash);
          if (!pending) {
            pending = (async () => {
              const value = await dependencies.translateText(provider, { text: cleanText });
              const persisted = value.trim().length > 0;
              if (persisted) {
                await translationCache.set(sourceHash, value);
              }
              return {
                value,
                cacheHit: false,
                persisted,
              };
            })();
            inFlightParagraphTranslations.set(sourceHash, pending);
          }

          try {
            return await pending;
          }
          finally {
            if (inFlightParagraphTranslations.get(sourceHash) === pending) {
              inFlightParagraphTranslations.delete(sourceHash);
            }
          }
        })();

      wroteCache = wroteCache || result.persisted;
      return result.value;
    } catch (error) {
      console.warn('Pickup paragraph translation failed, fallback to token-only preview:', error);
      return '';
    }
  }));

  if (wroteCache) {
    void translationCache.maybePrune(CACHE_PRUNE_REASONS.translate);
  }

  return paragraphs.map((paragraph, index) => {
    const units = includeUnitTranslation && dictionary
      ? paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary, dependencies))
      : [];
    return buildParagraphTranslationPreview(paragraph, units, paragraphTexts[index] ?? '');
  });
}
