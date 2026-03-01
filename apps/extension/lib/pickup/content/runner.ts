import type { PickupParagraph } from '@/lib/pickup/messages';
import { REQUEST_TIMEOUT_MS } from './constants';
import { collectParagraphs } from './collector';
import {
  PICKUP_TOKEN_ORIGINAL_TEXT_ATTR,
  PICKUP_TOKEN_TAG,
  PICKUP_TRANSLATION_PARAGRAPH_SELECTOR,
} from './markers';
import { applyAnnotations, requestAnnotationTranslationPreview } from './render';
import { ensurePickupStyles } from './styles';
import { requestAnnotations } from './transport';

type PendingParagraph = PickupParagraph & { element: Element };

const INTERSECTION_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: '600px',
  threshold: 0.1,
};

const COLLECT_DEBOUNCE_MS = 400;
const INITIAL_COLLECT_DELAY_MS = 300;
const INITIAL_COLLECT_RETRY_COUNT = 2;
const INITIAL_COLLECT_RETRY_INTERVAL_MS = 1000;
const READY_STATE_COMPLETE = 'complete';
const DEFAULT_TRANSLATION_PREVIEW_ENABLED = false;

type PickupRunnerOptions = {
  translationPreviewEnabled?: boolean;
};

export function createPickupRunner(options: PickupRunnerOptions = {}) {
  let isApplying = false;
  let mutationTimer: number | undefined;
  let initialCollectTimer: number | undefined;
  let lastRequestId = 0;
  let observer: MutationObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let isCollectionEnabled = false;
  let hasDeferredCollect = false;
  let loadHandler: (() => void) | null = null;
  const initialRetryTimers = new Set<number>();
  const pending = new Map<string, PendingParagraph>();
  const readyQueue = new Set<string>();
  let contextInvalidated = false;
  let loggedInvalidated = false;
  let started = false;
  let refreshRequested = false;
  let translationPreviewEnabled = options.translationPreviewEnabled ?? DEFAULT_TRANSLATION_PREVIEW_ENABLED;

  function isExtensionContextInvalidated(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return (
      message.includes('Extension context invalidated')
      || message.includes('The message port closed before a response was received')
      || message.includes('Could not establish connection. Receiving end does not exist')
    );
  }

  function handleContextInvalidatedOnce(error: unknown) {
    if (!isExtensionContextInvalidated(error)) {
      return false;
    }
    contextInvalidated = true;
    if (!loggedInvalidated) {
      loggedInvalidated = true;
      console.warn('Pickup stopped: extension context invalidated. Reload the page to re-enable.');
    }
    return true;
  }

  function collectAndObserve(root: ParentNode = document) {
    // 第 1 步：解析 DOM → 采集段落 → 建立 elementMap，并把元素挂到 IntersectionObserver。
    const { paragraphs, elementMap } = collectParagraphs(root);
    if (paragraphs.length === 0) {
      return;
    }

    paragraphs.forEach((paragraph) => {
      if (pending.has(paragraph.id)) {
        return;
      }
      const element = elementMap.get(paragraph.id);
      if (!element) {
        return;
      }
      pending.set(paragraph.id, { ...paragraph, element });
      intersectionObserver?.observe(element);
    });
  }

  function queueReady(ids: string[]) {
    ids.forEach(id => readyQueue.add(id));
    void processQueue();
  }

  async function processQueue() {
    if (contextInvalidated) {
      return;
    }
    if (isApplying) {
      return;
    }
    if (readyQueue.size === 0) {
      return;
    }

    const batchIds = Array.from(readyQueue);
    readyQueue.clear();

    // 第 2 步：视口命中后批量请求标注 → 渲染 → 决策布局。
    const batch: PendingParagraph[] = [];
    for (const id of batchIds) {
      const item = pending.get(id);
      if (!item) {
        continue;
      }
      const element = item.element as HTMLElement;
      if (!element.isConnected) {
        pending.delete(id);
        continue;
      }
      if (element.dataset.pickupProcessed === 'true' || element.dataset.pickupStatus === 'done') {
        pending.delete(id);
        continue;
      }
      batch.push(item);
    }

    if (batch.length === 0) {
      if (readyQueue.size > 0) {
        void processQueue();
      }
      return;
    }

    isApplying = true;
    const requestId = ++lastRequestId;
    const elementMap = new Map<string, Element>();
    const paragraphs: PickupParagraph[] = batch.map(({ element, ...paragraph }) => paragraph);

    batch.forEach((item) => {
      const element = item.element as HTMLElement;
      element.dataset.pickupStatus = 'loading';
      elementMap.set(item.id, item.element);
    });

    const timeoutId = window.setTimeout(() => {
      if (lastRequestId === requestId) {
        elementMap.forEach((element) => {
          (element as HTMLElement).dataset.pickupStatus = 'error';
        });
        batch.forEach(item => pending.delete(item.id));
        isApplying = false;
        if (readyQueue.size > 0) {
          void processQueue();
        }
      }
    }, REQUEST_TIMEOUT_MS);

    try {
      const annotations = await requestAnnotations(paragraphs);
      if (lastRequestId !== requestId) {
        return;
      }
      window.clearTimeout(timeoutId);
      if (annotations.length === 0) {
        elementMap.forEach((element) => {
          (element as HTMLElement).dataset.pickupStatus = 'error';
        });
        return;
      }
      const translationOverridesByParagraph = await requestAnnotationTranslationPreview(
        annotations,
        elementMap,
        { includeParagraphTranslation: translationPreviewEnabled },
      );
      await applyAnnotations(annotations, elementMap, { translationOverridesByParagraph });
    }
    catch (error) {
      window.clearTimeout(timeoutId);
      elementMap.forEach((element) => {
        (element as HTMLElement).dataset.pickupStatus = 'error';
      });
      if (handleContextInvalidatedOnce(error)) {
        stop();
        return;
      }
      console.warn('Pickup annotation failed:', error);
    }
    finally {
      batch.forEach(item => pending.delete(item.id));
      isApplying = false;
      if (refreshRequested) {
        refreshRequested = false;
        refresh();
        return;
      }
      if (readyQueue.size > 0) {
        void processQueue();
      }
    }
  }

  function handleIntersections(entries: IntersectionObserverEntry[]) {
    const readyIds: string[] = [];
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }
      const target = entry.target as HTMLElement;
      const id = target.dataset.pickupId;
      intersectionObserver?.unobserve(target);
      if (!id) {
        return;
      }
      readyIds.push(id);
    });

    if (readyIds.length > 0) {
      queueReady(readyIds);
    }
  }

  function scheduleCollect() {
    if (!isCollectionEnabled) {
      hasDeferredCollect = true;
      return;
    }

    if (mutationTimer) {
      window.clearTimeout(mutationTimer);
    }
    mutationTimer = window.setTimeout(() => {
      collectAndObserve();
    }, COLLECT_DEBOUNCE_MS);
  }

  function runInitialCollectPasses() {
    isCollectionEnabled = true;
    collectAndObserve();

    if (hasDeferredCollect) {
      hasDeferredCollect = false;
      collectAndObserve();
    }

    for (let attempt = 1; attempt <= INITIAL_COLLECT_RETRY_COUNT; attempt += 1) {
      const retryTimer = window.setTimeout(() => {
        initialRetryTimers.delete(retryTimer);
        collectAndObserve();
      }, INITIAL_COLLECT_RETRY_INTERVAL_MS * attempt);
      initialRetryTimers.add(retryTimer);
    }
  }

  function scheduleInitialCollect() {
    initialCollectTimer = window.setTimeout(() => {
      initialCollectTimer = undefined;
      runInitialCollectPasses();
    }, INITIAL_COLLECT_DELAY_MS);
  }

  function setupInitialCollectionGate() {
    if (document.readyState === READY_STATE_COMPLETE) {
      scheduleInitialCollect();
      return;
    }

    loadHandler = () => {
      loadHandler = null;
      scheduleInitialCollect();
    };

    window.addEventListener('load', loadHandler, { once: true });
  }

  function restoreAnnotatedContent(root: ParentNode = document) {
    const translationParagraphElements = root.querySelectorAll<HTMLElement>(PICKUP_TRANSLATION_PARAGRAPH_SELECTOR);
    translationParagraphElements.forEach((element) => element.remove());

    const tokenElements = root.querySelectorAll<HTMLElement>(PICKUP_TOKEN_TAG);
    tokenElements.forEach((tokenElement) => {
      const originalText = tokenElement.getAttribute(PICKUP_TOKEN_ORIGINAL_TEXT_ATTR) ?? '';
      tokenElement.replaceWith(document.createTextNode(originalText));
    });

    const annotatedElements = root.querySelectorAll<HTMLElement>('[data-pickup-annotated="true"]');
    annotatedElements.forEach((element) => {
      delete element.dataset.pickupAnnotated;
      delete element.dataset.pickupProcessed;
      delete element.dataset.pickupStatus;
      delete element.dataset.pickupId;
    });

    const statusElements = root.querySelectorAll<HTMLElement>('[data-pickup-status]');
    statusElements.forEach((element) => {
      delete element.dataset.pickupProcessed;
      delete element.dataset.pickupStatus;
      delete element.dataset.pickupId;
    });
  }

  function refresh() {
    if (!started || contextInvalidated) {
      return;
    }
    if (isApplying) {
      refreshRequested = true;
      return;
    }
    if (mutationTimer) {
      window.clearTimeout(mutationTimer);
      mutationTimer = undefined;
    }
    pending.clear();
    readyQueue.clear();
    intersectionObserver?.disconnect();
    restoreAnnotatedContent();
    if (!isCollectionEnabled) {
      hasDeferredCollect = true;
      return;
    }
    collectAndObserve();
  }

  function start() {
    if (started) {
      return;
    }
    started = true;
    ensurePickupStyles();
    intersectionObserver = new IntersectionObserver(handleIntersections, INTERSECTION_OPTIONS);

    observer = new MutationObserver(() => {
      scheduleCollect();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    setupInitialCollectionGate();
  }

  function stop() {
    if (!started) {
      return;
    }
    started = false;
    if (mutationTimer) {
      window.clearTimeout(mutationTimer);
      mutationTimer = undefined;
    }
    if (initialCollectTimer) {
      window.clearTimeout(initialCollectTimer);
      initialCollectTimer = undefined;
    }
    initialRetryTimers.forEach(timer => window.clearTimeout(timer));
    initialRetryTimers.clear();
    if (loadHandler) {
      window.removeEventListener('load', loadHandler);
      loadHandler = null;
    }

    observer?.disconnect();
    observer = null;
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    isCollectionEnabled = false;
    hasDeferredCollect = false;
    refreshRequested = false;
    pending.clear();
    readyQueue.clear();
  }

  return {
    start,
    stop,
    restore: restoreAnnotatedContent,
    refresh,
    isTranslationPreviewEnabled: () => translationPreviewEnabled,
    setTranslationPreviewEnabled: (enabled: boolean) => {
      if (translationPreviewEnabled === enabled) {
        return false;
      }
      translationPreviewEnabled = enabled;
      refresh();
      return true;
    },
    isStarted: () => started,
  };
}
