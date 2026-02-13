export const AST_VERSION = 1 as const;

export type AstVersion = typeof AST_VERSION;

export type PageAst = {
  astVersion: AstVersion;
  pageId: string;
  sentences: SentenceAst[];
  diagnostics: DiagnosticAst[];
};

export type SentenceAst = {
  id: string;
  sourceId: string;
  text: string;
  units: UnitAst[];
  relations: RelationAst[];
  grammarPoints: GrammarPointAst[];
};

export type UnitAst = {
  id: string;
  kind: 'token' | 'phrase' | 'clause';
  surface: string;
  span: [number, number] | null;
  tokenIndex?: number;
  headIndex?: number;
  pos?: string;
  tag?: string;
  dep?: string;
  typeId?: number;
  category?: 'grammar' | 'vocabulary';
  senseId?: string;
  meaning?: string;
  role?: string;
  confidence?: number;
};

export type RelationAst = {
  type: 'dep' | 'phrase' | 'clause';
  from: string;
  to: string;
  label?: string;
};

export type GrammarPointAst = {
  id: string;
  label: string;
  explanation?: string;
  evidenceUnitIds: string[];
};

export type DiagnosticAst = {
  level: 'info' | 'warn' | 'error';
  code: string;
  message: string;
  sentenceId?: string;
  unitIds?: string[];
};
