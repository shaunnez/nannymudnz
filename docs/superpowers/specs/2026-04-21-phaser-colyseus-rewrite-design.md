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
- **Replacing Vite or the build system.** Phaser ships ESM; it drops in.
- **Client-side prediction / rollback netcode in the first cut.** Phase 4 ships with server-authoritative input dispatch + state reconciliation; prediction is a follow-up.
- **Godot.** Evaluated and rejected: rewriting ~3k LOC of TS simulation into GDScript/C# to gain tooling wins is net-negative when multiplayer is a hard requirement and Colyseus wants TS on the server.
- **Mobile/touch input.** Keyboard-first, as today.
- **Spectator mode, replays, or persistent accounts.** Out of scope for the rewrite.

## The four phases

The phases are ordered so each one ships a working game. Nothing is merged half-done.

### Phase 1 — Simulation purity pass (~2–3 days)

No visible change. Game plays identically. Typecheck stays green. This is the tax that keeps Phase 4 cheap.

**Changes:**

- `src/simulation/simulation.ts:759` — dodge recovery currently uses `setTimeout`. Replace with `dodgeMs` on the `PlayerController` and recover inside `tickSimulation`.
- `src/simulation/ai.ts:286` — boss lunge uses `setTimeout` to zero `vx`. Replace with a `lungeMs` field on `AIState` and decrement in `tickBossAI`.
- `src/simulation/simulation.ts:298`, `ai.ts:104` — projectile IDs use `Date.now()` / counter mix. Replace with a `nextProjectileId` counter on `SimState`. IDs must be deterministic from `(tick, seq)`.
- `src/simulation/simulation.ts:193` — the module-level `controllers: Map<string, PlayerController>` must move. Per-actor controller state belongs on `SimState.controllers: Record<string, PlayerController>` (or on the `Actor` itself for fields that only matter per-actor). `resetController` becomes a function on the state, not a singleton side-effect.
- **Seeded RNG.** Add `src/simulation/rng.ts` exporting `makeRng(seed: number): () => number`. Replace every `Math.random()` in `src/simulation/` with `state.rng()`. `SimState` gains `rngSeed: number` (serialized) and a non-serialized `rng: () => number` that `tickSimulation` reconstructs at entry each tick from `(rngSeed, tick)` so snapshots are reproducible and Colyseus Schema never has to carry a function.
- **Non-serializable fields.** `Projectile.hitActorIds: Set<string>` → `hitActorIds: string[]`. Audit any other `Set`/`Map`/`Date` instances in simulation types.
- **No DOM references.** Grep confirms there are none today; add an ESLint rule (`no-restricted-globals`: `window`, `document`, `localStorage`, `setTimeout`, `setInterval`, `Date`) scoped to `src/simulation/**` so regressions fail lint.

**Done when:** `npm run typecheck` passes, gameplay is bit-for-bit equivalent (spot-check), and the ESLint gate is green.

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
│   └── simulation/             DELETED (re-exported from packages/shared)
└── package.json                workspaces: ["packages/*"]
```

**Room loop:**

- `MatchRoom` sets `this.setPatchRate(50)` (20 Hz state patches) and runs a `setSimulationInterval((dt) => tickSimulation(this.state, this.collectInputs(), dt), 1000/60)`.
- Clients send `room.send('input', InputState)` each frame. Server coalesces inputs per player per tick.
- `MatchState` is a Colyseus `Schema`. Mapping helpers in `packages/shared/src/schema/` convert between the plain `SimState` used by the tick function and the Schema instance.

**Client changes:**

- `GameplayScene` swaps its `tickSimulation` call for a subscription: when `room.state` changes, diff actors against the local `ActorView` map (same reconcile code as Phase 2).
- Input: `PhaserInputAdapter` still produces an `InputState`, but instead of feeding it into a local `tickSimulation`, it ships it over the room socket. The game still runs locally until the first patch arrives, so there's no blank-screen latency on connect.
- Client-side prediction (reconciling `room.state` against a locally-ticked copy with rollback) is deliberately deferred. First cut is pure server-authoritative; feel is evaluated, and prediction is added only if latency demands it.

**Done when:** two browsers can connect to a local Colyseus server, pick guilds, and play the same match with server-authoritative combat and state sync.

## Architecture boundaries (post-rewrite)

Same one-way dep flow as today, one new tier:

```
input/  ──►  simulation/  ◄── (read-only) ──  game/ (Phaser views)
                  ▲                                ▲
                  │                                │
           packages/server (Colyseus)    ColyseusClient
                                                   │
