# Multiplayer 1v1 (Colyseus) — Design

**Date:** 2026-04-22
**Scope:** Ship a working networked 1v1 match reachable at `localhost:5175/multiplayer`. Two tabs on the same machine create/join a room, pick guilds independently, play a server-authoritative BO3, and see identical results. This is the first real multiplayer cut — Phase 4 of the existing Phaser+Colyseus rewrite (`docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md`) — but deliberately scoped down to 1v1 so the infrastructure lands without drowning in modes/teams/spectators.

## Goals

- Two browser tabs on localhost can create + join a room via shareable 6-char code and play a full BO3 match with server-authoritative simulation and identical state on both clients.
- Existing single-player paths (Story, VERSUS-vs-AI) continue to ship unchanged. Colyseus server is optional — story mode never talks to it.
- Simulation lives in a shared workspace package so the same `tickSimulation` runs client-side (story/VS) and server-side (MP) with no code fork.
- UI for the MP hub, create/join modals, room lobby, networked char-select, and networked stage-select all ship per the design handoff (`design_handoff_nannymud/`), scaled down to 1v1 but with non-MVP controls scaffolded-disabled so they can be lit up later without re-doing the layout.
- Localhost RTT lets us skip client-side prediction; 20 Hz patches + client interpolation make remote play tolerable at 40–80 ms RTT.

## Non-goals

