# Agent Orchestration PRD

## Goal

Define a repo-aware autonomous workflow for Nannymud that can move multiple tasks forward in parallel without creating merge chaos, invalid verification, or misleading backlog state.

This PRD replaces the older generic agent concept with a workflow designed for:

- this actual repo shape
- worktree-based parallelism
- game-specific QA constraints
- asset production as a first-class lane
- human review where AI judgment is still weak

## Why A Rewrite Is Needed

The current `agents/*.md` are useful conceptually, but not directly compatible with this repo.

Examples of mismatch:

- they expect `docs/plan.md`, `taskboard.md`, and `pnpm`
- they assume `packages/client` and `prototype/combat-prototype.html`
- they are not aligned to the current Vite + shared/server workspace layout
- they do not model asset generation or design drift review as real lanes

Until the rewrite lands, the old `agents/*.md` must be treated as historical only. They actively point to wrong paths and wrong tooling, so dispatching from them is unsafe.

Known stale assumptions include:

- `packages/client/src/scenes/` instead of `src/game/scenes/`
- `packages/server/src/sim/` instead of `packages/shared/src/simulation/`
- `prototype/combat-prototype.html`, `docs/GDD.md`, `lore/*.json`, `taskboard.md`, and `docs/plan.md`, none of which are current control files here
- `pnpm` instead of the repo's `npm` scripts

The replacement should preserve the core idea:

- orchestrator delegates
- dev implements
- QA verifies

But the workflow and files must be rewritten for the current reality.

## Core Principles

### Worktree-first parallelism

Every implementation task that can change files runs in its own git worktree on its own feature branch.

This is mandatory for safe parallelism in a game repo where:

- gameplay changes can conflict easily
- UI tasks often touch the same screens
- assets can involve large binary diffs

### Backlog-first orchestration

Agents should never improvise the work queue from scattered markdown alone.

There must be one explicit backlog source of truth.

Target state: GitHub Issues plus a thin repo-side roadmap/index.

Until GitHub Issues are configured with the agreed label set, the only repo-side dispatch pointer is `docs/codex/plans/roadmap.md`. Agents must not infer active work from older plans or historical docs.

### QA is layered, not magical

Game QA should not pretend AI can fully understand moment-to-moment feel.

Verification should be split into:

1. objective checks
2. browser/UI flow checks
3. gameplay heuristics
4. human spot checks for feel-sensitive work

### Human approval remains strategic

Human input should be reserved for:

- animation feel
- combat feel
- design drift decisions where the implementation may actually be better
- final sign-off on asset quality

## Recommended Agent Roles

## 1. Orchestrator

### Responsibilities

- reads the active backlog
- selects the next safe batch of parallel tasks
- creates one worktree/branch per implementation task
- dispatches agents by lane
- waits for completion
- routes tasks to QA
- routes eligible outputs to reviewer
- updates issue state and the roadmap/index when needed

### Must not do

- large code edits
- direct implementation of queued work

## 2. Dev

### Responsibilities

- implements one bounded task in one worktree
- runs repo-appropriate checks
- commits and pushes a feature branch
- reports changed files, checks run, and follow-up risk

### Constraints

- one task only
- disjoint write scope whenever possible
- no editing backlog control files unless explicitly assigned

## 3. QA

### Responsibilities

- verifies the task branch
- runs objective checks
- performs browser flow validation
- captures screenshots/videos where useful
- rejects with concrete evidence or passes with evidence

### QA layers

#### Layer A - Objective checks

- `npm run typecheck`
- `npm run build`
- relevant tests if they exist

#### Layer B - Browser flow checks

- verify whether Playwright is actually configured before assuming it exists
- if Playwright is configured, open the correct screen/flow, perform key interactions, and capture screenshots
- if Playwright is not configured yet, record that as a setup gap and fall back to the documented manual/browser runbook

Playwright install verification is a Phase 0 task, not an assumption.

#### Layer C - Gameplay heuristics

Use AI to assess:

- whether the screen responds correctly
- whether VFX appear and are anchored plausibly
- whether pickups/items are visible and usable

Do not overclaim:

- QA can detect obvious wrongness
- QA cannot be the sole judge of nuanced combat feel

## 4. Asset

### Responsibilities

- owns PixelLab-facing tasks
- generates character/VFX/world assets
- saves raw outputs
- composites/normalizes into repo contracts
- documents what still needs human visual review

### Typical tasks

- guild sprite generation
- guild VFX generation
- stage props and environment objects
- pickup and throwable art

## 5. Reviewer

### Responsibilities

- reviews what Dev and QA produced
- looks for process improvements
- flags avoidable tool churn or bad prompt hygiene
- suggests improvements to agent markdown, QA flow, and task decomposition
- performs design drift classification when requested

### This lane is especially useful for

- optimizing repeated UI flows
- reducing unnecessary browser/test passes
- improving how QA drives controls in the game
- tightening prompts/instructions for future runs

## Backlog Model

## Recommended source of truth

Use GitHub Issues as the task system once it is configured.

### Why

- first-class status tracking
- labels and dependencies are easier than ad hoc markdown parsing
- works naturally with feature branches and PRs
- easier to review historically than a constantly rewritten taskboard

### Phase 0 decision

Phase 0 must make the backlog contract explicit:

- preferred destination: GitHub Issues
- required one-time setup: `.github/ISSUE_TEMPLATE/*`, the agreed label taxonomy, and a board/project view
- temporary repo-side pointer until that exists: `docs/codex/plans/roadmap.md`

Autonomous issue-driven dispatch must not begin until that setup exists.

