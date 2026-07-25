# {{PROJECT_NAME}} standards

Canonical source for cross-cutting values referenced by multiple `.claude/agents/*.md` files
and `SKILL.md`. If any of these change, update it here first — the agent files below point here
rather than repeating the literal value, so a change only requires editing this file plus any
place a _new_ literal genuinely needs introducing (there shouldn't be one).

## WCAG conformance scope

Automated accessibility scans (per layer — see each test-author agent's `{{STACK_FACTS}}`
block for which tool) must be scoped to exactly these tags:

`{{WCAG_TAGS}}`

As an array literal (the shape most a11y-scanning tools' APIs expect — adjust syntax to the
actual tool if it takes tags a different way):

```js
{{WCAG_TAGS}};
```

## Combined coverage threshold

The combined statement-coverage percentage across all enabled test layers (unit
<!-- WAYPOINT:OPTIONAL:BDD -->+ BDD<!-- WAYPOINT:END --> + e2e, per
`{{PKG_MANAGER}} run test:coverage:merge`) must be **at least {{COVERAGE_THRESHOLD}}%** before a
change passes `qa-reviewer`'s Step 12 gate or CI's `coverage-merge` job.

## Runtime version

Development and CI both target **{{RUNTIME_VERSION}}** (`package.json`'s `engines` field,
`.github/workflows/ci.yml` and `cd.yml`'s pinned runtime version).

## Security hygiene checklist

Applied by `qa-reviewer.md` to every change, and by anyone reviewing a PR manually:

- No committed secrets or credentials (API keys, tokens, passwords) anywhere in the diff.
- No unsanitized injection of user-controlled data into the DOM/HTML (e.g. raw `innerHTML`
  assignment from user input without escaping/sanitization).
- `{{PKG_MANAGER}} audit --omit=dev` reports no high/critical vulnerabilities in any dependency
  touched by the change (mirrors the CI `audit` job's high/critical-severity gate).
