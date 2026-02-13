export type PickupTokenKind = 'grammar' | 'vocabulary';

export type PickupTypeDefinition = {
  id: number;
  name: string;
  tag: string;
  kind: PickupTokenKind;
  background: string;
  border: string;
  text: string;
};

export const PICKUP_TYPE_ID_GRAMMAR = 1;
export const PICKUP_TYPE_ID_VOCABULARY = 2;
const LEGACY_GRAMMAR_TYPE_IDS = new Set([7, 8, 9]);

export const PICKUP_TYPES: PickupTypeDefinition[] = [
  {
    id: PICKUP_TYPE_ID_GRAMMAR,
    name: 'Grammar',
    tag: 'GR',
    kind: 'grammar',
    background: 'rgba(37, 99, 235, 0.12)',
    border: '#2563EB',
    text: '#1D4ED8',
  },
  {
    id: PICKUP_TYPE_ID_VOCABULARY,
    name: 'Vocabulary',
    tag: 'VOC',
    kind: 'vocabulary',
    background: 'rgba(5, 150, 105, 0.12)',
    border: '#059669',
    text: '#047857',
  },
];

export const DEFAULT_PICKUP_TYPE = PICKUP_TYPES[0];

export function getPickupTypeById(id: number) {
  const direct = PICKUP_TYPES.find(item => item.id === id);
  if (direct) {
    return direct;
  }
  if (LEGACY_GRAMMAR_TYPE_IDS.has(id)) {
    return getPickupTypeByKind('grammar');
  }
  return getPickupTypeByKind('vocabulary');
}

export function getPickupTypeByKind(kind: PickupTokenKind) {
  return PICKUP_TYPES.find(item => item.kind === kind) ?? DEFAULT_PICKUP_TYPE;
}
