import { sha256 } from 'js-sha256';
import type {
  PickupTranslateParagraphInput,
  PickupTranslateParagraphPreview,
  PickupTranslateUnitInput,
  PickupTranslateUnitPreview,
} from '../messages';
import { CACHE_PRUNE_REASONS } from '../constants';
import {
  lookupVocabAllPos,
  lookupVocabPhones,
  lookupVocabTranslation,
  type VocabDictionary,
} from '../vocab/dictionary';

const DEFAULT_TRANSLATION_QUEUE_CONCURRENCY = 4;

type TranslationCacheEntry = {
  value: string;
};

type TranslationCacheLike = {
  get: (sourceHash: string) => Promise<TranslationCacheEntry | null>;
  set: (sourceHash: string, value: string) => Promise<void>;
  maybePrune: (reason: string) => Promise<void>;
};

export type BuildTranslationPreviewsOptions = {
  includeParagraphTranslation?: boolean;
  includeUnitTranslation?: boolean;
  dictionary?: VocabDictionary | null;
  translationCache?: TranslationCacheLike | null;
  translateParagraph?: (text: string, paragraph: PickupTranslateParagraphInput) => Promise<string>;
  onParagraphTranslationError?: (error: unknown) => void;
  translationQueueConcurrency?: number;
};

function createAsyncTaskQueue(concurrency: number) {
  const limit = Math.max(1, Math.floor(concurrency));
  const pending: Array<() => void> = [];
  let active = 0;

  const pump = () => {
    while (active < limit && pending.length > 0) {
      active += 1;
      const start = pending.shift();
      start?.();
    }
  };

  return <T>(task: () => Promise<T>) => new Promise<T>((resolve, reject) => {
    pending.push(() => {
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });
    pump();
  });
}

export function buildUnitTranslationPreview(
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

export function buildParagraphTranslationPreview(
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

export async function buildTranslationPreviews(
  paragraphs: PickupTranslateParagraphInput[],
  options: BuildTranslationPreviewsOptions = {},
): Promise<PickupTranslateParagraphPreview[]> {
  if (paragraphs.length === 0) {
    return [];
  }

  const includeParagraphTranslation = options.includeParagraphTranslation !== false;
  const includeUnitTranslation = options.includeUnitTranslation !== false;
  const dictionary = options.dictionary ?? null;

  if (!includeParagraphTranslation) {
    return paragraphs.map((paragraph) => {
      const units = includeUnitTranslation && dictionary
        ? paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary))
        : [];
      return buildParagraphTranslationPreview(paragraph, units, '');
    });
  }

  if (!options.translationCache || !options.translateParagraph) {
    throw new Error(
      'Translation preview builder requires translationCache and translateParagraph when paragraph translation is enabled.',
    );
  }
  const translationCache = options.translationCache;
  const translateParagraph = options.translateParagraph;

  const enqueueTranslation = createAsyncTaskQueue(
    options.translationQueueConcurrency ?? DEFAULT_TRANSLATION_QUEUE_CONCURRENCY,
  );
  let wroteCache = false;

  const previews = await Promise.all(paragraphs.map(async (paragraph) => {
    const units = includeUnitTranslation && dictionary
      ? paragraph.units.map(unit => buildUnitTranslationPreview(unit, dictionary))
      : [];
    const sourceText = paragraph.sourceText ?? '';
    const cleanText = sourceText.replace(/\u200B/g, '').trim();

    if (!cleanText) {
      return buildParagraphTranslationPreview(paragraph, units, '');
    }

    try {
      const sourceHash = sha256(cleanText);
      const cached = await translationCache.get(sourceHash);
      const cachedText = cached?.value ?? '';
      const cachedValue = cachedText.trim();
      if (cachedValue) {
        return buildParagraphTranslationPreview(paragraph, units, cachedText);
      }

      const paragraphText = await enqueueTranslation(
        () => translateParagraph(cleanText, paragraph),
      );
      if (paragraphText.trim()) {
        await translationCache.set(sourceHash, paragraphText);
        wroteCache = true;
      }

      return buildParagraphTranslationPreview(paragraph, units, paragraphText);
    }
    catch (error) {
      options.onParagraphTranslationError?.(error);
      return buildParagraphTranslationPreview(paragraph, units, '');
    }
  }));

  if (wroteCache) {
    void translationCache.maybePrune(CACHE_PRUNE_REASONS.translate);
  }

  return previews;
}
