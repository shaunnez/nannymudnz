# Phaser + Colyseus Rewrite — Design

**Date:** 2026-04-21
**Scope:** Migrate the gameplay layer from hand-rolled Canvas 2D to Phaser 3, and prepare the simulation for authoritative-server multiplayer via Colyseus. Phased so single-player keeps shipping the whole time; Colyseus lights up last.

## Goals

- Replace `src/rendering/` (Canvas 2D, ~1.4k LOC) with a Phaser 3 scene that draws from the same `SimState` the simulation already produces.
- Keep the simulation (`src/simulation/`) as the single source of game logic, lifted into a shared package so the Colyseus server can run it authoritatively later.
- Keep React menus (`TitleScreen`, `MainMenu`, `CharSelect`, `TeamConfig`, `GameOverScreen`, the terminal-theme screens landing from the screen-port effort) rendered in React. Only `GameScreen.tsx` changes.
- Remove the pre-conditions that would make multiplayer integration painful: kill `setTimeout` inside simulation, replace `Date.now()` with deterministic tick-based IDs, seed RNG, lift per-player controller state out of module scope, drop non-serializable types (e.g. `Set<string>`) from simulation structs.
- Unlock a real animation pipeline (atlases, state machines, tweens, camera effects, particles) to replace what `spriteLoader.ts` / `SpriteActorRenderer` / `ParticleSystem` reinvent.

## Non-goals

- **Rewriting the simulation.** Combat, AI, combo grammar, guild abilities, status effects, waves, and the `Actor` struct all stay. This doc is about plumbing, not mechanics.
- **Rewriting menus.** The in-progress screen port (`docs/superpowers/specs/2026-04-20-screen-port-design.md`) continues in React. Phaser only owns the gameplay scene.
- **Replacing React.** React remains the shell and screen router. Phaser mounts into a `<canvas>` inside `GameScreen.tsx`, the way the current renderer already does.
- **Replacing Vite or the build system.** Phaser 3 ships ESM and is compatible with Vite; expect a small `optimizeDeps.include: ['phaser']` entry and possibly `define: { 'typeof CANVAS_RENDERER': 'true', 'typeof WEBGL_RENDERER': 'true' }` to strip dead renderers from the bundle, but no build-tool replacement.
- **Client-side prediction / rollback netcode in the first cut.** Phase 4 ships with server-authoritative input dispatch + state reconciliation; prediction is a follow-up.
- **Godot.** Evaluated and rejected: rewriting ~3k LOC of TS simulation into GDScript/C# to gain tooling wins is net-negative when multiplayer is a hard requirement and Colyseus wants TS on the server.
- **Mobile/touch input.** Keyboard-first, as today.
- **Spectator mode, replays, or persistent accounts.** Out of scope for the rewrite.

## The four phases

The phases are ordered so each one ships a working game. Nothing is merged half-done.

### Phase 1 — Simulation purity pass (~3–5 days)

No externally-visible change. Game plays identically to a human tester. Typecheck stays green. This is the tax that keeps Phase 4 cheap. The estimate is larger than the first draft because the audit below turned up more sites than expected.

**1. Kill `setTimeout` inside simulation (2 sites):**

- `src/simulation/simulation.ts:759` — dodge recovery. Replace with a `dodgeMs` countdown on the `PlayerController` and recover inside `tickSimulation`.
- `src/simulation/ai.ts:286` — boss lunge zeroes `vx` after 300ms. Replace with a `lungeMs` field on `AIState`, decrement in `tickBossAI`.

**2. Deterministic IDs (all `Date.now()` and module-level counters):**

- `src/simulation/simulation.ts:298` (projectile from ability), `:807` (thrown pickup), `:933` (pickup drop) — all use `Date.now()`.
- `src/simulation/ai.ts:328` (spawned enemy id) uses `Date.now() + Math.random()`.
- `src/simulation/ai.ts:104` (archer projectile) uses module-level `projIdCounter` — different mechanism, same problem.
- `src/simulation/simulation.ts:22` — `actorIdCounter` is module-level.
- `src/simulation/combat.ts:5` — `effectIdCounter` is module-level.
- `src/simulation/simulation.ts:543` — `state_timeTracker` (champion bloodtally decay) is module-level.

  All of these move to `SimState`: `nextActorId`, `nextProjectileId`, `nextPickupId`, `nextEffectId`, `bloodtallyDecayMs`. IDs get produced as `` `${kind}_${state.nextFooId++}` ``. Any helper that currently takes an id (`spawnEnemyAt`, `addStatusEffect`, etc.) receives the relevant counter or mutates `state` directly.

