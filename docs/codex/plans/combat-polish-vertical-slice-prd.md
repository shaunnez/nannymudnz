# Combat Polish And Vertical Slice PRD

## Goal

Turn the current Phaser/Colyseus branch into a trustworthy production base by shipping one polished combat-and-world vertical slice instead of trying to solve every system at once.

This plan covers four linked workstreams:

1. repo cleanup and consolidation after the late Phaser move
2. combat feel and VFX clarity
3. one flagship stage vertical slice that works across story, VS, and multiplayer
4. human-in-the-loop animation review and polish

Two additional coordination lanes are now in scope:

5. design fidelity and drift review against the handoff package
6. markdown/backlog rationalization so it is obvious what is still active

The intent is to improve feel, readability, and confidence in the codebase without throwing away the current architecture.

## Recommendation

Do not rebuild from scratch yet.

The current branch already has the right high-level shape:

- shared simulation in `packages/shared/src/simulation/`
- server authority in `packages/server/src/rooms/`
- Phaser client and views in `src/game/`
- React shell and menus in `src/screens/`

The current problems read like post-pivot consolidation issues, not proof that the foundation is invalid.

## Current State

### What is already working

- Phaser gameplay scene, actor/projectile/pickup views, and MP room flow exist.
- Shared simulation types and guild data are still the source of truth.
- Character sprites are now a real production lane.
- VFX have started to move from placeholder-only rendering toward per-ability routing.
- Pickups are still present in simulation and Phaser rendering.
- Verification on 2026-04-23 found and fixed a real baseline blocker in `packages/shared/src/schema/**`: `tsconfig.app.json` needed decorator support because the app typecheck follows the `@nannymud/shared/*` path alias into shared source. The `tsconfig.app.json` `baseUrl` deprecation warning is also cleared.

### What currently feels weak

- combat readability is inconsistent
- ability placement is sometimes hard to trust
- hurt reactions are not always clear enough
- VFX are mostly still procedural fallback and feel basic
- stage/world presentation is still largely generic
- several UI/reference surfaces duplicate similar guild kit rendering logic
- active docs, agent specs, and backlog plumbing are not yet aligned tightly enough for safe autonomous execution

## Product Principles

### Clarity first, then wow

The first VFX pass must answer:

- what just happened
- who caused it
- where it landed
- whether it hit
- how dangerous it is

Once those answers are reliable, add stronger spectacle and identity.

### One stage must feel complete

The first world pass should not aim for procedural breadth.

It should produce one stage that feels intentionally authored and is strong enough to serve as:

- story proof of concept
- VS map
- MP map
- world-art contract for future stages

### Human eyes stay in the loop

Animation quality should not be treated as fully automatable. The pipeline should help a human review efficiently, not try to replace judgment.

### Design references are guide rails, not shackles

The handoff design should be treated as the intended baseline, but not every divergence is a defect.

Each drift finding should be classified as one of:

- missing from implementation
- worse than handoff
- different but acceptable
- different and better than handoff

The review process should preserve improvements instead of blindly reverting to the older mockup.

## Workstream A - Repo Consolidation

### Objective

Reduce code smell and duplication introduced by the late Phaser port, while protecting the current shipping momentum.

### Problems to solve

- duplicated move-list / guild-kit rendering across:
  - `src/screens/MoveList.tsx`
  - `src/screens/GuildDossier.tsx`
  - `src/screens/GuildDetails.tsx`
  - `src/screens/CharSelect.tsx`
  - `src/screens/ResultsScreen.tsx`
  - `src/screens/LoadingScreen.tsx`
- MP analogues should be verified too, especially `src/screens/mp/MpCharSelect.tsx` and `src/screens/mp/MpLoadingScreen.tsx`
- string-heavy message and flow wiring in multiplayer screens and room handlers
- possible UI text encoding/mojibake that should be verified with evidence instead of assumed
- mixed old/new contracts after the Canvas-to-Phaser transition
- missing architecture notes about which seams are intentionally string-based versus which should be typed maps/constants
- shared-schema decorator settings must stay aligned across app/shared typecheck boundaries

### Deliverables

