export interface PickupParagraph {
  id: string;
  text: string;
  hash?: string;
}

export type TranslateProvider = 'google' | 'llm';

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

export interface PickupTranslateUnitInput {
  unitId: string;
  text: string;
  kind?: 'grammar' | 'vocabulary';
  role?: string;
  pos?: string;
  dep?: string;
  tokenIndex?: number;
  span?: [number, number] | null;
}

export interface PickupTranslateParagraphInput {
  id: string;
  sourceText: string;
  units: PickupTranslateUnitInput[];
}

export interface PickupTranslateUnitPreview {
  unitId: string;
  vocabInfusionText: string;
  vocabInfusionHint?: string;
  syntaxRebuildText: string;
  context: PickupTranslateUnitInput;
}

export interface PickupTranslateParagraphPreview {
  id: string;
  sourceText: string;
  paragraphText: string;
  units: PickupTranslateUnitPreview[];
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
