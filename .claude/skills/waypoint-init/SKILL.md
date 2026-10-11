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
   ships with, per `examples/throughline`), `{{WCAG_TAGS}}` (offer
   `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` as the default — WCAG 2.1 AA — and ask if the
   project needs a different conformance level), and `{{RELEASE_REPORT_CADENCE}}` (offer 10 as the
   default — how many successful releases to live between automatic `quality-reporter` rollups;
   it can always be triggered early by hand via `/quality-report` regardless of this number).
3. Don't ask about GitHub-as-VCS or the npm-style script-name contract — both are fixed for this
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
   - Resolve every `<!-- WAYPOINT:OPTIONAL:<layer> -->...<!-- WAYPOINT:END -->` block: if the
     project has that layer on, keep the content and delete just the two marker lines; if off,
     delete the entire block including its content.
   - Delete any `<!-- Generator: ... -->` or `<!-- Generator note: ... -->` HTML comments — they're
     instructions to you, not content for the generated file.
   - In `SKILL.md` specifically: after removing disabled-layer steps (Step 6 if BDD is off, Step
     13 if `STATIC_SPA_DEPLOY` is off — the `STORYBOOK` layer's Step 11a is an out-of-band "a" step and
     never shifts numbering; it just follows Step 11's new number, e.g. "10a" if BDD is off), first write out an explicit old-step→new-step mapping
     table for yourself (e.g. "5→5, 7→6, 8→7, 9→8, 11→9, 12→10, 14→11, ...") before touching any
     prose — renumbering by feel invites exactly the kind of off-by-one error this table exists
     to prevent. Include Step 21a in the table as "<whatever Post-change report/Step 21 maps
     to>a" (e.g. if Step 21 maps to 18, Step 21a becomes "18a") — it's a fixed addendum
     immediately after Post-change report, not a fixed literal "21a"; see that step's own
     `<!-- Generator note -->` for what else needs updating alongside its header. Then, using
     that table, renumber every remaining `## Step N` header and fix every cross-reference to a
     step number throughout the file — the Pre-authorization section ("Steps 4, 15, or 22"), the
     "Artifacts & state" and "Accessibility" conventions' step mentions, Step 12's routing back to
     "Steps 9–11", Step 14's and Step 18's references to the same range, Step 19's/22's
     back-references to the merge step, the "see Step 21a" mention inside Step 21, the "if Step
     21a triggered..." mention in the final Step 22 summary, and the frontmatter `description`'s
     step count if it names one. Do this by reading the whole file and reasoning about each
     reference against your mapping table, not with a blind find-replace — the numbers appear in
     prose, not a table in the source file itself.
   - **Every other file has step-number references too, not just `SKILL.md`.** Using the same
     mapping table: `qa-reviewer.md`, `docs-updater.md`, `report-generator.md`, and
     `quality-reporter.md`'s frontmatter `description` fields each name the specific step they're
     invoked at ("Invoked... at Step 12/20/21/21a" in the throughline example) — update these to
     match `SKILL.md`'s new numbering (`quality-reporter.md`'s uses the renumbered "<N>a" form).
     Grep every generated file for `Step [0-9]` as a final check that none were missed.
2. **`docs/adr/README.md`**: copy verbatim from the template source — it has no placeholders.
3. **`.gitignore`**: if the target project has one, ensure `.workflow/` is present (append if
   missing, don't touch anything else in the file). If there's no `.gitignore` at all, create one
   containing just `.workflow/`.

## Step 6 — Validate

Before reporting success:

1. `Grep` every file you just wrote for `{{` and `WAYPOINT:` — either match means a placeholder
   or marker survived generation.
2. In `SKILL.md`, list every `## Step N` header (including `## Step <N>a`) and every
   `Step N`/`Steps N–M`/`Step <N>a` mention in the body (`Grep -o 'Steps? [0-9]+[a-z]?(–[0-9]+)?'`
   or equivalent), and check each body mention against your Step 5 mapping table: does it point
   at the step that actually does what the prose says it does? A number that's merely in-range
   (≤ the highest header) can still be wrong — e.g. pointing at the QA step when it meant the
   merge step — so re-derive what each reference is *supposed* to mean from the throughline
   example's original wording, not just check the digit is plausible.
3. `Grep` every generated `.claude/agents/*.md` **and** `.claude/skills/quality-report/SKILL.md`
   for `Step [0-9]` too — frontmatter descriptions carry step references independently of
   `ship-feature/SKILL.md` and are easy to miss (see Step 5's note).

Fix anything wrong before finishing; don't hand the user a pipeline with template syntax or a
dangling/incorrect step reference still in it.

## Step 7 — Report

Tell the user what was created (file list — including `quality-reporter.md` and
`quality-report/SKILL.md`), which optional layers are on/off and why, the confirmed
`{{RELEASE_REPORT_CADENCE}}`, and that `/ship-feature <change request>` is now ready to use (and
`/quality-report` for an on-demand rollup any time, without waiting for the cadence). Suggest
committing the generated `.claude/`/`docs/adr/` files as a first commit before running the
pipeline for real.
