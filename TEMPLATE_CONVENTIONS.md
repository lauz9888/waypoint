# Template conventions

The files under `.claude/` in this repo are **templates**, not a working pipeline — they're
meant to be read and rewritten, once, by a future `waypoint-init` generator (or a human) into a
concrete `.claude/` for an adopting project. `examples/throughline/` holds the original, fully
concrete files this pipeline was extracted from — the worked example to pattern-match against
when filling a template in, especially for prose sections a placeholder can't capture on its own.

## Inline placeholders

`{{PLACEHOLDER_NAME}}` — a single value substituted verbatim wherever it appears.

| Placeholder            | Meaning                                    | throughline's value                          |
| ----------------------- | ------------------------------------------- | --------------------------------------------- |
| `{{PROJECT_NAME}}`      | The adopting repo's name                    | `throughline`                                 |
| `{{APP_STACK_SUMMARY}}` | One-line description of the app and its deploy target | "a Vite-built PWA, deployed to GitHub Pages" |
| `{{PKG_MANAGER}}`       | Command used to run package scripts         | `npm`                                         |
| `{{PKG_EXEC}}`          | Command used to run a package binary directly | `npx`                                       |
| `{{RUNTIME_VERSION}}`   | Pinned language/runtime version             | `Node 20`                                     |
| `{{COVERAGE_THRESHOLD}}`| Minimum combined statement-coverage %       | `90`                                          |
| `{{BRANCH_COVERAGE_THRESHOLD}}` | Minimum combined branch-coverage % | — (throughline predates branch gating; default offered is `90`) |
| `{{WCAG_TAGS}}`         | Array literal of WCAG conformance tags scanned | `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` |
| `{{RELEASE_REPORT_CADENCE}}` | How many successful releases to live between automatic periodic quality reports | `10` |

## Stack-facts blocks

`{{STACK_FACTS: <layer>}}` marks a prose section a placeholder can't fill mechanically — it
names a concrete test framework/tool, file-location convention, and run command for one test
layer (unit, BDD, e2e, Storybook) or for accessibility scanning; `{{STACK_FACTS: coverage}}` in
`STANDARDS.md` is the per-layer coverage instrumentation plan (provider, primary/secondary role,
output path, shared exclusions). The generator writes fresh prose here in
the same voice and level of detail as the matching "Stack facts" section in
`examples/throughline/.claude/agents/*.md` (e.g. `unit-test-author.md`'s block names Vitest,
`*.test.ts`/`*.test.tsx` file locations, `vitest.setup.ts`'s `jest-axe` wiring, and the exact
`axe()` call pattern) — don't leave the placeholder token itself in a finished project.

## Optional layers

```
<!-- WAYPOINT:OPTIONAL:<layer> -->
...content...
<!-- WAYPOINT:END -->
```

Everything between the markers (including the markers) applies only if the adopting project
opted into `<layer>` during setup; otherwise the generator deletes the whole block. Layers in
use:

- `BDD` — the Cucumber/Gherkin-style behavioral layer (Steps 6/10 in `SKILL.md`, the
  `bdd-test-author` agent, and every `test:bdd`/BDD mention elsewhere). Some teams run unit + e2e
  only, with no separate behavioral layer.
- `STATIC_SPA_DEPLOY` — anything specific to a statically-built, client-only app deployed to a
  path-prefixed static host (the base-path smoke check in `SKILL.md` Step 13, PWA
  manifest/service-worker mentions). Doesn't apply to a server-rendered app, an API, or a
  root-path deploy.
- `STORYBOOK` — a component-story test layer (stories with interaction tests and an
  accessibility addon, run headlessly as a test suite): the story-authoring additions to
  `unit-test-author`, the out-of-band Step 11a full-suite/bug loop in `SKILL.md`, the
  `storybook-test` bug label, the `storybook`/`build-storybook`/`test:storybook` scripts, and the
  Storybook-specific metrics in `report-generator`'s metrics block. Only meaningful for projects
  with a UI component library.

`bdd-test-author.md` is entirely conditional on the `BDD` layer — if a project skips it, delete
the file outright rather than leaving an unused agent behind, and drop Steps 6/10 from `SKILL.md`.

## Step numbers

Step numbers in `SKILL.md` are fixed IDs: every Waypoint project uses the same number for the same
step, and generation never renumbers them. Turning a layer off deletes its steps and leaves a gap:

| Layer               | Steps removed when off |
| ------------------- | ---------------------- |
| `BDD`               | 6, 10                  |
| `STORYBOOK`         | 11a                    |
| `STATIC_SPA_DEPLOY` | 13                     |

Every other header and every `Step N` mention, in any file, keeps its number. A mention of several
steps (a range like "Steps 9–11" or a list like "Step 5/6/7") means whichever of them exist in the
project, so it can safely name a disabled layer's step; a mention of a single step must name one
that every project with that text has. A step's number and title together are its identity —
`scripts/validate-templates.js` checks every generated header against the template's, so a step
can't silently come to mean something else.

When adding a step, give it a new ID rather than shifting existing ones: an `a` suffix on the step
it follows (as Steps 11a and 21a do) keeps every existing reference valid. Fixed IDs also keep
`state.md`'s recorded step, and any step a report cites, comparable across projects.

## Not templatized (fixed for v1)

- **GitHub as the VCS/issue tracker.** Every `gh` CLI call in `SKILL.md`/agent files is left
  literal. Abstracting the host is real work with no proven second-host demand yet — a
  deliberate v1 scope cut, not an oversight.
- **The npm script-name contract itself** (`build`, `typecheck`, `lint`, `format`,
  `format:check`, `dev`, `test:unit`, `test:bdd`, `test:e2e`, `test:coverage:merge` — the last
  with a fixed output format, defined in `STANDARDS.md`'s "Coverage measurement" section). This is a
  Waypoint convention every adopting project commits to, independent of which tool implements
  each script — only the tool behind each name and how it's invoked (`{{PKG_MANAGER}}`/
  `{{PKG_EXEC}}`) varies.
- **Accessibility as a default-on concern** for any UI-facing work. The *tooling* named inside
  each `{{STACK_FACTS}}` block varies by framework, but whether to scan for WCAG conformance at
  all isn't an optional layer the way BDD or static-SPA deploy are — Waypoint's premise is
  "reusable workflow for web app development," and a11y is treated as baseline, not opt-in.
