import { PICKUP_TYPE_ID_GRAMMAR, PICKUP_TYPE_ID_VOCABULARY } from '@/lib/pickup/pickup-types';
import type { SentenceAst, UnitAst } from '@/lib/pickup/ast/types';

export type RenderToken = {
  id: string;
  text: string;
  start?: number;
  end?: number;
  kind?: 'grammar' | 'vocabulary';
  typeId: number;
  label?: string;
  meaning?: string;
  role?: string;
  groupId?: string;
  pos?: string;
  tag?: string;
  dep?: string;
  tokenIndex?: number;
};

export type RenderModel = {
  sentenceId: string;
  text: string;
  tokens: RenderToken[];
};

function resolveTypeId(unit: UnitAst): number {
  if (typeof unit.typeId === 'number') {
    return unit.typeId;
  }
  if (unit.category === 'grammar') {
    return PICKUP_TYPE_ID_GRAMMAR;
  }
  return PICKUP_TYPE_ID_VOCABULARY;
}

function collectGroupMap(sentence: SentenceAst) {
  const map = new Map<string, string>();
  sentence.grammarPoints.forEach((point) => {
    point.evidenceUnitIds.forEach((unitId) => {
      if (!map.has(unitId)) {
        map.set(unitId, point.id);
      }
    });
  });
  return map;
}

function toRenderToken(unit: UnitAst, groupMap: Map<string, string>): RenderToken {
  const span = unit.span ?? [undefined, undefined];
  const [start, end] = span;
  return {
    id: unit.id,
    text: unit.surface,
    start,
    end,
    kind: unit.category,
    typeId: resolveTypeId(unit),
    label: unit.role,
    meaning: unit.meaning,
    role: unit.role,
    groupId: groupMap.get(unit.id),
    pos: unit.pos,
    tag: unit.tag,
    dep: unit.dep,
    tokenIndex: unit.tokenIndex,
  };
}

export function buildRenderModelFromSentenceAst(sentence: SentenceAst): RenderModel {
  const groupMap = collectGroupMap(sentence);
  const tokens = sentence.units
    .filter(unit => unit.kind === 'token')
    .map(unit => toRenderToken(unit, groupMap));

  tokens.sort((a, b) => {
    if (typeof a.start === 'number' && typeof b.start === 'number') {
      return a.start - b.start;
    }
    return 0;
  });

  return {
    sentenceId: sentence.id,
    text: sentence.text,
    tokens,
  };
}
