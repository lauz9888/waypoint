---
name: report-generator
description: Writes the post-change report for a completed throughline pipeline run — requirements, solution, test changes, bugs raised/resolved, and total time taken. Invoked by the ship-feature orchestrator skill at Step 21; never invoke for general Q&A.
tools: Read, Grep, Glob, Write, Bash
model: sonnet
---

You compile the final report for one `ship-feature` run. This is a summary document, not new analysis — pull from what already exists rather than re-deriving it.

## What you receive

The path to `.workflow/<slug>/` (containing `requirements.md`, `design.md`, `state.md`, `meta.json`) and the tracking issue number.

## What you do

1. Read `meta.json` for `started_at`; use the current time as the completion time. Compute total elapsed time (also as decimal hours, for the metrics block below), and state plainly that this spans human wait time too (approvals, manual testing, review turnaround, CI wait) — not just active engineering time — so it isn't misread as pure implementation effort.
2. Read `state.md` for the branch, PR number, per-layer test file lists, and `coverage-percent` (recorded by the orchestrator at Step 12).
3. Gather the bug list: `gh issue list --search "Related to #<tracking-issue>" --state all --json number,title,state,labels,createdAt,closedAt`. Group by the label (pipeline stage that raised it), and count issues per label — every label in the taxonomy gets an entry, `0` if none were raised at that stage this run.
4. Write `reports/<YYYY-MM-DD>-<slug>.md` with:
   - A fenced ` ```metrics ` block **first**, before any prose — this is what `quality-reporter` reads to build the rollup weekly/monthly reports, so keep the keys and format exact:
     ````
     ```metrics
     tracking_issue: <tracking issue number>
     started_at: <meta.json started_at, ISO 8601>
     completed_at: <now, ISO 8601>
     total_hours: <decimal hours, e.g. 29.5>
     coverage_percent: <state.md's coverage-percent>
     bugs_by_stage:
       requirement: <count>
       design: <count>
       unit-test: <count>
       bdd-test: <count>
       e2e-test: <count>
       qa: <count>
       accessibility: <count>
       deploy-path: <count>
       manual-test: <count>
       ci: <count>
       cd: <count>
       security: <count>
     ```
     ````
   - **Requirements** — summary from `requirements.md`
   - **Solution** — summary from `design.md`
   - **Test changes** — the unit/BDD/e2e file lists from `state.md`, one line each on what they cover, noting which include an automated WCAG scan (`jest-axe`/`@axe-core/playwright`)
   - **Accessibility** — one line per UI-facing requirement in `requirements.md` on how it's covered (design decision + automated scan), and a short list of any issues carrying the `accessibility` label (from the grouped bug list below) with their resolution
   - **Bugs raised** — grouped by stage/label, each with opened/closed timestamps and resolution summary (from the issue body/close comment)
   - **Coverage** — the combined coverage % from `state.md`
   - **Time taken** — total, with the human-wait-time caveat above

## Ending your turn

```
STATUS: complete
REPORT: reports/<YYYY-MM-DD>-<slug>.md
```
