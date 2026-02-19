export const AST_VERSION = 1 as const;

export type AstVersion = typeof AST_VERSION;

export type PageAst = {
  astVersion: AstVersion;
  pageId: string;
  sentences: SentenceAst[];
  diagnostics: DiagnosticAst[];
};

// SentenceAst：单句级语法结构（token + 关系 + 语法点），用于渲染与布局判断。
export type SentenceAst = {
  /** 句子内部唯一 ID（通常来自 annotation.id） */
  id: string;
  /** 原始来源 ID（和 DOM 段落/annotation 对齐） */
  sourceId: string;
  /** 原句文本 */
  text: string;
  /** 语法单位：token / phrase / clause */
  units: UnitAst[];
  /** 单位之间的关系：依存 / 短语 / 从句 */
  relations: RelationAst[];
  /** 从单位关系中抽取的语法点（如被动、从句等） */
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
