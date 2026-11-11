# Stack facts

<!-- Generator: this file is the project's stack-specific prose, read by the pipeline's agents
     at run time (see .claude/STANDARDS.md's "Project configuration" section). Keep every `## `
     heading below exactly as written — agents look sections up by name. Write each section in the
     same voice and level of detail as examples/throughline/.waypoint/stack.md. Delete the section
     of any optional layer the project doesn't use (bdd-test, storybook-test). Cite a concrete
     existing file as the example to follow wherever the repo has one; where it doesn't, say the
     first test at that layer establishes the convention. -->

## test-frameworks

<!-- Generator: one line naming each enabled layer's framework, e.g. "Vitest (unit), Cucumber.js
     (BDD, `.feature` files), and Playwright (e2e)". -->

## unit-test

<!-- Generator: the unit test framework, where test files live and how they're named, the run
     command, and — for any component/DOM-producing code — the accessibility-scanning tool and
     exact call pattern to follow (with a reference file/line once one exists). -->

## bdd-test

<!-- Generator: BDD layer only. The BDD framework, where feature files/step definitions live, the
     run command, and how this layer handles accessibility-dimension scenarios (it typically
     doesn't run automated WCAG scans itself — those live at the unit/e2e layers — but should
     still drive and assert keyboard/focus/accessible-name behavior the way a real assistive-tech
     user would). -->

## e2e-test

<!-- Generator: the e2e framework, where specs live, the run command, and the accessibility-
     scanning tool/exact call pattern to follow (with a reference file/line once one exists — this
     layer runs in a real browser, so it's the layer that catches color-contrast violations
     deliberately skipped at the unit layer; scan every meaningfully distinct visible state a real
     user would reach, not just the page at load). If the app is redeployed to a live URL
     post-merge, also note that specs must read their target base URL from config/env rather than
     hardcoding localhost. -->

## storybook-test

<!-- Generator: STORYBOOK layer only. Where story files live (typically co-located next to the
     component they cover, not under the test directory) and how they're named, how a story mocks
     the same dependencies as the sibling component unit tests and seeds per-story state, the run
     command for the story test runner, and the Storybook-layer accessibility addon and how it's
     scoped to the WCAG tags in .waypoint/config.json. -->

## coverage

<!-- Generator: the coverage instrumentation plan .claude/STANDARDS.md's "Coverage measurement"
     section relies on. Write one bullet per enabled layer naming (a) the coverage provider and how
     it's switched on (e.g. "`@vitest/coverage-v8` via `vitest run --coverage`", "nyc around
     cucumber-js", "a `COVERAGE=true` build instrumented with `vite-plugin-istanbul`, counters read
     from `window.__coverage__`"), (b) the output path `coverage/<layer>/coverage-final.json`, (c)
     whether the layer is **primary** (seeds the canonical inventory — normally unit, plus
     Storybook if on) or **secondary** (credits hits; its unmatched items are reconciled), and (d)
     for primary layers, the provider setting that makes it report files no test imports (e.g.
     Vitest's `coverage.include` over the whole source root) — without it, untested files are
     simply absent. Then one line listing source root and exclusions agreed at setup (bootstrap
     entry files, stories, generated code), stated as the single list every layer's config and
     the merge script must share. Then a "Known secondary-only artefact classes" list — start it
     empty unless setup found concrete evidence of one; entries are added only by a change that
     demonstrated them. Call out explicitly when a layer's current setup is a known trap:
     V8/`page.coverage` converted over a minified production bundle (produces flat, whole-script
     coverage — use an Istanbul-instrumented coverage-only build instead, never instrumenting the
     normal production build), or providers whose locations disagree (needs the
     canonical-inventory combining rule in STANDARDS.md). If the project has no coverage tooling
     yet, state the recommended provider per layer as the plan the first `test:coverage:merge`
     change must follow. -->
