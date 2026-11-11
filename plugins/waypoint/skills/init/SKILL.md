---
name: init
description: Sets up the Waypoint pipeline in the current project — inspects the project's actual stack, confirms the gaps with the user, and writes the project's settings and stack facts to `.waypoint/config.json` and `.waypoint/stack.md` (plus `docs/adr/README.md` and a `.gitignore` entry). Also migrates a project that has an older, copied-in Waypoint pipeline under `.claude/`. Invoke with `/waypoint:init`, no arguments. Run once per project; re-run after a deliberate stack change.
---

You are setting up the Waypoint pipeline in the project in the current working directory. The
pipeline itself — the `/waypoint:ship-feature` and `/waypoint:quality-report` skills, the twelve
`waypoint:*` agents and the shared rules in `${CLAUDE_PLUGIN_ROOT}/STANDARDS.md` — comes from this
plugin and is the same in every project. What you write is everything specific to this project, in
`.waypoint/`, which the agents read while they run. Read the "Project configuration" section of
`${CLAUDE_PLUGIN_ROOT}/STANDARDS.md` before doing anything else: it defines both `.waypoint/` files
and the optional-layer rule.

Your templates are in `${CLAUDE_PLUGIN_ROOT}/templates/`: `config.json` (the config's shape and
defaults), `stack.md` (the stack-facts sections, each with a `<!-- Generator: -->` comment saying
what goes in it), `stack.example.md` (a real project's filled-in `stack.md`, the model for voice and
level of detail), and `adr-README.md`. `stack.example.md` is throughline's: its file paths, module
names, script names and coverage artefact classes are that project's, never defaults for this one —
copy its shape and its level of detail, and take every fact from this repo.

Like `requirements-analyst`, ground every decision in the target repo's actual state before asking
the user anything — inspecting the codebase is cheap, a wrong assumption baked into `.waypoint/` is
not.

## Step 1 — Pre-flight check on the target project

1. **Existing setup.** If `.waypoint/config.json` already exists, this is a re-run (a deliberate
   stack change) — read the existing `.waypoint/` files as your starting point, and ask the user to
   confirm before overwriting them (`AskUserQuestion`: update / abort). Don't silently clobber
   possibly hand-edited settings.
2. **An older, copied-in Waypoint pipeline.** Before the plugin existed, Waypoint was installed by
   copying files into the project's `.claude/`. Check for any of: `.claude/STANDARDS.md`,
   `.claude/skills/ship-feature/SKILL.md`, `.claude/skills/quality-report/SKILL.md`,
   `.claude/skills/waypoint-init/`, and `.claude/agents/<name>.md` for any of the twelve agent names
   in `${CLAUDE_PLUGIN_ROOT}/agents/`. If you find them, they're the best source of this project's
   existing answers: older copies hold the project name, thresholds, WCAG tags, cadence and runtime
   version inline (in `STANDARDS.md`), and each test-author agent's "Stack facts" section holds the
   stack prose `stack.md` needs — read them in Step 2 and carry their content over rather than
   re-deriving it. Remember the file list for Step 4. Where an old copy disagrees with the repo
   itself — a runtime version that doesn't match `engines`, `.nvmrc` or the CI workflow's
   `node-version`, a test path that no longer exists — the repo wins: old copies were written by
   hand and drift. Note each such disagreement for the Step 6 report.

## Step 2 — Inspect the target project

Read what already tells you the stack, rather than asking for everything:

1. `package.json` — `name` (candidate `project.name`), `engines` (candidate `runtimeVersion`),
   `dependencies`/`devDependencies` for test frameworks (`vitest`, `jest`, `@cucumber/cucumber`,
   `@playwright/test`, `cypress`, `jest-axe`, `vitest-axe`, `@axe-core/playwright`, `cypress-axe`,
   `vue-axe`, etc.), and deploy-related packages (`vite-plugin-pwa`, `gh-pages`, a `homepage`
   field).
2. Lockfile presence (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn) for
   `packageManager`; derive `packageExec` from it (npm → `npx`, pnpm → `pnpm exec`, yarn → `yarn`).
