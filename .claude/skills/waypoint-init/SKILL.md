---
name: waypoint-init
description: Bootstraps a concrete ship-feature pipeline into the current project — `.claude/agents/*.md`, `.claude/skills/ship-feature/SKILL.md`, `.claude/skills/quality-report/SKILL.md`, `.claude/STANDARDS.md`, `docs/adr/README.md` — by inspecting the project's actual stack, confirming the gaps with the user, and filling in Waypoint's templates. Invoke with the path to a local Waypoint checkout, e.g. `/waypoint-init ../waypoint`. Run once per project; re-run only to regenerate after a deliberate stack change.
---

You are bootstrapping the Waypoint `ship-feature` pipeline into the project in the current
working directory (not the Waypoint repo itself — that's the template source, passed in as an
argument). Read `TEMPLATE_CONVENTIONS.md` at the template source root before doing anything else;
it defines every placeholder and marker referenced below.

Like `requirements-analyst`, ground every decision in the target repo's actual state before
asking the user anything — inspecting the codebase is cheap, a wrong assumption baked into a
generated agent file is not.

## Step 1 — Resolve the template source

The invocation should include a path to a local Waypoint checkout (e.g.
`/waypoint-init ../waypoint`). If no path was given, ask for one. Validate it before proceeding:
`<path>/.claude/skills/ship-feature/SKILL.md` and `<path>/TEMPLATE_CONVENTIONS.md` must both
exist — if not, tell the user this doesn't look like a Waypoint checkout and stop.

## Step 2 — Pre-flight check on the target project

`Glob` for `.claude/agents/*.md` and `.claude/skills/ship-feature/SKILL.md` in the current
project. If either already exists, this looks like a re-run (deliberate stack change) rather than
first-time setup — ask the user to confirm before overwriting (`AskUserQuestion`: overwrite /
abort). Don't silently clobber a previously generated, possibly hand-edited, pipeline.

## Step 3 — Inspect the target project

Read what already tells you the stack, rather than asking for everything:

1. `package.json` — `name` (candidate `{{PROJECT_NAME}}`), `engines` (candidate
   `{{RUNTIME_VERSION}}`), `dependencies`/`devDependencies` for test frameworks (`vitest`, `jest`,
   `@cucumber/cucumber`, `@playwright/test`, `cypress`, `jest-axe`, `vitest-axe`,
   `@axe-core/playwright`, `cypress-axe`, `vue-axe`, etc.), and deploy-related packages
   (`vite-plugin-pwa`, `gh-pages`, a `homepage` field).
2. Lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn) for
   `{{PKG_MANAGER}}`; derive `{{PKG_EXEC}}` from it (npm → `npx`, pnpm → `pnpm exec`, yarn →
   `yarn`).
3. `.nvmrc` / `engines.node` for the runtime version if `package.json` alone didn't resolve it.
4. Existing test files/directories (`Glob` for `*.test.*`, `**/*.spec.ts`, `features/**/*.feature`
   or equivalent) to confirm a detected framework is actually in use, and to find a concrete
   existing usage example for accessibility scanning if one already exists (mirrors how
   throughline's own agent files cite `src/app.test.ts`/`tests/e2e/home.spec.ts` as worked
   examples).
5. Build config (`vite.config.*`, or equivalent) for a non-root base path / static-host deploy
   flag, if any.
