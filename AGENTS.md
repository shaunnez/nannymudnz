# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Nannymud — a browser-native, single-player 2.5D side-scrolling beat-'em-up (Little Fighter 2 style). Vite + React + TypeScript. No backend; `@supabase/supabase-js` is a dependency but is not currently wired in. Gameplay is drawn on a `<canvas>`; React is used only for menu screens and mounting the game loop.

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

Tests run via Vitest. `src/simulation/__tests__/golden.test.ts` is the reproducibility gate — if it fails after a change in `src/simulation/**`, you have introduced non-determinism and the Colyseus rewrite (see `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md`) will be harder. Keep it green.

## Architecture: strict layer separation

The codebase enforces a one-way dependency flow. Respect it when adding features — crossing these boundaries is the single most important rule in this repo:

```
input/  ──►  simulation/  ◄── (read-only) ──  rendering/
                  ▲
audio/  ──────────┘ (reads VFX events + phase transitions only)
```

- **`src/simulation/`** — pure TypeScript. Combat, AI, physics, wave progression, status effects, HP/MP, combo detection. **No DOM, no canvas, no `window`, no browser APIs.** It must remain portable to a Node server. Nothing non-deterministic is permitted — no `Math.random()`, no `Date.now()`, no `setTimeout`, no module-level mutable counters. Use `state.rng()` for rolls, tick-based countdown fields for timers, and `state.next*Id` counters for IDs. The ESLint override on `src/simulation/**` enforces this.
- **`src/rendering/`** — Canvas 2D drawing. **Reads** `SimState`; never mutates it. `GameRenderer` delegates per-actor drawing to an `ActorRendererImpl` (see `actorRenderer.ts`). Swapping placeholder art for sprites = implement that interface and inject a new impl in `GameRenderer`. Don't read rendering concepts back into simulation types. Render-only constants (`VIRTUAL_WIDTH`, `VIRTUAL_HEIGHT`, `CANVAS_BUFFER_WIDTH`, `CANVAS_BUFFER_HEIGHT`, `RENDER_SCALE`, `DEPTH_SCALE`) live in `src/rendering/constants.ts` — never in `src/simulation/constants.ts`. The game loop in `GameScreen.tsx` applies `ctx.setTransform(RENDER_SCALE, …)` once per frame so the renderer draws in virtual 900×506 units and the transform upscales to the 1600×900 backing buffer.
- **`src/input/`** — translates `KeyboardEvent`s into an `InputState` struct. `inputManager.getInputState(timeMs)` is the only thing simulation sees. Double-tap run detection lives here, not in the simulation.
- **`src/audio/`** — Web Audio API synth. Entirely independent; `GameScreen` inspects `state.vfxEvents` and phase transitions to trigger sounds. Do not call audio from inside `simulation/`.
- **`src/screens/`** — React screens (`TitleScreen`, `GuildSelect`, `GameScreen`, `GameOverScreen`). Only `GameScreen` runs the loop; the others are menus. `App.tsx` is the screen router (plain `useState`, no router library).
- **`src/layout/`** — wraps the whole app in a 16:9 letterbox (`ScalingFrame`) and owns the browser Fullscreen API (`F` key, `fullscreenchange` listener). Emits a `FULLSCREEN_EXIT_EVENT` on `window` so `GameScreen` can auto-pause on exit. New screens render inside `ScalingFrame` — don't reach for `minHeight: 100vh`. `useFullscreen()` hook lives in `useFullscreen.ts`; the constant lives in `fullscreenConstants.ts`; the component in `ScalingFrame.tsx`.

## Game loop (`src/screens/GameScreen.tsx`)

One `requestAnimationFrame` loop drives everything:

1. Compute `dtMs` (clamped to 50ms to survive tab-switches).
2. `input.getInputState(simTime + dtMs)` → build `InputState`.
3. `tickSimulation(state, inputState, dtMs)` → new `SimState` (the simulation treats state as immutable-ish; always reassign `stateRef.current`).
4. `input.clearJustPressed()` — must happen after the tick, before the next frame.
5. Inspect `state.vfxEvents` and phase transitions → trigger audio.
6. `renderer.render(ctx, state, comboBuffer, w, h, dtMs, isFullscreen)`.
7. Stop looping when `state.phase` leaves `'playing' | 'paused'`.

`resetController(stateRef.current, 'player')` is called on mount and cleanup — actor controller state in `simulation/` is held in module-level maps keyed by actor id, so retries/re-mounts must reset it or stale input bindings leak across runs.

Keybinds: movement on arrow keys; `Space` jump; `J` attack; `K` block; `L` grab; `P` pause (previously `Esc`, remapped so browser fullscreen doesn't hijack); `F` fullscreen. Defaults and migration in `src/input/keyBindings.ts`.

## Combo / ability system

Inputs are grammar strings, not discrete ability buttons. Five combo slots per guild: `↓↓J`, `→→J`, `↓↑J`, `←→J`, `↓↑↓↑J`, plus `K+J` RMB utility. The flow:

- `comboBuffer.ts` accumulates directional presses with a time window (`COMBO_WINDOW_MS`).
- On attack press, `detectComboFromInput` matches the buffer against the guild's `AbilityDef.combo` strings from `guildData.ts`.
- Match → run the ability (cost, cooldown, cast time, projectile/teleport/summon/channel variants all flow through `AbilityDef` flags in `types.ts`).
- No match → default basic attack chain (attack_1 → attack_2 → attack_3, governed by `COMBO_ATTACK_WINDOW_MS`).

When adding a guild ability, extend `guildData.ts` using the `makeAbility` helper (it supplies sensible defaults for the many optional fields) rather than hand-rolling the full `AbilityDef`.

## Actor / state shape

`Actor` in `types.ts` is a flat struct carrying data for every guild/enemy variant (e.g. `chiOrbs`, `sanity`, `bloodtally`, `dishes`, `shapeshiftForm`, `bossPhase`). This is intentional — it keeps the simulation allocation-light and serializable. New per-guild state goes on `Actor` as an optional-ish field, not in a side map.

`SimState.phase` drives top-level flow: `'playing' | 'paused' | 'victory' | 'defeat'`. `vfxEvents` is a per-frame array consumed by both rendering (particles) and audio.

## Coordinate system (2.5D)

- `x` = world x (scrolls with camera; world is `WORLD_WIDTH = 4000` wide).
- `y` = depth plane (`GROUND_Y_MIN..GROUND_Y_MAX`, ~60..380). Stepping up/down on the screen is a *dodge axis*, not vertical.
- `z` = fake elevation (jumps). `z = 0` is grounded.
- Hit detection uses `ATTACK_Y_TOLERANCE` on the depth axis — attacks whiff if the depth planes don't overlap.

Don't confuse `y` (depth) with screen-y; `rendering/` applies `DEPTH_SCALE` to project them.

## Asset / persistence notes

- No art assets — `PlaceholderRenderer` draws colored rectangles with a letter initial. Guild/enemy colors and initials come from `guildData.ts` / `enemyData.ts`.
- No audio files — everything synthesized in `audioManager.ts`.
- Only persistence is `localStorage` (volume settings, key bindings via `input/keyBindings.ts`).
- `assets-old/` and `lore-old/` are historical; ignore them unless the task is explicitly about reviving that content.

## Tooling conventions

- `.bolt/prompt` asks for production-quality, non-cookie-cutter UI and restricts new packages to existing ones (React, Tailwind, lucide-react). Honor this when touching menu screens.
- Tailwind is configured but most screens use inline styles (see `App.tsx`, `GameScreen.tsx`). Match the surrounding file's style rather than mixing the two.
- `tsconfig.app.json` has `noUnusedLocals` / `noUnusedParameters` enabled — leftover imports will break `npm run typecheck`.
