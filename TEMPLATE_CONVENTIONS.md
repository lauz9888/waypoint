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
| `{{WCAG_TAGS}}`         | Array literal of WCAG conformance tags scanned | `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` |

## Stack-facts blocks

`{{STACK_FACTS: <layer>}}` marks a prose section a placeholder can't fill mechanically — it
names a concrete test framework/tool, file-location convention, and run command for one test
layer (unit, BDD, e2e) or for accessibility scanning. The generator writes fresh prose here in
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

`bdd-test-author.md` is entirely conditional on the `BDD` layer — if a project skips it, delete
the file outright rather than leaving an unused agent behind, and drop steps 6/10 from `SKILL.md`
(renumbering the rest, or leaving gaps and noting them — generator's judgment call).

## Not templatized (fixed for v1)

- **GitHub as the VCS/issue tracker.** Every `gh` CLI call in `SKILL.md`/agent files is left
  literal. Abstracting the host is real work with no proven second-host demand yet — a
  deliberate v1 scope cut, not an oversight.
- **The npm script-name contract itself** (`build`, `typecheck`, `lint`, `format`,
  `format:check`, `dev`, `test:unit`, `test:bdd`, `test:e2e`, `test:coverage:merge`). This is a
  Waypoint convention every adopting project commits to, independent of which tool implements
  each script — only the tool behind each name and how it's invoked (`{{PKG_MANAGER}}`/
  `{{PKG_EXEC}}`) varies.
- **Accessibility as a default-on concern** for any UI-facing work. The *tooling* named inside
  each `{{STACK_FACTS}}` block varies by framework, but whether to scan for WCAG conformance at
  all isn't an optional layer the way BDD or static-SPA deploy are — Waypoint's premise is
  "reusable workflow for web app development," and a11y is treated as baseline, not opt-in.
