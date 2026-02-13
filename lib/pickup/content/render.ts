import type { PickupAnnotation } from '@/lib/pickup/messages';
import { getPickupTypeById } from '@/lib/pickup/pickup-types';

export function buildTokenSpan(token: PickupAnnotation['tokens'][number]) {
  const type = getPickupTypeById(token.typeId);
  const wrapper = document.createElement('span');
  wrapper.className = 'xen-pickup-token';
  wrapper.style.backgroundColor = type.background;
  wrapper.style.borderColor = type.border;
  wrapper.style.color = type.text;
  wrapper.setAttribute('data-pickup-ignore', 'true');

  const tag = document.createElement('span');
  tag.className = 'xen-pickup-tag';
  tag.textContent = token.tag;

  const text = document.createElement('span');
  text.textContent = token.text;

  wrapper.append(tag, text);
  return wrapper;
}

export function applyAnnotations(
  annotations: PickupAnnotation[],
  elementMap: Map<string, Element>,
) {
  const appliedIds = new Set<string>();
  annotations.forEach((annotation) => {
    const element = elementMap.get(annotation.id);
    if (!element) {
      return;
    }
    const fragment = document.createDocumentFragment();
    annotation.tokens.forEach((token, index) => {
      fragment.appendChild(buildTokenSpan(token));
      if (index < annotation.tokens.length - 1) {
        fragment.appendChild(document.createTextNode(' '));
      }
    });
    debugger;
    element.textContent = '';
    element.appendChild(fragment);
    (element as HTMLElement).dataset.pickupProcessed = 'true';
    (element as HTMLElement).dataset.pickupStatus = 'done';
    appliedIds.add(annotation.id);
  });

  elementMap.forEach((element, id) => {
    if (!appliedIds.has(id)) {
      (element as HTMLElement).dataset.pickupStatus = 'error';
    }
  });
}
