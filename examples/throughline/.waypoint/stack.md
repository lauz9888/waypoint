# Stack facts

## test-frameworks

Vitest (unit), Cucumber.js (BDD, `.feature` files), and Playwright (e2e).

## unit-test

- Unit tests live alongside source as `*.test.ts`/`*.test.tsx` (or `.js`/`.jsx` if the project isn't on TypeScript), run with `npm run test:unit` (Vitest).
- Match the naming/style/location of any existing test files you find via Grep/Glob before writing new ones. If none exist yet, establish a convention and note it in your final report so later agents follow the same one.
- **Accessibility**: `jest-axe` is wired up (`vitest.setup.ts` registers the `toHaveNoViolations` matcher). For any component/DOM-producing code you're covering, follow the pattern in `src/app.test.ts`: append the rendered root to `document.body`, run `axe(root, { runOnly: { type: 'tag', values: WCAG_TAGS }, rules: { 'color-contrast': { enabled: false } } })` for each meaningfully distinct DOM state (e.g. closed/open), and `expect(results).toHaveNoViolations()`. `WCAG_TAGS` holds `.waypoint/config.json`'s `wcagTags` — use that exact value; don't write a second copy of the literal. Disable `color-contrast` here specifically — jsdom has no real rendering engine and the check throws rather than evaluates; contrast is covered at the e2e layer instead. Remove the `root` from `document.body` in a `finally` afterward so it doesn't leak into later tests.

## bdd-test

- Feature files live under `features/**/*.feature`, step definitions under `features/step_definitions/` (or the equivalent existing location — Grep/Glob for the current convention before assuming). Run with `npm run test:bdd` (Cucumber.js).
- BDD scenarios describe user-observable behavior in Gherkin (Given/When/Then), at a coarser grain than unit tests and typically narrower than full e2e specs (e.g. exercising a component/module's behavior against a scenario without a full browser).
- Match existing conventions (world/context setup, hooks, step phrasing style) before writing new ones. If none exist yet, establish a convention and note it in your final report.
- **Accessibility**: this layer doesn't run automated WCAG scans (that's `jest-axe`/`@axe-core/playwright` at the unit/e2e layers), but where a scenario covers user-observable behavior with an accessibility dimension in `requirements.md` (keyboard operability, focus management, accessible name/role), drive and assert it the same way a screen-reader/keyboard-only user would — e.g. "the add-item button's accessible name is..." in `features/step_definitions/add-item-button.steps.ts` — rather than reaching into implementation details.

## e2e-test

- E2e specs live under `tests/e2e/**/*.spec.ts` (or the equivalent existing location — Grep/Glob for the current convention). Run with `npm run test:e2e` (Playwright); the Playwright config builds/serves the app itself, so you don't need a separate dev server running.
- These specs are also re-run against the live GitHub Pages deployment after merge (CD's `e2e-live` job) — write them so the target base URL is configurable (env var or Playwright config `baseURL`), not hardcoded to `localhost`.
- Match existing conventions (fixtures, helpers, page objects) before writing new ones. If none exist yet, establish a convention and note it in your final report.
- **Accessibility**: `@axe-core/playwright` is installed. For any new or changed page/flow, follow the pattern in `tests/e2e/home.spec.ts` and `tests/e2e/add-item-button.spec.ts`: `new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()`, then `expect(results.violations).toEqual([])`. `WCAG_TAGS` holds `.waypoint/config.json`'s `wcagTags` — use that exact value; don't write a second copy of the literal. Since this runs in a real browser, it's the layer that catches color-contrast violations (deliberately skipped at the unit layer) — scan every meaningfully distinct visible state a real user would reach (e.g. a dropdown/modal in its open state), not just the page at load.

## coverage

throughline was set up before Waypoint recorded a per-layer instrumentation plan, so none is recorded here yet. The first change that touches `test:coverage:merge` or how any layer is instrumented must write this section from what it finds, following `.claude/STANDARDS.md`'s "Coverage measurement" section, and treat its calibration requirements as part of that change.

- Source root and exclusions: not yet recorded.
- Known secondary-only artefact classes: none.
