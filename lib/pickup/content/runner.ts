import { REQUEST_TIMEOUT_MS } from './constants';
import { collectParagraphs } from './collector';
import { applyAnnotations } from './render';
import { ensurePickupStyles } from './styles';
import { requestAnnotations } from './transport';

export function createPickupRunner() {
  let isApplying = false;
  let mutationTimer: number | undefined;
  let lastRequestId = 0;
  let observer: MutationObserver | null = null;

  async function annotatePage() {
    if (isApplying) {
      return;
    }
    const { paragraphs, elementMap } = collectParagraphs();
    if (paragraphs.length === 0) {
      return;
    }
    isApplying = true;
    const requestId = ++lastRequestId;
    const timeoutId = window.setTimeout(() => {
      if (lastRequestId === requestId) {
        elementMap.forEach((element) => {
          (element as HTMLElement).dataset.pickupStatus = 'error';
        });
        isApplying = false;
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
      isApplying = false;
    }
  }

  function scheduleAnnotate() {
    if (mutationTimer) {
      window.clearTimeout(mutationTimer);
    }
    mutationTimer = window.setTimeout(() => {
      annotatePage();
    }, 400);
  }

  function start() {
    ensurePickupStyles();
    annotatePage();
    observer = new MutationObserver(() => {
      if (!isApplying) {
        scheduleAnnotate();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stop() {
    observer?.disconnect();
    observer = null;
  }

  return {
    start,
    stop,
  };
}
