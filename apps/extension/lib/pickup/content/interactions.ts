import tippy, { type Instance, type Props } from 'tippy.js';
import {
  PICKUP_IGNORE_ATTR,
  PICKUP_LANE_SYNTAX_CLASS,
  PICKUP_ROLE_BADGE_CLASS,
  PICKUP_ROLE_BADGE_STRUCTURE_CLASS,
  PICKUP_TOKEN_ACTIVE_CLASS,
  PICKUP_TOKEN_CLASS,
  PICKUP_TOKEN_ORIGINAL_TEXT_ATTR,
  PICKUP_TOKEN_VOCABULARY_CLASS,
  PICKUP_UI_ATTR,
  PICKUP_UI_SELECTOR,
} from './markers';

const TIPPY_THEME = 'xen-pickup';
const TOKEN_SELECTOR = `.${PICKUP_TOKEN_CLASS}`;
const ROLE_BADGE_SELECTOR = `.${PICKUP_ROLE_BADGE_CLASS}`;
const PHONE_LINE_PATTERN = /\((US|UK)\)/;
const PHONE_CHIP_PATTERN = /(美式|英式)\((US|UK)\)\s*(.+?)(?=\s+(?:美式|英式)\((?:US|UK)\)|$)/g;
const SPEAK_LANG_BY_REGION = {
  US: 'en-US',
  UK: 'en-GB',
} as const;
type PhoneRegion = keyof typeof SPEAK_LANG_BY_REGION;

type InteractionMeta = {
  meaning: string;
  groupId?: string;
  isStructureBadge?: boolean;
};

export type PickupInteractionTarget = {
  element: HTMLElement;
  meaning?: string;
  groupId?: string;
  isStructureBadge?: boolean;
};

let hoverHandlersReady = false;
let activeGroupId: string | null = null;
let activeGroupElements: HTMLElement[] = [];
let lockedGroupId: string | null = null;
let activeTooltipInstance: Instance | null = null;

const metaByElement = new WeakMap<HTMLElement, InteractionMeta>();
const tokenGroupIndex = new Map<string, Set<HTMLElement>>();

const BASE_TIPPY_PROPS: Partial<Props> = {
  theme: TIPPY_THEME,
  arrow: false,
  placement: 'top',
  maxWidth: 320,
  offset: [0, 8],
  delay: [120, 0],
  duration: [120, 80],
  interactive: true,
  hideOnClick: false,
  appendTo: () => document.body,
  zIndex: 2147483000,
  popperOptions: {
    modifiers: [
      { name: 'shift', options: { padding: 8 } },
      { name: 'flip', options: { padding: 8, fallbackPlacements: ['bottom', 'right', 'left'] } },
      { name: 'preventOverflow', options: { padding: 8, altAxis: true } },
    ],
  },
  onCreate(instance) {
    instance.popper.setAttribute(PICKUP_UI_ATTR, 'true');
    instance.popper.setAttribute(PICKUP_IGNORE_ATTR, 'true');
  },
};

function isTokenElement(element: HTMLElement) {
  return element.matches(TOKEN_SELECTOR);
}

function normalizeTooltipText(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n');
  const lines = normalized
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.join('\n');
}

function normalizeSpeakWord(rawWord: string) {
  const trimmed = rawWord.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
}

function resolveSpeechVoice(lang: string, voices: SpeechSynthesisVoice[]) {
  if (voices.length === 0) {
    return null;
  }
  const exact = voices.find(voice => voice.lang === lang);
  if (exact) {
    return exact;
  }
  const prefix = lang.slice(0, 2).toLowerCase();
  return voices.find(voice => voice.lang.toLowerCase().startsWith(prefix)) ?? null;
}

function speakTokenByRegion(reference: HTMLElement, region: PhoneRegion) {
  const synthesizer = window.speechSynthesis;
  if (!synthesizer) {
    return;
  }
  const originalText = reference.getAttribute(PICKUP_TOKEN_ORIGINAL_TEXT_ATTR)
    ?? reference.dataset.pickupTokenOriginal
    ?? reference.textContent
    ?? '';
  const speakWord = normalizeSpeakWord(originalText);
  if (!speakWord) {
    return;
  }
  const utterance = new SpeechSynthesisUtterance(speakWord);
  utterance.lang = SPEAK_LANG_BY_REGION[region];
  utterance.rate = 0.95;
  const voice = resolveSpeechVoice(utterance.lang, synthesizer.getVoices());
  if (voice) {
    utterance.voice = voice;
  }
  synthesizer.cancel();
  synthesizer.speak(utterance);
}

function parsePhoneChips(line: string) {
  const chips: Array<{ region: PhoneRegion; value: string }> = [];
  PHONE_CHIP_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = PHONE_CHIP_PATTERN.exec(line);
  while (match) {
    const region = match[2] as PhoneRegion;
    const value = match[3]?.trim() ?? '';
    if ((region === 'US' || region === 'UK') && value) {
      chips.push({ region, value });
    }
    match = PHONE_CHIP_PATTERN.exec(line);
  }
  return chips;
}

