export interface PickupParagraph {
  id: string;
  text: string;
  hash?: string;
}

export type TranslateProvider = 'google' | 'llm';

export interface PickupToken {
  /** 原始 token 文本（基于分词切片，不一定等于用户选择的字符串） */
  text: string;
  /** 类型短标签，用于 UI 展示（如 GR / VOC） */
  tag: string;
  /** 类型 ID，对应 pickup-types 中定义 */
  typeId: number;
  /** 类型归类：语法 / 词汇 */
  kind?: 'grammar' | 'vocabulary';
  /** 类型名称（如 Grammar / Vocabulary），用于 UI 或日志 */
  label?: string;
  /** 在原文中的起始字符索引（0 基） */
  start?: number;
  /** 在原文中的结束字符索引（0 基，end 为开区间） */
  end?: number;
  /** 分词序号（spaCy token.i） */
  tokenIndex?: number;
  /** 依存句法的 head token 序号（spaCy token.head） */
  headIndex?: number;
  /** 词性（粗粒度 POS，spaCy token.pos） */
  pos?: string;
  /** 依存关系标签（spaCy token.dep）
   *  依存句法会把句子中的 token 组织成一棵树，每个 token 指向它的支配词（head）。
   *  dep 表示“当前词与 head 的关系类型”，如 nsubj（主语）、obj（宾语）、aux（助动词）。
   */
  dep?: string;
  /** 词性（细粒度 POS，spaCy token.tag） */
  spacyTag?: string;
  /** 句子序号（spaCy token.sent 的索引）
   *  多句文本中用于标记当前 token 属于第几句，通常从 0 开始递增。
   */
  sentence?: number;
  /** 是否为依存树的 root */
  isRoot?: boolean;
  /** 释义/翻译结果（可由词典或 LLM 填充） */
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
  usphone?: string;
  ukphone?: string;
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