3. `.nvmrc` / `engines.node` for the runtime version if `package.json` alone didn't resolve it.
4. Existing test files/directories (`Glob` for `*.test.*`, `**/*.spec.ts`, `features/**/*.feature`
   or equivalent) to confirm a detected framework is actually in use, and to find a concrete
   existing usage example for accessibility scanning if one already exists (the way
   `stack.example.md` cites `src/app.test.ts`/`tests/e2e/home.spec.ts`).
5. Build config (`vite.config.*`, or equivalent) for a non-root base path / static-host deploy
   flag, if any.
6. Existing `README.md` for a one-line description usable as `project.summary`.
7. **Coverage tooling, per layer** — the inputs to the instrumentation plan (the "Coverage
   measurement" section of `${CLAUDE_PLUGIN_ROOT}/STANDARDS.md`). Look for: coverage providers in
   `devDependencies` (`@vitest/coverage-v8`, `@vitest/coverage-istanbul`, `nyc`, `c8`,
   `babel-plugin-istanbul`, `vite-plugin-istanbul`, `@cypress/code-coverage`, `v8-to-istanbul`,
   `istanbul-lib-*`); `coverage` config in the unit runner's config (provider, `include`/`exclude`,
   reporters, output dir); how the e2e layer collects coverage, if at all (Playwright
   `page.coverage`, `window.__coverage__`, a `COVERAGE` env flag in the build config,
   `build.sourcemap`); and whether a `test:coverage:merge` script (and a merge script behind it)
   already exists. Note any known trap you find — V8/`page.coverage` coverage converted over a
   minified production bundle, providers of different kinds whose maps are merged raw with
   `CoverageMap.merge`, instrumentation that would also apply to the normal production build — so
   Step 3 can raise it.
8. Any older copied-in pipeline found in Step 1.2.

## Step 3 — Confirm with the user

Show what you detected and get explicit confirmation/correction rather than assuming silently —
wrong values here reach every agent that reads `.waypoint/`.

1. `AskUserQuestion` (single call, these are genuine either/or decisions; the tool takes at most
   four questions, so ask exactly these three):
   - **Package manager** — your detected value as the recommended option, plus the other two.
   - **Optional layers** — one `multiSelect` question whose options are the three layers below,
     each option's description stating what you detected for it, so the user ticks the layers to
     turn on (anything unticked is off).
   - **Share with collaborators** — whether to add the Waypoint marketplace and plugin to the
     project's committed `.claude/settings.json` (Step 4.5), so anyone who clones the repo and
     trusts the folder is offered the plugin and keeps it up to date automatically. Recommend yes
     for a team repo.

   The three layers:
   - **BDD layer** — on/off. Explain the tradeoff briefly (a separate Gherkin/behavioral layer
     between unit and e2e vs. unit+e2e only) if nothing in the repo already signals an answer
     (e.g. an existing `features/` directory or `@cucumber/cucumber` dependency settles it —
     state your detection and ask them to confirm rather than re-litigating).
   - **Static, path-prefixed deploy** (`STATIC_SPA_DEPLOY` layer) — on/off. Applies to a
     client-only build served under a non-root path (e.g. GitHub Pages under `/reponame/`);
     doesn't apply to a server-rendered app, an API, or a root-path deploy.
   - **Storybook layer** (`STORYBOOK`) — on/off. A component-story layer (stories with
     interaction tests and an accessibility addon, run as a test suite) authored by
     `unit-test-author` alongside unit tests, with its own full-suite step (Step 11a) and CI job.
     Only meaningful for a project with a UI component library; an existing `.storybook/`
     directory or `storybook` dependency settles it — state your detection and ask them to confirm.