## Suggested issue taxonomy

Lane labels:

- `lane:dev`
- `lane:asset`
- `lane:qa`
- `lane:design`
- `lane:reviewer`

Area labels:

- `area:combat`
- `area:vfx`
- `area:world`
- `area:ui`
- `area:mp`
- `area:docs`

Priority labels:

- `priority:high`
- `priority:med`
- `priority:low`

Drift labels:

- `drift:missing`
- `drift:worse`
- `drift:acceptable`
- `drift:better`

Cross-cutting labels:

- `needs-human`

States:

- `todo`
- `in-progress`
- `qa`
- `review`
- `done`
- `blocked`

## Repo-side docs still needed

Even with GitHub Issues, keep a small repo-side control layer:

- one active roadmap doc at `docs/codex/plans/roadmap.md`
- one docs status map at `docs/codex/plans/docs-status-index.md`
- one orchestration PRD
- one screen manifest at `docs/codex/plans/screen-manifest.md`
- runbooks for repeated workflows

## Branch And Worktree Policy

### Feature branch naming

Recommended:

- `codex/issue-123-ui-main-menu-drift`
- `codex/issue-212-knight-hurt-reaction`
- `codex/issue-310-assembly-stage-props`

### Worktree naming

Recommended:

- `.worktrees/issue-123-ui-main-menu-drift`
- `.worktrees/issue-212-knight-hurt-reaction`

### Parallelism rule

Only dispatch tasks together when they have:

- different write scopes, or
- clear priority that justifies coordination overhead

Preferred max parallel batch:

- 1 gameplay/dev task
- 1 UI/design task
- 1 asset task

This is safer than flooding the repo with many simultaneously conflicting edits.

## Design Drift Automation

## Goal

Make UI drift review repeatable rather than subjective and memory-based.

## Proposed flow

1. maintain `docs/codex/plans/screen-manifest.md`
2. capture handoff screenshots from the HTML design package
3. capture implementation screenshots from the live app
4. use AI comparison to classify with the shared output schema from `docs/runbooks/review-design-drift.md`
5. create/update issues from the findings using the reconciled drift labels

## Important guardrail

The system must not auto-file every visual difference as a bug.

It should produce recommendations for human confirmation, especially on:

- layout improvements
- readability improvements
- practical deviations that help gameplay

## QA For A Game - Realistic Expectations

## What AI QA is good at

- broken flows
- missing UI elements
- obvious layout regressions
- console/runtime errors
- basic input-response checks
- screenshot differencing
- confirming presence/absence of VFX or pickups

## What AI QA is weaker at

- subtle combat feel
- whether an animation has personality
- whether a hit reaction feels satisfying
- whether a camera motion feels right
- whether a design deviation is aesthetically superior

## Recommendation

Treat AI QA as:

- high-value for correctness
- medium-value for usability
- low-to-medium value for feel

For feel-sensitive tasks, require:

- explicit reviewer lane
- optional human gate

## Lane-Specific Verification Policy

### Dev tasks

Pass requires:

- `npm run typecheck`
- `npm run build`
- relevant tests when available

### UI/design tasks

Pass requires:

- objective checks
- screenshot capture
- drift comparison against the handoff reference

### Asset tasks

Pass requires:

- contract validation
- file placement
- metadata validity
- at least one visual review checkpoint

### Gameplay/combat tasks

Pass requires:

- objective checks
- scripted gameplay smoke when available
- reviewer or human sign-off when feel is central

## Reviewer Lane PRD

The reviewer lane is worth adding.

### Responsibilities

- inspect task outputs after QA
- identify process waste
- suggest:
  - prompt improvements
  - issue decomposition improvements
  - test-flow improvements
  - cheaper/faster QA routes

### Examples

- QA used too many browser steps to validate a simple menu state
- Dev changed five files when the task should have been isolated to one
- an asset task should have been routed to PixelLab first instead of local salvage
- repeated MP validation should start from a seeded app state instead of manually traversing menus every time

## Human Gates

Recommended human-gated categories:

- animation approval
- high-visibility combat feel changes
- final stage visual style sign-off
- drift findings classified as "implementation may be better"
- major asset batch acceptance

Recommended non-human-gated categories:

- small typed refactors
- straightforward UI drift fixes
- isolated bug fixes with clear QA evidence
- metadata-only asset contract updates

## Recommended First Implementation

### Phase 0 - Safe foundation

This phase is serial and blocks everything else.

- mark the old `agents/*.md` historical
- decide backlog home and write the roadmap pointer
- write the new repo-aware agent specs
- define the screen manifest path and schema
- reconcile label taxonomy, including drift labels
- verify Playwright install/config rather than assuming it

New agent specs should be written by the human or an orchestrator-role agent. Dev should not own backlog-control files unless explicitly assigned.

### Phase 1 - Parallel lanes open

- dispatch one bounded Dev task, one drift-review task, and one asset task with disjoint write scope
- use the roadmap plus configured issues as the only dispatch source
- keep reviewer optional until the first batch completes

### Phase 2 - Broader automation

- add reviewer lane by default for feel-sensitive work
- add issue auto-transition logic
- add periodic backlog summarization

## Deliverables

- new repo-aware agent markdown set
- orchestration rules for worktrees and branches
- GitHub issue workflow
- design drift automation plan
- reviewer lane policy
- game-specific QA policy

## Success Criteria

- multiple tasks can run in parallel without stomping each other
- backlog state is obvious
- QA evidence is reliable
- asset tasks are treated as first-class work
- feel-sensitive work still gets human or reviewer scrutiny
- the system reduces chaos instead of multiplying it
