# Pickup 布局说明

本文档说明翻译渲染的布局流程、关键封装点，以及为避免紧凑 UI 元素溢出所做的布局修复。

## 范围
覆盖内容脚本的渲染链路：`lib/pickup/content/*`，以及 inline / 多 lane 的布局选择逻辑。

## 流程总览
1. `collectParagraphs`（`lib/pickup/content/collector.ts`）
   - 遍历 DOM，挑选顶层可翻译元素。
   - 根据 `lib/pickup/content/dom.ts` 的规则跳过不可见/交互/系统 UI。
   - 写入 `data-pickup-original`，分配 `data-pickup-id`。
2. `createPickupRunner`（`lib/pickup/content/runner.ts`）
   - 批量请求注释，落地渲染。
3. `applyAnnotations`（`lib/pickup/content/render.ts`）
   - 构建 AST 和渲染模型，决定布局。
   - 注入布局容器，绑定 token/role/tooltip。
4. `ensurePickupStyles`（`lib/pickup/content/styles.ts`）
   - 注入布局和 token 样式。
5. `render-mode`（`lib/pickup/content/render-mode.ts`）
   - 控制显示的 lane（`vocab_infusion` / `syntax_rebuild`）。
6. `interactions`（`lib/pickup/content/interactions.ts`）
   - 提供 token/role 的交互与 tooltip 行为。

## 布局选择（Inline vs Three-Lane）
布局选择逻辑在 `shouldUseInlineLayout`（`lib/pickup/content/render.ts`）。

规则（按顺序）：
- 如果元素是 `display: inline*`，使用 inline。
- 文本过长（> 80）不使用 inline。
- 标签属于 inline 语义，或视觉截断（`nowrap/ellipsis`）时使用 inline。
- 如果是紧凑单行块（block/flex/grid/list-item，但高度接近单行），强制 inline。

最后一条是近期修复点：短文本菜单项会被判为三 lane，叠成多行导致重叠，因此改为强制 inline。

## 关键封装点
渲染链路拆成了若干稳定的封装函数：
- `buildRenderableTokens` / `buildAnnotatedFragment`
  - 用 token span 映射原文，并构建带注释的 fragment。
- `buildThreeLaneLayout`
  - 生成堆叠布局（原文 / 译文 / 词汇 / 语法）。
- `buildInlineLayout`
  - 生成紧凑布局（原文 + 译文同一行）。
- `shouldUseInlineLayout`
  - 布局判定的核心启发式，避免 UI 溢出。
- `decorateRenderedTokens`
  - 附加 tooltip、角色标签与交互钩子。

## 核心数据属性
这些属性构成布局与交互的协议：
- `data-pickup-id` / `data-pickup-status` / `data-pickup-processed`
- `data-pickup-original`
- `data-pickup-layout` = `inline` / `three-lane`
- `data-pickup-lane` = `original | target | vocab_infusion | syntax_rebuild`
- `data-pickup-unit` / `data-pickup-role` / `data-pickup-meaning`

## 近期改动摘要
- `lib/pickup/content/render.ts`
  - `shouldUseInlineLayout` 增强：对“紧凑单行块”强制 inline，避免菜单类 UI 叠行溢出。

## 难点说明（Why）
- span 对齐：token 的字符偏移可能因 DOM 归一化发生漂移，必须严格校验并提供降级策略。
- 布局启发式：站点样式高度多样，必须结合 computed style 与高度/行高的判断，才能稳定地处理单行 UI。

