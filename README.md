# Waypoint

A reusable, spec-first, test-first development pipeline for Claude Code — extracted from the
`throughline` project. Every change runs through requirements → design/review → test-first
unit/BDD/e2e → implementation → bug-fix loops → QA + coverage gate → manual test gate → merge →
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
   only asks what it can't detect. It writes a concrete `.claude/agents/*.md`,
   `.claude/skills/ship-feature/SKILL.md`, `.claude/STANDARDS.md`, and `docs/adr/README.md` into
   your project.
4. Review and commit the generated files, then run `/ship-feature <change request>` for real.

`examples/throughline/` is a fully concrete, worked example of the templates filled in — read it
alongside `TEMPLATE_CONVENTIONS.md` if you're extending the templates rather than just adopting
them.
