# Template validation tooling

A deterministic regression suite for the *mechanical* parts of what `waypoint-init` does —
placeholder substitution, `WAYPOINT:OPTIONAL` layer resolution, and generator-comment stripping,
plus the step-number rules (`SKILL.md` steps are fixed IDs that generation never renumbers — see
`TEMPLATE_CONVENTIONS.md`'s "Step numbers" section). It exists because that transformation logic was previously entrusted entirely to
an LLM's reasoning with no automated check that the generated pipeline variants (BDD ×
static-deploy × Storybook) come out internally consistent.

## What this proves, and what it doesn't

**Proves:** no `{{placeholder}}` or `WAYPOINT:` marker survives generation; every `WAYPOINT:OPTIONAL`
block in the source templates is well-formed before generation even starts (matched start/end, no
nesting, a known layer name — `validateOptionalBlocks` in `lib/template-transform.js`); the right
agent-file set exists per enabled layer (`bdd-test-author.md` present only when BDD is on); every
`## Step N` header in the generated `SKILL.md` **is the template's step with that same number and
title** (so a renumbered step fails, not just a missing one), in template order, with exactly the
steps of disabled layers absent; every `Step N` / `Step Na` mention in every generated file names
a step that exists, and every range or list (`Steps N–M`, `Step 5/6/7`) names only Waypoint step
IDs, at least one of them present; each of `qa-reviewer`/`docs-updater`/`report-generator`/`quality-reporter`'s frontmatter
agrees with `SKILL.md` about which step actually spawns it; disabled-layer script/label mentions
(`test:bdd`, `deploy-path`, `test:storybook`) are absent when off and present when on.

**Does not prove:**

- That a `Step N` mention names the step its author *meant*. Since numbers are never reassigned,
  a mention can't drift onto a different step through generation; but a template edit that
  writes the wrong number in the first place (e.g. "Step 12" where the merge step, Step 15, was
  meant) still passes, because Step 12 exists. Catching that needs a reviewer reading the
  template diff.
- That a real `{{STACK_FACTS: <layer>}}` block, once `waypoint-init` fills it in with real prose
  about a real stack, is *good* prose — accurate framework names, correct file locations, a
  sensible accessibility-scan call pattern. That still needs the judgment `waypoint-init` itself
  applies (reading the target repo, matching `examples/throughline`'s level of detail) and,
  ultimately, human review of what it generates. This tooling's fixtures fill every `STACK_FACTS`
  block with an obviously-fake stub string (`[[FIXTURE STUB: ...]]`) specifically so nobody
  mistakes it for real output — it's there purely to exercise the mechanical transform, not to
  model what `waypoint-init` should write.
- That `examples/throughline` hasn't semantically drifted from the templates it was extracted
  from — see the next section.

One cosmetic side effect worth knowing about: stripping a disabled `WAYPOINT:OPTIONAL` block
sometimes leaves a stray blank line where the block used to be (the markers themselves are usually
on their own lines). Harmless, not checked by the validator, and not something a real
LLM-driven `waypoint-init` run would leave behind — a script optimized for exactness here, not
prose polish.

## Files

- `lib/template-transform.js` — the transform primitives (`substitutePlaceholders`,
  `resolveStackFacts`, `resolveOptionalBlocks`, `stripGeneratorComments`,
  `parseStepHeaders`/`parseStepRef`, `findAgentSpawnStep`). No dependencies, no
  I/O — pure string-in, string-out functions, unit-testable in isolation if this ever grows real
  tests of its own.
- `generate-fixture.js <config.json> <outputDir>` — runs the templates in `.claude/` through the
  transform pipeline for one layer/values combination and writes the result.
- `validate-templates.js <dir> <config.json>` — runs every structural check above against an
  already-concrete `.claude/`-shaped directory (a generated fixture, or `examples/throughline/.claude`).
- `run-fixture-tests.js` — the actual test entry point (`node scripts/run-fixture-tests.js`, no
  arguments, no dependencies to install). For each of the four synthetic fixture configs under
  `test/fixtures/configs/`, regenerates fresh into a temp dir and diffs it against the committed
  copy under `test/fixtures/<name>/` (this diff is what catches "a template changed but the
  fixture was never regenerated" — the actual regression it's there to catch), then structurally
  validates the committed copy. Separately, structurally validates `examples/throughline/.claude`
  directly — the BDD + static-deploy combination (Storybook off), never regenerated since its
  `STACK_FACTS` prose is real content a script can't reproduce.

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
```

then re-run `node scripts/run-fixture-tests.js` to confirm everything's still structurally valid,
and commit the regenerated fixture files alongside your template change.
