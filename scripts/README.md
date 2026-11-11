# Template validation tooling

A deterministic regression suite for the *mechanical* parts of what `waypoint-init` does —
`WAYPOINT:OPTIONAL` layer resolution and generator-comment stripping, plus the step-number rules
(`SKILL.md` steps are fixed IDs that generation never renumbers — see `TEMPLATE_CONVENTIONS.md`'s
"Step numbers" section) and the shape of the two project-specific files, `.waypoint/config.json`
and `.waypoint/stack.md`. It exists because that transformation logic was previously entrusted
entirely to an LLM's reasoning with no automated check that the generated pipeline variants (BDD ×
static-deploy × Storybook) come out internally consistent.

## What this proves, and what it doesn't

**Proves:** no `{{` placeholder syntax, `WAYPOINT:` marker or generator comment survives
generation; every `WAYPOINT:OPTIONAL` block in the source templates is well-formed before
generation even starts (matched start/end, no nesting, a known layer name —
`validateOptionalBlocks` in `lib/template-transform.js`); the right agent-file set exists per
enabled layer (`bdd-test-author.md` present only when BDD is on); every `## Step N` header in the
generated `SKILL.md` **is the template's step with that same number and title** (so a renumbered
step fails, not just a missing one), in template order, with exactly the steps of disabled layers
absent; every `Step N` / `Step Na` mention in every generated file names a step that exists, and
every range or list (`Steps N–M`, `Step 5/6/7`) names only Waypoint step IDs, at least one of them
present; each of `qa-reviewer`/`docs-updater`/`report-generator`/`quality-reporter`'s frontmatter
agrees with `SKILL.md` about which step actually spawns it; disabled-layer script/label mentions
(`test:bdd`, `deploy-path`, `test:storybook`) are absent when off and present when on.

For `.waypoint/` (`lib/waypoint-config.js`): `templates/waypoint/config.json` and every fixture's
config have every field with a valid value; `templates/waypoint/stack.md` has every section; and
`examples/throughline/.waypoint/stack.md` has a non-empty section for exactly the concerns its
layers need, no unknown sections, and no leftover generator comments.

Because the templates hold no project values, the generated `.claude/` depends only on which layers
are on — so `examples/throughline/.claude` is regenerated and diffed like every other fixture.

**Does not prove:**

- That a `Step N` mention names the step its author *meant*. Since numbers are never reassigned,
  a mention can't drift onto a different step through generation; but a template edit that
  writes the wrong number in the first place (e.g. "Step 12" where the merge step, Step 15, was
  meant) still passes, because Step 12 exists. Catching that needs a reviewer reading the
  template diff.
- That the prose `waypoint-init` writes into a real project's `.waypoint/stack.md` is *good* —
  accurate framework names, correct file locations, a sensible accessibility-scan call pattern.
  That still needs the judgment `waypoint-init` itself applies (reading the target repo, matching
  `examples/throughline/.waypoint/stack.md`'s level of detail) and, ultimately, human review of
  what it writes. The checks here only prove the right sections exist and are filled in.
- That the agents actually read `.waypoint/` when they run. The templates tell them to; whether a
  model follows that is behavior, not structure.

One cosmetic side effect worth knowing about: stripping a disabled `WAYPOINT:OPTIONAL` block
sometimes leaves a stray blank line where the block used to be (the markers themselves are usually
on their own lines). Harmless, not checked by the validator, and not something a real
LLM-driven `waypoint-init` run would leave behind — a script optimized for exactness here, not
prose polish.

## Files

- `lib/template-transform.js` — the transform primitives (`resolveOptionalBlocks`,
  `stripGeneratorComments`, `parseStepHeaders`/`parseStepRef`, `findAgentSpawnStep`). No
  dependencies, no I/O — pure string-in, string-out functions, unit-testable in isolation if this
  ever grows real tests of its own.
- `lib/waypoint-config.js` — `validateConfig` and `validateStack`, the checks for
  `.waypoint/config.json` and `.waypoint/stack.md`. Same no-dependency, no-I/O style.
- `generate-fixture.js <.waypoint/config.json> <outputDir>` — runs the templates in `.claude/`
  through the transform pipeline for that config's layers and writes the result.
- `validate-templates.js <dir> <.waypoint/config.json>` — runs every structural check above against
  an already-concrete `.claude/`-shaped directory (a generated fixture, or
  `examples/throughline/.claude`).
- `run-fixture-tests.js` — the actual test entry point (`node scripts/run-fixture-tests.js`, no
  arguments, no dependencies to install). Validates the `.waypoint/` templates; then, for each of
  the four synthetic fixture configs under `test/fixtures/configs/` and for
  `examples/throughline/.waypoint/config.json`, validates the config, regenerates fresh into a temp
  dir and diffs it against the committed copy (`test/fixtures/<name>/`, or
  `examples/throughline/.claude`) — this diff is what catches "a template changed but the fixture
  was never regenerated", the actual regression it's there to catch — then structurally validates
  the committed copy. throughline's `stack.md` is validated too; the synthetic fixtures have none.

## Running it

```
node scripts/run-fixture-tests.js
```

No `npm install` — everything here is Node built-ins only (`fs`/`path`/`os`), deliberately, since
this repo isn't itself an npm project. `.github/workflows/validate-templates.yml` runs this on
every push/PR.

## After changing a template

If you edit anything under `.claude/` (or the transform logic itself), regenerate the fixtures
before committing:

```
node scripts/generate-fixture.js test/fixtures/configs/bdd-on_static-off.json test/fixtures/bdd-on_static-off
node scripts/generate-fixture.js test/fixtures/configs/bdd-off_static-on.json test/fixtures/bdd-off_static-on
node scripts/generate-fixture.js test/fixtures/configs/bdd-off_static-off.json test/fixtures/bdd-off_static-off
node scripts/generate-fixture.js test/fixtures/configs/bdd-off_static-on_storybook-on.json test/fixtures/bdd-off_static-on_storybook-on
node scripts/generate-fixture.js examples/throughline/.waypoint/config.json examples/throughline/.claude
```

then re-run `node scripts/run-fixture-tests.js` to confirm everything's still structurally valid,
and commit the regenerated fixture files alongside your template change.
