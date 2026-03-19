// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import type {
  ParagraphTranslationOverride,
  UnitTranslationOverride,
} from '../../lib/pickup/content/render-translation';
import { ensurePickupStyles } from '../../lib/pickup/content/styles';
import { requestAnnotations } from '../../lib/pickup/content/transport';

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
const ensurePickupStylesMock = vi.mocked(ensurePickupStyles);
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

describe('段落首屏渲染调度', () => {
  it('renders annotations before paragraph translation patch completes', async () => {
    const events: string[] = [];
    const { element, paragraph } = setupParagraph();
    const paragraphTranslation = createDeferred<Map<string, ParagraphTranslationOverride>>();

    collectParagraphsMock.mockReturnValue({
      paragraphs: [paragraph],
      elementMap: new Map([[paragraph.id, element]]),
    });
    requestAnnotationsMock.mockResolvedValue([{ id: paragraph.id, tokens: [] }]);
    requestAnnotationTranslationPreviewMock.mockImplementation(async (_annotations, _elementMap, options) => {
      events.push('annotation-render');
      expect(options).toEqual({
        includeParagraphTranslation: false,
        includeUnitTranslation: true,
      });
      return new Map([[paragraph.id, { units: new Map() }]]);
    });
    applyAnnotationsMock.mockImplementation(async (_annotations, elementMap) => {
      const annotatedElement = elementMap.get(paragraph.id) as HTMLElement;
      annotatedElement.dataset.pickupAnnotated = 'true';
      annotatedElement.dataset.pickupProcessed = 'true';
      annotatedElement.dataset.pickupStatus = 'done';
      annotatedElement.dataset.pickupId = paragraph.id;
      annotatedElement.dataset.pickupOriginal = paragraph.text;
      events.push('annotation-applied');
    });
    requestParagraphTranslationPreviewMock.mockImplementation(async () => {
      events.push('paragraph-patch-requested');
      return paragraphTranslation.promise;
    });
    applyParagraphTranslationOverridesMock.mockImplementation(() => {
      events.push('paragraph-patched');
    });

    const runner = createPickupRunner({ translationPreviewEnabled: true });
    runner.start();

    expect(ensurePickupStylesMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(300);
    const observer = FakeIntersectionObserver.instances[0]!;
    expect(observer).toBeTruthy();

    observer.trigger([{ target: element, isIntersecting: true }]);
    await flushPromises();

    expect(applyAnnotationsMock).toHaveBeenCalledTimes(1);
    expect(requestParagraphTranslationPreviewMock).toHaveBeenCalledTimes(1);
    expect(applyParagraphTranslationOverridesMock).not.toHaveBeenCalled();
    expect(events).toEqual([
      'annotation-render',
      'annotation-applied',
      'paragraph-patch-requested',
    ]);

    paragraphTranslation.resolve(
      new Map([
        [
          'paragraph-1',
          {
            paragraphText: '敏捷的狐狸跳了起来。',
            units: new Map<string, UnitTranslationOverride>(),
          },
        ],
      ]),
    );
    await flushPromises();

    expect(applyParagraphTranslationOverridesMock).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'annotation-render',
      'annotation-applied',
      'paragraph-patch-requested',
      'paragraph-patched',
    ]);

    runner.stop();
  });

  it('keeps token rendering flow unchanged when paragraph translation is disabled', async () => {
    const { element, paragraph } = setupParagraph();

    collectParagraphsMock.mockReturnValue({
      paragraphs: [paragraph],
      elementMap: new Map([[paragraph.id, element]]),
    });
    requestAnnotationsMock.mockResolvedValue([{ id: paragraph.id, tokens: [] }]);
    requestAnnotationTranslationPreviewMock.mockResolvedValue(
      new Map([[paragraph.id, { units: new Map([['unit-1', { vocabInfusionText: '狐狸', syntaxRebuildText: 'fox' }]]) }]]),
    );
    applyAnnotationsMock.mockResolvedValue(undefined);

    const runner = createPickupRunner({ translationPreviewEnabled: false });
    runner.start();

    vi.advanceTimersByTime(300);
    const observer = FakeIntersectionObserver.instances[0]!;
    expect(observer).toBeTruthy();

    observer.trigger([{ target: element, isIntersecting: true }]);
    await flushPromises();

    expect(requestAnnotationTranslationPreviewMock).toHaveBeenCalledWith(
      [{ id: paragraph.id, tokens: [] }],
      expect.any(Map),
      {
        includeParagraphTranslation: false,
        includeUnitTranslation: true,
      },
    );
    expect(applyAnnotationsMock).toHaveBeenCalledTimes(1);
    expect(requestParagraphTranslationPreviewMock).not.toHaveBeenCalled();
    expect(applyParagraphTranslationOverridesMock).not.toHaveBeenCalled();

    runner.stop();
  });

  it('requests paragraph translation when preview is enabled after annotations are already rendered', async () => {
    const { element, paragraph } = setupParagraph();

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
    requestParagraphTranslationPreviewMock.mockResolvedValue(
      new Map([[paragraph.id, { paragraphText: '敏捷的狐狸跳了起来。', units: new Map() }]]),
    );

    const runner = createPickupRunner({ translationPreviewEnabled: false });
    runner.start();

    vi.advanceTimersByTime(300);
    const observer = FakeIntersectionObserver.instances[0]!;
    observer.trigger([{ target: element, isIntersecting: true }]);
    await flushPromises();

    expect(applyAnnotationsMock).toHaveBeenCalledTimes(1);
    expect(requestParagraphTranslationPreviewMock).not.toHaveBeenCalled();

    expect(runner.setTranslationPreviewEnabled(true)).toBe(true);
    await flushPromises();

    expect(requestParagraphTranslationPreviewMock).toHaveBeenCalledTimes(1);
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
    expect(applyParagraphTranslationOverridesMock).toHaveBeenCalledTimes(1);

    runner.stop();
  });

  it('shows loading state while paragraph translation patch is in flight and restores done afterwards', async () => {
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

    const runner = createPickupRunner({ translationPreviewEnabled: true });
    runner.start();

    vi.advanceTimersByTime(300);
    const observer = FakeIntersectionObserver.instances[0]!;
    observer.trigger([{ target: element, isIntersecting: true }]);
    await flushPromises();

    expect(element.dataset.pickupStatus).toBe('loading');

    paragraphTranslation.resolve(
      new Map([[paragraph.id, { paragraphText: '敏捷的狐狸跳了起来。', units: new Map() }]]),
    );
    await flushPromises();

    expect(applyParagraphTranslationOverridesMock).toHaveBeenCalledTimes(1);
    expect(element.dataset.pickupStatus).toBe('done');

    runner.stop();
  });
});
