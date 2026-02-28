const DEFAULT_IGNORE_ATTR = 'data-pickup-ignore';
const DEFAULT_ACCENT_VARIABLE = '--xen-pickup-accent';
const DEFAULT_SOFT_BG_VARIABLE = '--xen-pickup-soft-bg';

const CLASS_TOKEN = 'xen-pickup-token';
const CLASS_TOKEN_VOCABULARY = 'xen-pickup-token-vocabulary';
const CLASS_TOKEN_GRAMMAR = 'xen-pickup-token-grammar';
const CLASS_TOKEN_TRANSLATED = 'xen-pickup-token-translated';
const CLASS_TOKEN_ACTIVE = 'xen-pickup-token-active';
const CLASS_ANNOTATION_TOP = 'xen-pickup-annotation-top';
const CLASS_ANNOTATION_RIGHT = 'xen-pickup-annotation-right';
const CLASS_ANNOTATION_NONE = 'xen-pickup-annotation-none';
const CLASS_HIGHLIGHT_UNDERLINE = 'xen-pickup-highlight-underline';
const CLASS_HIGHLIGHT_MARKER = 'xen-pickup-highlight-marker';
const CLASS_HIGHLIGHT_TEXT_COLOR = 'xen-pickup-highlight-text-color';
const CLASS_THEME_DARK = 'xen-pickup-theme-dark';
const CLASS_THEME_LIGHT = 'xen-pickup-theme-light';

const ANNOTATION_STATE_CLASSES = [
  CLASS_ANNOTATION_TOP,
  CLASS_ANNOTATION_RIGHT,
  CLASS_ANNOTATION_NONE,
] as const;

const HIGHLIGHT_STATE_CLASSES = [
  CLASS_HIGHLIGHT_UNDERLINE,
  CLASS_HIGHLIGHT_MARKER,
  CLASS_HIGHLIGHT_TEXT_COLOR,
] as const;

const THEME_STATE_CLASSES = [
  CLASS_THEME_DARK,
  CLASS_THEME_LIGHT,
] as const;

const TOKEN_TAG = 'xen-pickup-token-wc';

const ROOT_ANNOTATION_STYLE_ATTR = 'data-xen-pickup-annotation-style';
const ROOT_HIGHLIGHT_STYLE_ATTR = 'data-xen-pickup-highlight-style';
const ROOT_THEME_ATTR = 'data-xen-pickup-theme';

