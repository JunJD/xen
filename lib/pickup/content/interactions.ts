import tippy, { type Props } from 'tippy.js';

const TIPPY_THEME = 'xen-pickup';
const TOKEN_SELECTOR = '.xen-pickup-token';
const PICKUP_UI_SELECTOR = '[data-pickup-ui]';

const TOOLTIP_DESC_MAX_LENGTH = 12;
const TOOLTIP_ROLE_PREFIX = '角色: ';
const TOOLTIP_FALLBACK_ROLE = '未分类';
const TOOLTIP_FALLBACK_DESC = '暂无解释';

const TOOLTIP_MODE_STRUCTURE = 'structure';
const TOOLTIP_MODE_MEANING = 'meaning';
type TooltipMode = typeof TOOLTIP_MODE_STRUCTURE | typeof TOOLTIP_MODE_MEANING;

const TOOLTIP_BUTTON_LABEL_BY_MODE: Record<TooltipMode, string> = {
  [TOOLTIP_MODE_STRUCTURE]: '结构',
  [TOOLTIP_MODE_MEANING]: '释义',
};

const STRUCTURE_EXPLANATIONS: Array<{ keyword: string; explanation: string }> = [
  { keyword: '谓语', explanation: '句子核心动作' },
  { keyword: '主语', explanation: '动作发出者' },
  { keyword: '宾语', explanation: '动作承受对象' },
  { keyword: '定语', explanation: '限定名词范围' },
  { keyword: '状语', explanation: '补充动作状态' },
  { keyword: '补语', explanation: '补足核心信息' },
  { keyword: '介词', explanation: '引出介词结构' },
  { keyword: '并列', explanation: '并列成分连接' },
  { keyword: '从句', explanation: '从属句法结构' },
  { keyword: '标点', explanation: '句法停顿标记' },
  { keyword: '语法', explanation: '语法功能提示' },
  { keyword: '词汇', explanation: '词汇角色提示' },
];

let hoverHandlersReady = false;
let activeGroupId: string | null = null;
let activeGroupElements: HTMLElement[] = [];
let lockedGroupId: string | null = null;

const BASE_TIPPY_PROPS: Partial<Props> = {
  theme: TIPPY_THEME,
  arrow: false,
  placement: 'top',
  maxWidth: 320,
  delay: [120, 0],
  duration: [120, 80],
  interactive: true,
  hideOnClick: false,
  appendTo: () => document.body,
  zIndex: 2147483000,
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

function isInsidePickupUi(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest(PICKUP_UI_SELECTOR));
}

function normalizeTooltipText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clampTooltipText(value: string, maxLength: number) {
  const normalized = normalizeTooltipText(value);
  if (!normalized) {
    return TOOLTIP_FALLBACK_DESC;
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const visibleLength = Math.max(0, maxLength - 3);
  return `${normalized.slice(0, visibleLength)}...`;
}

function resolveTooltipRole(reference: HTMLElement) {
  const role = normalizeTooltipText(reference.dataset.pickupRole ?? '');
  if (role) {
    return role;
  }
  const category = reference.dataset.pickupCategory;
  if (category === 'grammar') {
    return '语法';
  }
  if (category === 'vocabulary') {
    return '词汇';
  }
  return TOOLTIP_FALLBACK_ROLE;
}

function resolveStructureDescription(role: string) {
  for (const item of STRUCTURE_EXPLANATIONS) {
    if (role.includes(item.keyword)) {
      return item.explanation;
    }
  }
  return '句法结构提示';
}

function resolveMeaningDescription(reference: HTMLElement, role: string) {
  const meaning = normalizeTooltipText(reference.dataset.pickupMeaning ?? '');
  if (!meaning) {
    return resolveStructureDescription(role);
  }
  return meaning;
}

function resolveTooltipDescription(reference: HTMLElement, role: string, mode: TooltipMode) {
  if (mode === TOOLTIP_MODE_STRUCTURE) {
    return clampTooltipText(resolveStructureDescription(role), TOOLTIP_DESC_MAX_LENGTH);
  }
  return clampTooltipText(resolveMeaningDescription(reference, role), TOOLTIP_DESC_MAX_LENGTH);
}

function buildTooltipActionButton(mode: TooltipMode) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xen-pickup-tooltip-action';
  button.dataset.pickupTooltipAction = mode;
  button.textContent = TOOLTIP_BUTTON_LABEL_BY_MODE[mode];
  return button;
}

function createTooltipContent(reference: HTMLElement) {
  const root = document.createElement('div');
  root.className = 'xen-pickup-tooltip';
  root.setAttribute('data-pickup-ui', 'true');

  const lines = document.createElement('div');
  lines.className = 'xen-pickup-tooltip-lines';
  lines.setAttribute('data-pickup-ui', 'true');

  const roleLine = document.createElement('div');
  roleLine.className = 'xen-pickup-tooltip-line xen-pickup-tooltip-line-role';
  roleLine.setAttribute('data-pickup-ui', 'true');

  const descriptionLine = document.createElement('div');
  descriptionLine.className = 'xen-pickup-tooltip-line xen-pickup-tooltip-line-desc';
  descriptionLine.setAttribute('data-pickup-ui', 'true');

  lines.append(roleLine, descriptionLine);

  const actions = document.createElement('div');
  actions.className = 'xen-pickup-tooltip-actions';
  actions.setAttribute('data-pickup-ui', 'true');

  const structureButton = buildTooltipActionButton(TOOLTIP_MODE_STRUCTURE);
  const meaningButton = buildTooltipActionButton(TOOLTIP_MODE_MEANING);
  structureButton.setAttribute('data-pickup-ui', 'true');
  meaningButton.setAttribute('data-pickup-ui', 'true');

  actions.append(structureButton, meaningButton);
  root.append(lines, actions);

  let currentMode: TooltipMode = TOOLTIP_MODE_MEANING;

  const update = () => {
    const role = resolveTooltipRole(reference);
    roleLine.textContent = `${TOOLTIP_ROLE_PREFIX}${role}`;
    descriptionLine.textContent = resolveTooltipDescription(reference, role, currentMode);
    structureButton.dataset.pickupActive = currentMode === TOOLTIP_MODE_STRUCTURE ? 'true' : 'false';
    meaningButton.dataset.pickupActive = currentMode === TOOLTIP_MODE_MEANING ? 'true' : 'false';
  };

  const switchMode = (mode: TooltipMode) => {
    if (currentMode === mode) {
      return;
    }
    currentMode = mode;
    update();
  };

  const handleActionClick = (event: MouseEvent, mode: TooltipMode) => {
    event.preventDefault();
    event.stopPropagation();
    switchMode(mode);
  };

  structureButton.addEventListener('click', event => handleActionClick(event, TOOLTIP_MODE_STRUCTURE));
  meaningButton.addEventListener('click', event => handleActionClick(event, TOOLTIP_MODE_MEANING));
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
  const token = findTokenElement(event.target);
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
  const token = findTokenElement(event.target);
  if (!token) {
    return;
  }
  const groupId = token.dataset.pickupGroup;
  if (!groupId) {
    return;
  }

  const related = event.relatedTarget as HTMLElement | null;
  if (related?.classList.contains('xen-pickup-token')) {
    if (related.dataset.pickupGroup === groupId) {
      return;
    }
  } else if (related) {
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

  const token = findTokenElement(event.target);
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
      tooltipContent.update();
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
