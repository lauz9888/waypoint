---
name: waypoint-init
description: Bootstraps the ship-feature pipeline into the current project — the project's settings and stack facts in `.waypoint/config.json` and `.waypoint/stack.md`, plus `.claude/agents/*.md`, `.claude/skills/ship-feature/SKILL.md`, `.claude/skills/quality-report/SKILL.md`, `.claude/STANDARDS.md` and `docs/adr/README.md` — by inspecting the project's actual stack, confirming the gaps with the user, and filling in Waypoint's templates. Invoke with the path to a local Waypoint checkout, e.g. `/waypoint-init ../waypoint`. Run once per project; re-run only to regenerate after a deliberate stack change.
---

You are bootstrapping the Waypoint `ship-feature` pipeline into the project in the current
working directory (not the Waypoint repo itself — that's the template source, passed in as an
argument). Read `TEMPLATE_CONVENTIONS.md` at the template source root before doing anything else;
it defines the `.waypoint/` config fields and the template markers referenced below.

Like `requirements-analyst`, ground every decision in the target repo's actual state before
asking the user anything — inspecting the codebase is cheap, a wrong assumption baked into
`.waypoint/` is not.

## Step 1 — Resolve the template source

The invocation should include a path to a local Waypoint checkout (e.g.
`/waypoint-init ../waypoint`). If no path was given, ask for one. Validate it before proceeding:
`<path>/.claude/skills/ship-feature/SKILL.md`, `<path>/templates/waypoint/config.json` and
`<path>/TEMPLATE_CONVENTIONS.md` must all exist — if not, tell the user this doesn't look like a Waypoint checkout and stop.

## Step 2 — Pre-flight check on the target project

`Glob` for `.waypoint/config.json`, `.claude/agents/*.md` and
`.claude/skills/ship-feature/SKILL.md` in the current project. If any already exists, this looks like a re-run (deliberate stack change) rather than
first-time setup — ask the user to confirm before overwriting (`AskUserQuestion`: overwrite /
abort). Don't silently clobber a previously generated, possibly hand-edited, pipeline.

## Step 3 — Inspect the target project

Read what already tells you the stack, rather than asking for everything:

1. `package.json` — `name` (candidate `project.name`), `engines` (candidate
   `runtimeVersion`), `dependencies`/`devDependencies` for test frameworks (`vitest`, `jest`,
   `@cucumber/cucumber`, `@playwright/test`, `cypress`, `jest-axe`, `vitest-axe`,
   `@axe-core/playwright`, `cypress-axe`, `vue-axe`, etc.), and deploy-related packages
   (`vite-plugin-pwa`, `gh-pages`, a `homepage` field).
2. Lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn) for
   `packageManager`; derive `packageExec` from it (npm → `npx`, pnpm → `pnpm exec`, yarn →
   `yarn`).
3. `.nvmrc` / `engines.node` for the runtime version if `package.json` alone didn't resolve it.
4. Existing test files/directories (`Glob` for `*.test.*`, `**/*.spec.ts`, `features/**/*.feature`
   or equivalent) to confirm a detected framework is actually in use, and to find a concrete
   existing usage example for accessibility scanning if one already exists (mirrors how
   throughline's own agent files cite `src/app.test.ts`/`tests/e2e/home.spec.ts` as worked
   examples).
5. Build config (`vite.config.*`, or equivalent) for a non-root base path / static-host deploy
   flag, if any.
6. Existing `README.md` for a one-line description usable as `project.summary`.
7. **Coverage tooling, per layer** — the inputs to `STANDARDS.md`'s instrumentation plan (its
   "Coverage measurement" section). Look for: coverage providers in `devDependencies`
   (`@vitest/coverage-v8`, `@vitest/coverage-istanbul`, `nyc`, `c8`, `babel-plugin-istanbul`,
   `vite-plugin-istanbul`, `@cypress/code-coverage`, `v8-to-istanbul`, `istanbul-lib-*`); `coverage`
   config in the unit runner's config (provider, `include`/`exclude`, reporters, output dir); how
   the e2e layer collects coverage, if at all (Playwright `page.coverage`, `window.__coverage__`, a
   `COVERAGE` env flag in the build config, `build.sourcemap`); and whether a
   `test:coverage:merge` script (and a merge script behind it) already exists. Note any known trap
   you find — V8/`page.coverage` coverage converted over a minified production bundle, providers
   of different kinds whose maps are merged raw with `CoverageMap.merge`, instrumentation that
   would also apply to the normal production build — so Step 4 can raise it.

