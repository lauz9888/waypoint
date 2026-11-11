# Template conventions

The files under `.claude/` in this repo are **templates**, not a working pipeline. They contain
nothing specific to one project: everything that differs between projects lives in the adopting
project's `.waypoint/` directory, which the agents read while they run. `waypoint-init` writes
`.waypoint/` from what it detects and confirms, and copies `.claude/` with only the optional
layers resolved — so any two projects with the same layers have identical `.claude/` files.
`examples/throughline/` is a worked example: the project this pipeline was extracted from, with
its real `.waypoint/` and the `.claude/` generated for it.

## `.waypoint/config.json`

Every project-specific value, as JSON (shape: `templates/waypoint/config.json`; checked by
`scripts/lib/waypoint-config.js`). Templates refer to a field by name — e.g. "`coverage.branches`
from `.waypoint/config.json`" — and never repeat its value.

| Field                  | Meaning                                    | throughline's value                          |
| ---------------------- | ------------------------------------------- | --------------------------------------------- |
| `schemaVersion`        | Version of this file's shape                | `1`                                           |
| `project.name`         | The adopting repo's name                    | `throughline`                                 |
| `project.summary`      | One-line description of the app and its deploy target | "a Vite-built PWA, deployed to GitHub Pages" |
| `packageManager`       | Command used to run package scripts — written `<pm>` in template commands | `npm`                  |
| `packageExec`          | Command used to run a package binary directly — written `<pm-exec>` | `npx`                       |
| `runtimeVersion`       | Pinned language/runtime version             | `Node 20`                                     |
| `layers`               | Which optional layers are on (see below)    | `BDD` and `STATIC_SPA_DEPLOY` on, `STORYBOOK` off |
| `coverage.statements`  | Minimum combined statement-coverage %       | `90`                                          |
| `coverage.branches`    | Minimum combined branch-coverage %          | `90` (throughline predates branch gating; this is the default offered) |
| `wcagTags`             | WCAG conformance tags every automated scan is scoped to | `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]` |
| `releaseReportCadence` | How many successful releases to live between automatic periodic quality reports | `10` |

## `.waypoint/stack.md`

The project's stack facts — prose no single value can capture. One `## <section>` per concern:
`test-frameworks` (one line naming each layer's framework); `unit-test`, `bdd-test`, `e2e-test` and
`storybook-test` (framework, file locations and naming, run command, and the accessibility-scanning
tool with the exact call pattern to follow); and `coverage` (the per-layer coverage
instrumentation plan: provider, primary/secondary role, output path, shared exclusions). Agents look
sections up by heading, so the headings are fixed; a disabled layer's section is left out.
`waypoint-init` writes it from `templates/waypoint/stack.md`'s generator comments, in the voice and
level of detail of `examples/throughline/.waypoint/stack.md` (e.g. its `unit-test` section names
Vitest, `*.test.ts`/`*.test.tsx` file locations, `vitest.setup.ts`'s `jest-axe` wiring, and the
exact `axe()` call pattern).

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
  each script — only the tool behind each name and how it's invoked (`packageManager`/
  `packageExec`) varies.
- **Accessibility as a default-on concern** for any UI-facing work. The *tooling* named in each
  layer's section of `.waypoint/stack.md` varies by framework, but whether to scan for WCAG conformance at
  all isn't an optional layer the way BDD or static-SPA deploy are — Waypoint's premise is
  "reusable workflow for web app development," and a11y is treated as baseline, not opt-in.