audio/  ──────────────────────────────────────────┘ (reads VFX events + phase transitions)
```

Rules that stay enforced:

- `packages/shared/simulation/` has zero DOM, zero `window`, zero `setTimeout`, zero `Math.random`. The ESLint scope added in Phase 1 (`src/simulation/**`) migrates to `packages/shared/src/simulation/**` when the code moves in Phase 4.
- `src/game/` never mutates `SimState`. It only reads.
- `packages/server/` imports from `packages/shared` and `colyseus`; it does not import from `src/`.
- React menus never import from `src/game/` or `packages/server/`.

## Risks and mitigations

- **Phaser 3 is a large API surface.** Mitigation: start `GameplayScene` as close to a 1:1 port of `gameRenderer.ts` as possible. Don't opportunistically adopt Phaser physics, Phaser cameras' bounds system, or scene transitions in Phase 2. Idioms can land in Phase 3.
- **Simulation "pure" cleanup is easy to get wrong.** Mitigation: a small golden-state test — tick a scripted input sequence for N frames, snapshot `SimState`, assert byte-equality on re-run with the same seed. Land this with Phase 1.
- **Colyseus Schema has its own mutation rules (arrays/maps are not plain arrays/maps).** Mitigation: keep the tick function pure over plain types in `packages/shared`; the Schema layer is a serialization mirror, updated from the plain state after each tick. Accept the double-write cost on day one; optimize if it profiles hot.
- **Two-phase gap (Phase 2 rendering regression).** Mitigation: Phase 2 is a single branch merged only when feature-parity is reached. Don't ship a half-ported GameplayScene to main.
- **React + Phaser lifecycle hazards (double-mount in StrictMode, HMR).** Mitigation: destroy the Phaser instance in the effect cleanup; guard with a ref; disable StrictMode for `GameScreen` if necessary.

## Decisions made (to avoid re-litigation)

- **Phaser 3, not Phaser 4.** Phaser 4 is still stabilizing; Phaser 3 is battle-tested and the docs/plugins ecosystem is broader.
- **Colyseus, not socket.io + custom loop.** Colyseus ships Schema, rooms, patch rate, matchmaking, monitoring — all of which we'd build by hand otherwise.
- **No ECS framework.** The existing `Actor` struct is already flat and allocation-light, per CLAUDE.md. Dropping an ECS in would be a second rewrite disguised as a refactor.
- **Keep Web Audio synth.** `audioManager.ts` is 232 LOC and works. Phaser's audio system isn't a strict upgrade for synthesized SFX. Revisit only if sampled audio arrives.
- **Keep React menus.** The in-progress screen port is the right shape; Phaser gameplay slots under the existing `screen === 'game'` branch.

## What Phase 1 ships in concrete terms

This is the one phase close enough to describe file-by-file:

- `src/simulation/rng.ts` — new, ~20 LOC seeded LCG.
- `src/simulation/types.ts` — `SimState` gains `rngSeed: number`, `rng: () => number`, `nextProjectileId: number`, `controllers: Record<string, PlayerController>`. `Projectile.hitActorIds: string[]`. `AIState` gains `lungeMs: number`.
- `src/simulation/simulation.ts` — delete module-level `controllers` map, delete `Date.now()` in projectile id, delete `setTimeout` in dodge recovery, replace `Math.random()` calls with `state.rng()`. `resetController` becomes `(state: SimState, playerId: string) => void`.
- `src/simulation/ai.ts` — `setTimeout` lunge → `lungeMs` state; `Math.random()` → `state.rng()`.
- `src/simulation/combat.ts` — `Math.random()` → `state.rng()` (requires passing `rng` in, or moving crit roll out — pick the former for minimal diff).
- `src/simulation/comboBuffer.ts` — already pure, no changes.
- `src/screens/GameScreen.tsx` — calls `resetController(stateRef.current, 'player')` instead of `resetController('player')`.
- `eslint.config.js` — add `no-restricted-globals` block scoped to `src/simulation/**`.
- `src/simulation/__tests__/golden.ts` (optional this phase, required by end of Phase 2) — scripted-input replay test.

Phases 2 and 4 need their own plan docs when it's time to execute them; they're too large to pin at the file level from this distance.

## Open questions

- **Sprite asset pipeline.** Current work lives under `scripts/` and `public/` (per git status); after Phase 2, atlas generation needs to target Phaser's atlas JSON format. Decide whether to keep the existing pixellab-driven generation scripts or adopt TexturePacker / free-tex-packer. Decision deferred to Phase 2 kickoff.
- **Fixed timestep.** Simulation currently runs at variable `dtMs` clamped to 50. Colyseus prefers fixed-step (e.g. 60 Hz); the simulation handles variable `dtMs` today. Phase 4 will need to decide whether to fix the step server-side and accumulate on the client, or keep variable and live with minor drift. Revisit at Phase 4 kickoff.
- **Authentication / accounts.** Colyseus supports JWT auth hooks. Out of scope here; surfaces again when we decide how players identify themselves.
