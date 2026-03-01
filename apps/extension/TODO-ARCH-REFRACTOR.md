# Xen Extension 维护性重构 TODO（复用 + 设计模式）

## 0. 范围与约束

- 本轮只做维护性重构，不处理 model/json 体积策略。
- 目标是降低“修改一处要改多处”的风险，提高可读性与复用率。
- 所有改动要求等价重构，不改变现有功能行为。

## 1. 维护性基线问题

- [x] content 层存在大量重复硬编码：`data-*` 属性、tag、class、selector 分散在多个文件。
- [x] storage 适配逻辑重复：`settings.ts` 与 `background/translate/storage.ts` 各有一套。
- [x] 页面模式状态逻辑重复：`render-mode.ts` 与 `translation-preview-mode.ts` 结构高度相似。
- [x] 多个大文件职责偏重（`render.ts` / `runner.ts` / `styles.ts` / `options/App.tsx`），后续改动成本高。

## 2. Phase A（先做）- Content 常量收口

- [x] A1. 新增 `lib/pickup/content/markers.ts`
  - 统一定义 content 层公共 attrs/classes/selectors/tag（token、translation、ui ignore 等）。
- [x] A2. 替换以下文件中的重复字符串常量：
  - `content/render.ts`
  - `content/runner.ts`
  - `content/dom.ts`
  - `content/interactions.ts`
  - `content/article.ts`
  - `content/web-components.ts`
  - `content/styles.ts`
- [x] A3. 保持语义名称统一，避免同一概念多套命名。

验收：
- [x] `rg "data-pickup-ignore|data-pickup-ui|xen-pickup-token-wc"` 只保留在公共常量模块或必要样式文本。
- [ ] 相关功能无回归：注释渲染、tooltip、段落翻译、忽略节点过滤。

## 3. Phase B（紧接）- Storage 兼容层复用

- [x] B1. 新增 `lib/platform/storage.ts`
  - 封装 `getStorageArea/storageGet/storageSet`。
- [x] B2. 替换 `lib/pickup/settings.ts` 的本地重复实现。
- [x] B3. 替换 `lib/pickup/background/translate/storage.ts` 的本地重复实现。
- [x] B4. 收敛异常处理与返回类型，减少重复 try/catch 模板代码。

验收：
- [x] `rg "function getStorageArea"` 仅在公共平台模块定义。
- [ ] 设置读写、provider/model/api key 存取行为一致。

## 4. Phase C（本轮可做）- 模式状态管理模板化

- [x] C1. 新增模式状态 helper（global cache + localStorage + dataset apply 模板）。
- [x] C2. 重构 `render-mode.ts` 与 `translation-preview-mode.ts` 复用 helper。
- [x] C3. 保留各自公开 API，不影响调用方。

验收：
- [x] 代码重复明显下降，两个模块只保留业务差异。
- [ ] 页面刷新后模式持久化行为一致。

## 5. Phase D（后续）- 大文件职责拆分

- [ ] D1. `render.ts` 拆为 token mapping / paragraph translation / dom mutation 三层。（进行中：已抽出 `render-annotator.ts` 与 `render-translation.ts`）
- [ ] D2. `runner.ts` 拆为 queue、observer、lifecycle 三个模块。
- [ ] D3. `styles.ts` 将静态 CSS 与主题探测逻辑分离。
- [ ] D4. `options/App.tsx` 拆为 settings sections + hooks + view components。

验收：
- [ ] 单文件长度和圈复杂度下降，模块职责更清晰。
- [ ] 新增功能时不再需要跨 5+ 文件同步改字符串/状态键。

## 6. 执行顺序（当前）

1. Phase A（低风险、立刻收益）
2. Phase B（低风险、复用收益高）
3. Phase C（低风险、模式逻辑统一）
4. Phase D（中风险，分批推进）
