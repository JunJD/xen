import { describe, expect, it } from 'vitest';
import { buildSentenceAstFromTokens } from '../../lib/pickup/ast/adapter';
import type { PickupToken } from '../../lib/pickup/messages';
import cases from '../fixtures/analysis-cases.json';

type GrammarPointExpectation = {
  label: string;
  evidence: number[];
};

type AnalysisCase = {
  id: string;
  text: string;
  tokens: PickupToken[];
  expect?: {
    grammarPoints?: GrammarPointExpectation[];
  };
};

const analysisCases = cases as AnalysisCase[];

function toSortedNumbers(values: Array<number | undefined>) {
  return values.filter((value): value is number => typeof value === 'number').sort((a, b) => a - b);
}

describe('buildSentenceAstFromTokens', () => {
  analysisCases.forEach((sample) => {
    it(sample.id, () => {
      const annotation = { id: sample.id, tokens: sample.tokens };
      const sentence = buildSentenceAstFromTokens(annotation, sample.text);

      expect(sentence.units.length).toBe(sample.tokens.length);
      const unitByTokenIndex = new Map<number, typeof sentence.units[number]>();
      const seenTokenIndices = new Set<number>();

      sentence.units.forEach((unit) => {
        if (typeof unit.tokenIndex === 'number') {
          unitByTokenIndex.set(unit.tokenIndex, unit);
          expect(seenTokenIndices.has(unit.tokenIndex)).toBe(false);
          seenTokenIndices.add(unit.tokenIndex);
        }
        if (unit.span) {
          const [start, end] = unit.span;
          const slice = sample.text.slice(start, end);
          expect(slice).toBe(unit.surface);
        }
      });

      sample.tokens.forEach((token) => {
        if (typeof token.tokenIndex !== 'number') {
          return;
        }
        const unit = unitByTokenIndex.get(token.tokenIndex);
        expect(unit).toBeDefined();
        if (!unit) {
          return;
        }
        if (typeof token.start === 'number' && typeof token.end === 'number') {
          expect(unit.span).toEqual([token.start, token.end]);
        }
      });

      const expectations = sample.expect?.grammarPoints ?? [];
      if (expectations.length === 0) {
        return;
      }

      const unitById = new Map(sentence.units.map(unit => [unit.id, unit]));
      const evidenceByLabel = new Map<string, number[]>();

      sentence.grammarPoints.forEach((point) => {
        const tokenIndices = toSortedNumbers(point.evidenceUnitIds.map(id => unitById.get(id)?.tokenIndex));
        evidenceByLabel.set(point.label, tokenIndices);
      });

      expectations.forEach((expected) => {
        const actual = evidenceByLabel.get(expected.label);
        expect(actual, `missing grammar point: ${expected.label}`).toBeDefined();
        if (!actual) {
          return;
        }
        expect(actual).toEqual([...expected.evidence].sort((a, b) => a - b));
      });
    });
  });
});
