# CLAUDE.md

Guidance for Claude Code (Opus 4.7) working in this repo. Terse on purpose — every line here is context tax. Pointers > prose; read the file paths referenced rather than memorizing snippets.

## Project in one paragraph

Browser-native 2.5D side-scrolling beat-'em-up (Little Fighter 2 style). Vite + React + TypeScript + Phaser 3 on the client; Colyseus + Node on the server for 1v1 multiplayer. The simulation is a pure-TS package shared between client (for SP) and server (for MP authority). React runs menus, Phaser runs the game canvas, Colyseus syncs state between two browsers. See `README.md` for the player-facing description.

## Commands

```bash
npm run dev         # concurrently: Vite client + Colyseus server (ports 5173, 2567)
npm run dev:client  # client only
npm run dev:server  # server only (swc-node register; NOT tsx — tsx crashed under watch)
npm run build       # client build to dist/
npm run typecheck   # tsc on src/ + packages/shared/
npm run lint        # ESLint flat config
npm test            # Vitest — ALL tests must pass, golden sim test is the determinism gate
npm run test:screens  # Playwright screen tour — 38 screens, SP+MP, writes screen-tour-report/REPORT.md
npx tsx scripts/balance-runner.ts  # headless 15×15 guild win-rate matrix (~3-5 min); writes scripts/balance-output.csv
```

## Balance tooling

`scripts/balance-runner.ts` runs 20 bot-vs-bot matches per guild pairing (4500 total) at max AI difficulty and outputs a win-rate matrix. Use it whenever guild stats or AI strategy configs change.

**To run a balance pass:**

```bash
npx tsx scripts/balance-runner.ts   # run from repo root or the bot-optimization worktree
```

Output: 15×15 win-rate matrix printed to stdout + `scripts/balance-output.csv`.

**Tuning levers (in `packages/shared/src/simulation/guildData.ts`):**

1. **Strategy** (`strategy` block on each guild) — adjust `priority`, range conditions (`useAtCloseRange`/`useAtLongRange`), `retreatBelowHpPct`, `blockOnReaction`, `preferRange`. Free to change; doesn't affect human gameplay feel.
2. **Stats** — `hpMax`, `armor`, `magicResist`, `moveSpeed` on the guild object.
3. **Ability params** — `baseDamage`, `cost`, `cooldownMs` on individual `AbilityDef` entries.

**Target:** all 15 guilds within 40–60% overall win rate. Current baseline is committed at `scripts/balance-output.csv`.

**Trigger phrase for Claude:** "run a balance pass" — Claude will edit strategy/stats, iterate the runner until guilds converge, and commit the updated CSV.

## Top layout

```
src/                           # Vite client
  game/                        # Phaser layer (scenes, views, net glue)
  screens/                     # React screens (menus, lobby, char/stage select, in-game host)
  audio/                       # Web Audio synth
  input/                       # keyBindings; PhaserInputAdapter lives in game/input/
  layout/                      # 16:9 letterbox + fullscreen
  state/                       # top-level React screen router state
packages/shared/src/           # deterministic simulation + Colyseus schema + wire protocol
  simulation/                  # pure TS — combat, AI, physics, abilities
  schema/                      # @colyseus/schema classes (SimStateSchema mirrors SimState)
  protocol/                    # client↔server message types
packages/server/src/           # Colyseus MatchRoom + entry point
```

## The one rule that matters most

**Layer dependency flow is one-way. Do not cross it.**

```
input/keyBindings ─►  @nannymud/shared/simulation  ◄─ (read-only) ── src/game/ (Phaser)
                             ▲
audio/ ──────────────────────┘ (reads vfxEvents + phase transitions)
```

Concretely:
- Nothing under `packages/shared/src/simulation/**` may import Phaser, React, a DOM API, `window`, `Math.random`, `Date.now`, `setTimeout`, or anything else non-deterministic. ESLint enforces this. Use `state.rng()` for rolls, tick-based countdowns for timers, `state.next*Id` counters for IDs.
- `src/game/**` **reads** `SimState`; it never mutates it. `GameplayScene.update` calls `tickSimulation(state, input, dt)` and re-assigns the result.
- `src/audio/**` reads `state.vfxEvents` and phase transitions. Do not invoke audio from simulation code.
- Render-only constants (`VIRTUAL_WIDTH/HEIGHT`, `DEPTH_SCALE`, `worldYToScreenY`, `SCREEN_Y_BAND_*`, `HUD_TOP_PX`) live in `src/game/constants.ts`. Simulation's own depth/world constants (`GROUND_Y_MIN/MAX`, `WORLD_WIDTH`, `PLAYER_SPAWN_X`) live in `packages/shared/src/simulation/constants.ts`. Never mix them.

