export interface PickupParagraph {
  id: string;
  text: string;
  hash?: string;
}

export interface PickupToken {
  text: string;
  tag: string;
  typeId: number;
  kind?: 'grammar' | 'vocabulary';
  label?: string;
  start?: number;
  end?: number;
  tokenIndex?: number;
  headIndex?: number;
  pos?: string;
  dep?: string;
  spacyTag?: string;
  sentence?: number;
  isRoot?: boolean;
  meaning?: string;
}

export interface PickupAnnotation {
  id: string;
  tokens: PickupToken[];
}

export type PickupModelRuntimeStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface PickupModelStatus {
  status: PickupModelRuntimeStatus;
  error: string | null;
  startedAt: number | null;
  readyAt: number | null;
  progress: number;
  stage: string;
}
