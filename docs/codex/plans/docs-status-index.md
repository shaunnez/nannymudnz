# Docs Status Index

## Purpose

Make it obvious which markdown files are actively driving the project, which ones are supporting references, and which older implementation plans should be treated as historical context rather than the current backlog.

## Active Control Docs

These are the documents that should drive current prioritization and execution.

| Doc | Role | Status |
|---|---|---|
| `docs/codex/plans/combat-polish-vertical-slice-prd.md` | Primary product and execution roadmap for cleanup, combat feel, flagship world slice, design drift, and backlog clarity | active |
| `docs/codex/plans/agent-orchestration-prd.md` | Repo-aware multi-agent workflow for worktrees, branches, QA, asset lane, and reviewer lane | active |
| `docs/codex/plans/asset-production-plan.md` | Character/VFX production contract and rollout order | active |
| `docs/codex/plans/guild-production-matrix.md` | Guild-by-guild asset backlog tracker | active |
| `docs/runbooks/generate-guild-sprites.md` | Sprite generation execution runbook | active |
| `docs/runbooks/generate-guild-vfx.md` | VFX generation execution runbook | active |
| `docs/runbooks/review-character-animations.md` | Human-in-the-loop animation review workflow | active |
| `docs/runbooks/review-design-drift.md` | Design-vs-implementation drift review workflow | active |

## Active But Secondary

These still matter, but they should not override the active control docs above.

| Doc | Role | Status |
|---|---|---|
| `docs/codex/plans/knight-baseline-plan.md` | Knight-specific sprite baseline plan | active-subplan |
| `docs/codex/plans/knight-vfx-plan.md` | Knight-specific VFX mapping and first-pass plan | active-subplan |
| `docs/codex/plans/leper-baseline-plan.md` | Leper-specific baseline reference plan | active-reference |
| `docs/codex/plans/leper-vfx-plan.md` | Leper-specific VFX reference plan | active-reference |
| `docs/codex/plans/world-production-matrix.md` | Long-range world-art backlog by lore zone | reference-backlog |

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
| `docs/superpowers/plans/2026-04-20-presentation-layer.md` | Completed/older implementation plan for presentation work | historical |
| `docs/superpowers/plans/2026-04-21-batch-1-foundations.md` | Earlier batch execution plan | historical |
| `docs/superpowers/plans/2026-04-21-phase-1-simulation-purity.md` | Earlier implementation phase plan | historical |
| `docs/superpowers/plans/2026-04-21-pixellab-guild-sprites-leper-pilot.md` | Pilot asset-generation plan; useful lessons, not current control doc | historical-reference |
| `docs/superpowers/plans/2026-04-22-phase-2-phaser-port.md` | Earlier detailed implementation plan for Phaser port | historical-reference |
| `docs/superpowers/plans/2026-04-22-multiplayer-1v1.md` | Earlier detailed implementation plan for MP 1v1 | historical-reference |
| `docs/superpowers/plans/2026-04-22-versus-mode-hud.md` | Earlier detailed implementation plan for VS HUD | historical-reference |

## What Is Still Left

This is the short list of major active work that still needs to happen.

1. Restore and hold a trustworthy green baseline, especially shared/server typecheck health.
2. Consolidate duplicated guild/move-list UI surfaces and clean up string-heavy flow wiring.
3. Run a proper design drift audit against the handoff package and convert the important gaps into backlog items.
4. Improve combat readability with hurt-reaction, impact-anchor, and telegraph passes before deeper spectacle work.
5. Build one flagship stage vertical slice that can serve story, VS, and multiplayer, with pickups/items back in the loop.
6. Finish the fresh Knight PixelLab character pass, then continue to Mage and the rest of the guild backlog.
7. Rewrite the repo agents around worktrees, feature branches, GitHub Issues, QA, asset, and reviewer lanes.
8. Rationalize the markdown backlog so the active docs remain small and the older plans stay reference-only.

## Decision Rules

- If a plan conflicts with current product priorities, prefer `combat-polish-vertical-slice-prd.md`.
- If an asset plan conflicts with an older pilot doc, prefer `asset-production-plan.md` and `guildData.ts`.
- Treat the `docs/superpowers/plans/` implementation plans as historical context unless one is explicitly revived.
- Once the orchestration system is rewritten, GitHub Issues should become the primary task system and these docs should stay as control/reference layers rather than an ad hoc backlog.