function removeFromGroupIndex(groupId: string, element: HTMLElement) {
  const set = tokenGroupIndex.get(groupId);
  if (!set) {
    return;
  }
  set.delete(element);
  if (set.size === 0) {
    tokenGroupIndex.delete(groupId);
  }
}

function registerInteractionTarget(target: PickupInteractionTarget) {
  const element = target.element;
  const previous = metaByElement.get(element);
  const meaning = normalizeTooltipText(target.meaning ?? '');

  if (previous?.groupId) {
    removeFromGroupIndex(previous.groupId, element);
  }

  const nextMeta: InteractionMeta = {
    meaning,
    groupId: target.groupId,
    isStructureBadge: target.isStructureBadge,
  };
  metaByElement.set(element, nextMeta);

  if (target.groupId && isTokenElement(element)) {
    let groupElements = tokenGroupIndex.get(target.groupId);
    if (!groupElements) {
      groupElements = new Set<HTMLElement>();
      tokenGroupIndex.set(target.groupId, groupElements);
    }
    groupElements.add(element);
  }
}

function findTokenElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (isTokenElement(target)) {
    return target;
  }
  return target.closest<HTMLElement>(TOKEN_SELECTOR);
}

function findRoleBadge(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.matches(ROLE_BADGE_SELECTOR)) {
    return target;
  }
  return target.closest<HTMLElement>(ROLE_BADGE_SELECTOR);
}

function isStructureBadge(badge: HTMLElement) {
  if (badge.classList.contains(PICKUP_ROLE_BADGE_STRUCTURE_CLASS)) {
    return true;
  }
  return Boolean(metaByElement.get(badge)?.isStructureBadge);
}

function isInsidePickupUi(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(PICKUP_UI_SELECTOR));
}

function isVocabToken(element: HTMLElement) {
  return isTokenElement(element) && element.classList.contains(PICKUP_TOKEN_VOCABULARY_CLASS);
}

function isSyntaxLane(element: HTMLElement) {
  return Boolean(element.closest(`.${PICKUP_LANE_SYNTAX_CLASS}`));
}

function shouldShowTooltip(element: HTMLElement) {
  if (isSyntaxLane(element) && isVocabToken(element)) {
    return false;
  }
  return true;
}

function resolveMeaningDescription(reference: HTMLElement) {
  return metaByElement.get(reference)?.meaning ?? '';
}

function createTooltipContent(reference: HTMLElement) {
  const root = document.createElement('div');
  root.className = 'xen-pickup-tooltip';
  root.setAttribute(PICKUP_UI_ATTR, 'true');

  const linesRoot = document.createElement('div');
  linesRoot.className = 'xen-pickup-tooltip-lines';
  linesRoot.setAttribute(PICKUP_UI_ATTR, 'true');

  root.append(linesRoot);

  const update = () => {
    linesRoot.textContent = '';
    const content = resolveMeaningDescription(reference);
    if (!content) {
      return false;
    }
    const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'xen-pickup-tooltip-line';
      lineEl.setAttribute(PICKUP_UI_ATTR, 'true');
      if (PHONE_LINE_PATTERN.test(line)) {
        lineEl.classList.add('xen-pickup-tooltip-line-phone');
        const chips = parsePhoneChips(line);
        if (chips.length > 0) {
          chips.forEach(({ region, value }) => {
            const chipButton = document.createElement('button');
            chipButton.type = 'button';
            chipButton.className = 'xen-pickup-tooltip-phone-chip';
            chipButton.setAttribute(PICKUP_UI_ATTR, 'true');
            chipButton.setAttribute('aria-label', `朗读${region}音标`);

            const regionEl = document.createElement('span');
            regionEl.className = 'xen-pickup-tooltip-phone-region';
            regionEl.setAttribute(PICKUP_UI_ATTR, 'true');
            regionEl.textContent = region;

            const valueEl = document.createElement('span');
            valueEl.className = 'xen-pickup-tooltip-phone-value';
            valueEl.setAttribute(PICKUP_UI_ATTR, 'true');
            valueEl.textContent = value;

            chipButton.append(regionEl, valueEl);
            chipButton.addEventListener('pointerdown', (event) => {
              event.stopPropagation();
            });
            chipButton.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              speakTokenByRegion(reference, region);
            });
            lineEl.append(chipButton);
          });
          linesRoot.append(lineEl);
          return;
        }
      } else {
        lineEl.classList.add('xen-pickup-tooltip-line-desc');
      }
      lineEl.textContent = line;
      linesRoot.append(lineEl);
    });
    return lines.length > 0;
  };

  root.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  update();
  return { root, update };
}