## Step 4 — Confirm with the user

Show what you detected and get explicit confirmation/correction rather than assuming silently —
wrong values here reach every agent that reads `.waypoint/`.

1. `AskUserQuestion` (single call, these are genuine either/or decisions):
   - **Package manager** — your detected value as the recommended option, plus the other two.
   - **BDD layer** — on/off. Explain the tradeoff briefly (a separate Gherkin/behavioral layer
     between unit and e2e vs. unit+e2e only) if nothing in the repo already signals an answer
     (e.g. an existing `features/` directory or `@cucumber/cucumber` dependency settles it —
     state your detection and ask them to confirm rather than re-litigating).
   - **Static, path-prefixed deploy** (`STATIC_SPA_DEPLOY` layer) — on/off. Applies to a
     client-only build served under a non-root path (e.g. GitHub Pages under
     `/reponame/`); doesn't apply to a server-rendered app, an API, or a root-path deploy.
   - **Storybook layer** (`STORYBOOK`) — on/off. A component-story layer (stories with
     interaction tests and an accessibility addon, run as a test suite) authored by
     `unit-test-author` alongside unit tests, with its own full-suite step (Step 11a) and CI job.
     Only meaningful for a project with a UI component library; an existing `.storybook/`
     directory or `storybook` dependency settles it — state your detection and ask them to confirm.
