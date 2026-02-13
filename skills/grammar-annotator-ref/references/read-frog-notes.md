# 语法标注笔记（Read Frog 参考）

目标：把这个仓库当作参考，实现“整页语法结构 + 词汇标注”的简化浏览器插件。
本文记录难点、可复用点、以及要看的代码位置。

## 难点（容易踩坑的地方）

- DOM 遍历与安全标注：深层 DOM、跳过隐藏/无关节点、段落识别与标记。
- Shadow DOM 与 iframe 覆盖：遍历 + 观察要能进入 shadow root/iframe。
- 稳定 DOM 插入：插入标注包装时不破坏布局；支持回滚/还原。
- 异步 + 批量请求控制：避免突发并发；重试与单条回退机制。
- 缓存与去重：同一段落不要重复请求；基于 hash 做持久缓存。
- 动态页面竞态：MutationObserver 可能导致重复处理或二次插入。
- 交互冲突：如果有悬浮 UI，需要避免和页面样式冲突。

## 可复用点（本仓库上一级里现成的）

### DOM 遍历与标记
- `../read-frog/src/utils/host/dom/traversal.ts`
  - `walkAndLabelElement` 遍历 DOM 并打段落标记。
  - `extractTextContent` 稳定提取文本（含 <br>）。
- `../read-frog/src/utils/host/dom/filter.ts`
  - 跳过规则、inline/block 判断、不要进入的元素判定。
- `../read-frog/src/utils/constants/dom-rules.ts`
  - 中央规则表（哪些 tag/selector 跳过或强制 block）。

### 整页扫描 + 观察
- `../read-frog/src/entrypoints/host.content/translation-control/page-translation.ts`
  - `PageTranslationManager` 组合 IntersectionObserver + MutationObserver。
  - 包含 shadow root 遍历与动态 DOM 处理。

### DOM 插入模式
- `../read-frog/src/utils/host/translate/dom/translation-insertion.ts`
  - 插入节点时处理 inline/block 与样式装饰。
- `../read-frog/src/utils/host/dom/batch-dom.ts`
  - DOM 写入批处理，避免抖动。

### 后台队列 + 批量请求
- `../read-frog/src/entrypoints/background/translation-queues.ts`
  - RequestQueue + BatchQueue 的组合用法、缓存、摘要。
- `../read-frog/src/utils/request/request-queue.ts`, `../read-frog/src/utils/request/batch-queue.ts`
  - 限速、重试、批量/单条回退。

### 消息通道（content <-> background）
- `../read-frog/src/utils/message.ts`
  - 类型化消息协议，sendMessage/onMessage。

### Shadow DOM UI 注入
- `../read-frog/src/entrypoints/selection.content/index.tsx`
- `../read-frog/src/utils/shadow-root.ts`

## 推荐的最小流程（新插件思路）

1) Content script：
   - 遍历 DOM 并标记段落（复用遍历策略）。
   - 抽取段落文本；为段落生成 hash。
2) Background：
   - 批量分析请求；重试与缓存。
3) Content script：
   - 接收结构化标注结果。
   - 批量插入 wrapper 到段落 DOM。
   - 保存“原始快照”，支持回滚/还原。

## 风险 / TODO 提醒

- “inline vs block” 包裹策略会显著影响页面布局。
- 避免处理可编辑区域与不可见内容。
- MutationObserver 可能导致重复处理，需要去重标记。
- 输出格式尽量用 JSON（offset + label），本地渲染更稳。
- 注入 UI 时确保 z-index 与样式隔离（Shadow DOM）。

## 快速阅读清单（优先读）

- `../read-frog/src/entrypoints/host.content/translation-control/page-translation.ts`
- `../read-frog/src/utils/host/dom/traversal.ts`
- `../read-frog/src/utils/host/dom/filter.ts`
- `../read-frog/src/utils/host/translate/dom/translation-insertion.ts`
- `../read-frog/src/entrypoints/background/translation-queues.ts`


