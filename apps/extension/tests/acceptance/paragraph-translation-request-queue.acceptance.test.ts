import { afterEach, expect, vi } from 'vitest';
import { buildTranslationPreviews, type BuildTranslationPreviewsDependencies } from '../../lib/pickup/background/translate/preview';
import { RequestQueue, type RequestQueueOptions } from '../../lib/pickup/background/translate/request-queue';
import {
  registerTranslateProvider,
  resetTranslateServiceForTests,
  setTranslateRequestQueueOptions,
} from '../../lib/pickup/background/translate/service';
import { defineFeatureAcceptance } from './bdd-harness';

type TranslationCacheStub = ReturnType<BuildTranslationPreviewsDependencies['getTranslationCache']>;

function createTranslationCacheStub(): TranslationCacheStub {
  return {
    get: async () => null,
    set: async () => undefined,
    maybePrune: async () => undefined,
  } as unknown as TranslationCacheStub;
}

function createQueueOptions(overrides: Partial<RequestQueueOptions> = {}): RequestQueueOptions {
  return {
    concurrency: 2,
    rate: 4,
    capacity: 4,
    timeoutMs: 50,
    maxRetries: 0,
    baseRetryDelayMs: 20,
    retryJitterRatio: 0,
    ...overrides,
  };
}

afterEach(() => {
  resetTranslateServiceForTests();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

defineFeatureAcceptance({
  featurePath: './features/paragraph-translation-request-queue.feature',
  metaUrl: import.meta.url,
  handlers: {
    'Parallel paragraph translation misses': async (scenario) => {
      expect(scenario.steps.map((step) => `${step.keyword} ${step.text}`)).toEqual([
        'Given three uncached paragraphs are requested together',
        'When paragraph translation previews are built',
        'Then provider execution is not strictly serial',
      ]);

      vi.useFakeTimers();
      vi.setSystemTime(0);

      let activeRequests = 0;
      let maxConcurrentRequests = 0;
      registerTranslateProvider({
        id: 'google',
        label: 'Test Google',
        async translate(request) {
          activeRequests += 1;
          maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);

          return new Promise((resolve) => {
            setTimeout(() => {
              activeRequests -= 1;
              resolve({ provider: 'google', text: `translated:${request.text}` });
            }, 20);
          });
        },
      });
      setTranslateRequestQueueOptions({
        concurrency: 3,
        rate: 10,
        capacity: 3,
        timeoutMs: 100,
        maxRetries: 0,
        baseRetryDelayMs: 10,
        retryJitterRatio: 0,
      });

      const previewsPromise = buildTranslationPreviews(
        [
          { id: 'p-1', sourceText: 'Paragraph one.', units: [] },
          { id: 'p-2', sourceText: 'Paragraph two.', units: [] },
          { id: 'p-3', sourceText: 'Paragraph three.', units: [] },
        ],
        'google',
        {
          includeParagraphTranslation: true,
          includeUnitTranslation: false,
        },
        {
          getTranslationCache: () => createTranslationCacheStub(),
          resolveTranslationModelKey: async () => 'acceptance-google',
        },
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(maxConcurrentRequests).toBeGreaterThan(1);

      await vi.advanceTimersByTimeAsync(20);
      await expect(previewsPromise).resolves.toMatchObject([
        { id: 'p-1', paragraphText: 'translated:Paragraph one.' },
        { id: 'p-2', paragraphText: 'translated:Paragraph two.' },
        { id: 'p-3', paragraphText: 'translated:Paragraph three.' },
      ]);
    },

    'Queue throttling policy': async (scenario) => {
      expect(scenario.steps.map((step) => `${step.keyword} ${step.text}`)).toEqual([
        'Given queue throttling is configured with limited burst capacity',
        'When four translation requests are enqueued together',
        'Then execution respects the configured queue policy',
      ]);

      vi.useFakeTimers();
      vi.setSystemTime(0);

      const queue = new RequestQueue(createQueueOptions({
        concurrency: 2,
        rate: 1,
        capacity: 2,
      }));
      const startTimes: number[] = [];

      const tasks = Array.from({ length: 4 }, (_, index) => queue.enqueue(async () => {
        startTimes[index] = Date.now();
        return `task-${index + 1}`;
      }));

      await vi.advanceTimersByTimeAsync(0);
      expect(startTimes).toEqual([0, 0]);

      await vi.advanceTimersByTimeAsync(999);
      expect(startTimes).toEqual([0, 0]);

      await vi.advanceTimersByTimeAsync(1);
      expect(startTimes).toEqual([0, 0, 1000]);

      await vi.advanceTimersByTimeAsync(1000);
      expect(startTimes).toEqual([0, 0, 1000, 2000]);

      await expect(Promise.all(tasks)).resolves.toEqual([
        'task-1',
        'task-2',
        'task-3',
        'task-4',
      ]);
    },

    'Timeout retry policy': async (scenario) => {
      expect(scenario.steps.map((step) => `${step.keyword} ${step.text}`)).toEqual([
        'Given retries are enabled for transient translation failures',
        'When a queued translation attempt times out once',
        'Then the queue retries within the configured policy',
      ]);

      vi.useFakeTimers();
      vi.setSystemTime(0);

      const queue = new RequestQueue(createQueueOptions({
        concurrency: 1,
        rate: 100,
        capacity: 1,
        timeoutMs: 30,
        maxRetries: 1,
        baseRetryDelayMs: 20,
      }));
      const attemptTimes: number[] = [];
      let attemptCount = 0;

      const resultPromise = queue.enqueue(async () => {
        attemptTimes.push(Date.now());
        attemptCount += 1;
        if (attemptCount === 1) {
          return await new Promise<string>(() => {});
        }
        return 'retried-successfully';
      });

      await vi.advanceTimersByTimeAsync(30);
      expect(attemptTimes).toEqual([0]);

      await vi.advanceTimersByTimeAsync(19);
      expect(attemptTimes).toEqual([0]);

      await vi.advanceTimersByTimeAsync(1);
      expect(attemptTimes).toEqual([0, 50]);

      await expect(resultPromise).resolves.toBe('retried-successfully');
    },
  },
});