- one shared presentational layer for guild ability / move-list cards
- one shared guild-details data adapter sourced from `packages/shared/src/simulation/guildData.ts`
- one pass to replace obvious duplicated UI copy/patterns
- a warning-free green typecheck baseline
- a short architecture note listing where strings are acceptable and where typed maps/constants are preferred

### Specific recommendations

- Prefer string-union types plus typed lookup records over TS enums, to stay aligned with existing code style.
- Centralize these contracts:
  - match phases
  - room message names
  - stage ids
  - guild-kit display sections
- Do not refactor everything at once. Target only the seams that affect iteration speed or produce inconsistent UX.

## Workstream B - Combat Feel And VFX

### Objective

Make combat feel legible, intentional, and satisfying before chasing purely decorative spectacle.

### Target outcome

A player should be able to tell, without guessing:

- when an attack starts
- when an attack connects
- when they got hit
- where an ability originates
- what area an AoE covers
- when a character is in recovery or danger

### Combat clarity backlog

#### B1. Hurt reaction pass

- Ensure characters reliably enter visible `hurt`/stagger states when damaged.
- Verify simulation state changes and animation playback line up.
- Improve fallback behavior when a guild lacks a dedicated hurt strip.

Relevant files:

- `packages/shared/src/simulation/simulation.ts`
- `packages/shared/src/simulation/physics.ts`
- `src/game/view/ActorView.ts`
- `src/game/view/AnimationRegistry.ts`

#### B2. Impact placement pass

- Normalize where hit sparks and impact VFX anchor:
  - melee contact
  - projectile impact
  - point-blank AoE
  - ground-target casts
- Add temporary debug overlays if needed to show:
  - attacker origin
  - target center
  - chosen VFX anchor
  - damage/hitbox contact frame

Relevant files:

- `packages/shared/src/simulation/simulation.ts`
- `src/game/view/ParticleFX.ts`
- `src/game/scenes/GameplayScene.ts`

#### B3. Ability telegraph pass

- Add stronger startup and placement reads for:
  - projectile casts
  - blink/teleport actions
  - area pulses
  - ground-target abilities
- Prioritize readability over particle count.

#### B4. Screen-energy pass

After clarity is stable:

- add stronger secondary particles
- add short flourish layers for ultimates and signature skills
- add guild-specific visual identity

### VFX production strategy

#### Clarity pass

Use assetized effects where they improve readability first:

- hit confirmation
- cast startup bursts
- clear AoE rings
- visible buff/debuff pulses
- readable hurt/impact flashes

#### Wow-factor pass

Layer on top:

- richer bursts
- lingering trails
- light bloom and energy accents
- signature ultimate moments

### PixelLab usage

PixelLab is a valid lane here, with realistic constraints.

Recommended tool usage:

- `mcp__pixellab__create_map_object`
  - transparent-background VFX sprites
  - ground markers
  - aura frames
  - environmental props
  - pickups and throwables
- `mcp__pixellab__create_character`
  - guild characters
- `mcp__pixellab__animate_character`
  - base character animation sets

Notes:

- PixelLab is strong for first-pass sprite/VFX generation, but some VFX may still need repo-side cleanup, compositing, timing, and anchor tuning.
- For combat VFX, PixelLab should produce the visual sheet, while the repo remains responsible for:
  - hook routing
  - timing
  - anchor placement
  - playback scale
  - fallback behavior

## Workstream C - Flagship Stage Vertical Slice

### Objective

Ship one stage that feels like the standard all future stages must meet.

### Recommendation

Use `assembly` as the first flagship stage.

Reasons:

- already the enabled stage
- fits combat readability well
- works for story, VS, and multiplayer
- can support pickups, landmarks, and clean lane readability

### Stage slice requirements

The flagship stage must include:

- distinct background and parallax identity
- visible midground landmarks
- readable combat plane
- foreground prop language that does not obscure hit readability
- item/pickup support
- one or two signature environmental features
- a single palette and art-direction contract for future stage production

### Systems to introduce

#### C1. Stage definition contract

Move beyond stage metadata-only definitions.

Add a stage content contract that can express:

