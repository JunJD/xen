import tippy, { followCursor, type Props } from 'tippy.js';

const TIPPY_THEME = 'xen-pickup';
const TOKEN_SELECTOR = '.xen-pickup-token';
const ROLE_BADGE_SELECTOR = '.xen-pickup-role-badge';
const PICKUP_UI_SELECTOR = '[data-pickup-ui]';
const BADGE_KIND_STRUCTURE = 'structure';
const PICKUP_CATEGORY_VOCAB = 'vocabulary';
const PICKUP_LANE_ATTR = 'data-pickup-lane';
const PICKUP_LANE_SYNTAX = 'syntax_rebuild';

const TOOLTIP_FALLBACK_DESC = '暂无解释';
const MOCK_MEANING_PREFIX_PATTERN = /^(语法|词汇)释义（mock）：?/;

let hoverHandlersReady = false;
let activeGroupId: string | null = null;
let activeGroupElements: HTMLElement[] = [];
let lockedGroupId: string | null = null;

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
  followCursor: true,
  plugins: [followCursor],
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

function findTokenElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.classList.contains('xen-pickup-token')) {
    return target;
  }
  return target.closest<HTMLElement>(TOKEN_SELECTOR);
}

function findRoleBadge(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.classList.contains('xen-pickup-role-badge')) {
    return target;
  }
  return target.closest<HTMLElement>(ROLE_BADGE_SELECTOR);
}

function isStructureBadge(badge: HTMLElement) {
  return badge.dataset.pickupBadge === BADGE_KIND_STRUCTURE;
}

function isInsidePickupUi(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(PICKUP_UI_SELECTOR));
}

function isVocabToken(element: HTMLElement) {
  return element.classList.contains('xen-pickup-token')
    && element.dataset.pickupCategory === PICKUP_CATEGORY_VOCAB;
}

function isSyntaxLane(element: HTMLElement) {
  const lane = element.closest<HTMLElement>(`[${PICKUP_LANE_ATTR}]`)?.dataset.pickupLane;
  return lane === PICKUP_LANE_SYNTAX;
}

function shouldShowTooltip(element: HTMLElement) {
  if (isSyntaxLane(element) && isVocabToken(element)) {
    return false;
  }
  return true;
}

function normalizeTooltipText(value: string) {
  const normalized = value.replace(/\r\n?/g, '\n');
  const lines = normalized
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return lines.join('\n');
}

function clampTooltipText(value: string) {
  const normalized = normalizeTooltipText(value);
  if (!normalized) {
    return TOOLTIP_FALLBACK_DESC;
  }
  return normalized;
}

function resolveMeaningDescription(reference: HTMLElement) {
  const raw = String(reference.dataset.pickupMeaning ?? '');
  const meaning = normalizeTooltipText(raw.replace(MOCK_MEANING_PREFIX_PATTERN, ''));
  if (!meaning) {
    return TOOLTIP_FALLBACK_DESC;
  }
  return meaning;
}

function createTooltipContent(reference: HTMLElement) {
  const root = document.createElement('div');
  root.className = 'xen-pickup-tooltip';
  root.setAttribute('data-pickup-ui', 'true');

  const descriptionLine = document.createElement('div');
  descriptionLine.className = 'xen-pickup-tooltip-line xen-pickup-tooltip-line-desc';
  descriptionLine.setAttribute('data-pickup-ui', 'true');

  root.append(descriptionLine);

  const update = () => {
    descriptionLine.textContent = clampTooltipText(resolveMeaningDescription(reference));
  };

  root.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
  });

  update();
  return { root, update };
}

function hasTooltipData(element: HTMLElement) {
  return Boolean(
    normalizeTooltipText(element.dataset.pickupRole ?? '')
    || normalizeTooltipText(element.dataset.pickupMeaning ?? ''),
  );
}

function collectGroupElements(origin: HTMLElement, groupId: string) {
  const container = origin.closest<HTMLElement>('[data-pickup-id]');
  if (container) {
    return Array.from(
      container.querySelectorAll<HTMLElement>(`.xen-pickup-token[data-pickup-group="${groupId}"]`),
    );
  }
  return Array.from(document.querySelectorAll<HTMLElement>(`.xen-pickup-token[data-pickup-group="${groupId}"]`));
}

function clearActiveGroup() {
  if (!activeGroupId) {
    return;
  }
  activeGroupElements.forEach((element) => {
    element.dataset.pickupActive = 'false';
    delete element.dataset.pickupActive;
  });
  activeGroupId = null;
  activeGroupElements = [];
}

function setActiveGroup(groupId: string, origin: HTMLElement) {
  if (activeGroupId === groupId && activeGroupElements.length > 0) {
    return;
  }
  clearActiveGroup();
  activeGroupId = groupId;
  activeGroupElements = collectGroupElements(origin, groupId);
  activeGroupElements.forEach((element) => {
    element.dataset.pickupActive = 'true';
  });
}

function unlockActiveGroup() {
  lockedGroupId = null;
  clearActiveGroup();
}

function toggleGroupLock(groupId: string, origin: HTMLElement) {
  if (lockedGroupId === groupId) {
    unlockActiveGroup();
    return;
  }
  lockedGroupId = groupId;
  setActiveGroup(groupId, origin);
}

function handlePointerOver(event: PointerEvent) {
  if (lockedGroupId) {
    return;
  }
  const badge = findRoleBadge(event.target);
  if (!badge) {
    return;
  }
  if (!isStructureBadge(badge)) {
    return;
  }
  const token = findTokenElement(badge);
  if (!token) {
    return;
  }
  const groupId = token.dataset.pickupGroup;
  if (!groupId) {
    return;
  }
  setActiveGroup(groupId, token);
}

function handlePointerOut(event: PointerEvent) {
  if (lockedGroupId) {
    return;
  }
  if (!activeGroupId) {
    return;
  }
  const token = findTokenElement(event.target);
  if (!token) {
    return;
  }
  const groupId = token.dataset.pickupGroup;
  if (!groupId || groupId !== activeGroupId) {
    return;
  }

  const related = event.relatedTarget as HTMLElement | null;
  if (related) {
    const relatedToken = related.closest<HTMLElement>(
      `.xen-pickup-token[data-pickup-group="${groupId}"]`,
    );
    if (relatedToken) {
      return;
    }
  }

  clearActiveGroup();
}

function handlePointerDown(event: PointerEvent) {
  if (isInsidePickupUi(event.target)) {
    return;
  }

  const badge = findRoleBadge(event.target);
  if (!badge) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }
  if (!isStructureBadge(badge)) {
    return;
  }
  const token = findTokenElement(badge);
  if (!token) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }

  const groupId = token.dataset.pickupGroup;
  if (!groupId) {
    if (lockedGroupId) {
      unlockActiveGroup();
    }
    return;
  }

  toggleGroupLock(groupId, token);
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
    onShow() {
      if (!shouldShowTooltip(element)) {
        return false;
      }
      tooltipContent.update();
      return undefined;
    },
  });
}

export function attachPickupInteractions(tokenElements: HTMLElement[]) {
  if (tokenElements.length === 0) {
    return;
  }
  ensureHoverHandlers();
  tokenElements.forEach(createTooltip);
}
