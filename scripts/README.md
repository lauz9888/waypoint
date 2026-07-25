# Template validation tooling

A deterministic regression suite for the *mechanical* parts of what `waypoint-init` does —
placeholder substitution, `WAYPOINT:OPTIONAL` layer resolution, generator-comment stripping, and
`SKILL.md` step renumbering (including cross-file "Step N" references in agent frontmatter and
`STANDARDS.md`). It exists because that transformation logic was previously entrusted entirely to
an LLM's reasoning with no automated check that all four generated pipeline variants (BDD ×
static-deploy, each on/off) come out internally consistent.

## What this proves, and what it doesn't

**Proves:** no `{{placeholder}}` or `WAYPOINT:` marker survives generation; every `WAYPOINT:OPTIONAL`
block in the source templates is well-formed before generation even starts (matched start/end, no
nesting, a known layer name — `validateOptionalBlocks` in `lib/template-transform.js`); the right
agent-file set exists per enabled layer (`bdd-test-author.md` present only when BDD is on); every
`Step N` / `Steps N–M` / `Step Na` reference — in `SKILL.md` and every other generated file —
**resolves to a step number that exists** as a header, and the step sequence is contiguous with no
gaps; each of `qa-reviewer`/`docs-updater`/`report-generator`/`quality-reporter`'s frontmatter
agrees with `SKILL.md` about which step actually spawns it; disabled-layer script/label mentions
(`test:bdd`, `deploy-path`) are absent when off and present when on.

**Does not prove:**

- That a `Step N` reference still means the *same thing* it meant before renumbering. The check
  is existence, not identity: if an edit accidentally leaves a stale reference to a step number
  that used to mean one thing, and renumbering happens to reassign that same number to a
  *different* surviving step, the reference now silently points at the wrong concept — a plain
  "does Step 6 exist?" check can't tell the difference, because after renumbering it genuinely
  does exist, just not as what the sentence meant. Nothing here currently catches that; it would
  need either annotating each cross-reference with what it's semantically pointing at (e.g.
  symbolic markers like `{{STEP:QA}}` resolved to a number at generation time, instead of writing
  raw numbers that have to survive renumbering unchanged) or a reviewer reading the diff by eye.
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
  `computeStepRenumberMap`/`applyStepRenumberMap`, `findAgentSpawnStep`). No dependencies, no
  I/O — pure string-in, string-out functions, unit-testable in isolation if this ever grows real
  tests of its own.
- `generate-fixture.js <config.json> <outputDir>` — runs the templates in `.claude/` through the
  transform pipeline for one layer/values combination and writes the result.
- `validate-templates.js <dir> <config.json>` — runs every structural check above against an
  already-concrete `.claude/`-shaped directory (a generated fixture, or `examples/throughline/.claude`).
- `run-fixture-tests.js` — the actual test entry point (`node scripts/run-fixture-tests.js`, no
  arguments, no dependencies to install). For each of the three synthetic fixture configs under
  `test/fixtures/configs/`, regenerates fresh into a temp dir and diffs it against the committed
  copy under `test/fixtures/<name>/` (this diff is what catches "a template changed but the
  fixture was never regenerated" — the actual regression it's there to catch), then structurally
  validates the committed copy. Separately, structurally validates `examples/throughline/.claude`
  directly — the fourth combination (BDD + static-deploy both on), never regenerated since its
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
```

then re-run `node scripts/run-fixture-tests.js` to confirm everything's still structurally valid,
and commit the regenerated fixture files alongside your template change.
