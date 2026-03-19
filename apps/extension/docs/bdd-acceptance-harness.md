# BDD Acceptance Harness

`apps/extension` keeps acceptance coverage inside Vitest and reads `.feature` files through a small local adapter in `tests/acceptance/bdd-harness.ts`. This avoids adding a separate Gherkin runner while still letting feature files drive acceptance cases.

Supported syntax is intentionally small:

- `Feature:`
- `Scenario:`
- step lines starting with `Given`, `When`, `Then`, `And`, or `But`

To add another acceptance case:

1. Add a `.feature` file under `tests/acceptance/features/`.
2. Add a `*.acceptance.test.ts` file under `tests/acceptance/`.
3. Call `defineFeatureAcceptance({ featurePath, metaUrl: import.meta.url, handlers })`.
4. Map each feature `Scenario:` name to a Vitest handler in `handlers`.
5. Run `pnpm --filter @xen/extension test`.

Reference example:

- Feature file: `tests/acceptance/features/content-mode.feature`
- Vitest wiring: `tests/acceptance/content-mode.acceptance.test.ts`