**3. Lift module-level controller state:**

- `src/simulation/simulation.ts:193` — `const controllers = new Map<string, PlayerController>()`. This breaks for multiple players in the same process (server-side) and leaks across retries (already a bug today, mitigated by `resetController`). Move to `SimState.controllers: Record<string, PlayerController>`. `resetController` becomes `(state: SimState, playerId: string) => void`. `getOrCreateController` takes `state` as its first argument.

**4. Seeded RNG:**

- Add `src/simulation/rng.ts` exporting `makeRng(seed: number): () => number` (simple LCG or mulberry32, ~20 LOC).
- `SimState` gains `rngSeed: number` (serialized) and a non-serialized `rng: () => number` that `tickSimulation` reconstructs at entry each tick from `(rngSeed, tick)`. Keeps snapshots reproducible; Colyseus Schema never carries a function.
- Replace every `Math.random()` in `src/simulation/` with `state.rng()`. There are ~15 sites:
  - `simulation.ts:141, 143` (initial controller — `lastActionMs` jitter, `packRole` coin-flip)
  - `simulation.ts:454` (basic-attack damage variance)
  - `simulation.ts:583` (wave spawn-Y scatter)
  - `simulation.ts:621` (projectile-hit crit roll)
  - `simulation.ts:908` (leper miasma DoT gate), `:931, :933` (pickup drop roll and id)
  - `combat.ts:26` (`calcDamage` variance), `:36` (`checkCrit`)
  - `ai.ts:94` (melee damage jitter), `:284, :293` (boss dash/AoE rolls), `:320` (bandit spawn offset), `:368, :370` (spawn controller init)
