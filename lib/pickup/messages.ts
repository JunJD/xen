export interface PickupParagraph {
  id: string;
  text: string;
  hash?: string;
}

export interface PickupToken {
  text: string;
  tag: string;
  typeId: number;
}

export interface PickupAnnotation {
  id: string;
  tokens: PickupToken[];
}
