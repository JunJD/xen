import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestQueue, type RequestQueueOptions } from '../../../lib/pickup/background/translate/request-queue';

function createQueueOptions(overrides: Partial<RequestQueueOptions> = {}): RequestQueueOptions {
  return {
    concurrency: 2,
    rate: 10,
    capacity: 10,
    timeoutMs: 50,
    maxRetries: 0,
    baseRetryDelayMs: 20,
    retryJitterRatio: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('paragraph translation request queue', () => {
  it('runs work up to the configured concurrency instead of strict serialization', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const queue = new RequestQueue(createQueueOptions({
      concurrency: 2,
      rate: 10,
      capacity: 10,
    }));
    let activeRequests = 0;
    let maxConcurrentRequests = 0;

    const tasks = ['one', 'two', 'three'].map(text => queue.enqueue(async () => {
      activeRequests += 1;
      maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests);

      return await new Promise((resolve) => {
        setTimeout(() => {
          activeRequests -= 1;
          resolve(text);
        }, 20);
      });
    }));

    await vi.advanceTimersByTimeAsync(0);
    expect(maxConcurrentRequests).toBe(2);

    await vi.advanceTimersByTimeAsync(20);
    expect(maxConcurrentRequests).toBe(2);

    await vi.advanceTimersByTimeAsync(20);
    await expect(Promise.all(tasks)).resolves.toEqual(['one', 'two', 'three']);
  });

  it('respects token-bucket rate settings when many requests are enqueued', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const queue = new RequestQueue(createQueueOptions({
      concurrency: 3,
      rate: 1,
      capacity: 2,
    }));
    const startTimes: number[] = [];

    const tasks = Array.from({ length: 4 }, (_, index) => queue.enqueue(async () => {
      startTimes[index] = Date.now();
      return index;
    }));

    await vi.advanceTimersByTimeAsync(0);
    expect(startTimes).toEqual([0, 0]);

    await vi.advanceTimersByTimeAsync(999);
    expect(startTimes).toEqual([0, 0]);

    await vi.advanceTimersByTimeAsync(1);
    expect(startTimes).toEqual([0, 0, 1000]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(startTimes).toEqual([0, 0, 1000, 2000]);

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3]);
  });

  it('retries timed out requests using the configured backoff policy', async () => {
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

    const task = queue.enqueue(async () => {
      attemptTimes.push(Date.now());
      attemptCount += 1;
      if (attemptCount === 1) {
        return await new Promise<string>(() => {});
      }
      return 'ok';
    });

    await vi.advanceTimersByTimeAsync(30);
    expect(attemptTimes).toEqual([0]);

    await vi.advanceTimersByTimeAsync(19);
    expect(attemptTimes).toEqual([0]);

    await vi.advanceTimersByTimeAsync(1);
    expect(attemptTimes).toEqual([0, 50]);

    await expect(task).resolves.toBe('ok');
  });
});