const TOKEN_SHADOW_STYLE = `
  :host {
    display: inline;
    vertical-align: baseline;
    color: inherit;
    font: inherit;
    line-height: inherit;
    text-decoration: none;
    border-radius: 0;
    --xen-token-annotation-color: rgba(71, 85, 105, 0.88);
    --xen-token-marker-base: var(--xen-pickup-marker-color, #ffe100);
  }
  .xen-token-root {
    position: relative;
    display: inline;
    vertical-align: baseline;
    line-height: inherit;
  }
  .xen-token-origin {
    display: ruby;
    ruby-position: over;
    ruby-align: center;
    line-height: inherit;
    color: inherit;
  }
  .xen-token-origin-text {
    position: relative;
    z-index: 1;
    display: inline;
    line-height: inherit;
    color: inherit;
  }
  .xen-token-annotation-top,
  .xen-token-annotation-right {
    white-space: nowrap;
    font-size: 0.62em;
    line-height: 1.1;
    font-style: normal;
    letter-spacing: 0.01em;
    text-align: center;
    color: var(--xen-token-annotation-color);
    user-select: none;
    pointer-events: none;
  }
  .xen-token-annotation-top {
    text-align: center;
  }
  .xen-token-annotation-right {
    display: none;
    margin-left: 0.32em;
    font-size: 0.72em;
  }
  :host(.xen-pickup-token-translated) .xen-token-annotation-top::before,
  :host(.xen-pickup-token-translated) .xen-token-annotation-right::before {
    content: '\\FF08';
    opacity: 0.82;
  }
  :host(.xen-pickup-token-translated) .xen-token-annotation-top::after,
  :host(.xen-pickup-token-translated) .xen-token-annotation-right::after {
    content: '\\FF09';
    opacity: 0.82;
  }
  :host(:not(.xen-pickup-token-translated)) .xen-token-annotation-top,
  :host(:not(.xen-pickup-token-translated)) .xen-token-annotation-right {
    display: none;
  }
  :host(.xen-pickup-annotation-top) .xen-token-root {
    display: inline;
  }
  :host(.xen-pickup-annotation-top) .xen-token-origin {
    display: ruby;
  }
  :host(.xen-pickup-annotation-top) .xen-token-annotation-right {
    display: none;
  }
  :host(.xen-pickup-annotation-right) .xen-token-root {
    display: inline-flex;
    align-items: baseline;
  }
  :host(.xen-pickup-annotation-right) .xen-token-origin {
    display: inline;
  }
  :host(.xen-pickup-annotation-right) .xen-token-annotation-top {
    display: none;
  }
  :host(.xen-pickup-annotation-right) .xen-token-annotation-right {
    display: inline-flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.08em;
  }
  :host(.xen-pickup-annotation-none) .xen-token-annotation-top,
  :host(.xen-pickup-annotation-none) .xen-token-annotation-right {
    display: none;
  }
  :host(.xen-pickup-theme-dark) {
    --xen-token-annotation-color: rgba(226, 232, 240, 0.82);
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-underline) .xen-token-origin-text {
    position: relative;
    margin: 0 -0.28em;
    padding: 0.02em 0.28em 0.06em;
    border-radius: 0.8em 0.3em;
    background: transparent;
    background-image: linear-gradient(
      to right,
      color-mix(in srgb, var(--xen-token-marker-base) 10%, transparent),
      color-mix(in srgb, var(--xen-token-marker-base) 70%, transparent) 4%,
      color-mix(in srgb, var(--xen-token-marker-base) 30%, transparent)
    );
    background-repeat: no-repeat;
    background-size: 100% 46%;
    background-position: left 97%;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker) .xen-token-origin-text {
    position: relative;
    display: inline-block;
    isolation: isolate;
    z-index: 0;
    border-radius: 0.18em;
    background: color-mix(
      in srgb,
      var(--xen-token-marker-base) 38%,
      transparent
    );
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker) .xen-token-origin-text::before,
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker) .xen-token-origin-text::after {
    content: '';
    position: absolute;
    left: 0;
    width: 100%;
    height: 70%;
    z-index: -1;
    border-radius: 0.2em;
    background: color-mix(
      in srgb,
      var(--xen-token-marker-base) 55%,
      transparent
    );
    opacity: 0.5;
    pointer-events: none;
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker) .xen-token-origin-text::before {
    transform: rotate(10deg) translateY(-0.5em);
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker) .xen-token-origin-text::after {
    transform: rotate(8deg) translateY(1em);
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-text-color) .xen-token-origin-text {
    color: color-mix(in srgb, var(--xen-pickup-accent, #ff7008) 72%, currentColor);
    font-weight: 600;
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-text-color):hover .xen-token-origin-text {
    color: color-mix(in srgb, var(--xen-pickup-accent, #ff7008) 80%, currentColor);
  }
  :host(.xen-pickup-token-translated.xen-pickup-highlight-marker):hover .xen-token-origin-text {
    background: color-mix(in srgb, var(--xen-token-marker-base) 48%, transparent);
  }
  :host(.xen-pickup-token-active) .xen-token-origin-text {
    background-color: color-mix(in srgb, var(--xen-pickup-accent, #415ccc) 16%, transparent);
    border-radius: 0;
  }
`;

export type PickupTokenKind = 'vocabulary' | 'grammar' | 'other';

export type PickupTokenConfig = {
  text: string;
  title: string;
  kind?: PickupTokenKind;
  accentColor: string;
  softBgColor: string;
  ignoreAttrName?: string;
  accentVariableName?: string;
  softBgVariableName?: string;
};

type TokenView = {
  originTextElement: HTMLSpanElement;
  topTranslationElement: HTMLElement;
  rightTranslationElement: HTMLSpanElement;
};

const tokenViews = new WeakMap<HTMLElement, TokenView>();

function addIgnoreAttr(element: HTMLElement, ignoreAttrName = DEFAULT_IGNORE_ATTR) {
  element.setAttribute(ignoreAttrName, 'true');
}

type AnnotationStyle = 'top' | 'right' | 'none';
type HighlightStyle = 'underline' | 'marker' | 'text-color';
type ThemeStyle = 'dark' | 'light';

type RootState = {
  annotationStyle: AnnotationStyle;
  highlightStyle: HighlightStyle;
  theme: ThemeStyle;
};

function normalizeAnnotationStyle(value: string | null): AnnotationStyle {
  if (value === 'top' || value === 'right' || value === 'none') {
    return value;
  }
  return 'top';
}

function normalizeHighlightStyle(value: string | null): HighlightStyle {
  if (value === 'underline' || value === 'marker' || value === 'text-color') {
    return value;
  }
  return 'marker';
}

function normalizeTheme(value: string | null): ThemeStyle {
  if (value === 'dark' || value === 'light') {
    return value;
  }
  return 'light';
}

function readRootState(): RootState {
  const root = document.documentElement;
  return {
    annotationStyle: normalizeAnnotationStyle(root?.getAttribute(ROOT_ANNOTATION_STYLE_ATTR) ?? null),
    highlightStyle: normalizeHighlightStyle(root?.getAttribute(ROOT_HIGHLIGHT_STYLE_ATTR) ?? null),
    theme: normalizeTheme(root?.getAttribute(ROOT_THEME_ATTR) ?? null),
  };
}

