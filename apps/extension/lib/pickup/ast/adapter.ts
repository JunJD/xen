import type { PickupAnnotation, PickupToken } from '@/lib/pickup/messages';
import type { GrammarPointAst, RelationAst, SentenceAst, UnitAst } from './types';
import { buildGrammarPointsFromTokens, resolveRole, type GrammarPointBuilderInput } from './rules';

function isAsciiWordChar(char: string) {
  return /[A-Za-z0-9]/.test(char);
}

function normalizeComparableText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function findNearbyTokenSpan(
  text: string,
  tokenText: string,
  anchorStart: number,
): [number, number] | null {
  if (!tokenText) {
    return null;
  }

  const searchRadius = 64;
  const windowStart = Math.max(0, anchorStart - searchRadius);
  const windowEnd = Math.min(text.length, anchorStart + searchRadius + tokenText.length);
  const windowText = text.slice(windowStart, windowEnd);

  let index = windowText.indexOf(tokenText);
  if (index < 0) {
    index = windowText.toLowerCase().indexOf(tokenText.toLowerCase());
  }
  if (index < 0) {
    return null;
  }

  const start = windowStart + index;
  return [start, start + tokenText.length];
}

function resolveSpan(token: PickupToken, text: string): [number, number] | null {
  if (typeof token.start !== 'number' || typeof token.end !== 'number') {
    return null;
  }

  let start = Math.max(0, Math.min(text.length, token.start));
  let end = Math.max(start, Math.min(text.length, token.end));
  if (end <= start) {
    return null;
  }

  const tokenText = token.text ?? '';
  if (/[A-Za-z]/.test(tokenText)) {
    while (start > 0 && isAsciiWordChar(text[start - 1] ?? '') && isAsciiWordChar(text[start] ?? '')) {
      start -= 1;
    }
    while (end < text.length && isAsciiWordChar(text[end - 1] ?? '') && isAsciiWordChar(text[end] ?? '')) {
      end += 1;
    }
  }

  if (tokenText) {
    const spanText = text.slice(start, end);
    if (normalizeComparableText(spanText) !== normalizeComparableText(tokenText)) {
      const recovered = findNearbyTokenSpan(text, tokenText, start);
      if (recovered) {
        return recovered;
      }
    }
  }

  return [start, end];
}

function resolveSurface(token: PickupToken, text: string) {
  const span = resolveSpan(token, text);
  if (span) {
    const [start, end] = span;
    const surface = text.slice(start, end);
    if (surface) {
      return surface;
    }
  }
  return token.text ?? '';
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
  // 解析阶段：把标注 token（含位置信息）转成 SentenceAst，供后续 render/model & layout 使用。
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
      meaning: token.meaning,
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
