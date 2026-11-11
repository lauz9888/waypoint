# Plugin validation tooling

A deterministic regression suite for the Waypoint plugin (`plugins/waypoint/`). Every adopting
project runs the plugin's same skills and agents, which apply the `WAYPOINT:OPTIONAL` layer blocks at
run time from the project's `.waypoint/config.json` — so these checks run on the plugin's files as
they are, and again on every way an agent can read them (each of the eight combinations of the
`BDD`, `STATIC_SPA_DEPLOY` and `STORYBOOK` layers). They also check the manifests and the shape of
the two project-specific files, `.waypoint/config.json` and `.waypoint/stack.md`.

## What this proves, and what it doesn't

**Proves**, for the marketplace and plugin manifests (`run-fixture-tests.js`): the marketplace has a
kebab-case name, an owner and a plugin list; each listed plugin's source is a `./` path inside the
repo with a `.claude-plugin/plugin.json` whose name matches; versions are `MAJOR.MINOR.PATCH` and
set only in `plugin.json`; and nothing but `plugin.json` sits in a plugin's `.claude-plugin/`. This
is the subset of the schema this repo relies on — `claude plugin validate` is the full check (see
below).

**Proves**, for the plugin's files (`validate-templates.js`): the fifteen pipeline files and the
`init` skill are present; every `${CLAUDE_PLUGIN_ROOT}/<path>` they mention exists in the plugin;
every `subagent_type` they spawn is `waypoint:<one of the twelve agents>`; the pipeline files don't
mention the old copied-into-`.claude/` layout (`.claude/STANDARDS.md`, unprefixed `/ship-feature`);
none contains `{{` placeholder syntax, and no pipeline file a `<!-- Generator` comment; every
`WAYPOINT:OPTIONAL` block is well-formed (matched start/end, no nesting, a known layer name —
`validateOptionalBlocks` in `lib/template-transform.js`); layer-only text (`test:bdd`,
`bdd-test-author`, `deploy-path`, `test:storybook`, `build-storybook`) sits inside its own layer's
block, so a project without the layer never reads it; under every layer combination, every
single-step mention (`Step N`, `Step Na`) in the pipeline files names a step that runs with those
layers, and every range or list (`Steps N–M`, `Step 5/6/7`) names only Waypoint step IDs, at least
one of which runs; and each of `qa-reviewer`/`docs-updater`/`report-generator`/`quality-reporter`'s
frontmatter agrees with `SKILL.md` about which step spawns it.

For `.waypoint/` (`lib/waypoint-config.js`): the plugin's `templates/config.json` and
`examples/throughline/.waypoint/config.json` have every field with a valid value;
`templates/stack.md` has every section; throughline's `stack.md` has a non-empty section for exactly
the concerns its layers need, no unknown sections, and no leftover generator comments; and the
plugin's `templates/stack.example.md` is identical to it. Finally, `examples/throughline/.claude`
holds exactly the `settings.json` `/waypoint:init` writes to share the plugin.

**Does not prove:**

- That the plugin installs and loads. These scripts don't run Claude Code; `claude plugin validate
  plugins/waypoint` and an actual `/plugin install` do.
- That an agent actually honors the layer blocks, or reads `.waypoint/`, when it runs. The
  plugin states the rule in `STANDARDS.md`, `SKILL.md` and every agent; whether a model follows it
  is behavior, not structure. The checks here only prove that what it reads is consistent for every
  layer combination.
- That a `Step N` mention names the step its author *meant*. Numbers are never reassigned, so a
  mention can't drift onto a different step; but an edit that writes the wrong number in the first
  place (e.g. "Step 12" where the merge step, Step 15, was meant) still passes, because Step 12
  exists. Catching that needs a reviewer reading the diff.
- That the prose `/waypoint:init` writes into a real project's `.waypoint/stack.md` is *good* —
  accurate framework names, correct file locations, a sensible accessibility-scan call pattern.
  That still needs the judgment `/waypoint:init` itself applies and, ultimately, human review of
  what it writes. The checks here only prove the right sections exist and are filled in.

## Files

- `lib/template-transform.js` — pure string helpers: `validateOptionalBlocks`,
  `resolveOptionalBlocks` (a file as an agent reads it for a given set of layers), `layerLookup`
  (which layer's block encloses a position), `parseStepHeaders`/`parseStepRef`,
  `findAgentSpawnStep`. A marker wrapped in backticks is treated as quoted text, not a marker. No
  dependencies, no I/O.
- `lib/waypoint-config.js` — `validateConfig` and `validateStack`, the checks for
  `.waypoint/config.json` and `.waypoint/stack.md`. Same no-dependency, no-I/O style.
- `validate-templates.js [pluginDir]` — runs the plugin-file checks above against `pluginDir`
  (default: `plugins/waypoint`).
- `run-fixture-tests.js` — the test entry point (`node scripts/run-fixture-tests.js`, no arguments,
  no dependencies to install). Runs every check above.

## Running it

```
node scripts/run-fixture-tests.js
```

No `npm install` — everything here is Node built-ins only (`fs`/`path`), deliberately, since this
repo isn't itself an npm project. `.github/workflows/validate-templates.yml` runs this on every
push/PR. If you have the Claude Code CLI, also run:

```
claude plugin validate plugins/waypoint --strict
claude plugin validate . --strict
```

## After changing the plugin

Re-run `node scripts/run-fixture-tests.js`. If you changed `examples/throughline/.waypoint/stack.md`,
copy it over `plugins/waypoint/templates/stack.example.md` (the tests check they match). Bump
`version` in `plugins/waypoint/.claude-plugin/plugin.json` when releasing, so installed copies pick
the change up.
