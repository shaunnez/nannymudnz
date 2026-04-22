# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Nannymud — a browser-native, single-player 2.5D side-scrolling beat-'em-up (Little Fighter 2 style). Vite + React + TypeScript + Phaser 3. No backend; `@supabase/supabase-js` is a dependency but is not currently wired in. Gameplay runs inside a `Phaser.Game` mounted into a React host component; React is used only for menu screens, the pause overlay, and mounting/unmounting the Phaser instance.

## Commands

```bash
npm run dev        # Vite dev server (http://localhost:5173)
npm run build      # Production build to dist/
npm run preview    # Serve the built dist/
npm run lint       # ESLint (flat config, eslint.config.js)
npm run typecheck  # tsc --noEmit -p tsconfig.app.json
npm test           # Vitest run (src/**/*.test.ts)
npm run test:watch # Vitest watch mode
```

Tests run via Vitest. `packages/shared/src/simulation/__tests__/golden.test.ts` is the reproducibility gate — if it fails after a change in `packages/shared/src/simulation/**`, you have introduced non-determinism and the Colyseus rewrite (see `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md`) will be harder. Keep it green.

## Architecture: strict layer separation

The codebase enforces a one-way dependency flow. Respect it when adding features — crossing these boundaries is the single most important rule in this repo:

```
input/ (keyBindings) ──►  @nannymud/shared/simulation  ◄── (read-only) ──  game/ (Phaser)
                                      ▲
audio/  ──────────────────────────────┘ (reads vfxEvents + phase transitions)
```

- **`packages/shared/src/simulation/`** — pure TypeScript. Combat, AI, physics, wave progression, status effects, HP/MP, combo detection. **No DOM, no canvas, no `window`, no browser APIs.** It must remain portable to a Node server. Nothing non-deterministic is permitted — no `Math.random()`, no `Date.now()`, no `setTimeout`, no module-level mutable counters. Use `state.rng()` for rolls, tick-based countdown fields for timers, and `state.next*Id` counters for IDs. The ESLint override on `packages/shared/src/simulation/**` enforces this.
- **`src/game/`** — Phaser 3 layer. `PhaserGame.ts` boots a `Phaser.Game` with three scenes (`Boot`, `Gameplay`, `Hud`). `GameplayScene.update` is the rAF loop: it calls `tickSimulation`, reconciles per-actor/projectile/pickup `*View` objects, consumes `state.vfxEvents`, runs audio dispatch, and drives the camera. It **reads** `SimState` and never mutates it. Render-only constants (`VIRTUAL_WIDTH`, `VIRTUAL_HEIGHT`, `DEPTH_SCALE`, `worldYToScreenY`, `WORLD_Y_MIN/MAX`) live in `src/game/constants.ts` — never in `packages/shared/src/simulation/constants.ts`. Phaser's `Scale.FIT` handles upscaling, so the old `CANVAS_BUFFER_*` / `RENDER_SCALE` concepts are gone.
- **`src/input/keyBindings.ts`** — localStorage-backed keybinding map. Phaser's `PhaserInputAdapter` (in `src/game/input/`) reads these and translates keyboard events into an `InputState` struct; `inputAdapter.getInputState(timeMs)` is the only thing simulation sees. Double-tap run detection lives in the adapter, not in the simulation.
- **`src/audio/`** — Web Audio API synth. Entirely independent; `GameplayScene.dispatchAudio` inspects `state.vfxEvents` and phase transitions to trigger sounds. Do not call audio from inside `simulation/`.
- **`src/screens/`** — React screens (`TitleScreen`, `MainMenu`, `CharSelect`, `GuildDetails`, `GameScreen`, `GameOverScreen`). Only `GameScreen` mounts Phaser; the others are menus. `App.tsx` is the screen router (plain `useState`, no router library).
- **`src/layout/`** — wraps the whole app in a 16:9 letterbox (`ScalingFrame`) and owns the browser Fullscreen API (`F` key, `fullscreenchange` listener). Emits a `FULLSCREEN_EXIT_EVENT` on `window` so `GameplayScene` can auto-pause on exit. New screens render inside `ScalingFrame` — don't reach for `minHeight: 100vh`. `useFullscreen()` hook lives in `useFullscreen.ts`; the constant lives in `fullscreenConstants.ts`; the component in `ScalingFrame.tsx`.

## Game loop (`src/game/scenes/GameplayScene.ts`)

Phaser's rAF drives everything. `GameplayScene.update(_, delta)`:

1. Compute `dtMs = Math.min(50, delta)` (clamp for tab-switches).
2. `inputAdapter.getInputState(simTime + dtMs)` → build `InputState`.
3. `tickSimulation(state, inputState, dtMs)` → new `SimState` (re-assign `this.simState`).
4. `inputAdapter.clearJustPressed()` — must happen after the tick.
5. Emit `phase-change` on `this.game.events` when phase transitions; this is how React knows to show `PauseOverlay`.
6. `dispatchAudio(prevPhase, inputState)` — peeks at `state.vfxEvents` and phase to play SFX/music.
7. `reconcileActors/Projectiles/Pickups` — maintain Map<id, View> with create/sync/destroy per tick; sprites are depth-sorted by `actor.y`.
8. `consumeVfxEvents(this, state.vfxEvents)` — spawns tweened particles for hit sparks, damage numbers, blink trails, etc.
9. Registry `simState` set for the HUD scene to pull.
10. Phase transitions to `victory`/`defeat` → stop music, play sting, `delayedCall(1500, callback)`.

