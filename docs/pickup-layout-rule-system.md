# 翻译布局规则体系（插件化方案）

目标：把布局判断拆成可插拔的最小规则单元（Rule Atom），避免规则膨胀后副作用不可控。

## 核心原则
1. **最小单位**：每条规则只判断一个信号，输出一个决策或不参与。
2. **无副作用**：规则只返回决策，不直接操作 DOM。
3. **可组合**：规则按优先级排序裁决，保证一致性。
4. **可调试**：每条规则必须返回 `reason`，方便定位。

---

## 结构设计

### 1) Rule Atom（最小规则单元）
每条规则只做一个判断：
- 输入：`LayoutContext`
- 输出：`LayoutDecision | null`

```ts
export type LayoutDecision = {
  layout: 'inline' | 'three-lane' | 'ellipsis';
  priority: number; // 越大越优先
  reason: string;
  ruleId: string;
};

export type LayoutRule = {
  id: string;
  priority: number;
  match: (ctx: LayoutContext) => LayoutDecision | null;
};
```

### 2) LayoutContext（上下文）
包含布局决策所需的数据，不直接持有复杂对象：
```ts
export type LayoutContext = {
  element: HTMLElement;
  sourceText: string;
  translationText?: string; // 译文（可选）
  computedStyle: CSSStyleDeclaration;
  metrics: {
    height: number;
    lineHeight: number;
    wordCount: number;
    isTruncated: boolean; // nowrap / ellipsis
    isEllipsis: boolean; // 实际溢出
  };
};
```

### 3) 裁决器（Pipeline）
统一执行规则并裁决最终布局：
```ts
export function decideLayout(ctx: LayoutContext, rules: LayoutRule[]) {
  const decisions = rules
    .map(rule => rule.match(ctx))
    .filter(Boolean) as LayoutDecision[];

  if (decisions.length === 0) {
    return { layout: 'three-lane', priority: 0, reason: 'default', ruleId: 'default' };
  }

  return decisions.sort((a, b) => b.priority - a.priority)[0];
}
```

---

## 现有规则拆分建议（原子化）
| 规则 | 信号 | 决策 |
| --- | --- | --- |
| `display-inline` | `display: inline*` | `inline` |
| `ellipsis-truncated` | 省略号截断 + 有译文 | `ellipsis` |
| `short-words` | `<3` 单词 | `inline` |
| `not-complete-sentence` | 非完整句子 | `inline` |
| `long-text` | `>80` 字符 | `three-lane` |
| `inline-tag-or-truncate` | inline 标签或视觉截断 | `inline` |
| `compact-block` | 单行 block/flex/grid/list-item | `inline` |

---

## 添加新规则（Case 4：段落块）
如果要针对段落块做专门处理，只需新增一条规则：
```ts
export const paragraphBlockRule: LayoutRule = {
  id: 'paragraph-block',
  priority: 60,
  match(ctx) {
    const tag = ctx.element.tagName;
    if (['P','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE'].includes(tag)) {
      return {
        layout: 'three-lane',
        priority: 60,
        reason: 'paragraph-like tag',
        ruleId: 'paragraph-block',
      };
    }
    return null;
  },
};
```
然后把它加入规则列表即可。

---

## 调试建议（可选增强）
- 给元素加 `data-pickup-layout` 和 `data-pickup-layout-reason`
- 在开发模式输出 `console.debug`：
```ts
console.debug('[layout]', decision.ruleId, decision.reason, ctx.element);
```

---

## 迁移路径
1. 保留现有逻辑；先建立规则与裁决器骨架。
2. 把旧规则逐条迁移成 Rule Atom。
3. 在 `render.ts` 中用 `decideLayout` 替换 `shouldUseInlineLayout`。
4. 保持 `ellipsis` 逻辑为最高优先级。

