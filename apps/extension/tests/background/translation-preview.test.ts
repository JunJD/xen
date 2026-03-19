import { sha256 } from 'js-sha256';
import { describe, expect, it } from 'vitest';
import type { PickupTranslateParagraphInput } from '../../lib/pickup/messages';
import { buildTranslationPreviews } from '../../lib/pickup/background/translation-preview';
import type { VocabDictionary } from '../../lib/pickup/vocab/dictionary';

function createParagraph(id: string, sourceText: string): PickupTranslateParagraphInput {
  return {
    id,
    sourceText,
    units: [
      {
        unitId: `${id}-unit-1`,
        text: 'fox',
        kind: 'vocabulary',
        pos: 'NOUN',
      },
    ],
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushAsyncWork() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

function createTranslationCache(
  paragraphs: PickupTranslateParagraphInput[],
  initialEntries: Record<string, string>,
  events: string[],
) {
  const labelByHash = new Map(
    paragraphs.map(paragraph => [sha256(paragraph.sourceText.trim()), paragraph.id]),
  );
  const stored = new Map(
    Object.entries(initialEntries).map(([sourceText, value]) => [sha256(sourceText.trim()), value]),
  );

  return {
    get: async (sourceHash: string) => {
      const label = labelByHash.get(sourceHash) ?? sourceHash;
      events.push(`cache:get:${label}`);
      const value = stored.get(sourceHash);
      if (value === undefined) {
        events.push(`cache:miss:${label}`);
        return null;
      }
      events.push(`cache:hit:${label}`);
      return { value };
    },
    set: async (sourceHash: string, value: string) => {
      const label = labelByHash.get(sourceHash) ?? sourceHash;
      events.push(`cache:set:${label}`);
      stored.set(sourceHash, value);
    },
    maybePrune: async (reason: string) => {
      events.push(`cache:prune:${reason}`);
    },
  };
}

describe('翻译预览构建队列', () => {
  it('preserves input order when cache misses finish out of order', async () => {
    const paragraphs = [
      createParagraph('A', 'Paragraph A'),
      createParagraph('B', 'Paragraph B'),
      createParagraph('C', 'Paragraph C'),
    ];
    const events: string[] = [];
    const completionOrder: string[] = [];
    const pendingById = new Map([
      ['A', createDeferred<string>()],
      ['B', createDeferred<string>()],
      ['C', createDeferred<string>()],
    ]);

    const buildPromise = buildTranslationPreviews(paragraphs, {
      includeUnitTranslation: false,
      translationCache: createTranslationCache(paragraphs, {}, events),
      translateParagraph: async (_text, paragraph) => {
        events.push(`translate:start:${paragraph.id}`);
        const translated = await pendingById.get(paragraph.id)!.promise;
        completionOrder.push(paragraph.id);
        events.push(`translate:resolve:${paragraph.id}`);
        return translated;
      },
      translationQueueConcurrency: 3,
    });

    await flushAsyncWork();

    expect(events).toEqual(expect.arrayContaining([
      'translate:start:A',
      'translate:start:B',
      'translate:start:C',
    ]));

    pendingById.get('B')!.resolve('Preview B');
    pendingById.get('C')!.resolve('Preview C');
    await flushAsyncWork();

    expect(completionOrder).toEqual(['B', 'C']);

    pendingById.get('A')!.resolve('Preview A');

    const previews = await buildPromise;

    expect(completionOrder).toEqual(['B', 'C', 'A']);
    expect(previews.map(preview => preview.id)).toEqual(['A', 'B', 'C']);
    expect(previews.map(preview => preview.paragraphText)).toEqual([
      'Preview A',
      'Preview B',
      'Preview C',
    ]);
  });

  it('lets cache hits complete without waiting behind misses', async () => {
    const paragraphs = [
      createParagraph('A', 'Paragraph A'),
      createParagraph('B', 'Paragraph B'),
      createParagraph('C', 'Paragraph C'),
    ];
    const events: string[] = [];
    const pendingA = createDeferred<string>();
    const pendingC = createDeferred<string>();

    const buildPromise = buildTranslationPreviews(paragraphs, {
      includeUnitTranslation: false,
      translationCache: createTranslationCache(paragraphs, {
        'Paragraph B': 'Cached Preview B',
      }, events),
      translateParagraph: async (_text, paragraph) => {
        events.push(`translate:start:${paragraph.id}`);
        const translated = paragraph.id === 'A'
          ? await pendingA.promise
          : await pendingC.promise;
        events.push(`translate:resolve:${paragraph.id}`);
        return translated;
      },
      translationQueueConcurrency: 2,
    });

    await flushAsyncWork();

    expect(events).toEqual(expect.arrayContaining([
      'cache:get:A',
      'cache:get:B',
      'cache:get:C',
      'cache:hit:B',
      'translate:start:A',
      'translate:start:C',
    ]));
    expect(events).not.toContain('translate:resolve:A');
    expect(events.indexOf('cache:hit:B')).toBeGreaterThan(events.indexOf('cache:get:B'));

    pendingC.resolve('Preview C');
    pendingA.resolve('Preview A');

    const previews = await buildPromise;

    expect(previews.map(preview => preview.paragraphText)).toEqual([
      'Preview A',
      'Cached Preview B',
      'Preview C',
    ]);
    expect(previews.map(preview => preview.id)).toEqual(['A', 'B', 'C']);
  });

  it('keeps unaffected previews stable when one paragraph translation fails', async () => {
    const paragraphs = [
      createParagraph('A', 'Paragraph A'),
      createParagraph('B', 'Paragraph B'),
      createParagraph('C', 'Paragraph C'),
    ];
    const errors: unknown[] = [];
    const dictionary: VocabDictionary = new Map([
      ['fox', {
        plain: '狐狸',
        byPos: { NOUN: ['狐狸'] },
        usphone: 'fɑːks',
        ukphone: 'fɒks',
      }],
    ]);

    const previews = await buildTranslationPreviews(paragraphs, {
      dictionary,
      translationCache: createTranslationCache(paragraphs, {}, []),
      translateParagraph: async (_text, paragraph) => {
        if (paragraph.id === 'B') {
          throw new Error('translation failed');
        }
        return `Preview ${paragraph.id}`;
      },
      onParagraphTranslationError: (error) => {
        errors.push(error);
      },
      translationQueueConcurrency: 3,
    });

    expect(errors).toHaveLength(1);
    expect(previews.map(preview => preview.id)).toEqual(['A', 'B', 'C']);
    expect(previews.map(preview => preview.paragraphText)).toEqual([
      'Preview A',
      '',
      'Preview C',
    ]);
    expect(previews[0].units[0]?.vocabInfusionText).toBe('狐狸');
    expect(previews[1].units[0]?.vocabInfusionText).toBe('狐狸');
    expect(previews[2].units[0]?.vocabInfusionText).toBe('狐狸');
  });
});
