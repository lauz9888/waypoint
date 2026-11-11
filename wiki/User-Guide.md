# User Guide — Adopting Waypoint in Your Project

A step-by-step walkthrough for bringing the Waypoint pipeline into your own project. If you want
to understand *why* the pipeline is shaped the way it is first, read the
[Workflow Overview](Workflow-Overview) — this page assumes you just want to get it running.

## Prerequisites

Before you start, make sure you have:

- **Claude Code**, with plugin support (`/plugin` works in a session).
- **A git repository for your project** — new or established, doesn't matter. Waypoint scaffolds
  missing pieces (test setup, npm scripts) if your project doesn't have them yet.
- **A GitHub repository, with the [`gh` CLI](https://cli.github.com/) installed and authenticated**
  (`gh auth status` should show you logged in). The pipeline drives branches, PRs, issues, and
  Actions entirely through `gh` — this is not optional in the current version.
- **An npm-, pnpm-, or yarn-based JS/TS project.** The pipeline assumes a package-script contract
  (`build`, `typecheck`, `lint`, `test:unit`, `test:e2e`, `test:coverage:merge`, etc.) — if some of
  these scripts don't exist yet, the pipeline creates them as part of your first change, but the
  project needs to be a `package.json`-based JS/TS project for that to make sense.

## Step 1 — Install the plugin

Waypoint is a Claude Code plugin, published from its GitHub repository, which doubles as a plugin
marketplace. In a Claude Code session, add the marketplace and install the plugin:

```
/plugin marketplace add lauz9888/waypoint
/plugin install waypoint@waypoint
```

(From a terminal instead: `claude plugin marketplace add lauz9888/waypoint`, then
`claude plugin install waypoint@waypoint`.) This gives you three skills —
`/waypoint:init`, `/waypoint:ship-feature` and `/waypoint:quality-report` — and the twelve
`waypoint:*` subagents the pipeline drives. Nothing is copied into your project: the same plugin
serves every project you use it in, and updates reach all of them at once.

## Step 2 — Run the setup skill

From inside your project (with Claude Code open there), run:

```
/waypoint:init
```

No arguments. If your project was set up with an older version of Waypoint that copied the
pipeline into `.claude/`, `/waypoint:init` finds those files, reuses what they already say about
your stack, and offers to remove them.

## Step 3 — Answer the setup interview

`/waypoint:init` reads your project first — `package.json`, your lockfile, any existing test files,
your README — and only asks about what it can't figure out on its own. Expect these kinds of
questions:

1. **A handful of yes/no or multiple-choice questions**, presented together, for things that are
   genuinely either/or:
   - Which package manager (it'll recommend whatever your lockfile implies).
   - Whether to enable the **BDD** layer (a separate Gherkin/behavioral test layer) — off by
     default unless it detects Cucumber already in use.
   - Whether to enable the **static, path-prefixed deploy** layer — relevant only if you're
     shipping a client-only build to a non-root path like GitHub Pages; off for anything
     server-rendered or deployed at the root.
   - Whether to enable the **Storybook** layer (component stories run as interaction +
     accessibility tests) — off by default unless it detects Storybook already in use.
   - Whether to **share the plugin with collaborators** by enabling it in your project's committed
     `.claude/settings.json` — recommended for a team repo.
2. **A short conversational back-and-forth** for anything left over: your project's one-line
   description, which test frameworks you use (if not auto-detected), your statement and branch
   coverage thresholds (90% each is the default), and the WCAG conformance level to scan for
   (WCAG 2.1 AA by default).
3. **Your coverage instrumentation plan** — a per-layer table of which tool measures coverage for
   each test layer, which layer defines the set of statements being counted, and which files are
   excluded. `/waypoint:init` fills in what it detected and proposes safe defaults for the rest
   (for example, measuring e2e coverage from a separate instrumented build rather than the
   minified production bundle, which silently reports every line as covered). If your project
   already has `test:coverage:merge`, it runs it once and tells you whether the figure is valid —
   and if not, recommends making the measurement fix your first `/waypoint:ship-feature`.

You don't need to have answers ready in advance — if something's detectable from your repo,
`/waypoint:init` will tell you what it found and just ask you to confirm.

## Step 4 — Review what was written

`/waypoint:init` writes only what's specific to your project:

| Path | What it is |
|---|---|
| `.waypoint/config.json` | Your project's settings: name and one-line summary, package manager, runtime version, which optional layers are on, coverage thresholds, WCAG tag scope, and quality-report cadence — the one place to change them later. |
| `.waypoint/stack.md` | Your stack facts in prose: each test layer's framework, file locations, run command and accessibility-scanning pattern, plus how coverage is measured per layer. Every test-writing agent follows it. |
| `docs/adr/README.md` | The convention for Architecture Decision Records the solution-designer agent uses when a change warrants one (left alone if you already have one). |
| `.gitignore` | Updated (or created) to exclude `.workflow/`, the pipeline's local scratch state. |
| `.claude/settings.json` | Only if you chose to share the plugin: the Waypoint marketplace and `waypoint@waypoint` enabled, merged into your existing settings. |

The pipeline itself lives in the plugin: the `ship-feature` orchestrator (steps belonging to a layer
you didn't enable are marked in it and skipped when it runs; step numbers never change, so a run
without BDD goes from Step 5 to Step 7), the twelve subagents, the `quality-report` trigger, and the
`STANDARDS.md` rules every agent shares — the trust boundary, how coverage is measured and
validated, requirements traceability, and the security checklist.

Read `.waypoint/stack.md` closely — it's the prose `/waypoint:init` wrote about your stack. No
`<!-- Generator` comments should remain in it (`/waypoint:init` checks this itself before
finishing). Both `.waypoint/` files are yours: edit them freely, same as any other file in your
repo.

## Step 5 — Commit the setup

```bash
git add .waypoint/ docs/adr/ .gitignore .claude/settings.json
git commit -m "Adopt the Waypoint pipeline"
```

(Leave `.claude/settings.json` out if you didn't share the plugin.) Do this before running the
pipeline for real, so you have a clean point to diff against if you ever want to see what a
`/waypoint:ship-feature` run changed versus what setup produced.

## Step 6 — Ship your first change

```
/waypoint:ship-feature <describe the change you want>
```

Here's what to expect, in order:

1. **Requirements.** A requirements analyst reads your codebase and drafts a numbered,
   testable `requirements.md`. It may ask you clarifying questions first. When it's done, **you
   review and approve it** — this is the first point you're actually asked to act.
2. **Design (automatic).** A solution is designed and reviewed against your requirements in the
   background. You're not asked to approve this step — a dedicated reviewer agent is the check —
   but you'll see it happen.
3. **Tests, written red.** Unit (and BDD/e2e/Storybook, per your enabled layers) tests get written for
   behavior that doesn't exist yet, each tagged with its purpose (a requirement, a documented risk,
   or a regression) and covering the relevant negative and boundary cases, and confirmed to fail for
   the right reason. Implementation doesn't start until every requirement has a test. If an agent
   finds your requirements ambiguous along the way, it asks rather than guessing — you're only
   brought back in when the answer would change what the software visibly does.
4. **Implementation.** Code gets written to the approved design and requirements — the red tests
   are immediate, executable evidence it got there, not the whole definition of "done" — while
   staying scoped to what the design actually describes.
5. **Full suites + auto-fixing.** Every test suite runs in full; any failure becomes a GitHub issue
   and gets fixed automatically, looping until green.
6. **Quality gates.** A QA review traces every requirement to the code and test that satisfy it,
   challenges whether the tests would actually catch a plausible wrong implementation, lists any
   significant risks left unresolved, and checks code quality, security hygiene, accessibility, and
   combined statement and branch coverage against your thresholds — after first checking the
   figure is valid: no double counting across layers, no non-code lines counted, and every source
   file actually in the count (checked against the files on disk, not just whatever the test
   tools happened to report). If anything's short, it loops back to add coverage or fix gaps —
   automatically. A provably broken measurement blocks the gate; a merely suspicious one (say,
   every line in a file hit exactly once) is investigated, and if it can't be explained it's
   filed as a non-blocking `coverage-investigation` issue rather than stopping your change.
7. **Manual testing.** The app starts locally and **you're given a URL to test yourself** — the
   second and last point you're asked to act. You're shown an assurance summary first (coverage,
   requirements verified, unresolved risks) so you know where to focus, and your decision is
   recorded either way — what you tested, or why you skipped it. If something's wrong, it gets classified before
   routing — an implementation defect goes to bug-fixing and re-test as you'd expect, but a wrong
   or missing test, a design gap, or a requirement that turns out to be wrong route differently
   (the last one reopens requirements approval rather than being force-fit as a "bug"). You may be
   asked which one it is if it's not obvious from how you describe it. Or just confirm it looks
   right and move on.
8. **Merge and ship.** The branch merges via PR, CI/CD run and are watched automatically (CI
   failures are auto-fixed and retried; a CD failure is logged for you, not auto-fixed, and the
   change is recorded as merged-but-not-live rather than shipped). Docs get reconciled against what
   actually shipped, and a report lands in `reports/` leading with that assurance summary, then
   requirement-level assurance, residual risks, solution, every bug raised and how it was
   resolved, and total time taken — both land together as one small
   housekeeping PR (not a direct push to `main`), which auto-merges if your repo allows it or waits
   for you to merge it by hand otherwise.

A run can take anywhere from minutes to a couple of hours depending on how much back-and-forth
happens at the two human gates and how many bug-fix cycles are needed — the final report's time
total includes that human wait time explicitly, so it isn't mistaken for pure engineering effort.

If you close Claude Code partway through, just run `/waypoint:ship-feature` again later with no new
request — it'll find the in-progress run and resume from where it left off.

## Periodic quality reports

Beyond the per-run report in `reports/`, Waypoint keeps a rolling view of how the pipeline is
performing over time. See [Workflow Overview](Workflow-Overview#periodic-quality-reporting) for
exactly what each metric means and how it's computed — this section is about what you get, when
you'll see it, and how to get it on demand.

**What you get.** Two reports in `reports/metrics/`:

- A **weekly** report covering the last 8 weeks, most recent first.
- A **monthly** report covering every calendar month since you adopted Waypoint in this project.

Each shows, per period: release velocity, defect density, a shift-left breakdown of which
pipeline stage caught each defect (with an explicit **post-merge delivery-failure rate** — the
share of failures only caught *after* a change already merged, meaning the CD workflow itself
failed, not necessarily that a defect reached a live user), average time to deliver a requirement,
coverage trend, and bug-fix churn — plus a plain-language "here's the trend" summary so you don't
have to read the raw table to get the headline.

**When it's triggered automatically.** Every successful release to live counts toward a running
total. The moment that total hits a multiple of the configured cadence — **every 10th release by
default** — the pipeline generates both reports as part of that same run, no separate action
needed; you'll see the two file paths and a one-line summary called out in that run's final
report to you.

**How to trigger it manually.** Run:

```
/waypoint:quality-report
```

any time — no arguments. It reads whatever release history already exists, regenerates both
reports, commits them, and tells you the two file paths plus a quick headline summary. Use this
whenever you want a current read without waiting for the automatic cadence — ahead of a retro, a
stakeholder update, or just to check in. If fewer than two releases have shipped yet, it says so
plainly rather than inventing a trend from too little data.

## Customizing your pipeline afterward

Everything project-specific is ordinary text in your repo's `.waypoint/`; the pipeline itself comes
from the plugin and updates with it (`/plugin marketplace update waypoint`). Common tweaks:

- **Change your coverage thresholds, WCAG scope, or quality-report cadence** — edit
  `.waypoint/config.json`. Every agent that cares reads it from there, so this is the one place to
  change (CI's `coverage-merge` job mirrors the thresholds as env vars — update those too).
- **Change a stack detail or your coverage instrumentation plan** (switched test runner, new
  accessibility tool, moved spec folder) — edit the matching section of `.waypoint/stack.md`.
- **Add or remove an optional layer later** (e.g. you adopted BDD after the fact) — flip it in
  `.waypoint/config.json`'s `layers`, and add (or delete) its section in `.waypoint/stack.md`. The
  pipeline picks it up on the next run. Re-running `/waypoint:init` (see below) does the same and
  writes the new `stack.md` section for you.
- **Adjust how the agents work in your project** — project conventions they should follow (where
  helpers live, a test style to match, a library to prefer) belong in `.waypoint/stack.md`, which
  every test-writing agent reads. Changing an agent's instructions themselves (e.g. what
  `qa-reviewer` checks) means changing the plugin: fork the Waypoint repository, edit
  `plugins/waypoint/`, and install from your fork's marketplace instead.

### Re-running `/waypoint:init`

Running `/waypoint:init` again in a project that's already set up is supported — it starts from your
existing `.waypoint/` files and asks you to confirm before overwriting them. Use this if your stack
changes in a way that would've changed your original answers (switched test frameworks, added a
deploy target, etc.), so `stack.md` gets rewritten with the same care as the first time.

## Troubleshooting / FAQ

**"My project isn't Node/npm-based."** Waypoint v1 assumes the npm-style script-name contract
(`build`, `test:unit`, etc.) — see [Workflow Overview](Workflow-Overview#whats-fixed-not-configurable)
for why that's a fixed assumption right now rather than a setup question.

**"`/waypoint:init` detected the wrong package manager / framework."** Just correct it when asked
— detection is a starting recommendation, not a final answer. If you notice something wrong after
setup finished, fix it in `.waypoint/config.json` or `.waypoint/stack.md`, or re-run
`/waypoint:init`.

**"I don't have a GitHub repo for this project yet."** Create one first (`gh repo create`, or via
github.com) — the pipeline needs `origin` configured and `gh` authenticated against it before your
first `/waypoint:ship-feature` run, specifically at the branch-push and PR-creation steps.

**"Can I skip the manual test gate?"** Yes — when asked, tell it testing isn't needed for this
change. It's a gate you can waive per run, not a hard requirement. You'll be asked for a one-line
reason, which goes in the run's report so you can later see which kinds of change manual testing
actually catches problems in.

**"A loop hit its retry cap and stopped."** Every loop in the pipeline (design review, red/green
cycles, QA, manual-test, CI) is capped at 5 iterations specifically so it doesn't spin forever on
something it can't resolve. You'll be asked whether to keep trying, take over manually, or abandon
the run — this is expected behavior for a genuinely stuck loop, not a bug.

**"Where do I see what a run actually did?"** `reports/<date>-<slug>.md`, written automatically at
the end of every successful run — requirements, solution, every test file touched, every bug raised
and its resolution, and total time.

**"Where do I see trends over time — velocity, defect rates, delivery time?"**
`reports/metrics/weekly-<date>.md` and `monthly-<date>.md`, written automatically every 10
releases (configurable) or any time via `/waypoint:quality-report`. See
[Periodic quality reports](User-Guide#periodic-quality-reports).
