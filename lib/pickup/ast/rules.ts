import type { PickupAnnotation, PickupToken } from '@/lib/pickup/messages';
import type { GrammarPointAst } from './types';

const ROLE_BY_DEP: Record<string, string> = {
  root: '谓语',
  nsubj: '主语',
  nsubjpass: '被动主语',
  csubj: '从句主语',
  csubjpass: '从句被动主语',
  obj: '宾语',
  dobj: '宾语',
  iobj: '间接宾语',
  pobj: '介词宾语',
  attr: '系表',
  cop: '系动词',
  aux: '助动词',
  auxpass: '被动助动词',
  neg: '否定',
  advmod: '副词修饰',
  amod: '形容修饰',
  det: '限定词',
  case: '介词标记',
  mark: '从属标记',
  prep: '介词',
  compound: '复合词',
  conj: '并列',
  cc: '并列连接',
  appos: '同位语',
  nmod: '名词修饰',
  nummod: '数词修饰',
  poss: '所有格',
  relcl: '定语从句',
  acl: '定语从句',
  advcl: '状语从句',
  ccomp: '补语从句',
  xcomp: '开放补语',
  parataxis: '并列分句',
  punct: '标点',
};

export function resolveRole(token: PickupToken) {
  const dep = token.dep?.toLowerCase();
  if (dep && ROLE_BY_DEP[dep]) {
    return ROLE_BY_DEP[dep];
  }
  if (token.pos) {
    return token.pos;
  }
  if (token.spacyTag) {
    return token.spacyTag;
  }
  return token.kind === 'grammar' ? '语法' : '词汇';
}

export type GrammarPointBuilderInput = {
  annotation: PickupAnnotation;
  unitIdsByTokenIndex: Map<number, string>;
  text: string;
  buildMockMeaning: (token: PickupToken, surface: string) => string;
  resolveSurface: (token: PickupToken, text: string) => string;
};

export function buildGrammarPointsFromTokens({
  annotation,
  unitIdsByTokenIndex,
  text,
  buildMockMeaning,
  resolveSurface,
}: GrammarPointBuilderInput): GrammarPointAst[] {
  const tokenByIndex = new Map<number, PickupToken>();
  const childrenByHead = new Map<number, number[]>();

  annotation.tokens.forEach((token) => {
    if (typeof token.tokenIndex !== 'number') {
      return;
    }
    tokenByIndex.set(token.tokenIndex, token);
    if (typeof token.headIndex !== 'number') {
      return;
    }
    const bucket = childrenByHead.get(token.headIndex) ?? [];
    bucket.push(token.tokenIndex);
    childrenByHead.set(token.headIndex, bucket);
  });

  const grammarPoints: GrammarPointAst[] = [];
  const seen = new Set<string>();

  const clauseLabels: Record<string, string> = {
    advcl: '状语从句',
    relcl: '定语从句',
    acl: '定语从句',
    ccomp: '补语从句',
    xcomp: '开放补语',
    parataxis: '并列分句',
  };
  const clauseDeps = new Set(Object.keys(clauseLabels));
  const prepositionDeps = new Set(['prep', 'agent']);

  function collectSubtree(rootIndex: number) {
    const visited = new Set<number>();
    const stack = [rootIndex];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined || visited.has(current)) {
        continue;
      }
      visited.add(current);
      const children = childrenByHead.get(current) ?? [];
      children.forEach(child => stack.push(child));
    }
    return Array.from(visited);
  }

  function addGrammarPoint(id: string, label: string, tokenIndices: number[], explanation?: string) {
    if (seen.has(id)) {
      return;
    }
    const evidenceUnitIds = new Set<string>();
    tokenIndices.forEach((tokenIndex) => {
      const unitId = unitIdsByTokenIndex.get(tokenIndex);
      if (unitId) {
        evidenceUnitIds.add(unitId);
      }
    });
    if (evidenceUnitIds.size === 0) {
      return;
    }
    seen.add(id);
    grammarPoints.push({
      id,
      label,
      explanation,
      evidenceUnitIds: Array.from(evidenceUnitIds),
    });
  }

  const passiveHeads = new Set<number>();
  annotation.tokens.forEach((token) => {
    const dep = token.dep?.toLowerCase();
    if (!dep) {
      return;
    }
    if (dep === 'auxpass' || dep === 'nsubjpass') {
      if (typeof token.headIndex === 'number') {
        passiveHeads.add(token.headIndex);
      }
    }
  });

  passiveHeads.forEach((headIndex) => {
    const headToken = tokenByIndex.get(headIndex);
    if (!headToken) {
      return;
    }
    const relatedDeps = new Set(['auxpass', 'nsubjpass', 'agent', 'neg', 'aux']);
    const relatedTokens: number[] = [headIndex];
    (childrenByHead.get(headIndex) ?? []).forEach((childIndex) => {
      const child = tokenByIndex.get(childIndex);
      if (!child?.dep) {
        return;
      }
      if (relatedDeps.has(child.dep.toLowerCase())) {
        relatedTokens.push(childIndex);
      }
    });
    addGrammarPoint(
      `gp:${annotation.id}:passive:${headIndex}`,
      '被动语态',
      relatedTokens,
    );
  });

  annotation.tokens.forEach((token) => {
    if (typeof token.tokenIndex !== 'number') {
      return;
    }
    const dep = token.dep?.toLowerCase();
    if (!dep) {
      return;
    }
    if (clauseDeps.has(dep)) {
      const label = clauseLabels[dep] ?? '从句结构';
      const subtree = collectSubtree(token.tokenIndex);
      addGrammarPoint(
        `gp:${annotation.id}:clause:${token.tokenIndex}`,
        label,
        subtree,
      );
    }
  });

  annotation.tokens.forEach((token) => {
    if (typeof token.tokenIndex !== 'number') {
      return;
    }
    const dep = token.dep?.toLowerCase();
    if (!dep || !prepositionDeps.has(dep)) {
      return;
    }
    const subtree = collectSubtree(token.tokenIndex);
    const surface = resolveSurface(token, text);
    addGrammarPoint(
      `gp:${annotation.id}:pp:${token.tokenIndex}`,
      '介词短语',
      subtree,
      token.meaning ?? buildMockMeaning(token, surface),
    );
  });

  return grammarPoints;
}
