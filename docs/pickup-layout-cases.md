# 翻译布局 Case 约定（Draft）

目标：在翻译元素集合增多时，尽可能保持页面视觉稳定，不破坏父级布局、不溢出、不挤压邻居。

## 基本规则
- 任何翻译插入都必须尊重父级宽高约束（不改变外层尺寸）。
- 单行元素优先 `inline` 布局（同一行放译文或副标识），避免堆叠。
- 多行段落可用多 lane 布局（原文/译文/词汇/语法）。
- 超出空间时优先“降噪”：减少展示层级，而不是扩展父级。

## 术语
- inline 布局：原文与译文同一行展示。
- three-lane 布局：原文 + 译文 + 词汇/语法分层显示。

## Case 约定

### Case 1：Inline 元素（已存在）
触发条件：
- `display: inline*`
- 或标签属于 `SPAN/A/B/STRONG/EM/I/U/S/SMALL/LABEL/MARK/ABBR/CITE/Q/CODE/KBD`
- 或视觉截断：`white-space: nowrap` 或 `text-overflow: ellipsis`

规则：
- 强制 inline 布局
- 译文放在原文旁，尽量缩小字体/颜色层级
- 禁止插入多行 lane

### Case 2：Compact 单行块（已存在）
触发条件：
- `display` 为 `block | list-item | flex | grid`
- 且元素高度接近单行（`height <= line-height * 2.2`）

规则：
- 强制 inline 布局
- 避免 three-lane 造成重叠溢出

### Case 3：长文本块（已存在）
触发条件：
- 文本长度 > 80（`MAX_INLINE_LAYOUT_TEXT_LENGTH`）

规则：
- 禁止 inline 布局
- 使用 three-lane

### Case 4：标题/段落块（已存在）
触发条件：
- `P/LI/H1/H2/H3/H4/H5/H6/BLOCKQUOTE`

规则：
- 默认三 lane（除非满足 Case 1/2 的 inline 强制条件）

### Case 5：视觉多行段落
触发条件：
- 任何不满足 Case 1/2 且文本不短的块

规则：
- 使用 three-lane
- 允许分层展示

## 约束策略（全局）
- 不改变原节点外层尺寸（不增加 padding/margin）。
- 不改变 display 结构（除非内部容器）。
- 允许在内容内进行文本缩小或降级展示。

## 降级/兜底策略
- 无法匹配 token span：保持原文，避免破坏布局。
- 译文空：仍保留原文布局，不插入空 lane。

## 已实施位置
- `lib/pickup/content/render.ts`
  - `shouldUseInlineLayout`: Case 1/2/3 的核心判断
  - `buildInlineLayout` / `buildThreeLaneLayout`
- `lib/pickup/content/styles.ts`
  - lane 样式与分层展示

