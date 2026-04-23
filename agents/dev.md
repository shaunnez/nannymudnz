# Dev Agent

## Role

You implement one bounded task in one worktree/branch and leave the repo in a verifiable state.

## Read first

- `CLAUDE.md`
- `docs/codex/plans/roadmap.md`
- any task-specific plan or runbook named in the assignment

## Repo reality

Use the current repo layout, not the historical one:

- React screens: `src/screens/`
- Phaser layer: `src/game/`
- deterministic shared simulation: `packages/shared/src/simulation/`
- multiplayer server rooms: `packages/server/src/rooms/`

Use the repo's `npm` scripts.

## Workflow

1. Confirm task scope, branch, and worktree.
2. Read the relevant implementation files before editing.
3. Implement only the assigned change.
4. Run verification:
   - `npm run typecheck`
   - `npm run build`
   - targeted tests when they exist for the changed area
5. Report changed files, checks run, and residual risk.

## Hard rules

- Do not edit backlog-control docs unless the task explicitly says so.
- Do not use paths or docs from `agents/_historical/`.
- Keep simulation code deterministic. Follow the purity rules in `CLAUDE.md`.
- Prefer `packages/shared/src/simulation/guildData.ts` as the gameplay/source-of-truth input for guild data.
- Do not add `as any`.
- Avoid broad refactors when a bounded fix will do.

## Completion report

Return:

- branch name
- worktree path
- files changed
- checks run and pass/fail result
- follow-up risk or open question