2. Plain conversation for anything Step 3 couldn't resolve or that needs a human call: project
   name, `project.summary` (one line), unit/e2e framework names if undetected (plus BDD's
   and Storybook's, if those layers are on), the accessibility-scanning tool for each layer if undetected,
   `runtimeVersion` if undetected, `coverage.statements` (offer 90 as the default Waypoint
   ships with, per `examples/throughline`), `coverage.branches` (offer 90 as the default
   — the value Waypoint's most recent adopter gates on; offer a lower floor such as 80 if the
   project already measures branches and sits well below 90, with a note to ratchet it up rather
   than fail every run from day one), `wcagTags` (offer
   `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` as the default — WCAG 2.1 AA — and ask if the
   project needs a different conformance level), and `releaseReportCadence` (offer 10 as the
   default — how many successful releases to live between automatic `quality-reporter` rollups;
   it can always be triggered early by hand via `/quality-report` regardless of this number).
3. **Coverage instrumentation plan** — present what Step 3.7 found as a per-layer table
   (layer → provider → primary/secondary → output path), with Waypoint's defaults filled in where
   nothing exists yet: unit (plus Storybook, if on) is primary via the unit runner's own coverage
   provider; BDD is secondary via an Istanbul wrapper around its runner; e2e is secondary via a
   coverage-only, Istanbul-instrumented build (gated on a `COVERAGE=true` env flag so the normal
   build is untouched), never V8 coverage over the minified production bundle. Primary layers seed
   the canonical inventory but don't define it — the merge must still verify it against a disk
   enumeration of the source root and reconcile secondary-only items — so note whether each
   primary provider is configured to report files no test imports. Ask the user to
   confirm or correct it, and to confirm the **coverage exclusions** — the source root, plus files
   no layer should count (bootstrap entry files such as `src/main.ts`, stories, generated code) —
   as one shared list. Start the plan's "Known secondary-only artefact classes" list empty unless
   the project's existing merge script or docs already demonstrate one with concrete evidence —
   an exclusion someone assumed is harmless isn't evidence. Flag every trap Step 3.7 found explicitly; if `test:coverage:merge` already
   exists and does something the plan forbids, say the first `/ship-feature` should be fixing it
   (Step 6.3 will measure it).
4. Don't ask about GitHub-as-VCS or the npm-style script-name contract — both are fixed for this
   version of Waypoint (see `TEMPLATE_CONVENTIONS.md`'s "Not templatized" section); note this to
   the user rather than presenting it as a choice.

## Step 5 — Generate

Everything project-specific goes into `.waypoint/`; the `.claude/` files are copied from the
template source unchanged. They're the same in every Waypoint project — the agents read
`.waypoint/` while they run, including which optional layers are on.

1. **`.waypoint/config.json`**: write it in the shape of
   `<template-source>/templates/waypoint/config.json`, with every field set to the value confirmed
   in Step 4 (`layers` included). Keep `schemaVersion` as the template has it.
2. **`.waypoint/stack.md`**: start from `<template-source>/templates/waypoint/stack.md`. Delete the
   `bdd-test` and `storybook-test` sections if those layers are off, keeping every other `## `
   heading exactly as written. Fill each remaining section following its `<!-- Generator: -->`
   comment, using `<template-source>/examples/throughline/.waypoint/stack.md` as the model for
   voice and level of detail — the same categories of information (file location/naming
   convention, run command, an accessibility bullet naming the scanning tool and exact call
   pattern), rewritten for the confirmed framework/tool in place of
   Vitest/Cucumber/Playwright/jest-axe/`@axe-core`. If Step 3 found a concrete existing usage
   example in the target repo, cite it by file path the way throughline's cites
   `src/app.test.ts`; if the target repo has no tests at a layer yet, say the first test file
   there establishes the pattern. Write the `coverage` section from the instrumentation plan and
   exclusions confirmed in Step 4.3. Then delete the generator comments.
3. **`.claude/STANDARDS.md`**, **`.claude/skills/ship-feature/SKILL.md`**,
   **`.claude/skills/quality-report/SKILL.md`**, and every **`.claude/agents/*.md`** (all twelve,
   `bdd-test-author.md` included whatever the BDD layer's setting): copy each one byte for byte.
   Don't resolve the `<!-- WAYPOINT:OPTIONAL:<layer> -->...<!-- WAYPOINT:END -->` blocks or
   renumber anything — the agents apply the blocks at run time from `layers` (see
   `TEMPLATE_CONVENTIONS.md`'s "Optional layers" section), and an identical copy is what lets a
   later Waypoint update replace these files without touching the project's own settings.
4. **`docs/adr/README.md`**: copy verbatim from the template source.
5. **`.gitignore`**: if the target project has one, ensure `.workflow/` is present (append if
   missing, don't touch anything else in the file). If there's no `.gitignore` at all, create one
   containing just `.workflow/`.

## Step 6 — Validate

Before reporting success:

1. Check `.waypoint/config.json` parses as JSON and has every field the template has, and that
   `.waypoint/stack.md` has a filled-in section for `test-frameworks`, `unit-test`, `e2e-test` and
   `coverage`, plus `bdd-test`/`storybook-test` exactly when those layers are on, with no
   `<!-- Generator` comment left in it.
2. Diff every file you copied in Step 5.3–5.4 against its template — each must be identical.

3. **Coverage baseline**, only if `test:coverage:merge` already exists: run it once (it may take
   a while — run it in the background) and apply `STANDARDS.md`'s "Validity checks" and
   "Investigation signals" to each layer's `coverage/<layer>/coverage-final.json` and the output,
   the same way `qa-reviewer` does — including enumerating the source root on disk yourself and
   checking every in-scope file is in whatever inventory the existing script produces (an
   existing script that doesn't verify its inventory at all is itself a finding). Don't edit the
   project's code or tests to fix anything here — init only generates the pipeline. Record the
   outcome for Step 7 in three groups: the statement and branch figures as printed (or "branches
   not reported"); validity failures, each with its objective evidence; and investigation
   signals, each marked explained or unresolved. If a layer fails its command for environmental
   reasons (no browser installed, no database), say so rather than treating it as a validity
   failure.

Fix anything wrong before finishing; don't hand the user a pipeline with template syntax or a
dangling/incorrect step reference still in it.

## Step 7 — Report

Tell the user what was created (file list — including `quality-reporter.md` and
`quality-report/SKILL.md`), which optional layers are on/off and why, the confirmed
`releaseReportCadence`, the confirmed coverage thresholds and instrumentation plan, the
Step 6.3 coverage baseline (if run), and that `/ship-feature <change request>` is now ready to use (and
`/quality-report` for an on-demand rollup any time, without waiting for the cadence). Suggest
committing the generated `.waypoint/`, `.claude/` and `docs/adr/` files as a first commit before running the
pipeline for real. If the baseline failed any validity check, or `test:coverage:merge`
doesn't exist yet, recommend that the first `/ship-feature` run be the measurement change itself
(e.g. `/ship-feature make test:coverage:merge meet STANDARDS.md's coverage measurement section`)
— its requirements will carry the calibration requirements — so that every later change is gated
on a real figure, not one that only looks real. Unresolved signals alone don't warrant that —
list them as worth a look, not as blockers.
