# Waypoint

[![Validate templates](https://github.com/lauz9888/waypoint/actions/workflows/validate-templates.yml/badge.svg)](https://github.com/lauz9888/waypoint/actions/workflows/validate-templates.yml)

A reusable, spec-first, test-first development pipeline for Claude Code — extracted from the
`throughline` project. Every change runs through requirements → design/review → test-first
unit/BDD/e2e/Storybook → implementation → bug-fix loops → QA + coverage gate → manual test gate → merge →
CI/CD → docs → a post-change report, orchestrated by the `/ship-feature` skill. Every 10 releases
(configurable), or on demand via `/quality-report`, a rollup report shows release velocity, defect
density, a shift-left analysis of when defects are caught, and requirement delivery time across
the whole history.

This repo holds **templates**, not a working pipeline (see `TEMPLATE_CONVENTIONS.md`). To adopt
it in a project:

1. Copy `.claude/skills/waypoint-init/` from this repo into your project's `.claude/skills/`.
2. From your project, run:
   ```
   /waypoint-init <path-to-this-waypoint-checkout>
   ```
3. Answer the setup questions — `waypoint-init` inspects your project's actual stack first and
   only asks what it can't detect. It writes your project's settings and stack facts to
   `.waypoint/config.json` and `.waypoint/stack.md`, and copies the pipeline itself
   (`.claude/agents/*.md`, `.claude/skills/ship-feature/SKILL.md`, `.claude/STANDARDS.md`) plus
   `docs/adr/README.md` into your project.
4. Review and commit the generated files, then run `/ship-feature <change request>` for real.

The `.claude/` files hold nothing specific to your project — the agents read `.waypoint/` while
they run — so changing a threshold or a stack detail means editing `.waypoint/`, and two projects
with the same optional layers get identical `.claude/` files.

`examples/throughline/` is a worked example: a real project's `.waypoint/` and the `.claude/`
generated for it — read it alongside `TEMPLATE_CONVENTIONS.md` if you're extending the templates
rather than just adopting them.

## Status & limitations

- **Status:** actively developed, v1. The pipeline, its subagents, and the reporting mechanism are
  all in real use (`examples/throughline` is the project this was extracted from), but the shape
  of individual steps is still expected to evolve — see `wiki/Workflow-Overview.md`'s distinction
  between the pipeline's **guarantees** (stable) and its **implementation details** (not).
- **Assumes Claude Code** with skills, subagents (the `Agent` tool), and `AskUserQuestion`
  available — this isn't a generic prompt-engineering template, it's built around those specific
  primitives.
- **Generated pipelines are mechanically validated.** `scripts/run-fixture-tests.js`, run in CI
  (`.github/workflows/validate-templates.yml`), regenerates `examples/throughline` and four
  synthetic layer combinations on every push, checks them for drift from the templates, and
  checks every `.waypoint/` file involved — see `scripts/README.md` for exactly what "validated"
  does and doesn't mean here (structural correctness, not prose quality).
- **Known limitations:** GitHub-only (VCS and issue tracker, via the `gh` CLI — see
  `TEMPLATE_CONVENTIONS.md`'s "Not templatized" section); assumes the npm-style script-name
  contract (`build`, `test:unit`, etc.), so non-Node projects aren't supported yet; every retry
  loop is capped at 5 iterations and stops to ask rather than looping forever, which is deliberate
  but means a genuinely stuck run needs a human.
- **Security/trust model:** see `.claude/STANDARDS.md`'s "Trust boundary for repository content"
  section — every agent treats source files, issue/PR text, logs, and command output as untrusted
  data, never as instructions.
