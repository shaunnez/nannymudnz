# Design: PixelLab guild-sprite generation (Leper pilot)

**Date:** 2026-04-20
**Status:** design — awaiting implementation plan
**Author:** brainstorming session (Claude Code + user)

## Summary

Generate pixel-art character sprite sheets for Nannymud's 15 guilds using the PixelLab MCP (https://api.pixellab.ai/mcp/docs), starting with a single-guild pilot on **Leper** to validate quality and pipeline before committing credits to the remaining 14. Land the app-side sprite rendering pipeline in the same spec so the pilot can be evaluated end-to-end in-game.

This spec covers the Leper pilot only. Scale-up to the other 14 guilds, scripted REST-API generation, VFX sprites, and separate actor-kind sheets (pets, summons, shapeshift forms) are enumerated as follow-ups and are out of scope here.

## Decisions (locked)

| # | Topic | Choice |
|---|---|---|
| 1 | Guild scope (eventual) | All 15 guilds; `cthulhu` → "Cult of the Drowned" and `khorne` → "Red Throne / Blood Pact" per `ipNote` fields in `lore-old/guilds.json`. |
| 2 | Animation set per guild | 15 animations (see §Animation set). |
| 3 | Pilot guild | **Leper** (non-MVP). Chosen because its diseased-bruiser aesthetic is a harder stress test than the cleaner MVP archetypes. |
| 4 | Sprite spec | 64×64 per frame; side-view; horizontal spritesheet; right-facing canonical, horizontally flipped for left; guild `colorPalette` used as prompt hint. |
| 5 | Effects | Character animations only for pilot. Procedural VFX in `src/rendering/particles.ts` remains untouched. |
| 6 | Pipeline | Claude-driven MCP pilot + app-side integration in parallel. No CLI script in this spec. |

## Animation set (15 per guild)

| Group | Animations | Notes |
|---|---|---|
| Locomotion / base | `idle`, `walk`, `run`, `jump` | Looping except `jump` |
| Basic combo chain | `attack_1`, `attack_2`, `attack_3` | Default chain when no combo matches |
| Ability slots | `ability_1`, `ability_2`, `ability_3`, `ability_4`, `ability_5` | Index-aligned to `GuildDef.abilities[i]` |
| Defensive | `block` | Looping, 2 frames |
| Reactions | `hurt`, `death` | Non-looping |

**Missing-animation fallback (unlisted `AnimationId`s):** resolved at render time via `animationFallback.ts` — `fall`/`land` → `jump`; `knockdown`/`getup` → `hurt`; `channel` → `ability_5`; `grab` → `ability_3`; `throw` → `attack_3`; `run_attack`/`jump_attack` → `attack_1`; `dodge`/`pickup` → `idle`.

**Scope exclusions per guild:**

- `ability_N` represents the **caster's own pose**, not the full effect. Pets, summons, shapeshift forms, and projectiles remain separate actor kinds with their own (deferred) sheets.
- `rmb` (Miasma toggle for Leper) is not generated as a distinct animation in the pilot. The app-side renderer reuses `block` or `ability_5` for RMB poses until scale-up decides otherwise.

## Overall architecture

Two parallel workstreams share one deliverable (in-game Leper):

```
Workstream 1: Generation (Claude MCP)        Workstream 2: Integration (app-side)
─────────────────────────────────────        ─────────────────────────────────────
pixellab MCP → PNG sprites                   SpriteActorRenderer (ActorRendererImpl)
  create_character                           spriteLoader (async PNG + metadata fetch)
  animate_character × 15                     animationFallback (missing-anim resolver)
         │                                   feature flag in GameRenderer
         ▼                                   reads ← metadata + PNGs
public/sprites/leper/
  <animation>.png × 15
  metadata.json
```

The boundary between the workstreams is the spritesheet + `metadata.json` contract (§Sprite contract). Either workstream can proceed independently once that contract is fixed.

Layer rules (CLAUDE.md `src/simulation` / `src/rendering` / `src/input` / `src/audio` separation) are preserved:

- All new code is under `src/rendering/sprite/`.
- `AnimationId` and `GuildId` are imported **as types only** from `src/simulation/types.ts`.
- No changes to `src/simulation/`, `src/input/`, or `src/audio/`.
- `ctx.setTransform(RENDER_SCALE, ...)` is applied once per frame in `GameScreen.tsx`; the sprite renderer draws in virtual 900×506 units and inherits the upscale — no manual scale math.

## Sprite contract

File layout per guild:

```
public/sprites/leper/
├── idle.png            64h × (N·64)w — horizontal strip, N frames left→right
├── walk.png
├── run.png
├── jump.png
├── attack_1.png        attack_2.png   attack_3.png
├── ability_1.png       ability_2.png  ability_3.png  ability_4.png  ability_5.png
├── block.png
├── hurt.png
├── death.png
└── metadata.json
```

`metadata.json` schema (types in `src/rendering/sprite/types.ts`):

```json
{
  "guildId": "leper",
  "frameSize": { "w": 64, "h": 64 },
  "facing": "right",
  "animations": {
    "idle":     { "frames": 4, "frameDurationMs": 180, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "walk":     { "frames": 6, "frameDurationMs": 120, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "run":      { "frames": 6, "frameDurationMs": 90,  "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "jump":     { "frames": 4, "frameDurationMs": 120, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_1": { "frames": 5, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_2": { "frames": 5, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_3": { "frames": 6, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_1": { "frames": 5, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_2": { "frames": 5, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_3": { "frames": 5, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_4": { "frames": 5, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_5": { "frames": 6, "frameDurationMs": 150, "loop": true, "anchor": { "x": 32, "y": 56 } },
    "block":    { "frames": 2, "frameDurationMs": 200, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "hurt":     { "frames": 3, "frameDurationMs": 100, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "death":    { "frames": 6, "frameDurationMs": 150, "loop": false, "anchor": { "x": 32, "y": 56 } }
  }
}
```

Frame counts and durations above are **defaults only** — real values come from what PixelLab returns and are written into `metadata.json` by the operator during the generation step. `anchor` is the pivot in sprite-local pixels that aligns to the actor's `(x, z)` world position; `(32, 56)` = feet-center on a 64×64 frame. `facing: "right"` is canonical; the renderer flips horizontally when `direction === -1`.

## Generation workflow (pilot)

Executed in Claude Code using the `pixellab` MCP tools connected to this session. Full runbook at `docs/runbooks/generate-guild-sprites.md`.

Steps:

1. **Build base-character prompt** from `lore-old/guilds.json` Leper entry + `oneshot.md` §5.14. Palette `#6B7F4F`, `#8B5A2B`, `#3F4F2F`, highlight `#65a30d`. Prompt: *"diseased plague-bearer bruiser, ragged hooded robe, torn bandages, hunched posture, necrotic green skin patches, no facial features visible, muted olive/brown palette, pixel art, side-view, plain background."* Size 64×64.
2. **`pixellab.create_character`** with that prompt. Poll, download base PNG, inspect. Re-prompt if unacceptable (retry point #1; cheap before animations).
3. **`pixellab.animate_character` × 15 in parallel** — one per animation in the set. Action prompts are per-animation (see runbook for full table; examples: `ability_1` = "plague vomit: hunches forward, cone of green vomit from mouth"; `ability_5` = "rotting tide channel: arms raised, swaying, 3s loop").
4. **Poll each job, download PNGs** into `public/sprites/leper/<animation>.png`.
5. **Author `metadata.json` by hand** from actual returned frame counts + duration defaults.
6. **Evaluation checkpoint** — `npm run dev`, enable flag, play Leper, decide: scale / re-prompt individual animations / abandon.

Retry points: after step 2 (base character) and per-animation after step 4.

Credit-budget estimate: 1 character + 15 animations = ~16 generation jobs for the pilot. First real call anchors the scale-up estimate.

## App-side integration

New files under `src/rendering/sprite/`:

- **`types.ts`** — `AnimationMetadata`, `SpriteSheet`, `GuildSpriteSet`.
- **`spriteLoader.ts`** — `loadGuildSpriteSet(guildId)`: fetches `/sprites/<guild>/metadata.json`, parallel-fetches each referenced PNG via `new Image()`, resolves when all `onload` fire. Cached by guildId. On failure (missing PNG, malformed JSON) logs + returns `null`; renderer falls back to placeholder.
- **`spriteActorRenderer.ts`** — implements `ActorRendererImpl`. Constructor takes a loaded `GuildSpriteSet`. On `renderActor`: resolve `animationId` (with fallback), compute frame via modulo (loop) or clamp (non-loop), `ctx.drawImage` the strip slice at `screenX - anchor.x, screenY - anchor.y`, applying a horizontal scale when `direction === -1`. HP bars and status-effect overlays remain in `GameRenderer` — the sprite renderer does not re-implement them.
- **`animationFallback.ts`** — `resolveAnimation(id, sheets): AnimationId` walks a preference list per `AnimationId` and returns the first present sheet. Worst case: `idle`. Guarantees the renderer never throws.

Modified file:

- **`gameRenderer.ts`** — reads `localStorage.getItem('nannymud:sprites') === '1'` at construction. If true and the selected guild has a loaded sprite set, injects `SpriteActorRenderer`. Otherwise `PlaceholderRenderer`. Per-guild gating: flag ON + missing sprite set → placeholder for that guild only.

Loading lifecycle: `GameScreen` calls `loadGuildSpriteSet(selectedGuild)` on mount after guild selection; shows a brief "loading sprites…" state while pending. Failure → silently fall back to placeholder (logged).

## Deliverables

1. `src/rendering/sprite/types.ts`
2. `src/rendering/sprite/spriteLoader.ts`
3. `src/rendering/sprite/spriteActorRenderer.ts`
4. `src/rendering/sprite/animationFallback.ts`
5. `src/rendering/gameRenderer.ts` (modified for feature flag + per-guild gating)
6. `public/sprites/leper/` — 15 PNGs + `metadata.json`
7. `docs/runbooks/generate-guild-sprites.md` — operator runbook
8. This design doc, committed to `docs/superpowers/specs/`

## Acceptance (pilot)

- Feature flag default OFF → no regression in `PlaceholderRenderer` rendering for any guild.
- Flag ON + Leper selected: in-game Leper uses PixelLab sprites for all 15 animations; loops and non-loops behave correctly; horizontal flip tracks `direction`.
- Missing animation (e.g. `dodge`) resolves to `idle` via `animationFallback.ts` without error.
- `npm run typecheck` and `npm run lint` clean.
- User plays a wave with Leper + sprite renderer and makes a go/no-go call on scale-up.

## Non-goals (explicit)

- Scripted CLI against PixelLab REST API (follow-up spec).
- Animated VFX / ability particle sprites (procedural particles untouched).
- Sprite sheets for the other 14 guilds.
- Alt-form / pet / summon actor-kind sheets: `bear_form`, `wolf_form`, `wolf_pet`, `drowned_spawn`, `rotting_husk`.
- Master-class sprite work (explicitly deferred as endgame).
- UI toggle for the sprite flag (devtools `localStorage` only).
- Preloading multiple guilds' sprite sets simultaneously.
- Any change to `src/simulation/`, `src/input/`, or `src/audio/`.

## Follow-up work (for later specs)

- Scale-up: batch-generate the remaining 14 guilds via runbook, or via scripted REST CLI.
- Separate actor-kind sprite sheets (pets, summons, shapeshift forms).
- Animated VFX sprites to replace procedural particles per-ability.
- Enemy sprite sheets (`plains_bandit`, `bandit_archer`, `wolf`, `bandit_brute`, `bandit_king`).
- Promote `docs/runbooks/generate-guild-sprites.md` to a proper `.claude/skills/` skill if operator pattern proves useful.
