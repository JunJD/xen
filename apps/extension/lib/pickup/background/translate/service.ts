import type { TranslateProvider } from '@/lib/pickup/messages';
import type { TranslateProviderAdapter, TranslateRequest } from './types';
import { RequestQueue, resolveRequestQueueOptions, type RequestQueueOptions } from './request-queue';

const providers = new Map<TranslateProvider, TranslateProviderAdapter>();
const requestQueues = new Map<TranslateProvider, RequestQueue>();

export const DEFAULT_TRANSLATE_REQUEST_QUEUE_OPTIONS: RequestQueueOptions = {
  concurrency: 2,
  rate: 4,
  capacity: 4,
  timeoutMs: 15_000,
  maxRetries: 2,
  baseRetryDelayMs: 750,
  retryJitterRatio: 0.1,
};

let translateRequestQueueOptions = { ...DEFAULT_TRANSLATE_REQUEST_QUEUE_OPTIONS };

export function registerTranslateProvider(provider: TranslateProviderAdapter) {
  if (providers.has(provider.id)) {
    throw new Error(`Translate provider already registered: ${provider.id}`);
  }
  providers.set(provider.id, provider);
}

export function getTranslateProvider(providerId: TranslateProvider): TranslateProviderAdapter {
  const provider = providers.get(providerId);
  if (!provider) {
    throw new Error(`Translate provider not registered: ${providerId}`);
  }
  return provider;
}

export function listTranslateProviders(): TranslateProviderAdapter[] {
  return Array.from(providers.values());
}

function getTranslateRequestQueue(providerId: TranslateProvider) {
  let queue = requestQueues.get(providerId);
  if (!queue) {
    queue = new RequestQueue(translateRequestQueueOptions);
    requestQueues.set(providerId, queue);
  }
  return queue;
}

export function setTranslateRequestQueueOptions(overrides: Partial<RequestQueueOptions>) {
  translateRequestQueueOptions = resolveRequestQueueOptions(translateRequestQueueOptions, overrides);
  requestQueues.forEach((queue) => {
    queue.setOptions(translateRequestQueueOptions);
  });
  return { ...translateRequestQueueOptions };
}

export function getTranslateRequestQueueOptions() {
  return { ...translateRequestQueueOptions };
}

export function resetTranslateServiceForTests() {
  providers.clear();
  requestQueues.forEach(queue => queue.dispose());
  requestQueues.clear();
  translateRequestQueueOptions = { ...DEFAULT_TRANSLATE_REQUEST_QUEUE_OPTIONS };
}

export async function translateText(providerId: TranslateProvider, request: TranslateRequest): Promise<string> {
  const provider = getTranslateProvider(providerId);
  const response = await getTranslateRequestQueue(providerId).enqueue(() => provider.translate(request));
  return response.text;
}