2. Plain conversation for anything Step 2 couldn't resolve or that needs a human call: project
   name, `project.summary` (one line), unit/e2e framework names if undetected (plus BDD's and
   Storybook's, if those layers are on), the accessibility-scanning tool for each layer if
   undetected, `runtimeVersion` if undetected, `coverage.statements` (offer the template's 90),
   `coverage.branches` (offer 90; offer a lower floor such as 80 if the project already measures
   branches and sits well below 90, with a note to ratchet it up rather than fail every run from
   day one), `wcagTags` (offer the template's WCAG 2.1 AA set and ask if the project needs a
   different conformance level), and `releaseReportCadence` (offer the template's 10 — how many
   successful releases to live between automatic `quality-reporter` rollups; it can always be
   triggered early by hand via `/waypoint:quality-report` regardless of this number).
3. **Coverage instrumentation plan** — present what Step 2.7 found as a per-layer table
   (layer → provider → primary/secondary → output path), with Waypoint's defaults filled in where
   nothing exists yet: unit (plus Storybook, if on) is primary via the unit runner's own coverage
   provider; BDD is secondary via an Istanbul wrapper around its runner; e2e is secondary via a
   coverage-only, Istanbul-instrumented build (gated on a `COVERAGE=true` env flag so the normal
   build is untouched), never V8 coverage over the minified production bundle. Primary layers seed
   the canonical inventory but don't define it — the merge must still verify it against a disk
   enumeration of the source root and reconcile secondary-only items — so note whether each
   primary provider is configured to report files no test imports. Ask the user to confirm or
   correct it, and to confirm the **coverage exclusions** — the source root, plus files no layer
   should count (bootstrap entry files such as `src/main.ts`, stories, generated code) — as one
   shared list. Start the plan's "Known secondary-only artefact classes" list empty unless the
   project's existing merge script or docs already demonstrate one with concrete evidence — an
   exclusion someone assumed is harmless isn't evidence. Flag every trap Step 2.7 found
   explicitly; if `test:coverage:merge` already exists and does something the plan forbids, say
   the first `/waypoint:ship-feature` should be fixing it (Step 5.2 will measure it).
4. **Older copied-in pipeline**, if Step 1.2 found one: list the files and ask
   (`AskUserQuestion`: remove them / keep them). Recommend removing — the plugin replaces them, and
   keeping them leaves a second, unprefixed `/ship-feature` and set of agents that won't get
   Waypoint updates. Don't diff whole files against the plugin's versions — the plugin has been
   reworded since, so that's mostly noise. Project-specific content lives in a few known places:
   each test-author agent's "Stack facts" section, and `STANDARDS.md`'s coverage instrumentation
   plan, exclusions and known secondary-only artefact classes. Check those, and tell the user
   anything there that your `.waypoint/stack.md` draft doesn't yet carry, so they can decide
   whether to keep it before the copies go.
5. Don't ask about GitHub-as-VCS or the npm-style script-name contract — both are fixed in this
   version of Waypoint; note this to the user rather than presenting it as a choice.

## Step 4 — Write

1. **`.waypoint/config.json`**: write it in the shape of `${CLAUDE_PLUGIN_ROOT}/templates/config.json`,
   with every field set to the value confirmed in Step 3 (`layers` included). Keep
   `schemaVersion` as the template has it.
2. **`.waypoint/stack.md`**: start from `${CLAUDE_PLUGIN_ROOT}/templates/stack.md`. Delete the
   `bdd-test` and `storybook-test` sections if those layers are off, keeping every other `## `
   heading exactly as written. Fill each remaining section following its `<!-- Generator: -->`
   comment, using `${CLAUDE_PLUGIN_ROOT}/templates/stack.example.md` as the model for voice and
   level of detail — the same categories of information (file location/naming convention, run
   command, an accessibility bullet naming the scanning tool and exact call pattern), rewritten for
   the confirmed framework/tool in place of Vitest/Cucumber/Playwright/jest-axe/`@axe-core`. If
   Step 2 found a concrete existing usage example in the target repo, cite it by file path the way
   the example cites `src/app.test.ts`; if the target repo has no tests at a layer yet, say the
   first test file there establishes the pattern. In each accessibility bullet, say where the
   test code keeps the WCAG tags — one shared module, or a constant declared in each file — by
   what the repo actually does (see `STANDARDS.md`'s "WCAG conformance scope"); if no test scans
   yet, say to keep them in one shared place. Write the `coverage` section from the
   instrumentation plan and exclusions confirmed in Step 3.3. Then delete the generator comments.
3. **`docs/adr/README.md`**: copy `${CLAUDE_PLUGIN_ROOT}/templates/adr-README.md` there verbatim,
   unless the project already has one (then leave it alone).
4. **`.gitignore`**: if the target project has one, ensure `.workflow/` is present (append if
   missing, don't touch anything else in the file). If there's no `.gitignore` at all, create one
   containing just `.workflow/`.
5. **`.claude/settings.json`**, only if the user chose to share with collaborators: add (merging
   into the existing file, changing nothing else in it)
   `"extraKnownMarketplaces": {"waypoint": {"source": {"source": "github", "repo": "lauz9888/waypoint"}, "autoUpdate": true}}`
   and `"enabledPlugins": {"waypoint@waypoint": true}`. `autoUpdate` matters: Claude Code doesn't
   auto-update third-party marketplaces by default, so without it every collaborator stays on
   the plugin version they first installed until they update by hand.
6. **Older copied-in pipeline**: if the user chose to remove it in Step 3.4, delete exactly the
   files Step 1.2 listed — nothing else under `.claude/`. Then `Grep` the rest of the repo
   (excluding `.git/`, `node_modules/`, `.workflow/` and `.waypoint/`) for references the removal
   left dangling: `.claude/STANDARDS.md`, `.claude/agents/`, `.claude/skills/`, and the unprefixed
   `/ship-feature` and `/quality-report` commands (now `/waypoint:ship-feature` and
   `/waypoint:quality-report`). Typical hits are CI workflow comments, README, code comments in
   coverage scripts and tests, Storybook config, and ADRs. Don't edit them — list each as
   `file:line` with what it should point to now (the plugin's `STANDARDS.md` section by name,
   `.waypoint/config.json`/`stack.md`, or the prefixed command) for the Step 6 report.

## Step 5 — Validate

Before reporting success:

1. Check `.waypoint/config.json` parses as JSON and has every field the template has, with sensible
   values (percentages 0–100, a positive integer cadence, a non-empty `wcagTags` array), and that
   `.waypoint/stack.md` has a filled-in section for `test-frameworks`, `unit-test`, `e2e-test` and
   `coverage`, plus `bdd-test`/`storybook-test` exactly when those layers are on, with no
   `<!-- Generator` comment left in it.
2. **Coverage baseline**, only if `test:coverage:merge` already exists. It runs every enabled
   layer's suite, so it needs the project's dependencies installed and whatever the layers need at
   run time — e2e and Storybook browsers (e.g. Playwright's Chromium), a database. If they aren't
   there (no `node_modules`, as in a fresh clone or a new worktree), don't install anything on your
   own: ask (`AskUserQuestion`: install and run — `<pm> ci` or the lockfile's equivalent, plus any
   browser install the scripts don't already do / skip the baseline). If skipped, record "baseline
   not run" and why for Step 6, and go on. Otherwise run it once (it may take a while — run it in
   the background) and apply the "Validity checks" and "Investigation signals"
   in `${CLAUDE_PLUGIN_ROOT}/STANDARDS.md` to each layer's `coverage/<layer>/coverage-final.json`
   and the output, the same way `qa-reviewer` does — including enumerating the source root on disk
   yourself and checking every in-scope file is in whatever inventory the existing script produces
   (an existing script that doesn't verify its inventory at all is itself a finding). Don't edit the
   project's code or tests to fix anything here — init only sets the pipeline up. Record the outcome
   for Step 6 in three groups: the statement and branch figures as printed (or "branches not
   reported"); validity failures, each with its objective evidence; and investigation signals,
   each marked explained or unresolved. If a layer fails its command for environmental reasons (no
   browser installed, no database), say so rather than treating it as a validity failure.

Fix anything wrong in the files you wrote before finishing.

## Step 6 — Report

Tell the user what was written (file list), which optional layers are on/off and why, the confirmed
`releaseReportCadence`, the confirmed coverage thresholds and instrumentation plan, the Step 5.2
coverage baseline (or that it wasn't run, and why), whether an older copied-in pipeline was removed
or kept — with every place an old copy disagreed with the repo (Step 1.2) and every dangling
reference Step 4.6 found, recommending a follow-up commit that repoints them — and that
`/waypoint:ship-feature <change request>` is now ready to use (and `/waypoint:quality-report` for an
on-demand rollup any time, without waiting for the cadence). Suggest committing `.waypoint/`,
`docs/adr/`, `.gitignore` and any `.claude/` changes as a first commit before running the pipeline
for real. If the baseline failed any validity check, or `test:coverage:merge` doesn't exist yet,
recommend that the first `/waypoint:ship-feature` run be the measurement change itself (e.g.
`/waypoint:ship-feature make test:coverage:merge meet the Waypoint standards' coverage measurement
section`) — its requirements will carry the calibration requirements — so that every later change
is gated on a real figure, not one that only looks real. Unresolved signals alone don't warrant
that — list them as worth a look, not as blockers.
