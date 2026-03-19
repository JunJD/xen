export type RequestQueueOptions = {
  concurrency: number;
  rate: number;
  capacity: number;
  timeoutMs: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  retryJitterRatio: number;
};

type RequestTask<T> = {
  id: number;
  thunk: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  scheduleAt: number;
  createdAt: number;
  retryCount: number;
};

const DEFAULT_RETRY_JITTER_RATIO = 0.1;

let nextTaskId = 0;

function toPositiveInteger(value: number, label: string, { allowZero = false }: { allowZero?: boolean } = {}) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} integer.`);
  }
  return value;
}

function toPositiveNumber(value: number, label: string, { allowZero = false }: { allowZero?: boolean } = {}) {
  if (!Number.isFinite(value) || value < (allowZero ? 0 : Number.EPSILON)) {
    throw new Error(`${label} must be ${allowZero ? 'a non-negative' : 'a positive'} number.`);
  }
  return value;
}

export function resolveRequestQueueOptions(
  base: RequestQueueOptions,
  overrides: Partial<RequestQueueOptions> = {},
): RequestQueueOptions {
  const next: RequestQueueOptions = {
    concurrency: overrides.concurrency ?? base.concurrency,
    rate: overrides.rate ?? base.rate,
    capacity: overrides.capacity ?? base.capacity,
    timeoutMs: overrides.timeoutMs ?? base.timeoutMs,
    maxRetries: overrides.maxRetries ?? base.maxRetries,
    baseRetryDelayMs: overrides.baseRetryDelayMs ?? base.baseRetryDelayMs,
    retryJitterRatio: overrides.retryJitterRatio ?? base.retryJitterRatio ?? DEFAULT_RETRY_JITTER_RATIO,
  };

  next.concurrency = toPositiveInteger(next.concurrency, 'Queue concurrency');
  next.rate = toPositiveNumber(next.rate, 'Queue rate');
  next.capacity = toPositiveInteger(next.capacity, 'Queue capacity');
  next.timeoutMs = toPositiveInteger(next.timeoutMs, 'Queue timeoutMs');
  next.maxRetries = toPositiveInteger(next.maxRetries, 'Queue maxRetries', { allowZero: true });
  next.baseRetryDelayMs = toPositiveInteger(next.baseRetryDelayMs, 'Queue baseRetryDelayMs', { allowZero: true });
  next.retryJitterRatio = toPositiveNumber(next.retryJitterRatio, 'Queue retryJitterRatio', { allowZero: true });

  return next;
}

export class RequestQueue {
  private waitingQueue: RequestTask<unknown>[] = [];
  private runningCount = 0;
  private nextPumpTimer: ReturnType<typeof setTimeout> | null = null;
  private bucketTokens: number;
  private lastRefillAt: number;
  private disposed = false;
  private options: RequestQueueOptions;

  constructor(options: RequestQueueOptions) {
    this.options = resolveRequestQueueOptions(options, {});
    this.bucketTokens = this.options.capacity;
    this.lastRefillAt = Date.now();
  }

  enqueue<T>(thunk: () => Promise<T>, scheduleAt = Date.now()): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Request queue has been disposed.'));
    }

    return new Promise<T>((resolve, reject) => {
      const task: RequestTask<T> = {
        id: ++nextTaskId,
        thunk,
        resolve,
        reject,
        scheduleAt,
        createdAt: Date.now(),
        retryCount: 0,
      };
      this.waitingQueue.push(task as RequestTask<unknown>);
      this.sortWaitingQueue();
      this.pump();
    });
  }

  setOptions(overrides: Partial<RequestQueueOptions>) {
    this.options = resolveRequestQueueOptions(this.options, overrides);
    this.bucketTokens = Math.min(this.bucketTokens, this.options.capacity);
    this.lastRefillAt = Date.now();
    this.pump();
  }

  getOptions(): RequestQueueOptions {
    return { ...this.options };
  }

  dispose() {
    this.disposed = true;
    this.waitingQueue = [];
    if (this.nextPumpTimer) {
      clearTimeout(this.nextPumpTimer);
      this.nextPumpTimer = null;
    }
  }

  private pump() {
    if (this.disposed) {
      return;
    }

    this.refillTokens();
    const now = Date.now();

    while (
      this.runningCount < this.options.concurrency
      && this.bucketTokens >= 1
      && this.waitingQueue.length > 0
    ) {
      const nextTask = this.waitingQueue[0];
      if (!nextTask || nextTask.scheduleAt > now) {
        break;
      }

      this.waitingQueue.shift();
      this.bucketTokens -= 1;
      this.runningCount += 1;
      void this.executeTask(nextTask);
    }

    this.scheduleNextPump();
  }

  private scheduleNextPump() {
    if (this.nextPumpTimer) {
      clearTimeout(this.nextPumpTimer);
      this.nextPumpTimer = null;
    }

    if (this.disposed || this.waitingQueue.length === 0) {
      return;
    }

    if (this.runningCount >= this.options.concurrency) {
      return;
    }

    const nextTask = this.waitingQueue[0];
    if (!nextTask) {
      return;
    }

    const now = Date.now();
    const delayUntilScheduled = Math.max(0, nextTask.scheduleAt - now);
    const delayUntilToken = this.bucketTokens >= 1
      ? 0
      : Math.ceil(((1 - this.bucketTokens) / this.options.rate) * 1000);
    const delay = Math.max(delayUntilScheduled, delayUntilToken);

    this.nextPumpTimer = setTimeout(() => {
      this.nextPumpTimer = null;
      this.pump();
    }, delay);
  }

  private async executeTask(task: RequestTask<unknown>) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const result = await Promise.race([
        Promise.resolve().then(task.thunk),
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Request timed out after ${this.options.timeoutMs}ms.`));
          }, this.options.timeoutMs);
        }),
      ]);

      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      task.resolve(result);
    }
    catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (task.retryCount < this.options.maxRetries) {
        task.retryCount += 1;
        task.scheduleAt = Date.now() + this.computeRetryDelay(task.retryCount);
        this.waitingQueue.push(task);
        this.sortWaitingQueue();
      } else {
        task.reject(error);
      }
    }
    finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      this.runningCount = Math.max(0, this.runningCount - 1);
      this.pump();
    }
  }

  private computeRetryDelay(retryCount: number) {
    const baseDelay = this.options.baseRetryDelayMs * (2 ** (retryCount - 1));
    const jitter = baseDelay * this.options.retryJitterRatio * Math.random();
    return Math.round(baseDelay + jitter);
  }

  private refillTokens() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) {
      return;
    }

    const replenished = (elapsedMs / 1000) * this.options.rate;
    this.bucketTokens = Math.min(this.options.capacity, this.bucketTokens + replenished);
    this.lastRefillAt = now;
  }

  private sortWaitingQueue() {
    this.waitingQueue.sort((left, right) => {
      if (left.scheduleAt !== right.scheduleAt) {
        return left.scheduleAt - right.scheduleAt;
      }
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      return left.id - right.id;
    });
  }
}