- backdrop layers
- landmark set
- prop set
- pickup spawn tables
- optional combat-safe decorative zones
- palette and lighting notes

#### C2. Stage art lane

Use PixelLab for:

- pillars
- banners
- braziers
- debris
- crates
- weapon props
- stage-specific pickups

Recommended source tool:

- `mcp__pixellab__create_map_object`

#### C3. Pickup loop refresh

The pickup system still exists in code and should be promoted back into the core loop.

Current evidence:

- pickup grab/throw logic in `packages/shared/src/simulation/simulation.ts`
- pickup rendering in `src/game/view/PickupView.ts`

Vertical slice target:

- at least one light throwable
- at least one melee pickup
- clear spawn/readability rules
- visible pickup affordance

### Definition of done for the stage slice

The flagship stage is done when:

- it has distinct authored visuals instead of only generic hills/ground
- it supports the same play surface across SP, VS, and MP
- props do not reduce combat clarity
- pickups are visible, useful, and understandable
- the stage gives future stage production a reusable contract

## Workstream D - Human-In-The-Loop Animation Review

### Objective

Review and improve each guild's basic animation set with human judgment supported by tooling and structured checklists.

### Recommendation

Yes, this is something we should do together.

The best workflow is:

1. Codex prepares review surfaces and checklists.
2. Human reviews in motion and marks issues.
3. Codex turns feedback into prompt updates, metadata tweaks, or regenerate/fallback decisions.

### What should be reviewed by eye

- silhouette readability
- foot planting and sliding
- attack anticipation
- impact timing
- hurt readability
- jump arc feel
- shield/block pose clarity
- weapon direction and overlap
- scale consistency across guilds

### What Codex can do to help

- generate contact sheets
- build per-guild review checklists
- compare strips against metadata
- identify likely anchor/scale mismatches
- propose regenerate vs metadata-tweak vs accept decisions
- keep a punch-list of issues per guild

### What should remain human-approved

- final call on whether an animation feels good
- whether silhouette/personality reads correctly
- whether a guild looks too floaty, too stiff, too soft, or too noisy

## Workstream E - Design Fidelity And Drift Review

### Objective

Bring the actual implementation back into intentional alignment with the design handoff package without erasing improvements the live app has already made.

### Reference sources

Primary design references:

- `design_handoff_nannymud/nannymud-design.pdf.pdf`
- `design_handoff_nannymud/README.md`
- `design_handoff_nannymud/Nannymud Screens.html`
- `design_handoff_nannymud/screens-*.jsx`

Implementation surfaces:

- `src/App.tsx`
- `src/screens/`
- `src/screens/mp/`
- `src/screens/hud/`

### Process

1. Read and maintain `docs/codex/plans/screen-manifest.md`.
2. Capture handoff reference screenshots.
3. Capture matching implementation screenshots.
4. Compare with a structured rubric:
   - missing structure
   - spacing/layout drift
   - typography/color drift
   - interaction drift
   - implementation improvement worth keeping
5. Turn findings into bounded issues by screen/flow.

### Recommended automation

- Playwright captures implementation screenshots once the harness is verified.
- Browser automation captures the handoff HTML reference views.
- AI review compares the paired screenshots and produces categorized findings.
- Human signs off on whether a drift item should be fixed or preserved.

### Deliverables

- one screen manifest at `docs/codex/plans/screen-manifest.md`
- one drift report per major flow using the schema in `docs/runbooks/review-design-drift.md`
- one queue of implementation tasks tagged with the reconciled drift labels from `docs/codex/plans/agent-orchestration-prd.md`

## Workstream F - Markdown And Backlog Rationalization

### Objective

Make it obvious which plans are still active, which are historical, and what work remains.

### Problem

The repo now has multiple overlapping markdown sources:

- active codex plans
- older `docs/superpowers/` plans/specs
- runbooks
- handoff docs
- ad hoc notes
- stale agent specs that describe the wrong repo

This makes it hard to answer simple questions like:

- what are we actually doing now
- what is done
- what is superseded
- which doc should an agent trust

### Deliverables

- one active roadmap doc
- one docs status map:
  - active
  - supporting reference
  - historical/superseded
