# 英语页面结构化技术 Roadmap

日期: 2026-02-13
Owner: xen

## 0. 目标与范围

- 目标: 构建一个类似 VSCode 语言服务的英语页面分析系统。
- 核心要求: 使用统一 AST/IR 做分析，支持两种展示模式（Grammar-first / Vocabulary-first）。
- 非目标（当前阶段）: 全量写作纠错与整文改写。

## 1. 架构基线

- 第 1 层（Content/UI）: 段落采集、DOM 渲染、交互。
- 第 2 层（Orchestration）: 队列、重试、缓存、增量调度。
- 第 3 层（NLP Service）: 解析、短语对齐、词义映射、诊断。
- 单一事实源: AST/IR 是所有渲染器唯一消费的分析输出。

## 1.1 交互与呈现分层（默认轻、需要时中、深挖才重）

- 默认态目标: 完全不学习也不烦人，仅在用户主动 hover 时提供信息。
- 默认开启全页处理，但仅保留极低频存在感提示（例如段落级轻微标注）。
- 右侧小悬浮按钮或地址栏状态提示作为可见入口，支持随时关闭。

默认轻（Hover）
- 仅当前词或短语出现轻微 underline 或微弱底色，不做全页持续高亮。
- Tooltip 贴近光标、不遮挡原文、可忽略，交互像 IDE hover。
- Tooltip 内容两行:
- 第 1 行: 角色信息（如 V / 主语 / 修饰谁）。
- 第 2 行: 一句话解释（不超过 12 个字）。
- 右侧提供两个小按钮: `结构` / `释义`。

需要时中（Tooltip 内切换）
- 点击 `结构` / `释义` 切换内容，不打开侧栏。
- 仍保持轻量，无重排，无明显遮挡。

深挖才重（Side Panel）
- Tooltip 提供“展开”入口，打开右侧侧栏。
- 侧栏用于展示 AST 结构、句法树、完整释义等深信息。

实现约束
- Hover 高亮采用 outline 或背景，不影响排版。
- Tooltip 使用轻量浮层库，默认不影响原文布局。

## 2. 分阶段计划（含验收标准与测试用例）

### Phase 0 - AST 合同与兼容层（2 天）

交付物
- 定义 AST schema: `PageAst`, `SentenceAst`, `UnitAst`, `RelationAst`, `SenseAst`, `Diagnostic`。
- 增加版本字段: `astVersion`。
- 提供从现有 `PickupAnnotation` 到 AST 兼容结构的 adapter。

验收标准
- A0-1: `astVersion` 存在并在运行时校验。
- A0-2: 现有渲染链路可通过 adapter 正常工作（无可见回归）。
- A0-3: AST 序列化是确定性的（同输入 -> 排序后 JSON 字节一致）。

测试用例
- T0-1 Schema 校验: 合法/非法 AST payload。
- T0-2 向后兼容: 旧 mock 标注渲染出的 token 数量一致。
- T0-3 快照测试: 同一段落输入生成稳定 AST snapshot。

### Phase 1 - 解析适配与短语对齐（4 天）

交付物
- 增加 parser adapter 接口（mock 与真实 parser 可插拔）。
- 实现 phrase builder 与 token-span aligner。
- 为下游翻译与诊断保存 phrase IDs。

验收标准
- A1-1: 短语级对齐 F1 >= 0.90（基于 gold set）。
- A1-2: Token 覆盖率 100%（每个可见 token 至少属于一个 unit）。
- A1-3: AST 中不存在孤立 relation ID。

测试用例
- T1-1 短语动词: `make up`, `give up`, `look up`。
- T1-2 多词表达: `take care of`, `in charge of`。
- T1-3 介词附着歧义: `I saw the man with a telescope.`
- T1-4 定语从句边界: `The book that you gave me is useful.`

### Phase 2 - 词义映射与翻译赋值（4 天）

交付物
- 增加 `SenseAst`（上下文词义 + 置信度）。
- 先短语级翻译，再词级回填。
- 增加低置信度 fallback 通道。

验收标准
- A2-1: 词义消歧准确率 >= 0.85（评测集）。
- A2-2: 固定表达的短语翻译覆盖优先级生效。
- A2-3: 最终视图中每个 `UnitAst` 至多一个 active sense。

测试用例
- T2-1 多义词对照: `book` 名词 vs 动词。
- T2-2 固定短语覆盖: `take into account` 不应被语义拆散。
- T2-3 上下文切换: 同 lemma 在两句中产生不同 sense ID。

### Phase 3 - 语法诊断与双模式渲染（3 天）

交付物
- 基于 AST relations 的 grammar rule engine。
- Renderer A: grammar-first 排序。
- Renderer B: vocabulary-first 排序。

验收标准
- A3-1: 双模式冲突率 <= 2%（回归集）。
- A3-2: 同一句在两模式中使用同一 unit/sense IDs。
- A3-3: 选定规则集下语法诊断 precision >= 0.80。

测试用例
- T3-1 时态识别: 现在完成进行时。
- T3-2 从句类型: 条件从句、让步从句。
- T3-3 模式一致性: 同句 AST IDs 相同，仅展示优先级不同。

### Phase 4 - 增量处理与缓存策略（3 天）

交付物
- 基于段落 hash 与 DOM 变更范围的增量分析。
- 缓存策略: hit / stale / invalidate 路径。
- 动态页面防重复插入保护。

验收标准
- A4-1: 增量更新只分析新增或变化段落。
- A4-2: 重复浏览场景下缓存命中率 >= 70%。
- A4-3: 高频 mutation 后无重复标注 wrapper。

测试用例
- T4-1 动态追加: 连续追加 10 段，仅新 ID 被分析。
- T4-2 Mutation 风暴: 快速 DOM 更新不产生重复标记。
- T4-3 缓存失效: 文本 hash 变化触发且仅触发一次重分析。

### Phase 5 - 系统验收与发布门禁（4 天）

交付物
- 端到端 benchmark harness。
- 错误分类与分级看板。
- 发布 checklist 与回滚预案。

验收标准
- A5-1: p95 端到端延迟 < 400ms（冷启动），< 50ms（缓存命中）。
- A5-2: 对齐 >= 90%，模式冲突 <= 2%，parser 失败率 < 1%。
- A5-3: 发布前 P0/P1 严重级别 blocker 为 0。

测试用例
- T5-1 50 段落压力测试。
- T5-2 混合域页面（新闻/文档/博客）语言漂移测试。
- T5-3 故障注入: parser timeout / fallback 路径正确性。

## 3. 最小回归测试集

- 对齐 gold 句子 20 条。
- 词义消歧 gold 句子 20 条。
- 双模式一致性 gold 句子 20 条。
- 全部 gold case 版本化放在 `tests/fixtures/ast-gold/`。

## 4. Definition of Done（DoD）

- DoD-1: 所有阶段验收标准可量化并达标。
- DoD-2: CI 覆盖 schema tests、regression tests、benchmark smoke tests。
- DoD-3: 用户可见输出只允许来自 AST，不允许每个模式独立临时解析。
