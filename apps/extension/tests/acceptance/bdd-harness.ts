import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But'] as const;

export type FeatureStepKeyword = (typeof STEP_KEYWORDS)[number];

export type FeatureStep = {
  keyword: FeatureStepKeyword;
  text: string;
  line: number;
};

export type FeatureScenario = {
  name: string;
  line: number;
  tags: string[];
  steps: FeatureStep[];
};

export type FeatureDocument = {
  name: string;
  filePath: string;
  description: string[];
  scenarios: FeatureScenario[];
};

export type FeatureScenarioHandler = (
  scenario: FeatureScenario,
  feature: FeatureDocument,
) => void | Promise<void>;

type DefineFeatureAcceptanceOptions = {
  featurePath: string;
  metaUrl: string;
  handlers: Record<string, FeatureScenarioHandler>;
};

function parseStep(line: string): { keyword: FeatureStepKeyword; text: string } | null {
  for (const keyword of STEP_KEYWORDS) {
    if (!line.startsWith(`${keyword} `)) {
      continue;
    }

    return {
      keyword,
      text: line.slice(keyword.length).trim(),
    };
  }

  return null;
}

export function parseFeature(source: string, filePath = 'inline.feature'): FeatureDocument {
  const lines = source.split(/\r?\n/);
  const scenarios: FeatureScenario[] = [];
  const scenarioNames = new Set<string>();
  const description: string[] = [];

  let featureName: string | null = null;
  let currentScenario: FeatureScenario | null = null;
  let pendingTags: string[] = [];

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith('#')) {
      return;
    }

    if (line.startsWith('@')) {
      pendingTags = [...pendingTags, ...line.split(/\s+/).filter(Boolean)];
      return;
    }

    if (line.startsWith('Feature:')) {
      if (featureName !== null) {
        throw new Error(`Duplicate Feature declaration in ${filePath}:${lineNumber}`);
      }

      featureName = line.slice('Feature:'.length).trim();
      if (!featureName) {
        throw new Error(`Feature name is missing in ${filePath}:${lineNumber}`);
      }

      currentScenario = null;
      return;
    }

    if (line.startsWith('Scenario:')) {
      if (featureName === null) {
        throw new Error(`Scenario declared before Feature in ${filePath}:${lineNumber}`);
      }

      const scenarioName = line.slice('Scenario:'.length).trim();
      if (!scenarioName) {
        throw new Error(`Scenario name is missing in ${filePath}:${lineNumber}`);
      }

      if (scenarioNames.has(scenarioName)) {
        throw new Error(`Duplicate Scenario "${scenarioName}" in ${filePath}:${lineNumber}`);
      }

      currentScenario = {
        name: scenarioName,
        line: lineNumber,
        tags: pendingTags,
        steps: [],
      };
      pendingTags = [];
      scenarioNames.add(scenarioName);
      scenarios.push(currentScenario);
      return;
    }

    const step = parseStep(line);
    if (step) {
      if (currentScenario === null) {
        throw new Error(`Step declared before Scenario in ${filePath}:${lineNumber}`);
      }

      if (!step.text) {
        throw new Error(`Step text is missing in ${filePath}:${lineNumber}`);
      }

      currentScenario.steps.push({
        ...step,
        line: lineNumber,
      });
      return;
    }

    if (featureName !== null && currentScenario === null) {
      description.push(line);
      return;
    }

    throw new Error(`Unsupported feature syntax in ${filePath}:${lineNumber}: ${line}`);
  });

  if (featureName === null) {
    throw new Error(`Missing Feature declaration in ${filePath}`);
  }

  if (scenarios.length === 0) {
    throw new Error(`Feature "${featureName}" has no scenarios in ${filePath}`);
  }

  const scenarioWithoutSteps = scenarios.find((scenario) => scenario.steps.length === 0);
  if (scenarioWithoutSteps) {
    throw new Error(
      `Scenario "${scenarioWithoutSteps.name}" has no steps in ${filePath}:${scenarioWithoutSteps.line}`,
    );
  }

  return {
    name: featureName,
    filePath,
    description,
    scenarios,
  };
}

export function loadFeature(featurePath: string, metaUrl: string): FeatureDocument {
  const filePath = fileURLToPath(new URL(featurePath, metaUrl));
  const source = readFileSync(filePath, 'utf8');
  return parseFeature(source, filePath);
}

export function defineFeatureAcceptance(options: DefineFeatureAcceptanceOptions) {
  const feature = loadFeature(options.featurePath, options.metaUrl);
  const scenarioNames = new Set(feature.scenarios.map((scenario) => scenario.name));
  const extraHandlers = Object.keys(options.handlers).filter((name) => !scenarioNames.has(name));

  describe(`Feature: ${feature.name}`, () => {
    feature.scenarios.forEach((scenario) => {
      it(`Scenario: ${scenario.name}`, async () => {
        const handler = options.handlers[scenario.name];
        expect(handler).toBeTypeOf('function');
        if (!handler) {
          throw new Error(
            `No acceptance handler registered for "${scenario.name}" in ${feature.filePath}`,
          );
        }

        await handler(scenario, feature);
      });
    });

    it('matches handlers to declared scenarios', () => {
      expect(extraHandlers).toEqual([]);
    });
  });

  return feature;
}
