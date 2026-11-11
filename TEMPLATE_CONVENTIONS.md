# Template conventions

The pipeline lives in the Waypoint plugin, `plugins/waypoint/`: its skills (`skills/`), agents
(`agents/`), shared rules (`STANDARDS.md`) and the templates `/waypoint:init` starts a project from
(`templates/`). The repo root's `.claude-plugin/marketplace.json` publishes it. None of the plugin's
files is specific to one project: everything that differs between projects — including which
optional layers are on — lives in the adopting project's `.waypoint/` directory, which the agents
read while they run. `/waypoint:init` writes `.waypoint/` from what it detects and confirms.
`examples/throughline/` is a worked example: the project this pipeline was extracted from, with its
real `.waypoint/` and the `.claude/settings.json` that shares the plugin with its collaborators.

## Plugin paths and names

- A file inside the plugin is referenced as `${CLAUDE_PLUGIN_ROOT}/<path>` (e.g.
  `${CLAUDE_PLUGIN_ROOT}/STANDARDS.md`). Claude Code substitutes the installed location when it
  loads a skill or agent, so agents read it with their file tools. The variable isn't set in the
  Bash environment, so never use it inside a shell command.
- Plugin components are namespaced: skills are `/waypoint:<skill>` and agents are spawned as
  `subagent_type="waypoint:<agent>"`. An agent's frontmatter `name` stays unprefixed.
- Plugin agents ignore the `permissionMode`, `hooks`, `mcpServers` and `initialPrompt` frontmatter
  fields, so don't rely on them.
- Bump `version` in `plugins/waypoint/.claude-plugin/plugin.json` for every release — installed
  copies stay on the version they have until it changes. Even then, Claude Code only fetches it
  automatically where the marketplace has auto-update on: the `.claude/settings.json`
  `/waypoint:init` writes sets `autoUpdate` for that reason; anyone else updates by hand.

## `.waypoint/config.json`

Every project-specific value, as JSON (shape: `plugins/waypoint/templates/config.json`; checked by
`scripts/lib/waypoint-config.js`). The plugin refers to a field by name — e.g. "`coverage.branches`
from `.waypoint/config.json`" — and never repeat its value.

| Field                  | Meaning                                    | throughline's value                          |
| ---------------------- | ------------------------------------------- | --------------------------------------------- |
| `schemaVersion`        | Version of this file's shape                | `1`                                           |
| `project.name`         | The adopting repo's name                    | `throughline`                                 |
| `project.summary`      | One-line description of the app and its deploy target | "A Vite-built PWA deployed to GitHub Pages under /throughline/" |
| `packageManager`       | Command used to run package scripts — written `<pm>` in template commands | `npm`                  |
| `packageExec`          | Command used to run a package binary directly — written `<pm-exec>` | `npx`                       |
| `runtimeVersion`       | Pinned language/runtime version             | `Node 22`                                     |
| `layers`               | Which optional layers are on (see below)    | `BDD`, `STATIC_SPA_DEPLOY` and `STORYBOOK` all on |
| `coverage.statements`  | Minimum combined statement-coverage %       | `90`                                          |
| `coverage.branches`    | Minimum combined branch-coverage %          | `90`                                          |
| `wcagTags`             | WCAG conformance tags every automated scan is scoped to | `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]` |
| `releaseReportCadence` | How many successful releases to live between automatic periodic quality reports | `10` |

## `.waypoint/stack.md`

The project's stack facts — prose no single value can capture. One `## <section>` per concern:
`test-frameworks` (one line naming each layer's framework); `unit-test`, `bdd-test`, `e2e-test` and
`storybook-test` (framework, file locations and naming, run command, and the accessibility-scanning
tool with the exact call pattern to follow); and `coverage` (the per-layer coverage
instrumentation plan: provider, primary/secondary role, output path, shared exclusions). Agents look
sections up by heading, so the headings are fixed; a disabled layer's section is left out.
`/waypoint:init` writes it from `plugins/waypoint/templates/stack.md`'s generator comments, in the
voice and level of detail of `templates/stack.example.md` — a copy of
`examples/throughline/.waypoint/stack.md`, kept identical by the tests (e.g. its `unit-test` section names
Vitest, the `src/<module>.test.ts` file locations, `vitest.setup.ts`'s `jest-axe` wiring, and the
exact `axe()` call pattern).

## Optional layers

```
<!-- WAYPOINT:OPTIONAL:<layer> -->
...content...
<!-- WAYPOINT:END -->
```

Everything between the markers applies only when the adopting project's `.waypoint/config.json`
has `layers.<layer>` set to `true`. The markers stay in every installed copy: the agents apply them
at run time, reading a disabled layer's block as if it weren't there (the rule is stated in
`STANDARDS.md`'s "Project configuration" section, in `SKILL.md`'s conventions, and in each
agent's configuration line). Blocks can sit mid-sentence; they can't nest. A marker quoted in
backticks (`` `<!-- WAYPOINT:END -->` ``) is text, not a marker. Layers in use:

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

`bdd-test-author.md` belongs entirely to the `BDD` layer, so it isn't wrapped in a block: every
project gets the file, and `SKILL.md` only spawns it from inside BDD blocks.

Text that only makes sense with its layer on — a `test:bdd` or `test:storybook` command, the
`deploy-path` label, a mention of `bdd-test-author` — must sit inside that layer's block;
`scripts/validate-templates.js` checks this.

## Step numbers

Step numbers in `SKILL.md` are fixed IDs: every Waypoint project uses the same number for the same
step, and they're never renumbered. A layer's steps sit inside its block and are skipped when it's
off:

| Layer               | Steps skipped when off |
| ------------------- | ---------------------- |
| `BDD`               | 6, 10                  |
| `STORYBOOK`         | 11a                    |
| `STATIC_SPA_DEPLOY` | 13                     |

A mention of several steps (a range like "Steps 9–11" or a list like "Step 5/6/7") means whichever
of them the project runs, so it can name a layer's step from outside that layer's block; a mention
of a single layer step must sit inside the same layer's block. `scripts/validate-templates.js`
checks every mention against all eight layer combinations.

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
