import type { PickupParagraph } from '@/lib/pickup/messages';
import { REQUEST_TIMEOUT_MS } from './constants';
import { collectParagraphs } from './collector';
import { applyAnnotations } from './render';
import { ensurePickupStyles } from './styles';
import { requestAnnotations } from './transport';

type PendingParagraph = PickupParagraph & { element: Element };

const INTERSECTION_OPTIONS: IntersectionObserverInit = {
  root: null,
  rootMargin: '600px',
  threshold: 0.1,
};

export function createPickupRunner() {
  let isApplying = false;
  let mutationTimer: number | undefined;
  let lastRequestId = 0;
  let observer: MutationObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  const pending = new Map<string, PendingParagraph>();
  const readyQueue = new Set<string>();

  function collectAndObserve(root: ParentNode = document) {
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
    if (isApplying) {
      return;
    }
    if (readyQueue.size === 0) {
      return;
    }

    const batchIds = Array.from(readyQueue);
    readyQueue.clear();

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
      applyAnnotations(annotations, elementMap);
    }
    catch (error) {
      window.clearTimeout(timeoutId);
      elementMap.forEach((element) => {
        (element as HTMLElement).dataset.pickupStatus = 'error';
      });
      console.warn('Pickup annotation failed:', error);
    }
    finally {
      batch.forEach(item => pending.delete(item.id));
      isApplying = false;
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
    if (mutationTimer) {
      window.clearTimeout(mutationTimer);
    }
    mutationTimer = window.setTimeout(() => {
      collectAndObserve();
    }, 400);
  }

  function start() {
    ensurePickupStyles();
    intersectionObserver = new IntersectionObserver(handleIntersections, INTERSECTION_OPTIONS);
    collectAndObserve();
    observer = new MutationObserver(() => {
      scheduleCollect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    pending.clear();
    readyQueue.clear();
  }

  return {
    start,
    stop,
  };
}
