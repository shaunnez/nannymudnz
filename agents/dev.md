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

## Branch and worktree naming

Use the convention from `agents/orchestrator.md`:
- branch: `codex/issue-{n}-{slug}`
- worktree: `.worktrees/issue-{n}-{slug}`

## Workflow

1. Confirm task scope, branch, and worktree.
2. Read the relevant implementation files before editing.
3. Implement only the assigned change.
4. Run verification:
   - `npm run typecheck`
   - `npm run build`
   - targeted tests when they exist for the changed area
5. Commit the change to the feature branch and push to origin.
   Do **not** create a PR — the orchestrator does that after QA passes.
6. Post a comment on the GitHub issue via the REST API:
   ```
   POST https://api.github.com/repos/shaunnez/nannymudnz/issues/{n}/comments
   Authorization: token $GITHUB_TOKEN
   ```
   Comment body must include:
   - branch name and commit SHA
   - files changed (list)
   - checks run and their pass/fail result
   - any residual risk or open question
7. Report the same findings back to the orchestrator.
   Leave the worktree in place; QA will inspect it next.

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