- one backlog source of truth for executable work
- historical copies of the pre-rewrite agent specs, clearly marked as deprecated

### Recommendation

Keep the rich historical docs, but add a thin top-level control layer that points to:

- the current active product plan
- the current active execution roadmap
- the current asset production lane
- the current orchestration plan
- the current screen manifest for drift review

## Milestones

### Milestone 0 - Baseline trust

- restore a green `npm run typecheck` baseline, especially `packages/shared/src/schema/**`
- resolve the `tsconfig.app.json` `baseUrl` deprecation warning
- audit mojibake/encoding issues with evidence instead of assumption
- document active architecture seams and the current backlog/control docs
- retire stale agent specs into a clearly historical location

### Milestone 1 - Combat clarity

- hurt reaction pass
- impact placement pass
- basic telegraph improvements

### Milestone 2 - Stage vertical slice

- authored `assembly` stage
- pickup loop visible and intentional
- SP/VS/MP compatibility

### Milestone 3 - Assetized clarity VFX

- per-guild clarity VFX for the most-used combat actions
- PixelLab-backed props and stage objects

### Milestone 4 - Wow-factor layering

- stronger signature effects
- ultimate flourishes
- environmental spectacle that does not compromise readability

### Milestone 5 - Guild animation review loop

- review all guild basics
- log issues
- regenerate or tune the worst offenders

### Milestone 6 - Design drift control

- screen manifest complete
- reference and implementation screenshot capture working
- drift items triaged into fix/keep buckets

### Milestone 7 - Backlog and docs clarity

- active roadmap exists
- current work is easy to locate
- historical docs are preserved but clearly marked as historical

## Milestone Dependencies

- M0 is a serial precondition for any autonomous execution.
- M2 depends on M1 so stage dressing does not obscure combat clarity work still in flight.
- M3 depends on M2 because stage props and clarity VFX share the same asset-generation lane and runtime contracts.
- M6 depends on M0 so drift findings have a manifest, label scheme, and backlog destination.

## Acceptance Criteria

### Repo/architecture

- move-list and guild details rendering are no longer duplicated across multiple screens
- typed contracts are used for core multiplayer/state wiring
- the branch is back on a trustworthy baseline

### Combat

- hurt reactions are consistently visible
- impact VFX feel anchored and believable
- abilities read clearly in motion

### Stage

- one map feels production-grade enough to represent the game
- pickups matter and are easy to understand

### Asset pipeline

- PixelLab is integrated as a repeatable lane for stage props and clarity/wow VFX
- regenerate/tune workflows are documented rather than ad hoc

### Animation workflow

- each guild has a review status
- major issues are tracked and actionable
- human review is built into the loop instead of being an afterthought

### Design fidelity

- major screen flows have been compared against the handoff package
- drift is categorized rather than guessed
- improvements in the live app are intentionally preserved when appropriate

### Project clarity

- there is one obvious place to see active work
- plans no longer compete ambiguously for authority

## Suggested Execution Order

Steps 1 and 2 are serial preconditions for everything after them. Do not open parallel execution lanes until the control docs, agent specs, and baseline-trust work are aligned.

1. rationalize markdown/backlog sources and retire stale agent specs
2. fix baseline trust issues
3. audit and consolidate duplicated guild-kit UI
4. do hurt/impact/ability placement polish
5. build the `assembly` vertical slice and refresh pickups
6. generate clarity-first world props and VFX with PixelLab
7. layer wow-factor VFX
8. run the human animation review pass across all guilds
9. run design drift review and feed it into the backlog

## Immediate Next Actions

1. Land `docs/codex/plans/roadmap.md` and `docs/codex/plans/screen-manifest.md`.
2. Mark the old `agents/*.md` set historical and replace it with repo-accurate active specs.
3. Restore a green shared-schema typecheck baseline and clear the `tsconfig.app.json` `baseUrl` deprecation warning.
4. Write a short architecture audit with a prioritized refactor list.
5. Create a combat-feel punch-list focused on hurt, impact anchors, and ability placement.
6. Define the `assembly` stage asset contract and its first PixelLab prompt pack.
7. Start the human-in-the-loop animation review runbook for the current guild set.