function applyHostState(element: HTMLElement) {
  const state = readRootState();
  element.classList.remove(...ANNOTATION_STATE_CLASSES, ...HIGHLIGHT_STATE_CLASSES, ...THEME_STATE_CLASSES);
  element.classList.add(
    state.annotationStyle === 'top'
      ? CLASS_ANNOTATION_TOP
      : state.annotationStyle === 'right'
        ? CLASS_ANNOTATION_RIGHT
        : CLASS_ANNOTATION_NONE,
    state.highlightStyle === 'underline'
      ? CLASS_HIGHLIGHT_UNDERLINE
      : state.highlightStyle === 'marker'
        ? CLASS_HIGHLIGHT_MARKER
        : CLASS_HIGHLIGHT_TEXT_COLOR,
    state.theme === 'dark' ? CLASS_THEME_DARK : CLASS_THEME_LIGHT,
  );
}

function buildTokenView(shadowRoot: ShadowRoot): TokenView {
  const style = document.createElement('style');
  style.textContent = TOKEN_SHADOW_STYLE;

  const rootElement = document.createElement('span');
  rootElement.className = 'xen-token-root';

  const originElement = document.createElement('ruby');
  originElement.className = 'xen-token-origin';

  const originTextElement = document.createElement('span');
  originTextElement.className = 'xen-token-origin-text';

  const topTranslationElement = document.createElement('rt');
  topTranslationElement.className = 'xen-token-annotation-top';

  const rightTranslationElement = document.createElement('span');
  rightTranslationElement.className = 'xen-token-annotation-right';

  originElement.append(originTextElement, topTranslationElement);
  rootElement.append(originElement, rightTranslationElement);
  shadowRoot.replaceChildren(style, rootElement);

  return {
    originTextElement,
    topTranslationElement,
    rightTranslationElement,
  };
}

function ensureTokenView(element: HTMLElement): TokenView {
  const existing = tokenViews.get(element);
  if (existing) {
    return existing;
  }

  let shadowRoot = element.shadowRoot;
  if (!shadowRoot) {
    shadowRoot = element.attachShadow({ mode: 'open' });
  }

  const view = buildTokenView(shadowRoot);
  tokenViews.set(element, view);
  return view;
}

function configureBaseToken(element: HTMLElement, config: PickupTokenConfig) {
  const resolvedKind = config.kind ?? 'other';
  element.classList.add(CLASS_TOKEN);
  element.classList.remove(CLASS_TOKEN_VOCABULARY, CLASS_TOKEN_GRAMMAR);

  if (resolvedKind === 'vocabulary') {
    element.classList.add(CLASS_TOKEN_VOCABULARY);
  } else if (resolvedKind === 'grammar') {
    element.classList.add(CLASS_TOKEN_GRAMMAR);
  }

  element.style.setProperty(config.accentVariableName ?? DEFAULT_ACCENT_VARIABLE, config.accentColor);
  element.style.setProperty(config.softBgVariableName ?? DEFAULT_SOFT_BG_VARIABLE, config.softBgColor);
  addIgnoreAttr(element, config.ignoreAttrName);
  element.title = config.title;
  applyHostState(element);
}

function setPlainText(element: HTMLElement, text: string) {
  const view = ensureTokenView(element);
  element.classList.remove(CLASS_TOKEN_TRANSLATED);
  view.originTextElement.textContent = text;
  view.topTranslationElement.textContent = '';
  view.rightTranslationElement.textContent = '';
  applyHostState(element);
}

function setTranslatedText(element: HTMLElement, originalText: string, translatedText: string) {
  const cleanOriginal = originalText ?? '';
  const cleanTranslation = translatedText ?? '';

  if (!cleanOriginal || !cleanTranslation) {
    setPlainText(element, cleanOriginal || cleanTranslation);
    return;
  }

  const view = ensureTokenView(element);
  element.classList.add(CLASS_TOKEN_TRANSLATED);
  view.originTextElement.textContent = cleanOriginal;
  view.topTranslationElement.textContent = cleanTranslation;
  view.rightTranslationElement.textContent = cleanTranslation;
  applyHostState(element);
}

class PickupTokenElement extends HTMLElement {
  connectedCallback() {
    ensureTokenView(this);
    applyHostState(this);
  }
}

function defineTokenElement() {
  const registry = globalThis.customElements;
  if (!registry || typeof registry.get !== 'function' || typeof registry.define !== 'function') {
    return;
  }
  if (!registry.get(TOKEN_TAG)) {
    registry.define(TOKEN_TAG, PickupTokenElement);
  }
}

export function ensurePickupWebComponents() {
  defineTokenElement();
}

export function syncPickupTokenHostStates(scope: ParentNode = document) {
  scope.querySelectorAll<HTMLElement>(TOKEN_TAG).forEach((element) => {
    ensureTokenView(element);
    applyHostState(element);
  });
}

export function createPickupTokenElement(config: PickupTokenConfig) {
  ensurePickupWebComponents();
  const tokenElement = document.createElement(TOKEN_TAG);
  configureBaseToken(tokenElement, config);
  setPlainText(tokenElement, config.text);
  return tokenElement;
}

export function applyPickupTokenRuby(element: HTMLElement, originalText: string, translatedText: string) {
  setTranslatedText(element, originalText, translatedText);
  return true;
}
