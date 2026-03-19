import { describe, expect, it, vi } from 'vitest';
import type { CacheEntry } from '../../../lib/pickup/cache';
import type { PickupTranslateParagraphInput, TranslateProvider } from '../../../lib/pickup/messages';
import { createTranslationPreviewGateway } from '../../../lib/pickup/background/translate/preview-gateway';

function createParagraph(id: string, sourceText: string): PickupTranslateParagraphInput {
  return {
    id,
    sourceText,
    units: [],
  };
}

function createCacheEntry(sourceHash: string, value: string): CacheEntry<string> {
  return {
    hash: sourceHash,
    sourceHash,
    modelKey: 'translate:google',
    version: 1,
    value,
    updatedAt: 1,
    lastAccessed: 1,
  };
}

function createGatewayHarness(options?: {
  cacheEntries?: Record<string, string>;
  translateText?: (provider: TranslateProvider, text: string) => Promise<string>;
}) {
  const cache = {
    get: vi.fn(async (sourceHash: string) => {
      const value = options?.cacheEntries?.[sourceHash];
      return value === undefined ? null : createCacheEntry(sourceHash, value);
    }),
    set: vi.fn(async () => undefined),
    maybePrune: vi.fn(async () => undefined),
  };
  const translateText = vi.fn(async (provider: TranslateProvider, request: { text: string }) => {
    if (options?.translateText) {
      return options.translateText(provider, request.text);
    }
    return `translated:${request.text}`;
  });
  const loadDictionary = vi.fn(async () => {
    throw new Error('Dictionary should not be loaded in these tests.');
  });
  const gateway = createTranslationPreviewGateway({
    resolveTranslationModelKey: vi.fn(async () => 'translate:google'),
    getTranslationCache: vi.fn(() => cache),
    translateText,
    hashText: (text) => `hash:${text}`,
    loadDictionary,
    warn: vi.fn(),
  });

  return {
    cache,
    gateway,
    loadDictionary,
    translateText,
  };
}

describe('translation preview gateway', () => {
  it('only sends uncached paragraphs to the provider', async () => {
    const { cache, gateway, loadDictionary, translateText } = createGatewayHarness({
      cacheEntries: {
        'hash:First paragraph': 'cached:first',
        'hash:Second paragraph': 'cached:second',
      },
    });

    const previews = await gateway.buildPreviews([
      createParagraph('p-1', 'First paragraph'),
      createParagraph('p-2', 'Second paragraph'),
      createParagraph('p-3', 'Third paragraph'),
    ], 'google', {
      includeUnitTranslation: false,
    });

    expect(loadDictionary).not.toHaveBeenCalled();
    expect(translateText).toHaveBeenCalledTimes(1);
    expect(translateText).toHaveBeenCalledWith('google', { text: 'Third paragraph' });
    expect(cache.set).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith('hash:Third paragraph', 'translated:Third paragraph');
    expect(cache.maybePrune).toHaveBeenCalledTimes(1);
    expect(previews.map(preview => preview.paragraphText)).toEqual([
      'cached:first',
      'cached:second',
      'translated:Third paragraph',
    ]);
  });

  it('returns previews in the same order as the input paragraphs', async () => {
    const { gateway } = createGatewayHarness({
      translateText: async (_provider, text) => `preview:${text}`,
    });

    const previews = await gateway.buildPreviews([
      createParagraph('p-3', 'Gamma'),
      createParagraph('p-1', 'Alpha'),
      createParagraph('p-2', 'Beta'),
    ], 'google', {
      includeUnitTranslation: false,
    });

    expect(previews.map(preview => preview.id)).toEqual(['p-3', 'p-1', 'p-2']);
    expect(previews.map(preview => preview.paragraphText)).toEqual([
      'preview:Gamma',
      'preview:Alpha',
      'preview:Beta',
    ]);
  });

  it('can be unit tested with injected doubles without booting background setup', async () => {
    const { gateway, translateText } = createGatewayHarness({
      translateText: async (_provider, text) => `isolated:${text}`,
    });

    const previews = await gateway.buildPreviews([
      createParagraph('p-1', 'Standalone paragraph'),
    ], 'google', {
      includeUnitTranslation: false,
    });

    expect(translateText).toHaveBeenCalledTimes(1);
    expect(previews).toEqual([
      {
        id: 'p-1',
        sourceText: 'Standalone paragraph',
        paragraphText: 'isolated:Standalone paragraph',
        units: [],
      },
    ]);
  });
});
