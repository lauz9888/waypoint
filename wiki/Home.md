# Waypoint

A reusable, spec-first, test-first development pipeline for Claude Code.

- **[Workflow Overview](Workflow-Overview)** — what the pipeline is, why it's shaped this way,
  and how a change moves through it end to end.
- **[User Guide](User-Guide)** — a step-by-step walkthrough for adopting the pipeline in your
  own project.

New here? Start with the Overview if you want to understand it before you use it, or jump straight
to the User Guide if you just want it running.

## At a glance

| | |
|---|---|
| **Driving philosophy** | Spec-first, test-first; ground every decision in the actual codebase; commit to a small number of hard rules and trust agents' judgment inside them |
| **Subagents** | 10 (11 with the optional BDD layer) |
| **Pipeline steps** | 22 in the full pipeline, every optional layer enabled |
| **Human approval gates** | 2 — requirements approval, and manual testing |
| **Max retry loops** | 5 iterations per loop (design review, red/green cycles, QA, manual test, CI bug-fixing), then it stops and asks |
| **Accessibility** | WCAG 2.1 AA scanning, baseline by default — not an optional layer |
| **Coverage threshold** | 90% by default, configurable per project |
| **Supported VCS / issue tracker** | GitHub only, via the `gh` CLI — fixed, not configurable in this version |
| **Supported project types** | npm-, pnpm-, or yarn-based JS/TS projects |
| **Optional layers** | BDD (Gherkin/behavioral tests); static path-prefixed deploy (e.g. GitHub Pages) |
| **Run state** | Local `.workflow/<slug>/` scratch, gitignored, resumable across sessions |

See [Workflow Overview](Workflow-Overview#guarantees) for the reasoning behind these numbers, and
which of them are guarantees versus current implementation details.

## Who this is for

Waypoint is built for teams and individual developers who are already shipping an npm/pnpm/yarn
JS or TS project on GitHub with Claude Code, and want every change — not just the important ones —
to go through the same disciplined, tested, accessible-by-default process without having to
re-explain that process in every conversation. It suits people who'd rather commit to a small set
of non-negotiable rules (tests first, human gates only where humans add value, nothing loops
forever) than either hand-hold every AI-assisted change individually or accept whatever an
unstructured conversation happens to produce.

It's less suited to fully autonomous "vibe-coding" (Waypoint deliberately inserts two human
checkpoints and won't skip the test-first discipline), and it doesn't yet fit projects outside the
GitHub + npm-style-scripts world — non-Node stacks or other VCS/issue-tracker hosts aren't
supported in this version (see
[What's fixed, not configurable](Workflow-Overview#whats-fixed-not-configurable)).
