# Grammar + Vocabulary Dual-Mode Challenges

Date: 2026-02-13

## Core Challenges

1. Alignment
- Problem: `spaCy` `token/chunk/dependency` boundaries do not always match translated phrase boundaries.
- Impact: Grammar explanations and vocabulary translations can drift out of sync.
- Goal: Build one shared intermediate layer (span/phrase IDs) for all modes.

2. Disambiguation
- Problem: The same word can change POS and meaning by context; word-by-word translation is unreliable.
- Impact: Vocabulary explanations become dictionary-like and miss sentence meaning.
- Goal: Prefer phrase-level translation first, then backfill token-level glosses in context.

3. Granularity
- Problem: Output jumps between token, phrase, and grammar pattern levels without a stable policy.
- Impact: Explanations feel inconsistent and harder to learn from.
- Goal: Define a fixed 3-level structure (word / phrase / grammar point) and display priority.

4. Cross-Mode Consistency
- Problem: Grammar-focused and vocabulary-focused modes can conflict if implemented separately.
- Impact: The same sentence may produce contradictory explanations between modes.
- Goal: Keep one shared analysis pipeline; only the renderer changes per mode.

## Suggested Attack Order

- [ ] Step 1: Build the shared intermediate representation (token/span/phrase + IDs).
- [ ] Step 2: Add phrase-level translation plus token-level contextual backfill.
- [ ] Step 3: Lock a stable granularity policy (word -> phrase -> grammar point).
- [ ] Step 4: Implement Mode A (grammar-first) and Mode B (vocabulary-first) on the same data model.
- [ ] Step 5: Run 20-50 real sentences as consistency regression tests and log error types.

## 中文说明（含例子）

1. 对齐难（语法结构和翻译片段对不上）
- 说明：`spaCy` 给出的 `token/chunk/dependency` 边界，常常和翻译后的短语边界不一致。
- 例子：`take care of` 在英文分析里是 3 个词，但中文常对应“照顾”1 个词。
- 风险：如果按逐词翻译，语法说明和词汇说明会发生错位。

2. 消歧难（同词多义、同形异性）
- 说明：同一个词在不同上下文中，词性和词义都可能变化。
- 例子：`book` 在 `I read a book.` 是名词；在 `I booked a room.` 是动词。
- 风险：只做词典映射会导致解释不符合句子真实语义。

3. 粒度难（词 / 短语 / 语法点三层切换）
- 说明：输出单位如果不固定，会在词级、短语级、语法点级来回跳。
- 例子：`I have been working here for 3 years.`
- 风险：有时只解释 `have/been/working`，有时又直接解释“现在完成进行时”，学习体验不连贯。

4. 双模式一致性难（语法模式与词汇模式结论冲突）
- 说明：如果“语法优先模式”和“词汇优先模式”各自独立实现，容易互相打架。
- 例子：`He made up a story.` 里 `made up` 应作为短语动词处理。
- 风险：语法模式识别为短语动词，但词汇模式若拆成 `made` + `up` 会给出冲突结论。

## 中文攻克顺序

- [ ] 第一步：先定义统一中间层（token/span/phrase + IDs）。
- [ ] 第二步：先做短语级翻译，再回填词级释义。
- [ ] 第三步：固定输出粒度策略（词 -> 短语 -> 语法点）。
- [ ] 第四步：同一数据结构渲染 Mode A（偏语法）与 Mode B（偏词汇）。
- [ ] 第五步：用 20-50 条真实句子做一致性回归并记录误差类型。
