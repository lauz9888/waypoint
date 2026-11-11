# Template validation tooling

A deterministic regression suite for Waypoint's templates. `waypoint-init` copies the pipeline files
in `.claude/` into every adopting project unchanged, and the agents apply the `WAYPOINT:OPTIONAL`
layer blocks at run time from the project's `.waypoint/config.json` — so these checks run on the
templates as they are, and again on every way an agent can read them (each of the eight
combinations of the `BDD`, `STATIC_SPA_DEPLOY` and `STORYBOOK` layers). They also check the shape of
the two project-specific files, `.waypoint/config.json` and `.waypoint/stack.md`.

## What this proves, and what it doesn't

**Proves**, for the pipeline files (`validate-templates.js`): all fifteen are present; none contains
`{{` placeholder syntax or a `<!-- Generator` comment; every `WAYPOINT:OPTIONAL` block is well-formed
(matched start/end, no nesting, a known layer name — `validateOptionalBlocks` in
`lib/template-transform.js`); layer-only text (`test:bdd`, `bdd-test-author`, `deploy-path`,
`test:storybook`, `build-storybook`) sits inside its own layer's block, so a project without the
layer never reads it; under every layer combination, every single-step mention (`Step N`,
`Step Na`) names a step that runs with those layers, and every range or list (`Steps N–M`,
`Step 5/6/7`) names only Waypoint step IDs, at least one of which runs; and each of
`qa-reviewer`/`docs-updater`/`report-generator`/`quality-reporter`'s frontmatter agrees with
`SKILL.md` about which step spawns it.

For `.waypoint/` (`lib/waypoint-config.js`): `templates/waypoint/config.json` and
`examples/throughline/.waypoint/config.json` have every field with a valid value;
`templates/waypoint/stack.md` has every section; throughline's `stack.md` has a non-empty section
for exactly the concerns its layers need, no unknown sections, and no leftover generator comments.
And `examples/throughline/.claude` is a byte-for-byte copy of the templates, as `waypoint-init`
installs it.

**Does not prove:**

- That an agent actually honors the layer blocks, or reads `.waypoint/`, when it runs. The
  templates state the rule in `STANDARDS.md`, `SKILL.md` and every agent; whether a model follows it
  is behavior, not structure. The checks here only prove that what it reads is consistent for every
  layer combination.
- That a `Step N` mention names the step its author *meant*. Numbers are never reassigned, so a
  mention can't drift onto a different step; but a template edit that writes the wrong number in
  the first place (e.g. "Step 12" where the merge step, Step 15, was meant) still passes, because
  Step 12 exists. Catching that needs a reviewer reading the template diff.
- That the prose `waypoint-init` writes into a real project's `.waypoint/stack.md` is *good* —
  accurate framework names, correct file locations, a sensible accessibility-scan call pattern.
  That still needs the judgment `waypoint-init` itself applies (reading the target repo, matching
  `examples/throughline/.waypoint/stack.md`'s level of detail) and, ultimately, human review of
  what it writes. The checks here only prove the right sections exist and are filled in.

## Files

- `lib/template-transform.js` — pure string helpers: `validateOptionalBlocks`,
  `resolveOptionalBlocks` (a file as an agent reads it for a given set of layers), `layerLookup`
  (which layer's block encloses a position), `parseStepHeaders`/`parseStepRef`,
  `findAgentSpawnStep`. A marker wrapped in backticks is treated as quoted text, not a marker. No
  dependencies, no I/O.
- `lib/waypoint-config.js` — `validateConfig` and `validateStack`, the checks for
  `.waypoint/config.json` and `.waypoint/stack.md`. Same no-dependency, no-I/O style.
- `validate-templates.js [dir]` — runs the pipeline-file checks above against `dir` (default: this
  repo's `.claude/`).
- `run-fixture-tests.js` — the test entry point (`node scripts/run-fixture-tests.js`, no arguments,
  no dependencies to install). Validates the `.claude/` templates, the `.waypoint/` templates, and
  `examples/throughline` (its `.waypoint/` files, and that its `.claude/` is an exact copy).

## Running it

```
node scripts/run-fixture-tests.js
```

No `npm install` — everything here is Node built-ins only (`fs`/`path`), deliberately, since this
repo isn't itself an npm project. `.github/workflows/validate-templates.yml` runs this on every
push/PR.

## After changing a template

If you edit a pipeline file under `.claude/`, copy it to `examples/throughline/.claude/` at the same
path — throughline's copy must stay identical, the same as any adopting project after it updates —
then re-run `node scripts/run-fixture-tests.js`.