- `checkCrit` and `calcDamage` in `combat.ts` must now accept `rng: () => number` as a parameter (they don't currently see `state`). Callers pass `state.rng`.

**5. Non-serializable fields:**

- `Projectile.hitActorIds: Set<string>` → `hitActorIds: string[]` (use `includes`/`push`; pierce sets are ≤ a handful of entries).
- Re-audit `src/simulation/types.ts` for any `Set`, `Map`, `Date`, or class instances; plain objects/arrays/primitives only.

**6. Lint gate:**

- Add an `eslint.config.js` override scoped to `src/simulation/**`:
  - `no-restricted-globals`: ban `window`, `document`, `localStorage`, `setTimeout`, `setInterval`, `Date`, `performance`. (These catch global references; grep confirms DOM names are absent today, but the rule prevents regressions.)
  - `no-restricted-syntax`: additional selector to ban `Math.random()` — `CallExpression[callee.object.name='Math'][callee.property.name='random']`. Without this selector, the RNG discipline is unenforced, because `Math.random` is a property access, not a restricted global. The existing `no-restricted-globals` list cannot catch it on its own.
- Lint must fail CI for these rules, not warn.

**7. Golden-state reproducibility test:**

- Add a lightweight test runner (see Decisions) and `src/simulation/__tests__/golden.ts`: tick a scripted `InputState` sequence for N frames with a fixed seed, snapshot `SimState`, assert deep-equality on a second run. This is the only way to keep Phase 1 honest — without it the purity claims rot silently.

**Done when:**

- `npm run typecheck` passes.
- `npm run lint` passes with the new `src/simulation/**` override.
- Golden-state test passes (same seed + same inputs → identical `SimState`).
- A human tester spot-checks a few minutes of play and can't distinguish it from the pre-change build. Note: this is *subjectively* indistinguishable, not byte-identical — swapping `Math.random()` for a seeded stream necessarily produces different specific rolls.

### Phase 2 — Phaser port (~1–2 weeks)

Replace `src/rendering/` with Phaser. Simulation untouched. Menus untouched.

**New layout:**

```
src/
├── game/                       NEW — Phaser client
│   ├── PhaserGame.ts           Phaser.Game factory (resolution, scale manager)
│   ├── scenes/
│   │   ├── BootScene.ts        asset manifest, loading bar
│   │   ├── GameplayScene.ts    the scene that runs tickSimulation + renders
│   │   └── HudScene.ts         overlay scene for HUD/pause (separate camera)
│   ├── view/
│   │   ├── ActorView.ts        wraps a Phaser.GameObjects.Sprite, bound to an actor id
│   │   ├── ProjectileView.ts
│   │   ├── PickupView.ts
│   │   └── ParticleFX.ts       tween + Phaser particle emitter wrappers
│   ├── input/PhaserInputAdapter.ts  builds InputState from Phaser keyboard
│   └── assets/manifest.ts      atlas/audio declarations
├── rendering/                  DELETED
├── input/inputManager.ts       DELETED (PhaserInputAdapter replaces it)
├── screens/GameScreen.tsx      REWRITTEN — mounts PhaserGame, forwards props
└── audio/audioManager.ts       UNCHANGED — Phaser has an audio system, but keeping
                                the existing Web Audio synth avoids a second rewrite
```

**Scene responsibilities:**

- `GameplayScene.update(time, delta)` calls `tickSimulation(state, input, delta)` exactly the way `GameScreen.tsx` does today.
- After the tick, it reconciles its `Map<actorId, ActorView>` against `state.enemies + state.allies + [state.player]`: spawn views for new actors, update transforms on existing ones (`x, y - z * 0.6`, facing-flip), despawn on death + animation completion.
- Depth sort by `y` (manual, Phaser's `depth` property). 2.5D remains a render convention; simulation keeps its `(x, y, z)` tuple unchanged.
- Parallax background becomes a `TileSprite` layer per hill plus a gradient image; camera follows `state.cameraX`.
- HUD (`src/rendering/hud.ts`) reimplements on `HudScene` using Phaser text + graphics + the existing tween engine for damage-number float-up.
- `vfxEvents` consumption moves into `GameplayScene` — `hit_spark` / `aoe_pop` / `blink_trail` / `damage_number` each map to a Phaser tween or particle emitter.
- **Audio triggers move too.** The `audio.playAttack()` / `playHeal()` / `playBlock()` / `playJump()` calls currently living in `GameScreen.tsx`'s rAF loop (which inspect `state.vfxEvents` and `state.player.state`) move into `GameplayScene.update` after the tick runs. React no longer has per-tick state to read, so it cannot drive audio. `AudioManager` itself is unchanged — only the call sites relocate.

**Sprite pipeline:**

- The current `spriteLoader.ts` / `SpriteActorRenderer` work is discarded. Texture atlases generated per guild/enemy become Phaser atlases; `AnimationManager` registers animations keyed by `${actorKind}:${animationId}`.
- `ActorView.setAnimation(animationId)` is a pass-through to `sprite.play(key, ignoreIfPlaying=true)`.
- Placeholder fallback: if an atlas is missing, render a colored rect with the initial letter (same as today), drawn via `Phaser.GameObjects.Graphics`.

**GameScreen.tsx:**

```tsx
useEffect(() => {
  const game = new Phaser.Game(makeConfig(canvasRef.current!, guildId, callbacks));
  return () => game.destroy(true);
}, [guildId]);
```

React still owns mount/unmount, prop forwarding (guildId, onVictory, onDefeat, onQuit), fullscreen hook, and `FULLSCREEN_EXIT_EVENT` wiring.

**Done when:** every feature currently visible in the canvas renderer (parallax, actors, projectiles, pickups, HUD, boss bar, pause overlay, controls hint, damage numbers, particles) is reproduced in Phaser, and `npm run dev` plays identically.

### Phase 3 — Build single-player content on Phaser (open-ended)

No further architectural change. New guilds, new levels, new abilities, new VFX, new menus all land here. This phase exists explicitly in the plan so we don't rush into Phase 4; the simulation stays pure because Phase 1 locked the discipline in.

**Exit criteria:** the team decides multiplayer is the next priority. No technical gate.

### Phase 4 — Colyseus integration (~1 week + netcode tuning)

Lift the simulation to a shared package. Run it on the server. Client becomes a thin renderer + input producer.

**New layout:**

```
/
├── packages/
│   ├── shared/                 NEW — simulation as a workspace package
│   │   ├── src/
│   │   │   ├── simulation/     MOVED from src/simulation/
│   │   │   ├── schema/         Colyseus Schema mirrors of SimState/Actor/etc.
│   │   │   └── index.ts
│   │   └── package.json
│   └── server/                 NEW — Colyseus authoritative server
│       ├── src/
│       │   ├── index.ts        Colyseus.Server bootstrap
│       │   ├── rooms/
│       │   │   └── MatchRoom.ts  runs tickSimulation on a fixed tick
│       │   └── MatchState.ts   extends Schema, holds the SimState mirror
│       └── package.json
├── src/                        client
│   ├── game/
│   │   ├── net/
│   │   │   ├── ColyseusClient.ts   wraps colyseus.js Client + Room
│   │   │   └── StateSync.ts         applies Schema deltas → local SimState mirror
│   │   └── scenes/GameplayScene.ts MODIFIED — does not call tickSimulation;
│   │                                subscribes to room state and renders
│   └── simulation/             MOVED — every `src/` import migrates to
│                                `@nannymud/shared/simulation`. No shim.
└── package.json                workspaces: ["packages/*"]
```

**Room loop:**

- `MatchRoom` sets `this.setPatchRate(50)` (20 Hz state patches) and runs a `setSimulationInterval((dt) => tickSimulation(this.state, this.collectInputs(), dt), 1000/60)`.
- Clients send `room.send('input', InputState)` each frame. Server coalesces inputs per player per tick.
- `MatchState` is a Colyseus `Schema`. Mapping helpers in `packages/shared/src/schema/` convert between the plain `SimState` used by the tick function and the Schema instance.

**Client changes:**

- `GameplayScene` stops calling `tickSimulation`. Instead it subscribes to `room.state`: on every patch it diffs actors against the local `ActorView` map (the same reconcile code written in Phase 2) and interpolates transforms between patches so 20 Hz patches don't look choppy at 60 FPS.
- `PhaserInputAdapter` still produces an `InputState` each frame, but instead of feeding it into a local `tickSimulation`, it ships it via `room.send('input', InputState)`.
- Between connect and the first patch there is **no local simulation**. The scene renders a "Connecting…" overlay until `room.onStateChange.once` fires. This is a deliberate choice for the first cut; it keeps the client trivially correct.
- Client-side prediction (locally ticking a mirror and rolling back on server reconciliation) is explicitly a follow-up. The overlay gets replaced by prediction only when measured latency makes it necessary. This is the single design lever we can pull if the server-authoritative feel is too laggy.

**Done when:** two browsers can connect to a local Colyseus server, pick guilds, and play the same match with server-authoritative combat and state sync.

## Architecture boundaries (post-rewrite)

Same one-way dep flow as today, with Colyseus slotted between the authoritative simulation (server) and the rendering client. The client holds a read-only `SimState` mirror populated by `ColyseusClient`; everything on the client reads from that mirror.

```
SERVER (packages/server)
  packages/server ──owns──► packages/shared/simulation
                                    │
                                    │ tickSimulation()
                                    ▼
                              room.state (Schema)
                                    │
                                    │ patches (20 Hz)
                                    ▼
─────────────────────────────────────────────────────────
CLIENT (src/)
  PhaserInputAdapter ──► ColyseusClient ──► client SimState mirror
                              ▲                      │
                              │                      ├──► game/ (Phaser views, read-only)
                              │                      │
                              │                      └──► audio/ (reads vfxEvents + phase)
                              │
                       InputState over socket
```

Rules that stay enforced:

- `packages/shared/simulation/` has zero DOM, zero `window`, zero `setTimeout`, zero `Math.random`. The ESLint scope added in Phase 1 (`src/simulation/**`) migrates to `packages/shared/src/simulation/**` when the code moves in Phase 4.
- `src/game/` never mutates `SimState`. It only reads.
- `packages/server/` imports from `packages/shared` and `colyseus`; it does not import from `src/`.
- React menus never import from `src/game/` or `packages/server/`.

## Risks and mitigations

- **Phaser 3 is a large API surface.** Mitigation: start `GameplayScene` as close to a 1:1 port of `gameRenderer.ts` as possible. Don't opportunistically adopt Phaser physics, Phaser cameras' bounds system, or scene transitions in Phase 2. Idioms can land in Phase 3.
- **Simulation "pure" cleanup is easy to get wrong.** Mitigation: a small golden-state test — tick a scripted input sequence for N frames, snapshot `SimState`, assert byte-equality on re-run with the same seed. Land this with Phase 1.
- **Colyseus Schema vs. plain `SimState`.** Colyseus emits deltas based on Schema mutations. If the tick function mutates plain TS objects, there are three ways to feed the Schema, each with different costs; we do not pick one in this spec because the right answer depends on profiling and the size of `SimState` after Phase 3:
  1. **Mutate the Schema in place inside `tickSimulation`.** Purest delta stream, smallest bandwidth. Contaminates the simulation with `@colyseus/schema` runtime types, which is the opposite of why we lifted it to `packages/shared` — this leaks a transport concern into the logic layer.
  2. **Run tick against plain types, then apply a plain→Schema diff.** Keeps the simulation pure. Needs a diff/applier utility (~200 LOC, not trivial) that understands every collection field. Delta stream is correct; CPU cost is one extra pass per tick.
  3. **Run tick against plain types, overwrite Schema wholesale each tick.** Simplest code; every tick ships full state. Bandwidth grows with actor count — fine for 2-player small matches, probably unacceptable for 4+ players with many projectiles.
  Decision deferred to Phase 4 kickoff, when we can measure `SimState` size in bytes with real content. Phase 4 plan-doc owns picking one.
- **Two-phase gap (Phase 2 rendering regression).** Mitigation: Phase 2 is a single branch merged only when feature-parity is reached. Don't ship a half-ported GameplayScene to main.
- **React + Phaser lifecycle hazards (double-mount in StrictMode, HMR).** Mitigation: destroy the Phaser instance in the effect cleanup; guard with a ref; disable StrictMode for `GameScreen` if necessary.

## Decisions made (to avoid re-litigation)

- **Phaser 3, not Phaser 4.** Phaser 4 is still stabilizing; Phaser 3 is battle-tested and the docs/plugins ecosystem is broader.
- **Colyseus, not socket.io + custom loop.** Colyseus ships Schema, rooms, patch rate, matchmaking, monitoring — all of which we'd build by hand otherwise.
- **No ECS framework.** The existing `Actor` struct is already flat and allocation-light, per CLAUDE.md. Dropping an ECS in would be a second rewrite disguised as a refactor.
- **Keep Web Audio synth.** `audioManager.ts` is 232 LOC and works. Phaser's audio system isn't a strict upgrade for synthesized SFX. Revisit only if sampled audio arrives.
- **Keep React menus.** The in-progress screen port is the right shape; Phaser gameplay slots under the existing `screen === 'game'` branch.
- **Adopt Vitest** as the test runner for the golden-state test and whatever follows. CLAUDE.md currently says no test runner is configured; this spec adds one. Vitest chosen over `node --test` because it reuses the existing Vite config for TS transforms, runs in watch mode cleanly, and supports the same `import.meta` / ESM idioms the rest of the codebase uses. Script: `npm run test`. Location: `src/**/__tests__/*.test.ts` initially; may relocate to `packages/shared/test/` in Phase 4.

## Phase 1 file summary

Phase 1 above names every site. At the file level the touch-map is:

- `src/simulation/rng.ts` — new.
- `src/simulation/types.ts` — `SimState` gains `rngSeed`, `rng`, `nextActorId`, `nextProjectileId`, `nextPickupId`, `nextEffectId`, `bloodtallyDecayMs`, `controllers`. `Projectile.hitActorIds` becomes `string[]`. `AIState` gains `lungeMs`.
- `src/simulation/simulation.ts` — largest diff: module-level `controllers`, `actorIdCounter`, `state_timeTracker` all move to `SimState`; `setTimeout` dodge recovery becomes `dodgeMs`; `Date.now()` ids replaced; all `Math.random()` calls threaded through `state.rng`.
- `src/simulation/ai.ts` — `projIdCounter` moves to `SimState`; boss-lunge `setTimeout` → `lungeMs`; `Date.now()` in `spawnEnemyAt` replaced; `Math.random()` → `state.rng()`.
- `src/simulation/combat.ts` — `effectIdCounter` moves to `SimState`; `checkCrit` and `calcDamage` gain an `rng: () => number` parameter.
- `src/simulation/comboBuffer.ts` — already pure.
- `src/screens/GameScreen.tsx` — one-line diff: `resetController(stateRef.current, 'player')`.
- `eslint.config.js` — new override for `src/simulation/**` with `no-restricted-globals` + `no-restricted-syntax`.
- `package.json` + `vitest.config.ts` — add Vitest and `test` script.
- `src/simulation/__tests__/golden.test.ts` — new reproducibility test.

Phase 2 and Phase 4 each need their own plan document when they come up; they're too large to pin at the file level from this distance.

## Open questions

- **Sprite asset pipeline.** Current work lives under `scripts/` and `public/` (per git status); after Phase 2, atlas generation needs to target Phaser's atlas JSON format. Decide whether to keep the existing pixellab-driven generation scripts or adopt TexturePacker / free-tex-packer. Decision deferred to Phase 2 kickoff.
- **Fixed timestep.** Simulation currently runs at variable `dtMs` clamped to 50. Colyseus prefers fixed-step (e.g. 60 Hz); the simulation handles variable `dtMs` today. Phase 4 will need to decide whether to fix the step server-side and accumulate on the client, or keep variable and live with minor drift. Revisit at Phase 4 kickoff.
- **Authentication / accounts.** Colyseus supports JWT auth hooks. Out of scope here; surfaces again when we decide how players identify themselves.