- **Multi-player modes.** FFA, 2v2, 3v3, 4v4, CO-OP Horde all deferred. The room model supports exactly 2 `PlayerSlot`s for MVP.
- **Rollback or client-side prediction.** The client has no local authoritative tick during MP — it reads the server's mirror. This is the single biggest latency lever; we pull it later if remote play demands it.
- **Accounts, auth, persistence.** Display names are anonymous localStorage strings. No DB. No match history, no stats, no ratings, no replays.
- **Chat, kick, mid-lobby guild-change, team badges, spectators, friends list, region/ping detection.** UI chrome for these is scaffolded (per the handoff design) but all interactive controls are disabled.
- **Public lobby browser population.** The Hub table is rendered empty with a "Room browser coming soon" placeholder. Public vs Private room creation works (Private rooms never register with the lobby broker), but the browse-and-click-to-join flow is deferred.
- **Reconnect grace window.** If either client drops mid-match the match ends immediately and both are returned to the Hub.
- **Replacing the existing VS-vs-AI mode.** The Main Menu grows a new "MULTIPLAYER" entry alongside the existing "VERSUS" entry; they share no code path.
- **Fixing the double-loading-screen stack** (custom loading screen → Phaser's own loader running back-to-back). Listed as a known issue, addressed as one named task inside the MP loading rework, not a drive-by.

## Architecture

### Workspace layout

```
/
├── package.json              workspaces: ["packages/*"]
├── packages/
│   ├── shared/               NEW
│   │   ├── src/
│   │   │   ├── simulation/   MOVED from src/simulation (untouched logic)
│   │   │   ├── schema/       NEW — Colyseus Schema mirrors of SimState
│   │   │   │   ├── MatchState.ts
│   │   │   │   ├── PlayerSlot.ts
│   │   │   │   └── SimStateSchema.ts    structurally compatible with SimState
│   │   │   ├── protocol/     NEW — shared message types
│   │   │   │   └── messages.ts
│   │   │   └── index.ts
│   │   └── package.json      name: "@nannymud/shared"
│   └── server/               NEW
│       ├── src/
│       │   ├── index.ts      Colyseus.Server bootstrap, port 2567
│       │   └── rooms/
│       │       └── MatchRoom.ts   per-match server (MVP: the only room kind)
│       └── package.json      name: "@nannymud/server"
├── src/                      client (unchanged location)
│   ├── game/net/             NEW
│   │   ├── ColyseusClient.ts
│   │   ├── StateSync.ts
│   │   └── InputSender.ts
│   └── screens/mp/           NEW — all MP screens
└── ...
```

Every existing import of `../simulation/X` in the client becomes `@nannymud/shared/simulation/X`. No shim layer — one-shot migration, one commit.

### Process model (dev)

- **Vite** — port 5175, serves client from `src/`.
- **Colyseus** — port 2567, serves WebSocket + the Colyseus monitor.
- **Root script** `npm run dev` — uses `concurrently` to spawn both. `npm run dev:client` and `npm run dev:server` exist for isolated runs.
- **Vite dev proxy** forwards `/ws` → `ws://localhost:2567`, so client connects via same-origin WebSocket and CORS is never involved in dev. Production would serve both from the same origin behind a reverse proxy.

### New dependencies

Add at root (workspaces handle hoisting):

- Runtime (server): `colyseus`, `@colyseus/schema`
- Runtime (client): `colyseus.js`
- Dev: `@colyseus/testing`, `concurrently`, `tsx` (for running the server in dev without a build step)

No other packages needed — existing Vite/React/Phaser/Vitest stack handles the rest.

### Deployment footprint (future, out of scope for MVP build but noted so we don't paint ourselves in)

The server is a stateful Node process holding live rooms in memory; it cannot run on serverless. Deployment will be a single long-running container (Fly.io / Railway / bare VPS). Horizontal scaling requires a Colyseus presence driver (Redis) — not needed for MVP since everything is one process.

## Colyseus rooms and state

### One room kind (MVP)

- **`MatchRoom`** — one per match. Created when a client clicks "Host Room"; destroyed when both players leave or 30s after match end. Holds the entire lifecycle: lobby → char_select → stage_select → loading → in_game → results.
- **`LobbyRoom` is deferred.** The Hub's room browser is already scoped out as scaffolded-disabled; without a browser there is nothing to broadcast room listings to. Join-by-code uses Colyseus's `matchMaker.joinById(code)` directly — the code is also the `roomId`. When the browser lands later, `LobbyRoom` becomes a pub/sub broker of public `MatchRoom`s with no other structural changes to `MatchRoom`.

### MatchRoom state shape

```ts
class PlayerSlot extends Schema {
  @type("string") sessionId: string;
  @type("string") name: string;
  @type("string") guildId: string;          // '' until picked
  @type("boolean") ready: boolean;
  @type("boolean") locked: boolean;         // locked guild in char-select
  @type("boolean") connected: boolean;
  @type("number") ping: number;
}

class MatchState extends Schema {
  @type("string") phase:
    'lobby' | 'char_select' | 'stage_select' | 'loading' | 'in_game' | 'results';
  @type("string") code: string;              // 6-char A-Z + 2-9
  @type("number") rounds: 1 | 3 | 5 | 7;
  @type("string") visibility: 'public' | 'private';
  @type("string") name: string;              // room display name
  @type("string") hostSessionId: string;
  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
  @type("string") stageId: string;
  @type("number") seed: number;              // set at loading → in_game transition
  @type(SimStateSchema) sim: SimStateSchema; // only populated during in_game
  @type("string") matchWinnerSessionId: string; // '' until results phase
  @type("number") createdAtMs: number;       // server Date.now at creation, never read by sim
}
```

`SimStateSchema` is the Colyseus-Schema mirror of the plain-object `SimState` the simulation uses. It covers actors, projectiles, pickups, vfx events, round state, and combat log. VFX events ship as a capped array inside the Schema (cap = 64; server drains per patch) so client sees every hit spark without buffering an unbounded stream. When the cap is hit, the oldest events are dropped and the server logs `vfx_drop` with a count for later tuning.

### Team assignment (server-side)

Both players are humans, but the existing sim uses `Actor.team` as a ternary (`'player' | 'enemy' | 'neutral'`) consumed directly by AI targeting and projectile hit-tests (`ai.ts`, `simulation.ts`). For MVP we keep the enum as-is and encode MP identity as a parallel dimension:

- Slot 0 (host) → server sets `actor.team = 'player'`, `actor.isPlayer = true`, `sessionId = <host>`.
- Slot 1 (joiner) → server sets `actor.team = 'enemy'`, `actor.isPlayer = true`, `sessionId = <joiner>`.
- Neither actor gets an `aiState.behavior` of `'chaser'` — both are player-controlled. The team enum exists only so existing hit-test/target-selection code finds a valid opponent.
- The HUD's "P1 vs P2" identity comes from `sessionId` (or `hostSessionId` comparison), **not** from `team`. The HUD must not assume local player == `team:'player'`.

### Schema ↔ Sim: structural typing, no mapping layer

Rather than maintaining bidirectional `applySimToSchema` / `applySchemaToSim` helpers, `SimStateSchema` is declared so it **structurally satisfies** the existing `SimState` TypeScript interface. Same field names, same primitive/array types, `@type` decorators on fields. The server's `tickSimulation(state, ...)` runs against the Schema instance directly; Colyseus observes the mutations automatically.

Client side: `room.state` is an instance of `MatchState` / `SimStateSchema`; the client treats it as a `SimState` via the same interface. No plain-object shadow, no copy pass. The tiny asymmetry (ArraySchema vs plain arrays) is handled by a single `toArray` helper where iteration order matters.

Keeping one authoritative shape removes the highest-churn code in the whole initiative — the bidirectional mapping would double every time a sim field is added.

## Flow / state machine

```
Hub (no persistent room connection)
  ├── Host Room → matchMaker.create('match') → auto-joins as host → Lobby (phase='lobby', 1/2)
  └── Join by Code → matchMaker.joinById(code) → Lobby (phase='lobby', 2/2)

Lobby (both connected)
  ├── each player toggles ready
  ├── host's LAUNCH BATTLE enabled when both ready
  └── host clicks → phase='char_select'

Char Select (networked, each picks own)
  ├── each player moves own cursor locally; LOCK IN sends {type:'lock_guild', guildId}
  ├── server sets PlayerSlot.guildId + .locked = true
  ├── once a slot is locked it stays locked until both slots are locked (no unlock/re-pick in MVP — avoids a race where A unlocks while B is about to commit)
  ├── opponent's slot card reveals locked guild (no real-time cursor MVP)
  └── when both locked → phase='stage_select'

Stage Select (host drives)
  ├── non-host sees "Host is picking stage" panel
  ├── host picks + confirms → server sets stageId
  └── phase='loading'

Loading (both sides)
  ├── client preloads textures/audio (reuses existing loader)
  ├── each client sends {type:'ready_to_start'} when done
  ├── server waits for both then allocates seed, builds initial SimState, populates sim schema
  └── phase='in_game'

In Game
  ├── server runs tickSimulation at 60 Hz
  ├── each client sends {type:'input', {state: InputState, events: InputEvent[], sequenceId}} per render frame
  ├── server coalesces per-player input per tick: latest held-state + merged event list (preserves justPressed semantics)
  ├── server broadcasts Schema patches at 20 Hz
  ├── client runs GameplayScene without local simulation tick — reads room.state directly
  ├── client interpolates actor transforms between last 2 patches for 60 fps render
  └── when round.matchWinner set → phase='results', matchWinnerSessionId set
  note: pause (P key) is a no-op in MP; server never pauses the tick

Results
  ├── both see winner banner (shared component with offline Results screen)
  ├── host has REMATCH button (enabled)
  ├── joiner sees "Waiting for rematch?" with Accept/Decline (Rematch initiation is host-only in MVP)
  ├── host clicks REMATCH → server sends {type:'rematch_offered'} to joiner
  ├── joiner accepts → phase='char_select' with locked=false (same players re-pick)
  ├── joiner declines → phase stays 'results' (room stays open, host may LEAVE or offer again)
  └── either clicks LEAVE → room closes, both return to Hub
```

## Screens — shipped vs scaffolded-disabled

The design handoff (`design_handoff_nannymud/README.md`) describes 20 screens across singleplayer + 8-player multiplayer. MVP reuses the 1v1 subset and networks the relevant ones. For each MP screen, interactive controls outside MVP scope are rendered visible-but-disabled so the layout stays identical to the handoff and future features slot in without a UI redesign.

### MP Hub (#13)

**Ships:** Header with room/player count (both hardcoded to 0 and 1 respectively for MVP), `+ HOST ROOM` CTA, `JOIN BY CODE` CTA, `← BACK` to main menu.

**Disabled (visible):** Search input, mode tabs (ALL / FFA / TEAMS 2v2 / 3v3 / 4v4 / CO-OP HORDE), FULL/LOCKED filter checkboxes, table rows (replaced with single-row placeholder: "Room browser coming soon — use JOIN BY CODE").

### Create Room modal (#14)

**Ships:** Room Name input, Visibility radios (Public / Private only), Room Code field (auto-generated 6-char A-Z + 2-9, no O/0/I/1) + COPY button, Rounds toggle (BO1 / BO3 / BO5 / BO7, default BO3), CANCEL / CREATE ROOM → footer.

**Disabled (visible):** Mode picker (FFA / Teams 2v2 / 3v3 / 4v4 / CO-OP Horde), Stage picker (selected during stage_select phase instead), Friendly Fire toggle, Spectator Slots selector, Lock toggle on room code, Friends visibility radio.

### Join by Code modal (#15)

**Ships:** 6-cell input with auto-advance, paste support, normalizing to upper-case and stripping O/0/I/1, CANCEL / JOIN ROOM → footer. On invalid code: inline error "Room not found or already full." On full room: "Room is full." On in-progress match: "Match already in progress."

**Disabled (visible):** "Recent" chip list below input.

### Room Lobby (#16) — minimal

**Ships:** Top bar (room name + shareable code with click-to-copy + LEAVE), meta strip (rounds / visibility), 2-slot grid (2×1 — repurposes the 2×4 8-player grid as 2×1 for 1v1), per-slot card (monogram + name + ping + READY toggle + host badge on host's slot), LAUNCH BATTLE → CTA on host's footer (enabled only when both slots `connected && ready`).

**Disabled (visible):** Chat panel on right side, KICK button on opponent's slot (host-only), team-badge cycling, `⇄ CHANGE GUILD` button, `✎ EDIT ROOM` button (host-only), spectator slots row.

### Char Select — networked 1v1 (#3)

**Ships:** 15-guild grid (identical to singleplayer), own cursor driven by own input, LOCK IN button per player, "Waiting for opponent to lock" state after local lock, opponent's slot card reveals their locked guildId when they lock.

**Disabled / Deferred:** Real-time opponent cursor position (opponent's slot stays blank until they lock). Team Config (#4) screen is skipped entirely — 1v1 is one guild per side.

### Stage Select (#5)

**Ships:** Host sees existing StageSelect screen unchanged. Non-host sees a waiting panel: "Host is picking stage" + host's display name + animated pulse. Stage only reveals to non-host after host confirms (no streaming-preview of host's hover).

### Loading (#6)

Reuses existing loading screen. Each client shows own loading card; server waits for both to send `ready_to_start` before flipping to `in_game`. **Known issue flagged here:** current loading UX stacks a custom React loading screen on top of Phaser's internal asset loader, producing two sequential loading screens. The MP loading rework consolidates these into one.

### Battle HUD (#7)

The Phase 3 VS HUD (just shipped — `HudOverlay`, `HudTopBar`, `HudFooter`) renders identically. The only change is data source: instead of reading `SimState` from local `tickSimulation`, it reads from the `StateSync`-maintained mirror, with client-side interpolation smoothing 20 Hz patches to 60 fps rendering.

### Results (#9)

Reuses existing Results screen. Winner banner + damage/combo/resource callouts. Host's Results shows REMATCH button enabled; joiner's shows REMATCH disabled and an accept/decline modal appears if host clicks rematch. LEAVE returns both to Hub and closes the room.

## Networking

### Tick + patch rates

- **Server simulation tick:** 60 Hz via `setSimulationInterval(dt => tickSimulation(simState, collectInputs(), dt), 1000/60)`. Same simulation the client runs in story mode, with no branches.
- **Server patch rate:** 20 Hz via `setPatchRate(50)`. Bandwidth-friendly; Colyseus Schema ships only diffs.
- **Client render:** 60 fps (Phaser rAF), interpolating between the last 2 received patches for actor transforms.

### Input protocol

**Why this needs care:** the existing input model is half "held state" (`moveX`, `moveY`, `attackHeld`) and half "events" (`attackJustPressed`, `jumpJustPressed`). The just-pressed flags are cleared by `GameplayScene` each render frame (`GameplayScene.ts:146`). If we just send an InputState snapshot at 60 Hz and the server reads the latest, a dropped packet costs a button press — and the combo buffer + ability trigger path runs off those events. Solution: buffer events between sends, keep held state as a replaceable snapshot.

Message shape:

```ts
type InputMsg = {
  sequenceId: number;                 // monotonic per-client (future prediction hook)
  state: InputState;                  // latest held-state snapshot (moveX, attackHeld, etc.)
  events: InputEvent[];               // all justPressed/justReleased events since last send
};
type InputEvent = { type: 'attackDown' | 'attackUp' | 'jumpDown' | 'blockDown' | 'grabDown' | 'abilityDown'; key?: string; tMs: number; };
```

- Client: `PhaserInputAdapter` already produces an `InputState` per frame. A new `InputSender` captures edges (current-vs-previous state) into an `events[]`, increments `sequenceId`, and ships `room.send('input', { sequenceId, state, events })` every render frame. On send, the local event buffer clears.
- Server: `MatchRoom.onMessage('input', ...)` stores the latest held-state per sessionId **and** appends the incoming events to a per-player pending queue. Each simulation tick, the server drains each player's pending queue into the tick's InputState (setting the appropriate `justPressed` flags) then applies the held-state fields. After the tick runs, justPressed flags are cleared as usual — mirroring the offline contract exactly.
- Out-of-order / duplicate handling: messages with `sequenceId <= lastAcknowledged` are dropped. TCP-ordered WebSocket makes real reordering rare, but the field is there for future UDP / prediction work.
- Target rate: 60 Hz client → server. Server applies exactly one coalesced InputState per player per tick.

### Client-side interpolation

`StateSync` keeps a rolling 2-patch buffer of actor transform snapshots (`x`, `y`, `z`, `vx`, `vy`, `vz`, `animationFrame`) with receive timestamps. `GameplayScene.reconcileActors` reads interpolated values at `serverTimeNow - 50ms` to stay behind the newest patch by one interval. Non-transform state (hp, mp, status effects, facing, current ability) reads the latest snapshot without interpolation — jumps are imperceptible at 20 Hz for these fields.

No prediction, no rollback. The local player's input has RTT-of-visible-response latency. On localhost this is sub-frame; on real internet it's whatever the RTT is. Acceptable for MVP proof; this is the knob to turn later if remote play needs to feel tighter.

### VFX events

Sim's `vfxEvents` array is replicated via Schema. Server appends during tick; client drains during `consumeVfxEvents`. Cap of 64 events per patch window prevents unbounded growth during bursty combat; when the cap is hit, oldest events are dropped and the server logs `vfx_drop` with a count so we can tune later. Visual impact of a drop: a missing hit spark or damage number on one frame — acceptable for MVP.

### Disconnect

`MatchRoom.onLeave(client, consented)` — if the match is in `in_game` phase, set `matchWinnerSessionId = <remaining client>`, flip `phase = 'results'` with a SYSTEM log entry "Opponent disconnected." If in any pre-game phase, reset room to `lobby` phase (keep remaining player's slot, clear opponent slot). Room auto-closes 30s after second player leaves or match ends.

No reconnect support: even if a dropped client reopens the URL, they land in the Hub, not back in their old match. Reconnect is deferred.

## Identity

- First visit to `/multiplayer` → simple modal: "Enter display name (≤16 chars)" with default value `Player-XXXX` (where XXXX is random). Stored under `localStorage['nannymud.mp.name']`.
- Name is shown in lobby slot, results screen, and future chat/spectator views.
- No uniqueness check — two players with the same name is fine; they're disambiguated by guild monogram + slot position.
- No profanity filter, no moderation. Localhost demo posture.

## Determinism + audit

- Phase 1's simulation purity work (`SimState.rngSeed`, `state.rng()`, no `Date.now()`, no module-level counters) is the reason this plan is cheap. Server generates the seed at `loading → in_game` transition using its own `Math.random()` (outside the sim) and writes it into `MatchState.seed`, which is then baked into `SimState.rngSeed` when `createVsMatchState` runs.
- `createVsMatchState(p1Guild, p2Guild, stageId, seed)` on the server replaces `createVsState` (which assumes P2 is AI). The difference: both actors are `isPlayer = true`, both have their own `PlayerController` keyed by sessionId, neither has `aiState.behavior = 'chaser'`.
- The existing VS-vs-AI `createVsState` + `tickRound` state machine carry over verbatim — it's already built around 2 players and a BO3 round loop.
- Golden determinism test in `src/simulation/__tests__/golden.test.ts` must stay green through the workspace move. The test does not involve Colyseus; if it still passes after the migration, the sim is undisturbed.

## Client architecture changes

- `src/game/scenes/GameplayScene.ts` — grows a branch on a new registry field `netMode: 'offline' | 'mp'`. Offline path unchanged. MP path: `update()` does not call `tickSimulation`; it reads `room.state.sim` directly, runs interpolation, reconciles views, consumes VFX, dispatches audio. Input adapter still produces `InputState` but feeds `InputSender` instead of local sim. The P-key pause handler checks `netMode` and is a no-op in MP (Colyseus tick can't pause; adding concede-round confirmation is deferred).
- `src/game/PhaserGame.ts` — `GameBootConfig` gains `netMode: 'offline' | 'mp'` and `matchRoom?: Colyseus.Room<MatchState>`. Story + VS set `netMode: 'offline'`. MP screens set `netMode: 'mp'` and pass the active room.
- `src/screens/GameScreen.tsx` — already accepts `mode` / `p2` / `stageId`. Grows one more branch: MP mode wires the active `matchRoom` into the Phaser boot config and mounts the existing `HudOverlay` (no HUD changes). HudOverlay's "which side am I?" decision uses `localSessionId === hostSessionId ? 'P1' : 'P2'` rather than reading `actor.team`.
- `src/App.tsx` — routing grows an MP branch. The existing `useAppState` hook gains an MP state tree (`mpPhase`, `mpRoom`, `mpPlayerName`) with its own screen types (`mp_hub`, `mp_create`, `mp_join`, `mp_lobby`, `mp_cs`, `mp_stage`, `mp_load`, `mp_battle`, `mp_results`). Singleplayer state is untouched.

## Testing strategy

### Server unit tests

- `packages/server/src/rooms/__tests__/MatchRoom.test.ts` — exercises phase transitions, ready gating, lock gating, disconnect handling using Colyseus's `boardcastPatch` + `@colyseus/testing` harness.
- `packages/shared/src/schema/__tests__/simToSchema.test.ts` — round-trips a handful of SimState snapshots through applySimToSchema + applySchemaToSim and asserts structural equality.

### Client integration test

- `src/game/net/__tests__/StateSync.test.ts` — feeds synthetic Schema patches, asserts interpolation produces expected positions at t=now-50ms.

### Manual acceptance (Task N of the plan)

1. `npm run dev` spawns Vite + Colyseus.
2. Open `localhost:5175/multiplayer` in two tabs. First-visit name prompt appears in each.
3. Tab 1 → HOST ROOM → Create → lands in lobby showing self + empty slot + code.
4. Copy code → Tab 2 → JOIN BY CODE → paste → joins lobby → both slots connected.
5. Both ready up → host launches → both enter char-select.
6. Each tab picks + locks own guild → both advance to stage select.
7. Tab 1 (host) picks stage, Tab 2 sees waiting state.
8. Both loading cards complete → battle starts.
9. Each tab plays own side. Scores/HP/positions match across tabs (±50ms visual lag).
10. BO3 completes → both see same winner.
11. Host clicks REMATCH → joiner accepts → char-select again. OR either LEAVES → both return to Hub.
12. Disconnect test: kill Tab 2 mid-match → Tab 1 sees "Opponent disconnected" + wins.
13. Story mode regression: open fresh tab → Main Menu → FIGHT → story mode plays normally (no Colyseus connection attempted).

### Deferred (explicit): load testing, prediction tuning, real-internet RTT testing.

## Explicit deferred list

Everything in this list is called out so future plans can reference it:

1. Real-time cursor broadcast during char-select
2. Lobby chat panel
3. Lobby KICK button + kick protocol
4. Team-badge cycling in lobby
5. `⇄ CHANGE GUILD` shortcut from lobby
6. `✎ EDIT ROOM` modal (host editing room settings mid-lobby)
7. Spectators (join room as non-playing observer)
8. Mode variants: FFA, 2v2, 3v3, 4v4, CO-OP Horde
9. Friends list and Friends-only visibility
10. Public lobby browser listing (LobbyRoom already tracks rooms; Hub table just needs to subscribe and render)
11. Region auto-detection + ping measurement
12. Client-side prediction + rollback netcode
13. Reconnect grace window (30s return-to-seat)
14. Account system (login, persistent identity, per-guild MMR, match history)
15. Match history + replays + stats persistence
16. Profanity filter / moderation
17. Rate limiting / anti-abuse on room creation and matchmaking
18. Production deployment (Colyseus container + Redis presence for horizontal scale)
19. **Double-loading-screen fix** (custom loader → Phaser loader) — addressed as a named task inside the MP loading rework task

## Risks

- **Schema cost of SimState.** `SimState` is broad (actors with ~30 fields each, projectiles, pickups, VFX, combat log). Structural-typing approach keeps the server running `tickSimulation` directly on Schema instances — no double bookkeeping, but every sim mutation now goes through Colyseus's change tracking. Mitigation: measure `broadcast` bytes per patch during manual testing; if too heavy, move VFX events to per-player unreliable messages (they're visual only and don't need strict ordering).
- **Workspace migration churn.** Moving `src/simulation` → `packages/shared/src/simulation` touches **31 client files with 46 import lines** (grep verified). This is its own task. Sites to update: every `from '../simulation/…'` / `from './simulation/…'` import → `from '@nannymud/shared/simulation/…'`. Plus config files: `tsconfig.app.json` paths, `eslint.config.js` override glob on `src/simulation/**`, `vitest.config.ts` if present, `package.json` workspaces array. The golden determinism test (`src/simulation/__tests__/golden.test.ts`) moves with the folder and stays green — that's the regression gate. One PR, one commit — reviewers should diff `git log --name-only` against the import-rewrite pattern.
- **Structural typing gotchas.** Colyseus `ArraySchema<T>` and `MapSchema<K,V>` are not plain `Array` / `Map` — iteration and indexing differ. Any sim code doing `state.actors.filter(...)` or `for (const [id, a] of state.actors)` needs a small helper or refactor. Spec'd solution: one `toArray()` helper plus a codebase-wide audit as part of migration.
- **Circular import between shared simulation and schema.** The sim must not import from `schema/`; `schema/` may import types (but not runtime) from `simulation/`. Lint rule + careful type-only imports solve this but it's a real trap.
- **Colyseus + Vite ESM interop.** Colyseus ships CJS + ESM; `@colyseus/schema` uses decorators (requires `experimentalDecorators` + `emitDecoratorMetadata` in the server's tsconfig, but not the client's). The client imports Schema types for readonly access only.
- **Interpolation feel.** 50ms interpolation delay means local actions have ~50ms visible latency beyond RTT. Trade-off accepted for MVP; if it feels bad we shrink the buffer to 30ms and accept occasional extrapolation jitter.
- **Team-enum reuse may leak into UX.** Server assigns slot1=`team:'enemy'` to satisfy hit-test code, but the HUD, results screen, and combat log must not display "Enemy" for a human opponent. Audit every string source that reads `team` — replace with sessionId-based lookups where the team label would surface to the user.

## Acceptance criteria (definition of done)

- Two tabs on `localhost:5175/multiplayer` complete a full BO3 match per the manual checklist above.
- All existing vitest suites (including golden determinism) pass post-migration.
- Server runs as `npm run dev:server`, client as `npm run dev:client`, both as `npm run dev`.
- Story mode and VS-vs-AI both load and play without any Colyseus connection attempt.
- Disconnect-during-match correctly ends the match for the surviving player.
- Code review confirms the deferred list is consistent with the codebase (no stub code for deferred features beyond the scaffolded-disabled UI).

## References

- Phase 4 of `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md` — this spec is the detailed cut of that phase.
- `design_handoff_nannymud/README.md` — UI design source for screens 13–16 and shared primitives.
- `docs/superpowers/specs/2026-04-22-versus-mode-hud-design.md` + its plan — the Phase 3 VS HUD this spec reuses.

## Revision history

- **2026-04-22 rev2** — post-review fixes to the first cut:
  1. Team-enum policy: server slot0=`'player'`, slot1=`'enemy'`; HUD identity via sessionId (not team).
  2. Input protocol: ship `{sequenceId, state, events[]}` per frame so justPressed edges survive packet drop and combo buffer stays intact.
  3. Schema architecture: structural typing (SimStateSchema satisfies SimState interface); drop bidirectional mapping layer.
  4. Dropped `LobbyRoom` from MVP — join-by-code uses `matchMaker.joinById(code)` directly.
  5. Pause (P key) is a no-op in MP — server tick cannot be paused.
  6. Migration task explicitly scoped: 31 files / 46 imports + tsconfig/eslint/vitest/package.json.
  7. Dependencies itemized (colyseus, @colyseus/schema, colyseus.js, @colyseus/testing, concurrently, tsx).
  8. Rematch-decline keeps room open (only LEAVE closes it).
  9. Char-select unlock policy: locked slot stays locked until both are locked (simpler, race-free).
  10. VFX cap raised 32→64; drops are server-logged for tuning.