`resetController(this.simState, 'player')` is called in `create` and on scene shutdown — actor controller state in `simulation/` is held in module-level maps keyed by actor id, so retries/re-mounts must reset it or stale input bindings leak across runs.

Keybinds: movement on arrow keys; `Space` jump; `J` attack; `K` block; `L` grab; `P` pause (previously `Esc`, remapped so browser fullscreen doesn't hijack); `F` fullscreen. Defaults and migration in `src/input/keyBindings.ts`.

## Phaser conventions

- **Scene keys**: `'Boot'`, `'Gameplay'`, `'Hud'`. `HudScene` runs in parallel to `GameplayScene` (launched, not started).
- **React ↔ Phaser bridge**: `game.registry` for pull-style state (`guildId`, `callbacks`, `simState`, `isFullscreen`); `game.events` / `scene.events` for push-style commands (`phase-change`, `pause-requested`, `resume-requested`, `restart-requested`). React never reaches into `simState` to mutate it.
- **No simulation in scene code.** Scenes may only call the exported simulation functions (`tickSimulation`, `forcePause`, `forceResume`, `createInitialState`, `resetController`). Keep new rules inside `packages/shared/src/simulation/`.
- **Animation keys**: `${guildId}:${animId}` (see `AnimationRegistry.ts`); texture keys are `tex:${guildId}:${animId}`. Sprites fall back through `FALLBACK` chains when a guild lacks a specific animation.
- **Depth sort**: containers set `setDepth(actor.y)` for 2.5D sort; VFX uses `setDepth(y + 1000)` so particles draw above same-plane actors.
- **No `Date.now()`/`setTimeout`/`requestAnimationFrame` in scene code.** Use `this.time.delayedCall` and `delta` from `update`.

## Combo / ability system

Inputs are grammar strings, not discrete ability buttons. Five combo slots per guild: `↓↓J`, `→→J`, `↓↑J`, `←→J`, `↓↑↓↑J`, plus `K+J` RMB utility. The flow:

- `comboBuffer.ts` accumulates directional presses with a time window (`COMBO_WINDOW_MS`).
- On attack press, `detectComboFromInput` matches the buffer against the guild's `AbilityDef.combo` strings from `guildData.ts`.
- Match → run the ability (cost, cooldown, cast time, projectile/teleport/summon/channel variants all flow through `AbilityDef` flags in `types.ts`).
- No match → default basic attack chain (attack_1 → attack_2 → attack_3, governed by `COMBO_ATTACK_WINDOW_MS`).

When adding a guild ability, extend `guildData.ts` using the `makeAbility` helper (it supplies sensible defaults for the many optional fields) rather than hand-rolling the full `AbilityDef`.

## Actor / state shape

`Actor` in `types.ts` is a flat struct carrying data for every guild/enemy variant (e.g. `chiOrbs`, `sanity`, `bloodtally`, `dishes`, `shapeshiftForm`, `bossPhase`). This is intentional — it keeps the simulation allocation-light and serializable. New per-guild state goes on `Actor` as an optional-ish field, not in a side map.

`SimState.phase` drives top-level flow: `'playing' | 'paused' | 'victory' | 'defeat'`. `vfxEvents` is a per-frame array consumed by both rendering (Phaser tweens) and audio.

## Coordinate system (2.5D)

- `x` = world x (scrolls with camera; world is `WORLD_WIDTH = 4000` wide).
- `y` = depth plane (`GROUND_Y_MIN..GROUND_Y_MAX`, ~60..380). Stepping up/down on the screen is a *dodge axis*, not vertical.
- `z` = fake elevation (jumps). `z = 0` is grounded.
- Hit detection uses `ATTACK_Y_TOLERANCE` on the depth axis — attacks whiff if the depth planes don't overlap.

Don't confuse `y` (depth) with screen-y; `src/game/constants.ts::worldYToScreenY` and `DEPTH_SCALE` project them.

## Asset / persistence notes

- Placeholder art: `ActorView` falls back to a colored rounded rectangle + initial letter for actors without sprite metadata (currently all enemies). Guild/enemy colors and initials come from `guildData.ts` / `enemyData.ts`.
- Guild sprites: `public/sprites/<guildId>/` contains per-animation PNG strips + `metadata.json` generated by `scripts/composite-pixellab-sprites.py`. Loaded in `BootScene.preload` via `queueGuildSprites`.
- No audio files — everything synthesized in `audioManager.ts`.
- Only persistence is `localStorage` (volume settings, key bindings via `input/keyBindings.ts`).
- `assets-old/` and `lore-old/` are historical; ignore them unless the task is explicitly about reviving that content.

## Tooling conventions

- `.bolt/prompt` asks for production-quality, non-cookie-cutter UI and restricts new packages to existing ones (React, Tailwind, lucide-react, Phaser). Honor this when touching menu screens.
- Tailwind is configured but most screens use inline styles (see `App.tsx`, `GameScreen.tsx`). Match the surrounding file's style rather than mixing the two.
- `tsconfig.app.json` has `noUnusedLocals` / `noUnusedParameters` enabled — leftover imports will break `npm run typecheck`.
