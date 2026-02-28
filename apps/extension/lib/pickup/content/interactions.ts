import tippy, { type Instance, type Props } from 'tippy.js';

const TIPPY_THEME = 'xen-pickup';
const TOKEN_SELECTOR = '.xen-pickup-token';
const ROLE_BADGE_SELECTOR = '.xen-pickup-role-badge';
const PICKUP_UI_SELECTOR = '[data-pickup-ui]';
const PICKUP_TOKEN_VOCABULARY_CLASS = 'xen-pickup-token-vocabulary';
const PICKUP_TOKEN_ACTIVE_CLASS = 'xen-pickup-token-active';
const PICKUP_LANE_SYNTAX_CLASS = 'xen-pickup-lane-syntax-rebuild';
const PICKUP_ROLE_BADGE_STRUCTURE_CLASS = 'xen-pickup-role-badge-structure';
const PHONE_LINE_PATTERN = /\((US|UK)\)/;

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
    instance.popper.setAttribute('data-pickup-ui', 'true');
    instance.popper.setAttribute('data-pickup-ignore', 'true');
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
  root.setAttribute('data-pickup-ui', 'true');

  const linesRoot = document.createElement('div');
  linesRoot.className = 'xen-pickup-tooltip-lines';
  linesRoot.setAttribute('data-pickup-ui', 'true');

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
      lineEl.setAttribute('data-pickup-ui', 'true');
      if (PHONE_LINE_PATTERN.test(line)) {
        lineEl.classList.add('xen-pickup-tooltip-line-phone');
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