The golden determinism test at `packages/shared/src/simulation/__tests__/golden.test.ts` is the gate that enforces purity. If it fails after your changes, you introduced non-determinism — fix it; don't update the golden.

## Gameplay architecture (read the files before changing)

- `src/game/scenes/GameplayScene.ts` — rAF loop. SP: `tickSimulation` every frame. MP: server ticks; client reconciles via `onStateChange` and interpolates positions 50ms behind real time (`StateSync`). VFX consumption happens in `onStateChange` for MP (not `update`) so effects fire once per tick, not per frame.
- `src/game/view/{ActorView,ProjectileView,PickupView,ParticleFX}.ts` — per-entity views, reconciled per tick. Cache the `ScreenYBand` at construction via `getScreenYBand(scene)`.
- `src/input/keyBindings.ts` — localStorage-backed keymap. `PhaserInputAdapter` turns keys into `InputState`; double-tap run lives in the adapter, not sim.
- `packages/shared/src/simulation/simulation.ts::tickSimulation` — dispatches to `tickVsSimulation` when `state.mode === 'vs'`, otherwise the wave/story loop.
- `packages/server/src/rooms/MatchRoom.ts` — authoritative MP room. Applies client inputs via `opponentInput` param on `tickSimulation`, broadcasts via @colyseus/schema.

## Coordinate system

- `x` world-x (0..WORLD_WIDTH=4000), scrolls with camera
- `y` **depth plane** (GROUND_Y_MIN=60..GROUND_Y_MAX=380) — dodge axis, not screen-y
- `z` fake elevation (jumps). `z=0` = grounded
- Hit detection uses `ATTACK_Y_TOLERANCE` on the depth axis — attacks whiff if planes don't overlap

`worldYToScreenY(y, band.min, band.max)` projects depth → scene-y. The band is mode-dependent (story fills the canvas; VS/MP has HUD gutters); views read it once from `game.registry` via `getScreenYBand(scene)`.

## Combo / ability grammar

Combos are directional input sequences, not buttons: `↓↓J`, `→→J`, `↓↑J`, `←→J`, `↓↑↓↑J`, `K+J` (RMB). `comboBuffer.ts` accumulates presses; `detectComboFromInput` matches against `AbilityDef.combo` in `guildData.ts`. No match → basic attack chain. Adding an ability: use `makeAbility` in `guildData.ts` — don't hand-roll the full `AbilityDef`.

## Actor shape

`Actor` in `types.ts` is a flat struct carrying every guild/enemy variant's state (`chiOrbs`, `sanity`, `bloodtally`, `dishes`, `shapeshiftForm`, `bossPhase`, …). Intentional — serializable and allocation-light. New per-guild state is a new optional-ish field on `Actor`, not a side map.

## MP specifics

- Server authoritative: client sends inputs only, receives state. `state.player` = host, `state.opponent` = joiner. Both have `isPlayer = true`.
- `MatchPhase` drives UI routing in `App.tsx`: `'lobby' | 'char_select' | 'stage_select' | 'loading' | 'in_game' | 'results'`.
- `colyseus.js` EventEmitters return the emitter, not an unsubscriber. To deregister: `room.onStateChange.remove(handler)`. Same pattern for `room.onLeave`.
- Colyseus schema instances are structurally typed to match `SimState`; the render path aliases them and reuses the SP code.
- Dev server: `node --watch --import @swc-node/register/esm-register`. Don't switch to tsx — its watcher hangs.
- Colyseus URL override: `VITE_COLYSEUS_URL` env var; defaults to `ws://localhost:2567`.

## Failure modes to avoid

Specific mistakes that have cost real time in this codebase:

- **Non-determinism slip**: any `Math.random()` / `Date.now()` / `performance.now()` / `setTimeout` inside `packages/shared/src/simulation/**` breaks MP consistency and the golden test. Use `state.rng()` / `state.timeMs` / tick-based counters.
- **Mutating Colyseus schema from the client**: schema is server-authored. The client reads the synced state only. Never mutate `room.state` on the client.
- **Forgetting `resetController`**: actor controller state is held in module-level maps keyed by actor id (in `simulation/`). Retries / scene re-mounts must `resetController(state, 'player')` or stale inputs leak across runs.
- **Registering event handlers without deregistering**: `game.events`, `scene.events`, `room.onStateChange`, `room.onLeave`, `window` (fullscreen). Always clean up in scene shutdown / React effect teardown.
- **Passing `VIRTUAL_HEIGHT` to `worldYToScreenY`**: the signature is `(worldY, screenYMin, screenYMax)`. Use `getScreenYBand(scene)` and the cached band.
- **Importing render constants into simulation**: `src/game/constants.ts` is client-only. Simulation uses `packages/shared/src/simulation/constants.ts`.
- **Leftover unused locals**: `tsconfig.app.json` has `noUnusedLocals` / `noUnusedParameters` on — orphan imports break `npm run typecheck`.
- **Running `npm run dev:server` expecting a free port 2567**: the user often already has one running in another terminal; check before starting a second.

## Conventions

- Scene keys: `'Boot'`, `'Gameplay'`, `'Hud'`. `HudScene` runs parallel to `GameplayScene` (launched, not started). React HUD overlays in VS/MP mode instead of `HudScene`.
- React↔Phaser bridge: `game.registry` for pull state (`guildId`, `callbacks`, `simState`, `isFullscreen`, `screenYBand`); `game.events` / `scene.events` for push (`phase-change`, `pause-requested`, `resume-requested`, `restart-requested`, `preload-done`).
- Animation keys: `${guildId}:${animId}`; texture keys: `tex:${guildId}:${animId}`. See `AnimationRegistry.ts` — sprites fall back through chains when a guild lacks an animation.
- Depth sort: containers set `setDepth(actor.y)` for 2.5D ordering; VFX uses `setDepth(y + 1000)`.
- Keybinds: arrows move; `Space` jump; `J` attack; `K` block; `L` grab; `P` pause (remapped from Esc so fullscreen doesn't hijack); `F` fullscreen.
- Tailwind is configured but most screens use inline styles. Match the surrounding file rather than mixing.
- `.bolt/prompt` restricts new packages: keep to React, Tailwind, lucide-react, Phaser, Colyseus. No new runtime deps without discussion.
- `assets-old/`, `lore-old/` are historical. Ignore unless the task is explicitly about reviving that content.

## Design docs

Substantial work is planned in `docs/superpowers/plans/` and spec'd in `docs/superpowers/specs/`. When starting a multi-step feature, check there first — a plan may already exist.

## Orchestrator

**Trigger phrase: "orchestrator run"**

When the user says "orchestrator run" (or a close variant), start a self-paced loop using `/loop` with the prompt below. The loop polls GitHub Issues, dispatches agents by lane, and updates issue state.

### Loop prompt

```
You are the Nannymud orchestrator. Follow agents/orchestrator.md exactly.

Each iteration:

1. Query open issues on shaunnez/nannymudnz with label "todo" via the GitHub REST API
   (Authorization: token $GITHUB_TOKEN or the token in use this session).
   Filter to issues that also have a lane: label (lane:dev, lane:asset, lane:qa, lane:design, lane:reviewer).

2. Select the next safe batch — at most:
   - 1 lane:dev task
   - 1 lane:asset task
   - 1 lane:design task
   Respect disjoint write scope. Do not queue two tasks that touch the same sim or scene files.

3. For each selected issue:
   a. Move label from "todo" to "in-progress" via the API.
   b. Derive branch name: codex/issue-{number}-{slug}
      Derive worktree path: .worktrees/issue-{number}-{slug}
   c. Dispatch a sub-agent using the Agent tool with isolation: worktree, briefed against
      the relevant agents/*.md spec and the issue body.
   d. When the sub-agent completes, move the label to "qa" (for dev/design tasks)
      or "review" (for asset tasks that need human sign-off).
   e. If QA is needed, dispatch a qa agent against the same branch.
   f. On QA pass, move label to "done". On failure, move to "todo" and add a comment
      with the rejection reason.
   g. Include in the orchestrator report any new GitHub issues the QA agent raised
      during verification (bugs found incidentally, not just the assigned task).

4. If no actionable issues exist, report the idle state and sleep until the next iteration.

Always read agents/orchestrator.md before dispatching. Never dispatch from agents/_historical/.
Token for GitHub API: use the token already authenticated this session, or prompt the user to set GITHUB_TOKEN.
```

### Usage

```
orchestrator run
```

Claude will start a self-paced `/loop` — no interval argument needed, it paces itself based on how long dispatch takes. To stop it, press Escape or Ctrl+C.

GitHub token must be available. Either set `GITHUB_TOKEN` in your shell before starting, or Claude will use the token from the current session if one was provided.
