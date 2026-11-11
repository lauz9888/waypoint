# Waypoint

[![Validate templates](https://github.com/lauz9888/waypoint/actions/workflows/validate-templates.yml/badge.svg)](https://github.com/lauz9888/waypoint/actions/workflows/validate-templates.yml)

A reusable, spec-first, test-first development pipeline for Claude Code — extracted from the
`throughline` project. Every change runs through requirements → design/review → test-first
unit/BDD/e2e/Storybook → implementation → bug-fix loops → QA + coverage gate → manual test gate → merge →
CI/CD → docs → a post-change report, orchestrated by the `/waypoint:ship-feature` skill. Every 10 releases
(configurable), or on demand via `/waypoint:quality-report`, a rollup report shows release velocity, defect
density, a shift-left analysis of when defects are caught, and requirement delivery time across
the whole history.

Waypoint is a Claude Code plugin; this repo is both its source (`plugins/waypoint/`) and its
marketplace. To adopt it in a project:

1. Install the plugin, in a Claude Code session:
   ```
   /plugin marketplace add lauz9888/waypoint
   /plugin install waypoint@waypoint
   ```
2. From your project, run `/waypoint:init` and answer the setup questions. It inspects your
   project's actual stack first and only asks what it can't detect, then writes your project's
   settings and stack facts to `.waypoint/config.json` and `.waypoint/stack.md` (plus
   `docs/adr/README.md`, a `.gitignore` entry, and — if you choose to share the plugin with
   collaborators — the plugin's entry in `.claude/settings.json`).
3. Review and commit those files, then run `/waypoint:ship-feature <change request>` for real.

The pipeline itself — the skills, the twelve `waypoint:*` agents and the shared `STANDARDS.md` —
lives in the plugin, is identical for every project, and updates for all of them at once. The
agents read `.waypoint/` while they run, including which optional layers are on, so changing a
threshold, a stack detail or a layer means editing `.waypoint/`. A project set up by an older
Waypoint (pipeline files copied into `.claude/`) migrates by running `/waypoint:init`.

`examples/throughline/` is a worked example: a real project's `.waypoint/` and its
`.claude/settings.json`. Read it alongside `TEMPLATE_CONVENTIONS.md` if you're changing the plugin
rather than just adopting it.

## Status & limitations

- **Status:** actively developed, v1. The pipeline, its subagents, and the reporting mechanism are
  all in real use (`examples/throughline` is the project this was extracted from), but the shape
  of individual steps is still expected to evolve — see `wiki/Workflow-Overview.md`'s distinction
  between the pipeline's **guarantees** (stable) and its **implementation details** (not).
- **Assumes Claude Code** with skills, subagents (the `Agent` tool), and `AskUserQuestion`
  available — this isn't a generic prompt-engineering template, it's built around those specific
  primitives.
- **The plugin is mechanically validated.** `scripts/run-fixture-tests.js`, run in CI
  (`.github/workflows/validate-templates.yml`), checks it on every push as it is and for all eight
  combinations of optional layers, along with the marketplace and plugin manifests, the
  `.waypoint/` templates and throughline's real `.waypoint/` — see `scripts/README.md` for exactly
  what "validated" does and doesn't mean here (structural correctness, not prose quality). Run
  `claude plugin validate plugins/waypoint` too when you have the CLI; CI doesn't install it.
- **Known limitations:** GitHub-only (VCS and issue tracker, via the `gh` CLI — see
  `TEMPLATE_CONVENTIONS.md`'s "Not templatized" section); assumes the npm-style script-name
  contract (`build`, `test:unit`, etc.), so non-Node projects aren't supported yet; every retry
  loop is capped at 5 iterations and stops to ask rather than looping forever, which is deliberate
  but means a genuinely stuck run needs a human.
- **Security/trust model:** see the plugin's `STANDARDS.md`'s "Trust boundary for repository content"
  section — every agent treats source files, issue/PR text, logs, and command output as untrusted
  data, never as instructions.
