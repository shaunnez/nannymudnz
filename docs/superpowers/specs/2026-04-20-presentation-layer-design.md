# Presentation Layer — Design (Sub-project B)

**Date:** 2026-04-20
**Scope:** Fullscreen + aspect-ratio-locked canvas + layout discipline for all screens. Zero gameplay/simulation changes.

## Roadmap context

This is the first of three sequenced sub-projects. Only B is fully designed here; C and A get stub roadmap entries at the bottom.

1. **B — Presentation layer** (this doc). Fullscreen, 16:9 letterbox, resolution bump.
2. **C — Workflow infrastructure.** Rewrite `agents/*.md` for this repo, set up `/loop` cadence + taskboard format, so future sub-projects execute autonomously.
3. **A — Visual overhaul.** Character sprite integration, character-select avatars, VFX/sound pass.

## Goals

- Game canvas fills the browser viewport at all times, maintaining a locked 16:9 aspect ratio with letterbox/pillarbox bars as needed.
- True browser fullscreen available via `F` key or an on-canvas toggle.
- Render at a higher backing-buffer resolution (1600×900) without changing gameplay feel — the simulation continues to see the same slice of the world.
- All screens (Title, GuildSelect, Game, GameOver) render inside one consistent scaling frame — the game *frame* is the signature, even while menu content is still programmer-art.
- Input/pause behavior survives the Esc/fullscreen conflict gracefully.

## Non-goals

