---
name: quality-report
description: On-demand trigger for {{PROJECT_NAME}}'s periodic quality/velocity rollup — spawns `quality-reporter` to write fresh weekly (past 8 weeks) and monthly (since Waypoint's adoption in this project) reports to `reports/metrics/`, the same reports the `ship-feature` pipeline generates automatically every {{RELEASE_REPORT_CADENCE}} releases (its Step 21a). Invoke with `/quality-report` — no arguments needed.
---

You are triggering an on-demand run of the periodic quality report. This is a single-purpose
skill: no pipeline state, no branch, no tests to run — it's a read-only rollup over data that
already exists in `reports/*.md`.

## What you do

1. Spawn `Agent(subagent_type="quality-reporter")`. It needs no input beyond the repo itself — it
   reads every `reports/*.md` metrics block and `reports/.release-count` directly.
2. On `STATUS: complete`: commit the two new files directly to `main` — no branch or PR, the same
   low-risk, docs-only convention `ship-feature`'s Step 20/21 already use for report/doc commits:
   `git checkout main && git pull && git add reports/metrics/ && git commit -m "quality-report:
   weekly + monthly rollup" && git push`.
3. Tell the user the two file paths from the agent's `REPORTS:` line, plus a one- or two-sentence
   summary of the headline numbers (release velocity trend, escaped-to-production rate) pulled
   from the reports you just wrote — don't make them open the files to get the top-line answer.

## If there isn't enough history yet

If `quality-reporter` reports fewer than 2 total releases exist yet (see its own "What you do"
step 5), still write and commit the reports — they'll just say so plainly — and pass that along
when reporting back to the user rather than treating it as a failure.

There's no loop, no retry cap, and no human gate here — it's a deterministic read over existing
data, so a bad run just gets re-triggered next time this skill (or the automatic Step 21a trigger)
runs.
