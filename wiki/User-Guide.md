# User Guide — Adopting Waypoint in Your Project

A step-by-step walkthrough for bringing the Waypoint pipeline into your own project. If you want
to understand *why* the pipeline is shaped the way it is first, read the
[Workflow Overview](Workflow-Overview) — this page assumes you just want to get it running.

## Prerequisites

Before you start, make sure you have:

- **Claude Code**, with the ability to invoke skills (`/command-name`) in your project.
- **A git repository for your project** — new or established, doesn't matter. Waypoint scaffolds
  missing pieces (test setup, npm scripts) if your project doesn't have them yet.
- **A GitHub repository, with the [`gh` CLI](https://cli.github.com/) installed and authenticated**
  (`gh auth status` should show you logged in). The pipeline drives branches, PRs, issues, and
  Actions entirely through `gh` — this is not optional in the current version.
- **An npm-, pnpm-, or yarn-based JS/TS project.** Waypoint's generated pipeline assumes a
  package-script contract (`build`, `typecheck`, `lint`, `test:unit`, `test:e2e`,
  `test:coverage:merge`, etc.) — if some of these scripts don't exist yet, the pipeline creates
  them as part of your first change, but the project needs to be a `package.json`-based JS/TS
  project for that to make sense.
- **A local checkout of this Waypoint repository.** You'll pass its path to the setup skill in
  Step 2 below.

## Step 1 — Copy the setup skill into your project

Waypoint's bootstrapper is itself a Claude Code skill, `waypoint-init`, that needs to exist inside
*your* project before you can invoke it there. Copy its folder over:

```bash
cp -r /path/to/waypoint/.claude/skills/waypoint-init  your-project/.claude/skills/
```

(On Windows PowerShell: `Copy-Item -Recurse \path\to\waypoint\.claude\skills\waypoint-init your-project\.claude\skills\`.)

That's the only file transfer you do by hand — everything else is generated for you in the next
step.

## Step 2 — Run the setup skill

From inside your project (with Claude Code open there), run:

```
/waypoint-init /path/to/waypoint
```

passing the path to your local Waypoint checkout. If you forget the path, the skill will ask for
it.

## Step 3 — Answer the setup interview

`waypoint-init` reads your project first — `package.json`, your lockfile, any existing test files,
your README — and only asks about what it can't figure out on its own. Expect two kinds of
questions:

1. **A handful of yes/no or multiple-choice questions**, presented together, for things that are
   genuinely either/or:
   - Which package manager (it'll recommend whatever your lockfile implies).
   - Whether to enable the **BDD** layer (a separate Gherkin/behavioral test layer) — off by
     default unless it detects Cucumber already in use.
   - Whether to enable the **static, path-prefixed deploy** layer — relevant only if you're
     shipping a client-only build to a non-root path like GitHub Pages; off for anything
     server-rendered or deployed at the root.
2. **A short conversational back-and-forth** for anything left over: your project's one-line
   description, which test frameworks you use (if not auto-detected), your coverage threshold
   (90% is the default), and the WCAG conformance level to scan for (WCAG 2.1 AA by default).

You don't need to have answers ready in advance — if something's detectable from your repo,
`waypoint-init` will tell you what it found and just ask you to confirm.

## Step 4 — Review what was generated

`waypoint-init` writes:

| Path | What it is |
|---|---|
| `.claude/agents/*.md` | The subagent roster (11 files, or 12 if you enabled BDD), each recreated for your actual stack. |
| `.claude/skills/ship-feature/SKILL.md` | The pipeline orchestrator, with the step numbering adjusted to whichever layers you enabled. |
| `.claude/skills/quality-report/SKILL.md` | On-demand trigger for the periodic quality/velocity rollup (see below) — `/quality-report`, no arguments. |
| `.claude/STANDARDS.md` | Your coverage threshold, WCAG tag scope, runtime version, and quality-report cadence — the one place to change them later. |
| `docs/adr/README.md` | The convention for Architecture Decision Records the solution-designer agent uses when a change warrants one. |
| `.gitignore` | Updated (or created) to exclude `.workflow/`, the pipeline's local scratch state. |

These are concrete files — no `{{placeholders}}` or template markers should remain anywhere in
them (`waypoint-init` checks this itself before finishing, but it's worth a skim). They're yours
now: edit them freely, same as any other file in your repo. There's no ongoing link back to the
Waypoint repository.

## Step 5 — Commit the generated pipeline

```bash
git add .claude/ docs/adr/ .gitignore
git commit -m "Adopt the Waypoint ship-feature pipeline"
```

Do this before running the pipeline for real, so you have a clean point to diff against if you
ever want to see what a `/ship-feature` run changed versus what setup produced.

## Step 6 — Ship your first change

```
/ship-feature <describe the change you want>
```

Here's what to expect, in order:

1. **Requirements.** A requirements analyst reads your codebase and drafts a numbered,
   testable `requirements.md`. It may ask you clarifying questions first. When it's done, **you
   review and approve it** — this is the first point you're actually asked to act.
2. **Design (automatic).** A solution is designed and reviewed against your requirements in the
   background. You're not asked to approve this step — a dedicated reviewer agent is the check —
   but you'll see it happen.
3. **Tests, written red.** Unit (and BDD/e2e, per your enabled layers) tests get written for
   behavior that doesn't exist yet, and confirmed to fail for the right reason.
4. **Implementation.** Code gets written until exactly those tests pass.
5. **Full suites + auto-fixing.** Every test suite runs in full; any failure becomes a GitHub issue
   and gets fixed automatically, looping until green.
6. **Quality gates.** A QA review checks code quality, security hygiene, accessibility, and
   combined coverage against your threshold. If anything's short, it loops back to add coverage or
   fix gaps — automatically.
7. **Manual testing.** The app starts locally and **you're given a URL to test yourself** — the
   second and last point you're asked to act. Report a bug here and it's fixed and re-tested before
   moving on; or just confirm it looks right.
8. **Merge and ship.** The branch merges via PR, CI/CD run and are watched automatically (CI
   failures are auto-fixed and retried; CD failures are logged for you, not auto-fixed), docs are
   reconciled against what actually shipped, and a report lands in `reports/` summarizing
   requirements, solution, every bug raised and how it was resolved, and total time taken.

A run can take anywhere from minutes to a couple of hours depending on how much back-and-forth
happens at the two human gates and how many bug-fix cycles are needed — the final report's time
total includes that human wait time explicitly, so it isn't mistaken for pure engineering effort.

If you close Claude Code partway through, just run `/ship-feature` again later with no new
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
pipeline stage caught each defect (with an explicit **escaped-to-production rate** — the share of
defects only caught *after* a change already went live), average time to deliver a requirement,
coverage trend, and bug-fix churn — plus a plain-language "here's the trend" summary so you don't
have to read the raw table to get the headline.

**When it's triggered automatically.** Every successful release to live counts toward a running
total. The moment that total hits a multiple of the configured cadence — **every 10th release by
default** — the pipeline generates both reports as part of that same run, no separate action
needed; you'll see the two file paths and a one-line summary called out in that run's final
report to you.

**How to trigger it manually.** Run:

```
/quality-report
```

any time — no arguments. It reads whatever release history already exists, regenerates both
reports, commits them, and tells you the two file paths plus a quick headline summary. Use this
whenever you want a current read without waiting for the automatic cadence — ahead of a retro, a
stakeholder update, or just to check in. If fewer than two releases have shipped yet, it says so
plainly rather than inventing a trend from too little data.

## Customizing your pipeline afterward

Once generated, your pipeline is ordinary text in your repo — there's no magic re-sync with
Waypoint. Common tweaks:

- **Change your coverage threshold, WCAG scope, or quality-report cadence** — edit
  `.claude/STANDARDS.md`. Every agent that cares reads it from there, so this is the one place to
  change.
- **Add or remove an optional layer later** (e.g. you adopted BDD after the fact) — easiest done by
  re-running `/waypoint-init` (see below) rather than hand-editing the step numbering yourself.
- **Adjust an individual agent's behavior** — e.g. tighten what `qa-reviewer` checks, or change
  `bug-fixer`'s scope rules — just edit that agent's `.claude/agents/*.md` file directly.

### Re-running `waypoint-init`

Running `/waypoint-init` again in a project that already has a generated pipeline is supported —
it detects the existing files and asks you to confirm before overwriting anything. Use this if
your stack changes in a way that would've changed your original answers (switched test frameworks,
added a deploy target, etc.) rather than hand-patching the step renumbering yourself, which is easy
to get subtly wrong.

## Troubleshooting / FAQ

**"My project isn't Node/npm-based."** Waypoint v1 assumes the npm-style script-name contract
(`build`, `test:unit`, etc.) — see [Workflow Overview](Workflow-Overview#whats-fixed-not-configurable)
for why that's a fixed assumption right now rather than a setup question.

**"`waypoint-init` detected the wrong package manager / framework."** Just correct it when asked —
detection is a starting recommendation, not a final answer. If you notice it picked something
wrong *after* generation finished, the cleanest fix is re-running `/waypoint-init` rather than
hand-editing every generated file.

**"I don't have a GitHub repo for this project yet."** Create one first (`gh repo create`, or via
github.com) — the pipeline needs `origin` configured and `gh` authenticated against it before your
first `/ship-feature` run, specifically at the branch-push and PR-creation steps.

**"Can I skip the manual test gate?"** Yes — when asked, tell it testing isn't needed for this
change. It's a gate you can waive per run, not a hard requirement.

**"A loop hit its retry cap and stopped."** Every loop in the pipeline (design review, red/green
cycles, QA, manual-test, CI) is capped at 5 iterations specifically so it doesn't spin forever on
something it can't resolve. You'll be asked whether to keep trying, take over manually, or abandon
the run — this is expected behavior for a genuinely stuck loop, not a bug.

**"Where do I see what a run actually did?"** `reports/<date>-<slug>.md`, written automatically at
the end of every successful run — requirements, solution, every test file touched, every bug raised
and its resolution, and total time.

**"Where do I see trends over time — velocity, defect rates, delivery time?"**
`reports/metrics/weekly-<date>.md` and `monthly-<date>.md`, written automatically every 10
releases (configurable) or any time via `/quality-report`. See
[Periodic quality reports](User-Guide#periodic-quality-reports).
