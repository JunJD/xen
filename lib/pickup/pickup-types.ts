export type PickupTypeDefinition = {
  id: number;
  name: string;
  tag: string;
  background: string;
  border: string;
  text: string;
};

export const PICKUP_TYPES: PickupTypeDefinition[] = [
  { id: 1, name: '主语', tag: 'S', background: '#E3F2FD', border: '#2196F3', text: '#1976D2' },
  { id: 2, name: '谓语', tag: 'V', background: '#F3E5F5', border: '#9C27B0', text: '#7B1FA2' },
  { id: 3, name: '宾语', tag: 'O', background: '#E8F5E9', border: '#4CAF50', text: '#388E3C' },
  { id: 4, name: '定语', tag: 'Attr', background: '#FFF3E0', border: '#FF9800', text: '#F57C00' },
  { id: 5, name: '状语', tag: 'Adv', background: '#FCE4EC', border: '#E91E63', text: '#C2185B' },
  { id: 6, name: '补语', tag: 'C', background: '#F1F8E9', border: '#8BC34A', text: '#689F38' },
  { id: 7, name: '介词短语', tag: 'PP', background: '#E0F2F1', border: '#009688', text: '#00796B' },
  { id: 8, name: '从句', tag: 'Clause', background: '#FBE9E7', border: '#FF5722', text: '#E64A19' },
  { id: 9, name: '连词', tag: 'Conj', background: '#EDE7F6', border: '#673AB7', text: '#512DA8' },
];

export const DEFAULT_PICKUP_TYPE = PICKUP_TYPES[0];

export function getPickupTypeById(id: number) {
  return PICKUP_TYPES.find(item => item.id === id) ?? DEFAULT_PICKUP_TYPE;
}