- No sprite integration or character art (that's sub-project A).
- No menu visual redesign. `TitleScreen`, `GuildSelect`, `GameOverScreen` keep their current inline-styled React — they just render inside the scaling frame. LF2-style menu redesign is a later pass.
- No VFX, no audio, no gameplay tuning.
- No mobile/touch support.
- No DPR-aware rendering. Fixed 1600×900 backing buffer is the final word for this sub-project.

## Architecture

### ScalingFrame — the wrapper

A new component `src/layout/ScalingFrame.tsx` (new `src/layout/` folder) wraps the whole app.

Responsibilities:
- Fills the browser viewport (`width: 100vw; height: 100vh`).
- Locks its child to a 16:9 box using CSS (`aspect-ratio: 16 / 9`), centered, with the child's size = `min(100vw, 100vh * 16/9)`.
- Renders black letterbox/pillarbox bars via `background: #000` on the outer container.
- Exposes a fullscreen toggle method via a small React context or prop, invoked from either `F` keypress or an on-canvas button.
- Listens for `fullscreenchange`; on exit, dispatches an auto-pause event the game screen can consume.

`App.tsx` wraps its screen router inside `<ScalingFrame>`. All four screens render as its children, filling the 16:9 box.

### Canvas backing buffer

- `<canvas width={1600} height={900}>` inside `GameScreen.tsx`. CSS scales it to fit the ScalingFrame.
- `imageRendering: 'pixelated'` (not `crisp-edges` — `pixelated` is the modern spelling and works on Chrome/Edge/Safari).
- The *world view* (the slice of world the camera shows) stays exactly what it is today: 900 world units wide by 500 tall. Only the *render resolution* of that view changes.
- A new constant `RENDER_SCALE = 1600 / 900 ≈ 1.7778` in `src/rendering/constants.ts` (new file — renderer-only constants, keeps simulation free of render concerns). Applied uniformly to both axes: `screenX = (worldX - cameraX) × RENDER_SCALE`, `screenY = (worldY - worldZ) × RENDER_SCALE`.
- Consequence of uniform scale on a 1600×900 canvas: vertical view becomes 900 / 1.7778 ≈ 506 world units instead of 500 — a 1.2% extra sliver, imperceptible, intentionally absorbed (do not try to correct for it; non-uniform scaling distorts sprites).
- Simulation constants (`WORLD_WIDTH`, `ATTACK_RANGE_DEFAULT`, `CAMERA_LOCK_PADDING`, `GROUND_Y_MIN/MAX`, `PLAYER_SPAWN_X/Y`) are untouched — the player still sees the same slice of world they did at 900×500.
- `src/simulation/constants.ts` presently owns `CANVAS_WIDTH`, `CANVAS_HEIGHT`, `WORLD_TO_SCREEN_X_SCALE`, `GROUND_SCREEN_Y`, `VIEW_HEIGHT`. These belong in the rendering layer — they were misplaced. Move them to `src/rendering/constants.ts` as part of this work. (Grep first to verify no simulation code reads them; it shouldn't.)

### Fullscreen toggle

- `F` key binding added to `keyBindings.ts` defaults.
- `InputManager` emits a "toggle fullscreen" intent; `GameScreen` (and the ScalingFrame via context) calls `document.documentElement.requestFullscreen()` / `document.exitFullscreen()`.
- On non-game screens (Title, GuildSelect, GameOver), a global keydown listener in `ScalingFrame` handles `F` directly — no `InputManager` instance is running on menus.
- Small "⛶ Fullscreen" button in the top-right canvas HUD, drawn by `hud.ts`, clickable via a hit-test on canvas mouse events (`GameScreen` adds a click handler that maps mouse → canvas coords → HUD hit test).

### Input / pause conflict

- Default pause binding: `Esc` → `P`. `keyBindings.ts` default updated; existing saved bindings in localStorage (if any) get migrated on load — if `pause === 'Escape'`, rewrite to `'p'`.
- `Esc` still does "back / exit" on menus (TitleScreen → no-op, GuildSelect → TitleScreen, GameOver → GuildSelect). That's menu logic inside React, not InputManager.
- `ScalingFrame` listens for `fullscreenchange` and dispatches an event the game screen uses to auto-pause on fullscreen exit.
- `InputManager`'s existing `blur` handler already clears keys — leave it alone.

### Info bar removal

- Delete the DOM block at `src/screens/GameScreen.tsx:142-170` (the `← → ↑ ↓ Move ...` hint + Quit button).
- `hud.ts` gains:
  - Small controls hint rendered bottom-center of canvas, low opacity, fades out after 5s of gameplay (can re-show on pause).
  - Top-right cluster: pause button, fullscreen toggle, quit button. Simple rectangle hit-testing; `GameScreen` wires the canvas click handler.
- Pause overlay (currently in `hud.ts` as `renderPauseOverlay`) gains a visible "Quit to menu" button for players who can't find the top-right one.

## Data flow

```
ScalingFrame (layout + fullscreen API + F key)
   └─ Router (App.tsx useState)
       ├─ TitleScreen
       ├─ GuildSelect
       ├─ GameScreen
       │    ├─ <canvas 1600x900>
       │    ├─ InputManager (window keydown/up)
       │    ├─ AudioManager
       │    ├─ GameRenderer (reads SimState, applies RENDER_SCALE)
       │    └─ tickSimulation (unchanged)
       └─ GameOverScreen
```

Key point: `ScalingFrame` does not own game state. It owns layout and the fullscreen gesture. The game loop and simulation remain in `GameScreen`.

## File-level change summary

New:
- `src/layout/ScalingFrame.tsx` — wrapper, fullscreen context, key listener.
- `src/rendering/constants.ts` — render-only constants including `RENDER_SCALE`, migrated `CANVAS_WIDTH`/`CANVAS_HEIGHT`/`GROUND_SCREEN_Y`/`VIEW_HEIGHT`/`WORLD_TO_SCREEN_X_SCALE`.

Modified:
- `src/App.tsx` — wrap children in `<ScalingFrame>`, drop `minHeight: 100vh` outer flex (ScalingFrame owns it).
- `src/screens/GameScreen.tsx` — canvas to 1600×900, delete info bar, wire canvas click handler for HUD buttons, listen for auto-pause event.
- `src/screens/TitleScreen.tsx`, `GuildSelect.tsx`, `GameOverScreen.tsx` — remove any explicit `minHeight: 100vh` or `maxWidth: 900`; let ScalingFrame drive size.
- `src/rendering/gameRenderer.ts`, `hud.ts`, `actorRenderer.ts`, `placeholderRenderer.ts`, `particles.ts` — multiply world→screen projections by `RENDER_SCALE`. Consolidate constants import from new `rendering/constants.ts`.
- `src/rendering/hud.ts` — add top-right button cluster (pause/fullscreen/quit), fading controls hint, hit-testing helpers.
- `src/input/keyBindings.ts` — add `fullscreen: 'f'`, change default `pause: 'p'`, add one-shot migration from `'Escape'`.
- `src/input/inputManager.ts` — emit `fullscreenToggle` on `F` press (new bool in `InputState` or a side-channel callback).
- `src/simulation/constants.ts` — remove the render-only constants (CANVAS_WIDTH etc.), leave simulation-only constants.
- `src/simulation/types.ts` — if `InputState` gains `fullscreenToggleJustPressed`, add there.
- `CLAUDE.md` — brief note about `rendering/constants.ts` being the home for render constants and `RENDER_SCALE` semantics.

## Testing plan

No automated tests in this repo. Manual checklist (add to spec PR):

- `npm run dev` → game loads, letterbox visible on ultrawide / narrow windows.
- Resize browser from very wide → very tall → back; canvas always fills available 16:9 space, no clipping of gameplay.
- Press `F` → browser enters fullscreen; letterbox now fills monitor. Press `F` again → exits cleanly.
- Press `Esc` in fullscreen → exits fullscreen AND game pauses automatically.
- Click top-right pause button → pauses. Click fullscreen button → toggles.
- On 4K monitor, sprites and text are noticeably sharper than the old 900×500 upscale.
- Gameplay feel unchanged: walking from spawn to first enemy takes the same time; camera locks at the same player position; all abilities hit at the same ranges. (Sanity check: spawn a plains_bandit, verify basic attack hits at the same relative distance as on `main`.)
- `npm run typecheck` clean, `npm run build` clean, `npm run lint` clean.

## Risks & mitigations

- **Constant migration introduces a typo.** Any use of the moved `CANVAS_WIDTH`/`CANVAS_HEIGHT`/etc. in files we don't touch will break. Mitigation: before editing, grep for each migrated constant across `src/` and move all call sites atomically.
- **`imageRendering: 'pixelated'` on Safari.** Supported since Safari 10. If it fails, the canvas upscales smoothly instead of crisply — acceptable degradation.
- **Fullscreen API on iframes (e.g., if embedded in Bolt preview).** `requestFullscreen` may reject. We already no-op gracefully on rejection.
- **Saved keybindings in localStorage pointing to `Escape` for pause.** Migration runs once on load; logs a console warning.

## Open questions

None currently. Visual polish of menu screens and LF2-styled character select are deferred to sub-project A + a later menu-redesign pass.

---

# Roadmap (stubs)

## Sub-project C — Workflow Infrastructure

Rewrite `agents/*.md` from the old Colyseus monorepo conventions to match this Vite+React single-package repo. Establish a `taskboard.md` + `/loop` cadence that executes sub-project tasks autonomously. Define the "done" signal so the loop can advance. Full design brainstormed when B is done.

## Sub-project A — Visual Overhaul

**Core tension to resolve:** the existing character assets in `assets-old/final/characters/` are static 92×92 isometric 3/4-pose PNGs, 8 directions, no animation frames. The current game is a side-scrolling beat-'em-up with `facing = -1 | 1`. Using these assets as-is means either using only 2 of 8 directions (wasteful, bad-looking) or sampling more directions based on movement vector (richer look, needs `facing` to become an angle).

Other scope items: character-select avatars using the south-facing PNG; VFX pass (hit sparks, particle overhaul); audio pass (better synth patches or real samples); possible sprite animation generation (frames per direction). Full design brainstormed when C is done.

## Sub-project D — VS Mode (local multiplayer, keyboard-shared)

LF2-style arena: 2–4 fighters on one keyboard (human or CPU), free-for-all or team colors (RGBY), pick-a-character + pick-an-arena + go. Time-limit and last-fighter-standing win conditions. The simulation already supports multiple actors and teams; the work is input (multi-player keybinds), character select UI with P1/P2/P3/P4 slots, arena selection, end-of-round score screen, and AI for CPU-controlled opponents in VS context (tuning from stage-mode chaser AI).

**Out of scope for D:** networked multiplayer. That's a later sub-project on top of D. Plan D such that the simulation stays cleanly stateless/deterministic so a server-authoritative wrapper can be added later without rewriting.

## Sub-project E — Stage System Expansion

Multiple stages beyond Plains of Nan. Stage select screen, difficulty selector (Easy / Normal / Difficult / Crazy scaling enemy HP/damage/wave counts), per-stage music and parallax backgrounds, per-stage enemy rosters. `lore-old/` contains Nannymud-universe setting material that may seed stage themes (respect the IP-sanitization note at `lore-old/sources.md`).

## Cut from scope (explicitly not building)

- **Championship mode.** 1v1 tournament bracket — skipped. VS mode covers the "pick fighters and brawl" itch; Championship's bracket UI + 1v1 balance isn't worth the work.
- **Networked multiplayer.** Deferred indefinitely. Design D to not preclude it, but don't build for it.
- **Character / stage editor (LF2's .dat files).** Not in the plan.

## Likely sequencing after A

A → E (stages) → D (VS mode) → multiplayer. Stages-before-VS because more single-player content is cheaper to build and validates the art pipeline first; VS comes once the character roster feels complete. Open to reordering if building VS first would better stress-test the simulation.
