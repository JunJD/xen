import type { PickupAnnotation, PickupToken } from '@/lib/pickup/messages';
import type { GrammarPointAst, RelationAst, SentenceAst, UnitAst } from './types';
import { buildGrammarPointsFromTokens, resolveRole, type GrammarPointBuilderInput } from './rules';

function resolveSurface(token: PickupToken, text: string) {
  if (typeof token.start === 'number' && typeof token.end === 'number') {
    const start = Math.max(0, Math.min(text.length, token.start));
    const end = Math.max(start, Math.min(text.length, token.end));
    return text.slice(start, end);
  }
  return token.text ?? '';
}

function resolveSpan(token: PickupToken, text: string): [number, number] | null {
  if (typeof token.start === 'number' && typeof token.end === 'number') {
    const start = Math.max(0, Math.min(text.length, token.start));
    const end = Math.max(start, Math.min(text.length, token.end));
    return [start, end];
  }
  return null;
}

function buildMockMeaning(token: PickupToken, surface: string) {
  const category = token.kind === 'grammar' ? '语法' : '词汇';
  if (surface.trim()) {
    return `${category}释义（mock）：${surface.trim()}`;
  }
  return `${category}释义（mock）`;
}

function buildUnitId(sentenceId: string, tokenIndex: number | undefined, fallbackIndex: number) {
  const index = typeof tokenIndex === 'number' ? tokenIndex : fallbackIndex;
  return `u:${sentenceId}:${index}`;
}

export function buildSentenceAstFromTokens(
  annotation: PickupAnnotation,
  text: string,
  options: {
    buildGrammarPoints?: (input: GrammarPointBuilderInput) => GrammarPointAst[];
  } = {},
): SentenceAst {
  const sentenceId = annotation.id;
  const unitIdsByTokenIndex = new Map<number, string>();

  const units: UnitAst[] = annotation.tokens.map((token, index) => {
    const unitId = buildUnitId(sentenceId, token.tokenIndex, index);
    if (typeof token.tokenIndex === 'number') {
      unitIdsByTokenIndex.set(token.tokenIndex, unitId);
    }
    const surface = resolveSurface(token, text);
    return {
      id: unitId,
      kind: 'token',
      surface,
      span: resolveSpan(token, text),
      tokenIndex: token.tokenIndex,
      headIndex: token.headIndex,
      pos: token.pos,
      tag: token.spacyTag ?? token.tag,
      dep: token.dep,
      typeId: token.typeId,
      category: token.kind,
      meaning: token.meaning ?? buildMockMeaning(token, surface),
      role: resolveRole(token),
    };
  });

  const relations: RelationAst[] = [];
  annotation.tokens.forEach((token, index) => {
    if (typeof token.tokenIndex !== 'number' || typeof token.headIndex !== 'number') {
      return;
    }
    const from = unitIdsByTokenIndex.get(token.tokenIndex) ?? buildUnitId(sentenceId, token.tokenIndex, index);
    const to = unitIdsByTokenIndex.get(token.headIndex);
    if (!to) {
      return;
    }
    relations.push({
      type: 'dep',
      from,
      to,
      label: token.dep,
    });
  });

  const grammarPoints = (options.buildGrammarPoints ?? buildGrammarPointsFromTokens)({
    annotation,
    unitIdsByTokenIndex,
    text,
    buildMockMeaning,
    resolveSurface,
  });

  return {
    id: sentenceId,
    sourceId: annotation.id,
    text,
    units,
    relations,
    grammarPoints,
  };
}
