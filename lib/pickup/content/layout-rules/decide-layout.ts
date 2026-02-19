import type { LayoutContext, LayoutDecision, LayoutRule } from './types';

const DEFAULT_DECISION: LayoutDecision = {
  layout: 'three-lane',
  priority: 0,
  reason: 'default',
  ruleId: 'default',
};

export function decideLayout(ctx: LayoutContext, rules: LayoutRule[]): LayoutDecision {
  // 规则匹配：遍历所有规则，挑选“最高优先级”的布局决策。
  const decisions = rules
    .map(rule => rule.match(ctx))
    .filter(Boolean) as LayoutDecision[];

  if (decisions.length === 0) {
    return DEFAULT_DECISION;
  }

  return decisions.sort((a, b) => b.priority - a.priority)[0];
}
