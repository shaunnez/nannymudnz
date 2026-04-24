# Roadmap

## Purpose

This is the thin active-control layer for current work. It points to the live batch, the next milestone, and the docs that govern execution.

## Current Batch

### Batch P0 - Foundation and control-doc alignment

Status: **complete** (2026-04-23)

All exit criteria met:

- `npm run typecheck` exits 0, no deprecation warning
- active `agents/*.md` use real paths and `npm` commands
- `docs/codex/plans/docs-status-index.md` lists the active and historical agent specs
- `docs/codex/plans/screen-manifest.md` exists with schema plus initial rows
- `docs/runbooks/review-design-drift.md` and the two PRDs share the same label scheme and manifest path
- agent specs patched: branch/worktree naming, commit+push mandate, post-batch roadmap update rule

### Batch P1-i - Bug and design triage (complete, 2026-04-23)

Issues dispatched: #4 (story game over routing), #5 (ability panel icons + cooldown timers).
Both QA-passed. Pending manual merge to main — see integration note below.

Integration note: worktrees branched from an older main commit that predates the MP-extended `GameScreen.tsx`.
Issue #4 fix must be applied to the current main `GameScreen.tsx` (which has MP props) before merging.

Remaining todo-labeled issues:
- #3 (lane:dev, priority:high): Leper miasma drains ROT too fast — next dev slot

Blockers:
- GitHub token (provided token returned 401) — label transitions (todo → in-progress → qa → done) skipped this batch

### Batch P1-ii - Next (active)

Entry condition: batch P1-i merged or cherry-picked to main.

Scope:
- Issue #3: Leper miasma drain rate + toggle/deactivate fix (lane:dev, priority:high)
- Milestone 1 combat clarity tasks (hurt reaction, impact placement, telegraph readability) when #3 is resolved

Dispatch source: GitHub Issues `shaunnez/nannymudnz` + `docs/codex/plans/combat-polish-vertical-slice-prd.md`.

Known setup gap: Playwright not yet installed. QA will use the manual/browser fallback and record it as a gap finding.

## Next Milestone

Milestone 1 - Combat clarity

Entry condition:

- Batch P0 complete
- active backlog source chosen
- at least one bounded combat-readability task is ready for dispatch

Primary target:

- hurt reaction pass
- impact placement pass
- telegraph readability pass

## Backlog source

**Active source: GitHub Issues** on `shaunnez/nannymudnz`.

Label taxonomy is live (26 labels: lane, area, priority, drift, state, needs-human).
Issue templates in `.github/ISSUE_TEMPLATE/`: `dev-task`, `asset-task`, `design-drift`, `bug`.

This roadmap remains the thin control layer — milestone targets and batch scope live here; individual tasks live in issues.

## Control docs

- `docs/codex/plans/combat-polish-vertical-slice-prd.md`
- `docs/codex/plans/agent-orchestration-prd.md`
- `docs/codex/plans/docs-status-index.md`
- `docs/codex/plans/screen-manifest.md`
- `docs/runbooks/review-design-drift.md`