6. Existing `README.md` for a one-line description usable as `{{APP_STACK_SUMMARY}}`.
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
wrong values here propagate into every generated agent file.

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
   name, `{{APP_STACK_SUMMARY}}` (one line), unit/e2e framework names if undetected (plus BDD's
   and Storybook's, if those layers are on), the accessibility-scanning tool for each layer if undetected,
   `{{RUNTIME_VERSION}}` if undetected, `{{COVERAGE_THRESHOLD}}` (offer 90 as the default Waypoint
   ships with, per `examples/throughline`), `{{BRANCH_COVERAGE_THRESHOLD}}` (offer 90 as the default
   — the value Waypoint's most recent adopter gates on; offer a lower floor such as 80 if the
   project already measures branches and sits well below 90, with a note to ratchet it up rather
   than fail every run from day one), `{{WCAG_TAGS}}` (offer
   `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` as the default — WCAG 2.1 AA — and ask if the
   project needs a different conformance level), and `{{RELEASE_REPORT_CADENCE}}` (offer 10 as the
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
   (Step 6.4 will measure it).
4. Don't ask about GitHub-as-VCS or the npm-style script-name contract — both are fixed for this
   version of Waypoint (see `TEMPLATE_CONVENTIONS.md`'s "Not templatized" section); note this to
   the user rather than presenting it as a choice.

## Step 5 — Generate

For each template file at the source, produce the target project's concrete version:

1. **`.claude/STANDARDS.md`**, **`.claude/skills/ship-feature/SKILL.md`**,
   **`.claude/skills/quality-report/SKILL.md`**, and every **`.claude/agents/*.md`** (including
   `quality-reporter.md`) except `bdd-test-author.md` if the BDD layer is off: read the
   template, then:
   - Substitute every inline `{{PLACEHOLDER}}` with the confirmed value.
   - For each `{{STACK_FACTS: <layer>}}` block: read the matching section in
     `<template-source>/examples/throughline/.claude/agents/<same-file>.md` as a structural
     model — same categories of information (file location/naming convention, run command, a
     note to match existing conventions before inventing new ones, an accessibility bullet naming
     the scanning tool and exact call pattern) — and write fresh prose for the confirmed
     framework/tool in place of Vitest/Cucumber/Playwright/jest-axe/`@axe-core`. If Step 3 found a
     concrete existing usage example in the target repo, cite it by file path the way the
     throughline version cites `src/app.test.ts`; if the target repo has no tests at this layer
     yet, phrase it as establishing the pattern in the first test file, mirroring how the
     throughline agents themselves say "if none exist yet, establish a convention and note it."
   - The `{{STACK_FACTS: coverage}}` block in `STANDARDS.md` has no throughline counterpart (it
     predates it); write it from the instrumentation plan and exclusions confirmed in Step 4.3,
     following the `<!-- Generator note -->` directly above the block for structure.
   - Resolve every `<!-- WAYPOINT:OPTIONAL:<layer> -->...<!-- WAYPOINT:END -->` block: if the
     project has that layer on, keep the content and delete just the two marker lines; if off,
     delete the entire block including its content.
   - Delete any `<!-- Generator: ... -->` or `<!-- Generator note: ... -->` HTML comments — they're
     instructions to you, not content for the generated file.
   - **Never renumber steps.** Step numbers are fixed IDs shared by every Waypoint project (see
     `TEMPLATE_CONVENTIONS.md`'s "Step numbers" section). Removing a disabled layer's step — Steps
     6 and 10 if BDD is off, Step 13 if `STATIC_SPA_DEPLOY` is off, Step 11a if `STORYBOOK` is off
     — leaves a gap in the sequence, by design. Every remaining `## Step N` header and every
     `Step N` mention, in `SKILL.md` and in every other generated file (agent frontmatter such as
     "Invoked... at Step 12", `STANDARDS.md`), stays exactly as the template writes it.
2. **`docs/adr/README.md`**: copy verbatim from the template source — it has no placeholders.
3. **`.gitignore`**: if the target project has one, ensure `.workflow/` is present (append if
   missing, don't touch anything else in the file). If there's no `.gitignore` at all, create one
   containing just `.workflow/`.

## Step 6 — Validate

Before reporting success:

1. `Grep` every file you just wrote for `{{` and `WAYPOINT:` — either match means a placeholder
   or marker survived generation.
2. List every `## Step N` header (including `## Step <N>a`) in the generated `SKILL.md` and
   compare it with the template's: each header must appear in the template with the same number
   and the same title, and the only template headers missing must be the steps of disabled
   layers (see Step 5). A different number or title means something was renumbered — undo it.
3. `Grep` every generated file — `SKILL.md`, `.claude/agents/*.md`,
   `.claude/skills/quality-report/SKILL.md`, `STANDARDS.md` — for `Steps? [0-9]+[a-z]?`. A mention
   of a single step must name a header that exists in the generated `SKILL.md`; a mention of
   several steps (a range like "Steps 9–11" or a list like "Step 5/6/7") may include a disabled
   layer's step, since it means whichever of them exist.

4. **Coverage baseline**, only if `test:coverage:merge` already exists: run it once (it may take
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
`{{RELEASE_REPORT_CADENCE}}`, the confirmed coverage thresholds and instrumentation plan, the
Step 6.4 coverage baseline (if run), and that `/ship-feature <change request>` is now ready to use (and
`/quality-report` for an on-demand rollup any time, without waiting for the cadence). Suggest
committing the generated `.claude/`/`docs/adr/` files as a first commit before running the
pipeline for real. If the baseline failed any validity check, or `test:coverage:merge`
doesn't exist yet, recommend that the first `/ship-feature` run be the measurement change itself
(e.g. `/ship-feature make test:coverage:merge meet STANDARDS.md's coverage measurement section`)
— its requirements will carry the calibration requirements — so that every later change is gated
on a real figure, not one that only looks real. Unresolved signals alone don't warrant that —
list them as worth a look, not as blockers.
