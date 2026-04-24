# Docs Status Index

## Purpose

Make it obvious which markdown files are actively driving the project, which ones are supporting references, and which older implementation plans should be treated as historical context rather than the current backlog.

## Active Control Docs

These are the documents that should drive current prioritization and execution.

| Doc | Role | Status |
|---|---|---|
| `docs/codex/plans/roadmap.md` | Thin active-batch pointer and milestone tracker | active |
| `docs/codex/plans/combat-polish-vertical-slice-prd.md` | Primary product and execution roadmap for cleanup, combat feel, flagship world slice, design drift, and backlog clarity | active |
| `docs/codex/plans/agent-orchestration-prd.md` | Repo-aware multi-agent workflow for worktrees, branches, QA, asset lane, and reviewer lane | active |
| `docs/codex/plans/screen-manifest.md` | Screen inventory and schema for design drift review | active |
| `docs/codex/plans/docs-status-index.md` | Control index for active vs historical docs and agent specs | active |
| `docs/runbooks/review-design-drift.md` | Design-vs-implementation drift review workflow | active |

## Active Subplans And Backlogs

These still matter, but they should not override the active control docs above.

| Doc | Role | Status |
|---|---|---|
| `docs/codex/plans/asset-production-plan.md` | Character/VFX production contract and rollout order | active-subplan |
| `docs/codex/plans/guild-production-matrix.md` | Guild-by-guild asset backlog tracker | active-backlog |
| `docs/codex/plans/assembly-stage-world-kit.md` | Assembly stage art-direction and object-pack subplan | active-subplan |
| `docs/codex/plans/knight-baseline-plan.md` | Knight-specific sprite baseline plan | active-subplan |
| `docs/codex/plans/knight-vfx-plan.md` | Knight-specific VFX mapping and first-pass plan | active-subplan |
| `docs/codex/plans/leper-baseline-plan.md` | Leper-specific baseline reference plan | active-reference |
| `docs/codex/plans/leper-vfx-plan.md` | Leper-specific VFX reference plan | active-reference |
| `docs/codex/plans/world-production-matrix.md` | Long-range world-art backlog by lore zone | reference-backlog |
| `docs/runbooks/generate-guild-sprites.md` | Sprite generation execution runbook | active-runbook |
| `docs/runbooks/generate-guild-vfx.md` | VFX generation execution runbook | active-runbook |
| `docs/runbooks/review-character-animations.md` | Human-in-the-loop animation review workflow | active-runbook |

## Active Agent Specs

These are the current agent instructions that match the repo layout and command set.

| Doc | Role | Status |
|---|---|---|
| `agents/orchestrator.md` | Reads the roadmap/backlog, dispatches bounded tasks, and coordinates lanes | active |
| `agents/dev.md` | Implements one bounded code task in one worktree/branch | active |
| `agents/qa.md` | Verifies bounded work with objective checks and documented browser validation | active |
| `agents/asset.md` | Handles PixelLab-facing and asset-pipeline tasks | active |
| `agents/reviewer.md` | Reviews outputs for drift, process quality, and follow-up risks | active |

## Supporting Reference Docs

These are useful source material and architecture references, but they are not the current execution backlog.

| Doc | Role | Status |
|---|---|---|
| `design_handoff_nannymud/README.md` | Human-readable design handoff overview | reference |
| `design_handoff_nannymud/Nannymud Screens.html` | Screen-by-screen handoff prototype | reference |
| `design_handoff_nannymud/screens-*.jsx` | Original handoff screen implementations | reference |
| `design_handoff_nannymud/nannymud-design.pdf.pdf` | Handoff PDF capture/reference | reference |
| `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md` | Architecture reference for the Phaser/shared/server direction | reference |
| `docs/superpowers/specs/2026-04-20-presentation-layer-design.md` | Presentation/layout architecture reference | reference |
| `docs/superpowers/specs/2026-04-22-multiplayer-1v1-design.md` | Multiplayer architecture and flow reference | reference |
| `docs/superpowers/specs/2026-04-22-versus-mode-hud-design.md` | VS HUD behavior and UI reference | reference |
| `docs/superpowers/specs/2026-04-20-pixellab-guild-sprites-design.md` | PixelLab sprite pipeline reference | reference |
| `docs/superpowers/specs/2026-04-20-screen-port-design.md` | Earlier screen-port direction/reference | reference |

## Historical Or Execution-Specific Docs

These mostly reflect earlier execution phases. Keep them for context, but do not treat them as the live roadmap.

| Doc | Role | Status |
|---|---|---|
| `agents/_historical/cto.md` | Deprecated pre-rewrite orchestrator spec with stale repo assumptions | historical-pending-rewrite |
| `agents/_historical/dev.md` | Deprecated pre-rewrite dev spec with stale repo assumptions | historical-pending-rewrite |
| `agents/_historical/qa.md` | Deprecated pre-rewrite QA spec with stale repo assumptions | historical-pending-rewrite |
| `agents/_historical/retro.md` | Deprecated pre-rewrite retrospective spec tied to old taskboard flow | historical-pending-rewrite |
| `docs/superpowers/plans/2026-04-20-presentation-layer.md` | Completed/older implementation plan for presentation work | historical |
| `docs/superpowers/plans/2026-04-21-batch-1-foundations.md` | Earlier batch execution plan | historical |
| `docs/superpowers/plans/2026-04-21-phase-1-simulation-purity.md` | Earlier implementation phase plan | historical |
| `docs/superpowers/plans/2026-04-21-pixellab-guild-sprites-leper-pilot.md` | Pilot asset-generation plan; useful lessons, not current control doc | historical-reference |
| `docs/superpowers/plans/2026-04-22-phase-2-phaser-port.md` | Earlier detailed implementation plan for Phaser port | historical-reference |
| `docs/superpowers/plans/2026-04-22-multiplayer-1v1.md` | Earlier detailed implementation plan for MP 1v1 | historical-reference |
| `docs/superpowers/plans/2026-04-22-versus-mode-hud.md` | Earlier detailed implementation plan for VS HUD | historical-reference |

## What Is Still Left

This is the short list of major active work that still needs to happen.

1. ~~Rewrite the repo agents and control docs so autonomous execution is safe.~~ Done — P0 complete 2026-04-23.
2. ~~Restore and hold a trustworthy green baseline, including the remaining TypeScript deprecation warning and architecture trust gaps.~~ Done — `npm run typecheck` clean 2026-04-23.
3. Consolidate duplicated guild/move-list UI surfaces and clean up string-heavy flow wiring.
4. Run a proper design drift audit against the handoff package and convert the important gaps into backlog items.
5. Improve combat readability with hurt-reaction, impact-anchor, and telegraph passes before deeper spectacle work.
6. Build one flagship stage vertical slice that can serve story, VS, and multiplayer, with pickups/items back in the loop.
7. Finish the fresh Knight PixelLab character pass, then continue to Mage and the rest of the guild backlog.

## Decision Rules

- If a plan conflicts with current product priorities, prefer `docs/codex/plans/combat-polish-vertical-slice-prd.md`.
- If an orchestration or routing question conflicts with a historical agent spec, prefer `docs/codex/plans/agent-orchestration-prd.md` and the active `agents/*.md` files.
- If an asset plan conflicts with an older pilot doc, prefer `docs/codex/plans/asset-production-plan.md` and `packages/shared/src/simulation/guildData.ts`.
- Treat the `docs/superpowers/plans/` implementation plans as historical context unless one is explicitly revived.
- Once the orchestration system is configured against GitHub Issues, those issues become the primary task system and these docs remain the control/reference layer rather than an ad hoc backlog.
