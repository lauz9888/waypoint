# CLAUDE.md

Repo-specific guidance for working in this repository (Waypoint, the template source — not an
adopting project's generated pipeline).

## The wiki lives in a separate repo — sync it, don't just commit `wiki/`

This repo's GitHub wiki (the "Wiki" tab, what visitors actually read) is a **separate git
repository**, `https://github.com/lauz9888/waypoint.wiki.git`, entirely distinct from this
working tree. `wiki/` in this repo is a **mirror**, kept here so wiki content is reviewable in
normal diffs/PRs alongside the code it documents — but committing and pushing changes under
`wiki/` to `origin` does **not** update the live wiki. The two can silently drift: this already
happened once (a rewritten Home.md intro and a new FAQ section were hand-edited directly on the
live wiki and never pulled back — see commit `1dbbd50` for the reconciliation).

**Whenever you edit anything under `wiki/`, sync the live wiki before considering the work done:**

1. Clone or pull the wiki repo into a gitignored scratch dir (`.wiki-scratch/`, already in
   `.gitignore`): `git clone https://github.com/lauz9888/waypoint.wiki.git .wiki-scratch` if it
   doesn't exist yet, otherwise `git -C .wiki-scratch pull`.
2. **Before overwriting anything**, diff the scratch clone against your edited `wiki/*.md` files.
   If the live wiki has content that isn't in `wiki/` (a hand-edit made directly on GitHub since
   the last sync), reconcile it into your edit rather than blindly overwriting — don't destroy
   content you didn't intend to touch.
3. Copy the reconciled `wiki/*.md` files into the scratch clone, then commit and push:
   `git -C .wiki-scratch add -A && git -C .wiki-scratch commit -m "<summary>" && git -C
   .wiki-scratch push`.
4. Commit the same `wiki/` changes to this repo too (`git add wiki/ && git commit ...`), so both
   copies stay in sync going forward.

This mirrors exactly what the generated `docs-updater` agent does for *adopting* projects (see
`.claude/agents/docs-updater.md`'s "Wiki" step) — the difference is that Waypoint's own wiki isn't
kept current by an automated agent, since this repo has no running `ship-feature` pipeline of its
own to invoke one. Do this sync by hand, every time, rather than assuming a later step will catch
it.
