// @vitest-environment jsdom

import { afterEach, beforeEach, expect, vi } from 'vitest';

vi.mock('../../lib/pickup/content/collector', () => ({
  collectParagraphs: vi.fn(),
}));

vi.mock('../../lib/pickup/content/render', () => ({
  applyAnnotations: vi.fn(),
  applyParagraphTranslationOverrides: vi.fn(),
  requestAnnotationTranslationPreview: vi.fn(),
  requestParagraphTranslationPreview: vi.fn(),
}));

vi.mock('../../lib/pickup/content/styles', () => ({
  ensurePickupStyles: vi.fn(),
}));

vi.mock('../../lib/pickup/content/transport', () => ({
  requestAnnotations: vi.fn(),
}));

import { collectParagraphs } from '../../lib/pickup/content/collector';
import {
  applyAnnotations,
  applyParagraphTranslationOverrides,
  requestAnnotationTranslationPreview,
  requestParagraphTranslationPreview,
} from '../../lib/pickup/content/render';
import { createPickupRunner } from '../../lib/pickup/content/runner';
import type { ParagraphTranslationOverride } from '../../lib/pickup/content/render-translation';
import { requestAnnotations } from '../../lib/pickup/content/transport';
import { defineFeatureAcceptance } from './bdd-harness';

type MinimalIntersectionObserverEntry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'target'>;

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];

  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(_target: Element) {}

  unobserve(_target: Element) {}

  disconnect() {}

  trigger(entries: MinimalIntersectionObserverEntry[]) {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

class FakeMutationObserver {
  constructor(_callback: MutationCallback) {}

  observe(_target: Node, _options?: MutationObserverInit) {}

  disconnect() {}
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushPromises(rounds = 6) {
  for (let index = 0; index < rounds; index += 1) {
    await Promise.resolve();
  }
}

function setDocumentReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value,
  });
}

function setupParagraph(id = 'paragraph-1', text = 'The quick fox jumps.') {
  const element = document.createElement('p');
  element.textContent = text;
  element.dataset.pickupId = id;
  element.dataset.pickupOriginal = text;
  element.dataset.pickupStatus = 'pending';
  document.body.append(element);
  return {
    element,
    paragraph: {
      id,
      text,
      hash: `${id}-hash`,
    },
  };
}

const collectParagraphsMock = vi.mocked(collectParagraphs);
const applyAnnotationsMock = vi.mocked(applyAnnotations);
const applyParagraphTranslationOverridesMock = vi.mocked(applyParagraphTranslationOverrides);
const requestAnnotationTranslationPreviewMock = vi.mocked(requestAnnotationTranslationPreview);
const requestParagraphTranslationPreviewMock = vi.mocked(requestParagraphTranslationPreview);
const requestAnnotationsMock = vi.mocked(requestAnnotations);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
  vi.stubGlobal('MutationObserver', FakeMutationObserver);
  FakeIntersectionObserver.instances = [];
  setDocumentReadyState('complete');
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

defineFeatureAcceptance({
  featurePath: './features/translation-toggle-regression.feature',
  metaUrl: import.meta.url,
  handlers: {
    'Enabling translation preview after annotation render': async (scenario) => {
      expect(scenario.steps.map((step) => `${step.keyword} ${step.text}`)).toEqual([
        'Given an annotated paragraph exists without a paragraph translation',
        'When the user enables translation preview',
        'Then the paragraph enters loading state',
        'And a paragraph translation request is sent for that paragraph',
        'And the paragraph returns to done after the translation patch completes',
      ]);

      const { element, paragraph } = setupParagraph();
      const paragraphTranslation = createDeferred<Map<string, ParagraphTranslationOverride>>();

      collectParagraphsMock.mockReturnValue({
        paragraphs: [paragraph],
        elementMap: new Map([[paragraph.id, element]]),
      });
      requestAnnotationsMock.mockResolvedValue([{ id: paragraph.id, tokens: [] }]);
      requestAnnotationTranslationPreviewMock.mockResolvedValue(
        new Map([[paragraph.id, { units: new Map() }]]),
      );
      applyAnnotationsMock.mockImplementation(async (_annotations, elementMap) => {
        const annotatedElement = elementMap.get(paragraph.id) as HTMLElement;
        annotatedElement.dataset.pickupAnnotated = 'true';
        annotatedElement.dataset.pickupProcessed = 'true';
        annotatedElement.dataset.pickupStatus = 'done';
        annotatedElement.dataset.pickupId = paragraph.id;
        annotatedElement.dataset.pickupOriginal = paragraph.text;
      });
      requestParagraphTranslationPreviewMock.mockImplementation(async () => paragraphTranslation.promise);

      const runner = createPickupRunner({ translationPreviewEnabled: false });
      runner.start();

      vi.advanceTimersByTime(300);
      const observer = FakeIntersectionObserver.instances[0]!;
      observer.trigger([{ target: element, isIntersecting: true }]);
      await flushPromises();

      expect(element.dataset.pickupStatus).toBe('done');

      expect(runner.setTranslationPreviewEnabled(true)).toBe(true);
      await flushPromises();

      expect(element.dataset.pickupStatus).toBe('loading');
      expect(requestParagraphTranslationPreviewMock).toHaveBeenCalledWith(
        [
          {
            id: paragraph.id,
            sourceText: paragraph.text,
            units: [],
          },
        ],
        {
          includeParagraphTranslation: true,
          includeUnitTranslation: false,
        },
      );

      paragraphTranslation.resolve(
        new Map([[paragraph.id, { paragraphText: '敏捷的狐狸跳了起来。', units: new Map() }]]),
      );
      await flushPromises();

      expect(applyParagraphTranslationOverridesMock).toHaveBeenCalledTimes(1);
      expect(element.dataset.pickupStatus).toBe('done');

      runner.stop();
    },
  },
});