function hasTooltipData(element: HTMLElement) {
  return Boolean(resolveMeaningDescription(element));
}

function collectGroupElements(groupId: string) {
  const set = tokenGroupIndex.get(groupId);
  if (!set) {
    return [];
  }
  const aliveTokens: HTMLElement[] = [];
  set.forEach((element) => {
    if (!element.isConnected) {
      set.delete(element);
      return;
    }
    aliveTokens.push(element);
  });
  if (set.size === 0) {
    tokenGroupIndex.delete(groupId);
  }
  return aliveTokens;
}

function clearActiveGroup() {
  if (!activeGroupId) {
    return;
  }
  activeGroupElements.forEach((element) => {
    element.classList.remove(PICKUP_TOKEN_ACTIVE_CLASS);
  });
  activeGroupId = null;
  activeGroupElements = [];
}

function setActiveGroup(groupId: string) {
  if (activeGroupId === groupId && activeGroupElements.length > 0) {
    return;
  }
  clearActiveGroup();
  activeGroupId = groupId;
  activeGroupElements = collectGroupElements(groupId);
  activeGroupElements.forEach((element) => {
    element.classList.add(PICKUP_TOKEN_ACTIVE_CLASS);
  });
}

function unlockActiveGroup() {
  lockedGroupId = null;
  clearActiveGroup();
}

function toggleGroupLock(groupId: string) {
  if (lockedGroupId === groupId) {
    unlockActiveGroup();
    return;
  }
  lockedGroupId = groupId;
  setActiveGroup(groupId);
}

function resolveGroupIdFromTokenOrBadge(token: HTMLElement, badge?: HTMLElement | null) {
  const tokenGroupId = metaByElement.get(token)?.groupId;
  if (tokenGroupId) {
    return tokenGroupId;
  }
  return badge ? metaByElement.get(badge)?.groupId : undefined;
}

function handlePointerOver(event: PointerEvent) {
  if (lockedGroupId) {
    return;
  }
  const badge = findRoleBadge(event.target);
  if (!badge || !isStructureBadge(badge)) {
    return;
  }
  const token = findTokenElement(badge);
  if (!token) {
    return;
  }
  const groupId = resolveGroupIdFromTokenOrBadge(token, badge);
  if (!groupId) {
    return;
  }
  setActiveGroup(groupId);
}

function handlePointerOut(event: PointerEvent) {
  if (lockedGroupId || !activeGroupId) {
    return;
  }
  const token = findTokenElement(event.target);
  if (!token) {
    return;
  }
  const groupId = metaByElement.get(token)?.groupId;
  if (!groupId || groupId !== activeGroupId) {
    return;
  }

  const relatedToken = findTokenElement(event.relatedTarget);
  if (relatedToken && metaByElement.get(relatedToken)?.groupId === groupId) {
    return;
  }

  clearActiveGroup();
}

function handlePointerDown(event: PointerEvent) {
  if (isInsidePickupUi(event.target)) {
    return;
  }

  const badge = findRoleBadge(event.target);
  if (!badge || !isStructureBadge(badge)) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }

  const token = findTokenElement(badge);
  if (!token) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }

  const groupId = resolveGroupIdFromTokenOrBadge(token, badge);
  if (!groupId) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }

  toggleGroupLock(groupId);
}

function ensureHoverHandlers() {
  if (hoverHandlersReady) {
    return;
  }
  hoverHandlersReady = true;
  document.addEventListener('pointerover', handlePointerOver, { passive: true });
  document.addEventListener('pointerout', handlePointerOut, { passive: true });
  document.addEventListener('pointerdown', handlePointerDown, { passive: true });
}

function createTooltip(element: HTMLElement) {
  if (!hasTooltipData(element)) {
    return;
  }
  const existing = (element as HTMLElement & { _tippy?: unknown })._tippy;
  if (existing) {
    return;
  }
  const tooltipContent = createTooltipContent(element);
  tippy(element, {
    ...BASE_TIPPY_PROPS,
    content: tooltipContent.root,
    onShow(instance) {
      if (!shouldShowTooltip(element)) {
        return false;
      }
      if (!tooltipContent.update()) {
        return false;
      }
      if (activeTooltipInstance && activeTooltipInstance !== instance) {
        activeTooltipInstance.hide();
      }
      activeTooltipInstance = instance;
      return undefined;
    },
    onHidden(instance) {
      if (activeTooltipInstance === instance) {
        activeTooltipInstance = null;
      }
    },
    onDestroy(instance) {
      if (activeTooltipInstance === instance) {
        activeTooltipInstance = null;
      }
    },
  });
}

export function attachPickupInteractions(targets: PickupInteractionTarget[]) {
  if (targets.length === 0) {
    return;
  }
  ensureHoverHandlers();
  targets.forEach((target) => {
    registerInteractionTarget(target);
    createTooltip(target.element);
  });
}
