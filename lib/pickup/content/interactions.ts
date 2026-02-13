import tippy, { type Props } from 'tippy.js';

const TIPPY_THEME = 'xen-pickup';
let hoverHandlersReady = false;
let activeGroupId: string | null = null;
let activeGroupElements: HTMLElement[] = [];

const BASE_TIPPY_PROPS: Partial<Props> = {
  theme: TIPPY_THEME,
  arrow: false,
  placement: 'top',
  maxWidth: 320,
  delay: [120, 0],
  duration: [120, 80],
  interactive: false,
  hideOnClick: false,
  appendTo: () => document.body,
  zIndex: 2147483000,
  onCreate(instance) {
    instance.popper.setAttribute('data-pickup-ui', 'true');
    instance.popper.setAttribute('data-pickup-ignore', 'true');
  },
  onShow(instance) {
    const reference = instance.reference as HTMLElement;
    const meaning = reference.dataset.pickupMeaning ?? '';
    if (!meaning) {
      return false;
    }
    if (instance.props.content !== meaning) {
      instance.setContent(meaning);
    }
    return true;
  },
};

function isTokenElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement && target.classList.contains('xen-pickup-token');
}

function findTokenElement(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  if (target.classList.contains('xen-pickup-token')) {
    return target;
  }
  return target.closest<HTMLElement>('.xen-pickup-token');
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
  if (activeGroupId === groupId) {
    return;
  }
  clearActiveGroup();
  activeGroupId = groupId;
  activeGroupElements = collectGroupElements(origin, groupId);
  activeGroupElements.forEach((element) => {
    element.dataset.pickupActive = 'true';
  });
}

function handlePointerOver(event: PointerEvent) {
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
  const token = findTokenElement(event.target);
  if (!token) {
    return;
  }
  const groupId = token.dataset.pickupGroup;
  if (!groupId) {
    return;
  }

  const related = event.relatedTarget as HTMLElement | null;
  if (related && isTokenElement(related)) {
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

function ensureHoverHandlers() {
  if (hoverHandlersReady) {
    return;
  }
  hoverHandlersReady = true;
  document.addEventListener('pointerover', handlePointerOver, { passive: true });
  document.addEventListener('pointerout', handlePointerOut, { passive: true });
}

function createTooltip(element: HTMLElement) {
  if (!element.dataset.pickupMeaning) {
    return;
  }
  const existing = (element as HTMLElement & { _tippy?: unknown })._tippy;
  if (existing) {
    return;
  }
  tippy(element, {
    ...BASE_TIPPY_PROPS,
    content: element.dataset.pickupMeaning ?? '',
  });
}

export function attachPickupInteractions(tokenElements: HTMLElement[]) {
  if (tokenElements.length === 0) {
    return;
  }
  ensureHoverHandlers();
  tokenElements.forEach(createTooltip);
}
