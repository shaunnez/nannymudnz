# Multiplayer 1v1 (Colyseus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Controller model:** Opus. **Subagent model per task:** annotated inline (haiku / sonnet / opus).
>
> **Spec:** `docs/superpowers/specs/2026-04-22-multiplayer-1v1-design.md` (rev2).

**Goal:** Ship a working networked 1v1 match reachable at `localhost:5175/multiplayer`. Two tabs can create/join a room via 6-char code, each picks a guild, play a server-authoritative BO3, and see identical state.

**Architecture:** npm workspaces monorepo. `packages/shared/` holds the simulation (moved from `src/simulation`) plus Colyseus `@type`-decorated Schema classes that **structurally satisfy** the `SimState` interface (no bidirectional mapping). `packages/server/` runs a Colyseus server with one `MatchRoom` type, ticking `tickSimulation` at 60 Hz on the Schema directly and broadcasting patches at 20 Hz. Client (`src/`) adds MP screens + a `netMode: 'mp'` branch in `GameplayScene` that reads `room.state.sim` instead of calling `tickSimulation` locally.

**Tech Stack:** Colyseus 0.15+, @colyseus/schema (decorators), colyseus.js, tsx (server dev runner), concurrently (root dev runner). Existing Vite/React/Phaser/Vitest untouched.

---

## Current status

Last completed: **Phase A** — A1 workspace skeleton (`edd26c7` + `b26f23b`) + A2 simulation migration (`29f8726` + `7ce425a` CLAUDE.md paths). 27 client files / 42 imports rewritten. Golden test green. Pushed to `origin/feat/vs-mode-hud`.

Next: Task B1 (SimStateSchema — Colyseus Schema classes that structurally satisfy the SimState interface).

Branch: `feat/vs-mode-hud` (stacking MP work on top of unmerged VS HUD branch).

Deferred follow-ups (low priority):
- `typecheck` script will want `tsc -b` with project references once `packages/server` has real TS (currently the script does a serial `&&` chain — fine today)
- ESLint walks `.worktrees/**` producing noise; add `.worktrees/**` to ignores in a future cleanup
- `packages/server/src/index.ts` has a pre-existing unused `gameServer` var — will self-resolve in Phase C when rooms are registered

Update this block after each task. Format: `Last completed: Task X (commit: <subject>) · Next: Task Y`.

---

## Execution model

### Phase dependency graph

```
A (Foundation, sync)
     │
     ▼
B (Schema+protocol, sync)
     │
     ├──────────────┬──────────────┐
     ▼              ▼              ▼
C (Server)     D (Client net)   E (Client screens)
     │              │              │
     └──────────────┴──────────────┘
                    │
                    ▼
              F (Integration, sync)
```

C, D, E are independent after B and may run in **three parallel worktrees** each driven by its own subagent dispatch. F re-synchronizes everything for the final integration + manual acceptance.

### Model tier guidance (subagent dispatches)

| Signal | Tier |
|---|---|
| 1-2 isolated files, complete code in step | haiku |
| Multi-file, integration logic, codebase-pattern matching | sonnet |
| Cross-cutting migration, schema architecture, final review | opus |

Controller (the session orchestrating dispatches) is **always Opus** — it reviews and routes, and Opus is what catches the spec/code-quality review gaps that cheaper models miss.

---

## Phase A: Foundation (sync, blocks everything)

### Task A1: Workspace skeleton

**Subagent model:** sonnet.

**Files:**
- Modify: `package.json` (add `"workspaces": ["packages/*"]`, add root scripts)
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Add workspaces to root package.json**

Add `"workspaces": ["packages/*"]` to root `package.json`. Add root scripts:
```json
"dev:client": "vite",
"dev:server": "tsx watch packages/server/src/index.ts",
"dev": "concurrently -n client,server -c blue,green \"npm:dev:client\" \"npm:dev:server\""
```
Change existing `"dev": "vite"` to `"dev:client": "vite"`. Keep `build`, `preview`, `lint`, `typecheck`, `test`.

- [ ] **Step 2: Install new dependencies**

Run: `npm install -D concurrently tsx @colyseus/testing`
Run: `npm install colyseus @colyseus/schema colyseus.js`
(Colyseus client lib is needed in the root client workspace; the others in root or shared/server as appropriate.)

- [ ] **Step 3: Create packages/shared package.json**

```json
{
  "name": "@nannymud/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./simulation/*": "./src/simulation/*",
    "./schema/*": "./src/schema/*",
    "./protocol/*": "./src/protocol/*"
  }
}
```

- [ ] **Step 4: Create packages/shared tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Create packages/shared/src/index.ts**

Empty barrel file for now, contents added in later tasks:
```ts
export * from './simulation';
```

- [ ] **Step 6: Create packages/server package.json**

```json
{
  "name": "@nannymud/server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "dependencies": {
    "@nannymud/shared": "*",
    "colyseus": "*",
    "@colyseus/schema": "*"
  }
}
```

- [ ] **Step 7: Create packages/server tsconfig.json**

Same as shared's tsconfig plus `"types": ["node"]`.

- [ ] **Step 8: Create packages/server/src/index.ts (stub)**

```ts
import { Server } from 'colyseus';
import { createServer } from 'node:http';

const app = createServer();
const gameServer = new Server({ server: app });
const port = Number(process.env.PORT ?? 2567);
app.listen(port, () => {
  console.log(`[server] Colyseus listening on :${port}`);
});
```

- [ ] **Step 9: Verify boot**

Run: `npm install` (for workspace linking)
Run: `npm run dev:server`
Expected: `[server] Colyseus listening on :2567` (no crash)
Ctrl+C after confirming.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json packages/
git commit -m "feat(mp): workspace skeleton for shared + server packages"
```

### Task A2: Migrate src/simulation → packages/shared/src/simulation

**Subagent model:** opus (cross-cutting, must preserve golden test).

**Files:**
- Move: `src/simulation/**` → `packages/shared/src/simulation/**` (git mv)
- Modify: `tsconfig.app.json` (add `paths` entry)
- Modify: `vite.config.ts` (alias if needed)
- Modify: `eslint.config.js` (update override glob `src/simulation/**` → `packages/shared/src/simulation/**`)
- Modify: every client import site (31 files, 46 import lines)

- [ ] **Step 1: git mv the folder**

Run: `git mv src/simulation packages/shared/src/simulation`
Verify: `git status` shows renames only, no new content.

- [ ] **Step 2: Rewrite imports in client**

In every `src/**/*.{ts,tsx}`, replace:
- `from '../simulation/<x>'` → `from '@nannymud/shared/simulation/<x>'`
- `from '../../simulation/<x>'` → same
- `from './simulation/<x>'` → same
- Same for `import type`.

Use grep to find all sites first:
Run: `grep -rn "from ['\"]\\.\\{1,3\\}/simulation" src/` (expect ~46 lines across ~31 files)

- [ ] **Step 3: Update tsconfig.app.json paths**

Add to `compilerOptions`:
```json
"paths": {
  "@nannymud/shared/*": ["../packages/shared/src/*"]
}
```

- [ ] **Step 4: Update vite.config.ts resolve.alias if needed**

If tsconfig paths alone don't resolve at Vite runtime, add:
```ts
resolve: {
  alias: {
    '@nannymud/shared': path.resolve(__dirname, 'packages/shared/src'),
  },
},
```

- [ ] **Step 5: Update eslint.config.js**

Change the `files: ['src/simulation/**']` override glob to `files: ['packages/shared/src/simulation/**']`. Keep the no-DOM / no-`Math.random` rules identical.

- [ ] **Step 6: Update vitest config**

In `vite.config.ts` or `vitest.config.ts`, ensure the test include glob covers `packages/shared/src/**/*.test.ts` (or keep tests colocated and update the glob).

- [ ] **Step 7: Run the regression gate**

Run: `npm test`
Expected: all tests PASS, especially `packages/shared/src/simulation/__tests__/golden.test.ts`.

- [ ] **Step 8: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors vs baseline.

- [ ] **Step 9: Boot dev to catch runtime import errors**

Run: `npm run dev:client`
Open `localhost:5175`, click FIGHT, verify story mode launches (sim runs).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "refactor(mp): move src/simulation to packages/shared/src/simulation"
```

---

## Phase B: Schema + protocol (sync, blocks C/D/E)

### Task B1: SimStateSchema (structural typing approach)

**Subagent model:** opus (architecture decision lives here).

**Files:**
- Create: `packages/shared/src/schema/SimStateSchema.ts`
- Create: `packages/shared/src/schema/ActorSchema.ts`
- Create: `packages/shared/src/schema/ProjectileSchema.ts`
- Create: `packages/shared/src/schema/PickupSchema.ts`
- Create: `packages/shared/src/schema/VfxEventSchema.ts`
- Create: `packages/shared/src/schema/LogEntrySchema.ts`
- Create: `packages/shared/src/schema/RoundStateSchema.ts`
- Create: `packages/shared/src/schema/index.ts`
- Create: `packages/shared/src/schema/__tests__/structural.test.ts`

- [ ] **Step 1: Write failing structural-typing test**

```ts
// packages/shared/src/schema/__tests__/structural.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { SimState, Actor } from '../../simulation/types';
import { SimStateSchema, ActorSchema } from '../index';

describe('Schema structurally satisfies SimState', () => {
  it('SimStateSchema assignable to SimState', () => {
    expectTypeOf<SimStateSchema>().toMatchTypeOf<SimState>();
  });
  it('ActorSchema assignable to Actor', () => {
    expectTypeOf<ActorSchema>().toMatchTypeOf<Actor>();
  });
});
```

Run: `npm test -- structural`
Expected: FAIL (SimStateSchema undefined).

- [ ] **Step 2: Enumerate fields to replicate**

Read `packages/shared/src/simulation/types.ts`. List every field on `Actor`, `Projectile`, `Pickup`, `VfxEvent`, `LogEntry`, `RoundState`, `SimState`. For each, note primitive vs array vs map vs nested. This list drives every subsequent class.

- [ ] **Step 3: Write ActorSchema**

```ts
// packages/shared/src/schema/ActorSchema.ts
import { Schema, type, ArraySchema, MapSchema } from '@colyseus/schema';
// ... import StatusEffect, AiState etc. from '../simulation/types'

export class ActorSchema extends Schema {
  @type('string') id!: string;
  @type('string') team!: 'player' | 'enemy' | 'neutral';
  @type('boolean') isPlayer!: boolean;
  @type('string') guildId?: string;
  @type('number') x!: number;
  @type('number') y!: number;
  @type('number') z!: number;
  @type('number') vx!: number;
  @type('number') vy!: number;
  @type('number') vz!: number;
  @type('number') facing!: 1 | -1;
  @type('number') hp!: number;
  @type('number') hpMax!: number;
  // ... full enumerated field list
}
```

**Full field enumeration is not abbreviated in the actual file** — copy every field from `Actor` in `simulation/types.ts`. Nested objects like `aiState`, `abilityCooldowns` become nested Schemas or MapSchemas.

- [ ] **Step 4: Write remaining schemas**

Follow the same one-to-one mapping pattern for `ProjectileSchema`, `PickupSchema`, `VfxEventSchema`, `LogEntrySchema`, `RoundStateSchema`.

- [ ] **Step 5: Write SimStateSchema**

```ts
// packages/shared/src/schema/SimStateSchema.ts
import { Schema, type, ArraySchema } from '@colyseus/schema';
import { ActorSchema } from './ActorSchema';
import { ProjectileSchema } from './ProjectileSchema';
// ...

export class SimStateSchema extends Schema {
  @type('string') phase!: 'playing' | 'paused' | 'victory' | 'defeat';
  @type('number') tick!: number;
  @type('number') rngSeed!: number;
  @type(ActorSchema) player!: ActorSchema;
  @type({ array: ActorSchema }) enemies = new ArraySchema<ActorSchema>();
  @type(ActorSchema) opponent?: ActorSchema;
  @type({ array: ProjectileSchema }) projectiles = new ArraySchema<ProjectileSchema>();
  @type({ array: PickupSchema }) pickups = new ArraySchema<PickupSchema>();
  @type({ array: VfxEventSchema }) vfxEvents = new ArraySchema<VfxEventSchema>();
  @type({ array: LogEntrySchema }) combatLog = new ArraySchema<LogEntrySchema>();
  @type(RoundStateSchema) round?: RoundStateSchema;
  @type('number') nextLogId!: number;
  // ... every SimState field
}
```

- [ ] **Step 6: Export barrel**

```ts
// packages/shared/src/schema/index.ts
export * from './SimStateSchema';
export * from './ActorSchema';
export * from './ProjectileSchema';
export * from './PickupSchema';
export * from './VfxEventSchema';
export * from './LogEntrySchema';
export * from './RoundStateSchema';
```

- [ ] **Step 7: Re-run structural test**

Run: `npm test -- structural`
Expected: PASS. If TypeScript complains about type mismatches, adjust field types until the Schema is structurally assignable to the plain interface. Common gotchas: `ArraySchema<T>` vs `T[]` — widen the SimState interface side where needed, or use `readonly T[]` signatures.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/schema/
git commit -m "feat(mp): SimStateSchema and kin — structurally satisfy SimState"
```

### Task B2: MatchState + PlayerSlot schemas

**Subagent model:** sonnet.

**Files:**
- Create: `packages/shared/src/schema/PlayerSlot.ts`
- Create: `packages/shared/src/schema/MatchState.ts`
- Modify: `packages/shared/src/schema/index.ts`
- Create: `packages/shared/src/schema/__tests__/matchState.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { MatchState, PlayerSlot } from '../index';

describe('MatchState', () => {
  it('initializes with phase lobby and empty slots', () => {
    const s = new MatchState();
    expect(s.phase).toBe('lobby');
    expect(s.players.size).toBe(0);
  });
  it('adds a PlayerSlot', () => {
    const s = new MatchState();
    const slot = new PlayerSlot();
    slot.sessionId = 'abc';
    slot.name = 'Alice';
    s.players.set('abc', slot);
    expect(s.players.get('abc')?.name).toBe('Alice');
  });
});
```

Run: `npm test -- matchState`
Expected: FAIL.

- [ ] **Step 2: Implement PlayerSlot**

```ts
// packages/shared/src/schema/PlayerSlot.ts
import { Schema, type } from '@colyseus/schema';

export class PlayerSlot extends Schema {
  @type('string') sessionId = '';
  @type('string') name = '';
  @type('string') guildId = '';
  @type('boolean') ready = false;
  @type('boolean') locked = false;
  @type('boolean') connected = true;
  @type('number') ping = 0;
}
```

- [ ] **Step 3: Implement MatchState**

```ts
// packages/shared/src/schema/MatchState.ts
import { Schema, type, MapSchema } from '@colyseus/schema';
import { PlayerSlot } from './PlayerSlot';
import { SimStateSchema } from './SimStateSchema';

export type MatchPhase = 'lobby' | 'char_select' | 'stage_select' | 'loading' | 'in_game' | 'results';

export class MatchState extends Schema {
  @type('string') phase: MatchPhase = 'lobby';
  @type('string') code = '';
  @type('number') rounds: 1 | 3 | 5 | 7 = 3;
  @type('string') visibility: 'public' | 'private' = 'private';
  @type('string') name = '';
  @type('string') hostSessionId = '';
  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
  @type('string') stageId = '';
  @type('number') seed = 0;
  @type(SimStateSchema) sim?: SimStateSchema;
  @type('string') matchWinnerSessionId = '';
  @type('number') createdAtMs = 0;
}
```

- [ ] **Step 4: Export and re-run test**

Add exports to `schema/index.ts`. Run: `npm test -- matchState` — PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema/
git commit -m "feat(mp): MatchState + PlayerSlot schemas"
```

### Task B3: Protocol messages + input event types

**Subagent model:** haiku.

**Files:**
- Create: `packages/shared/src/protocol/messages.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create messages.ts**

```ts
// packages/shared/src/protocol/messages.ts
import type { InputState } from '../simulation/types';

export type InputEvent =
  | { type: 'attackDown'; tMs: number }
  | { type: 'attackUp'; tMs: number }
  | { type: 'jumpDown'; tMs: number }
  | { type: 'blockDown'; tMs: number }
  | { type: 'grabDown'; tMs: number }
  | { type: 'abilityDown'; key: string; tMs: number };

export interface InputMsg {
  sequenceId: number;
  state: InputState;
  events: InputEvent[];
}

export interface LockGuildMsg { type: 'lock_guild'; guildId: string; }
export interface ReadyToggleMsg { type: 'ready_toggle'; ready: boolean; }
export interface PickStageMsg { type: 'pick_stage'; stageId: string; }
export interface LaunchBattleMsg { type: 'launch_battle'; }
export interface ReadyToStartMsg { type: 'ready_to_start'; }
export interface RematchOfferMsg { type: 'rematch_offer'; }
export interface RematchAcceptMsg { type: 'rematch_accept'; accept: boolean; }
```

- [ ] **Step 2: Add to barrel**

```ts
// packages/shared/src/index.ts
export * from './simulation';
export * from './schema';
export * from './protocol/messages';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/protocol packages/shared/src/index.ts
git commit -m "feat(mp): protocol message types"
```

---

## Phase C/D/E (PARALLEL — after B done)

All three phases share the same Phase A+B foundation but operate in different trees of the codebase. They **can** run in three parallel worktrees (see `superpowers:using-git-worktrees`). If running sequentially, order is irrelevant; do whichever first.

## Phase C: Server (parallel-safe)

### Task C1: MatchRoom phases (lobby/char_select/stage_select)

**Subagent model:** sonnet.

**Files:**
- Create: `packages/server/src/rooms/MatchRoom.ts`
- Modify: `packages/server/src/index.ts`
- Create: `packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts`
- Create: `packages/server/src/util/roomCode.ts`

- [ ] **Step 1: Room code generator + test**

```ts
// packages/server/src/util/roomCode.ts
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1
export function generateCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
```

Run: `npm test -- roomCode` (write a simple test asserting length=6 and alphabet membership).

- [ ] **Step 2: MatchRoom phase-transition test (failing)**

Use `@colyseus/testing`:
```ts
import { ColyseusTestServer, boot } from '@colyseus/testing';
import { MatchRoom } from '../MatchRoom';

it('starts in lobby, both ready triggers host launch → char_select', async () => {
  const colyseus = await boot(appConfig);
  const room = await colyseus.createRoom('match', {});
  const c1 = await colyseus.connectTo(room);
  const c2 = await colyseus.connectTo(room);
  c1.send('ready_toggle', { ready: true });
  c2.send('ready_toggle', { ready: true });
  await room.waitForNextPatch();
  c1.send('launch_battle', {}); // c1 is host
  await room.waitForNextPatch();
  expect(room.state.phase).toBe('char_select');
});
```

Run: FAIL.

- [ ] **Step 3: Implement MatchRoom lobby→char_select**

```ts
// packages/server/src/rooms/MatchRoom.ts
import { Room, Client } from 'colyseus';
import { MatchState, PlayerSlot } from '@nannymud/shared';
import { generateCode } from '../util/roomCode';

export class MatchRoom extends Room<MatchState> {
  maxClients = 2;

  onCreate(opts: { name?: string; rounds?: 1|3|5|7; visibility?: 'public'|'private' }) {
    this.setState(new MatchState());
    this.state.code = generateCode();
    this.state.name = opts.name ?? 'Room';
    this.state.rounds = opts.rounds ?? 3;
    this.state.visibility = opts.visibility ?? 'private';
    this.state.createdAtMs = Date.now();
    this.roomId = this.state.code;

    this.onMessage('ready_toggle', (client, msg: { ready: boolean }) => {
      const slot = this.state.players.get(client.sessionId);
      if (slot) slot.ready = msg.ready;
    });

    this.onMessage('launch_battle', (client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      const slots = [...this.state.players.values()];
      if (slots.length !== 2 || !slots.every(s => s.ready)) return;
      this.state.phase = 'char_select';
      slots.forEach(s => { s.locked = false; s.guildId = ''; });
    });

    this.onMessage('lock_guild', (client, msg: { guildId: string }) => {
      if (this.state.phase !== 'char_select') return;
      const slot = this.state.players.get(client.sessionId);
      if (!slot || slot.locked) return; // one-way lock
      slot.guildId = msg.guildId;
      slot.locked = true;
      if ([...this.state.players.values()].every(s => s.locked)) {
        this.state.phase = 'stage_select';
      }
    });

    this.onMessage('pick_stage', (client, msg: { stageId: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'stage_select') return;
      this.state.stageId = msg.stageId;
      this.state.phase = 'loading';
    });
  }

  onJoin(client: Client, opts: { name: string }) {
    const slot = new PlayerSlot();
    slot.sessionId = client.sessionId;
    slot.name = opts.name ?? 'Player';
    this.state.players.set(client.sessionId, slot);
    if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
  }

  onLeave(client: Client, consented: boolean) {
    const slot = this.state.players.get(client.sessionId);
    if (slot) slot.connected = false;
    // full disconnect handling in C3
  }
}
```

- [ ] **Step 4: Register room in server index**

```ts
// packages/server/src/index.ts
gameServer.define('match', MatchRoom).filterBy(['code']);
```

- [ ] **Step 5: Run test**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat(mp): MatchRoom lobby→char_select→stage_select phases"
```

### Task C2: MatchRoom sim tick + input handling

**Subagent model:** opus (touches sim boundary, determinism-sensitive).

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`
- Create: `packages/server/src/rooms/__tests__/MatchRoom.sim.test.ts`

- [ ] **Step 1: Write failing test — ready_to_start transitions to in_game**

```ts
it('both clients send ready_to_start in loading → phase in_game', async () => { ... });
```

- [ ] **Step 2: Handle ready_to_start + sim boot**

Add to `onCreate`:
```ts
const readyToStart = new Set<string>();
this.onMessage('ready_to_start', (client) => {
  if (this.state.phase !== 'loading') return;
  readyToStart.add(client.sessionId);
  if (readyToStart.size < 2) return;
  this.startMatch();
});
```

- [ ] **Step 3: Implement startMatch**

```ts
import { createInitialState, createPlayerActor } from '@nannymud/shared/simulation';
import { SimStateSchema, ActorSchema /* ... */ } from '@nannymud/shared';

private startMatch() {
  const [host, joiner] = [...this.state.players.values()];
  const seed = Math.floor(Math.random() * 2 ** 31);
  this.state.seed = seed;
  const sim = this.buildInitialSim(host, joiner, this.state.stageId, seed);
  this.state.sim = sim;
  this.state.phase = 'in_game';
  this.setSimulationInterval(dt => this.tick(dt), 1000/60);
  this.setPatchRate(50);
}
```

`buildInitialSim` replaces `createVsState` for MP: both actors are `isPlayer = true`, no AI behavior, slot0 gets `team: 'player'`, slot1 gets `team: 'enemy'`. Reuse guild data + initial HP/MP from `getGuild`.

- [ ] **Step 4: Implement tick**

```ts
private lastInput = new Map<string, InputState>();
private pendingEvents = new Map<string, InputEvent[]>();

this.onMessage('input', (client, msg: InputMsg) => {
  this.lastInput.set(client.sessionId, msg.state);
  const pending = this.pendingEvents.get(client.sessionId) ?? [];
  pending.push(...msg.events);
  this.pendingEvents.set(client.sessionId, pending);
});

private tick(dtMs: number) {
  if (!this.state.sim) return;
  const p1Input = this.coalesceInput(this.state.hostSessionId);
  const p2Input = this.coalesceInput(this.getJoinerId());
  tickSimulation(this.state.sim as unknown as SimState, p1Input, dtMs, { team: 'player' });
  tickSimulation(this.state.sim as unknown as SimState, p2Input, dtMs, { team: 'enemy' });
  // ... or one combined tick that knows both inputs — match existing tickSimulation API
}
```

**If `tickSimulation` only accepts one input today,** its signature grows a per-actor input map, OR the server runs two `applyInputToActor(state, actorId, input)` calls before a single `tickPhysics(state, dt)` pass. Check `packages/shared/src/simulation/simulation.ts` — the current `tickSimulation` signature decides this. Adapt accordingly and note any sim-API change in a separate commit.

- [ ] **Step 5: Coalesce input with event-edge semantics**

```ts
private coalesceInput(sessionId: string): InputState {
  const held = this.lastInput.get(sessionId) ?? makeEmptyInputState();
  const events = this.pendingEvents.get(sessionId) ?? [];
  this.pendingEvents.set(sessionId, []);
  const input: InputState = { ...held };
  for (const e of events) {
    if (e.type === 'attackDown') input.attackJustPressed = true;
    if (e.type === 'jumpDown') input.jumpJustPressed = true;
    // ... etc.
  }
  return input;
}
```

- [ ] **Step 6: Run tests**

Run: `npm test -- MatchRoom`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(mp): MatchRoom runs tickSimulation + coalesces input events"
```

### Task C3: Disconnect + results + rematch

**Subagent model:** sonnet.

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`
- Modify: `packages/server/src/rooms/__tests__/MatchRoom.*.test.ts`

- [ ] **Step 1: Write failing tests**

1. Disconnect during in_game → `phase = 'results'`, `matchWinnerSessionId` = remaining client.
2. Disconnect during pre-game → phase resets to `'lobby'`, opponent slot cleared.
3. `rematch_offer` by host → `rematch_accept{accept:true}` → phase `'char_select'` with locked=false.
4. `rematch_accept{accept:false}` → phase stays `'results'`, room still open.
5. Second `onLeave` (both gone) → room closes.

- [ ] **Step 2: Implement**

Extend `onLeave` with phase branching. Wire rematch messages. Track connected slots — if both leave, call `this.disconnect()`.

- [ ] **Step 3: Tests pass**

Run: `npm test -- MatchRoom`
Expected: PASS all.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mp): MatchRoom disconnect handling, rematch offer/accept"
```

---

## Phase D: Client net (parallel-safe)

### Task D1: ColyseusClient singleton + join flow

**Subagent model:** sonnet.

**Files:**
- Create: `src/game/net/ColyseusClient.ts`
- Create: `src/game/net/__tests__/ColyseusClient.test.ts`

- [ ] **Step 1: Failing test**

Test that `hostRoom({name, rounds, visibility})` returns a `Room<MatchState>` and that `joinByCode(code)` connects to an existing room. Mock `colyseus.js` `Client`.

- [ ] **Step 2: Implement**

```ts
// src/game/net/ColyseusClient.ts
import { Client, Room } from 'colyseus.js';
import type { MatchState } from '@nannymud/shared';

const WS_URL = import.meta.env.VITE_COLYSEUS_URL ?? 'ws://localhost:2567';

let client: Client | null = null;
export function getClient(): Client {
  if (!client) client = new Client(WS_URL);
  return client;
}

export async function hostRoom(opts: { name: string; rounds: 1|3|5|7; visibility: 'public'|'private'; playerName: string; }): Promise<Room<MatchState>> {
  return await getClient().create<MatchState>('match', { ...opts, name: opts.playerName });
}

export async function joinByCode(code: string, playerName: string): Promise<Room<MatchState>> {
  return await getClient().joinById<MatchState>(code, { name: playerName });
}
```

- [ ] **Step 3: Commit**

### Task D2: InputSender

**Subagent model:** sonnet.

**Files:**
- Create: `src/game/net/InputSender.ts`
- Create: `src/game/net/__tests__/InputSender.test.ts`

- [ ] **Step 1: Failing test**

Verify that two consecutive `update()` calls where attack transitions false→true produce an `attackDown` event, and that the event buffer clears after `send()`.

- [ ] **Step 2: Implement**

```ts
// src/game/net/InputSender.ts
import type { Room } from 'colyseus.js';
import type { InputState } from '@nannymud/shared/simulation/types';
import type { InputEvent, InputMsg, MatchState } from '@nannymud/shared';

export class InputSender {
  private sequenceId = 0;
  private prev: InputState | null = null;
  private events: InputEvent[] = [];
  constructor(private room: Room<MatchState>) {}

  update(current: InputState, tMs: number) {
    if (this.prev) {
      if (!this.prev.attackJustPressed && current.attackJustPressed) this.events.push({ type: 'attackDown', tMs });
      if (!this.prev.jumpJustPressed && current.jumpJustPressed) this.events.push({ type: 'jumpDown', tMs });
      // ... one per InputEvent variant
    }
    this.prev = current;
  }

  send(state: InputState) {
    const msg: InputMsg = { sequenceId: ++this.sequenceId, state, events: this.events };
    this.room.send('input', msg);
    this.events = [];
  }
}
```

- [ ] **Step 3: Commit**

### Task D3: Room state mirror + interpolation

**Subagent model:** sonnet.

**Files:**
- Create: `src/game/net/StateSync.ts`
- Create: `src/game/net/__tests__/StateSync.test.ts`

- [ ] **Step 1: Test — interpolates between two snapshots at t=halfway**

```ts
it('interpolates x at midpoint', () => {
  const sync = new StateSync();
  sync.onSnapshot({ tMs: 0, actors: [{ id: 'a', x: 0, y: 0, z: 0 }] });
  sync.onSnapshot({ tMs: 50, actors: [{ id: 'a', x: 100, y: 0, z: 0 }] });
  const at25 = sync.sample(25);
  expect(at25.find(a => a.id === 'a')?.x).toBeCloseTo(50);
});
```

- [ ] **Step 2: Implement StateSync**

Keeps last 2 snapshots. `sample(tMs)` returns interpolated position for each actor at `tMs` (defaults to `now - 50ms`). Non-transform fields (hp, mp, status) come from the newest snapshot.

- [ ] **Step 3: Commit**

---

## Phase E: Client screens (parallel-safe)

### Task E1: MP hub + modals (Create, Join)

**Subagent model:** sonnet.

**Files:**
- Create: `src/screens/mp/MpHub.tsx`
- Create: `src/screens/mp/CreateRoomModal.tsx`
- Create: `src/screens/mp/JoinByCodeModal.tsx`
- Create: `src/screens/mp/usePlayerName.ts`
- Modify: `src/screens/MainMenu.tsx` (add MULTIPLAYER entry)

Full code in each file per the design handoff. Per-file code is verbose — each screen's layout is documented in `design_handoff_nannymud/README.md` sections 13–15; reuse the `theme` tokens from `src/ui/theme.ts`. Disabled controls render with the same markup + `disabled` attribute + `opacity:.4` styling.

- [ ] **Step 1: MpHub renders + wiring** — see handoff §13.
- [ ] **Step 2: Create modal with visibility/rounds.**
- [ ] **Step 3: Join modal with 6-cell input.**
- [ ] **Step 4: Name prompt on first visit.**
- [ ] **Step 5: MainMenu entry.**
- [ ] **Step 6: Commit**

### Task E2: Lobby + networked char-select + stage-select

**Subagent model:** sonnet.

**Files:**
- Create: `src/screens/mp/MpLobby.tsx`
- Create: `src/screens/mp/MpCharSelect.tsx`
- Create: `src/screens/mp/MpStageSelect.tsx`

- [ ] Steps: subscribe to `room.state`; render slots; send `ready_toggle`, `lock_guild`, `pick_stage` messages; show "waiting for opponent" states; disable non-MVP controls.

- [ ] **Commit per screen**

### Task E3: App.tsx MP state tree

**Subagent model:** opus (central routing, easy to get wrong).

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/state/useAppState.ts`

- [ ] Add MP screens to `Screen` type; add `mpRoom: Room<MatchState> | null`, `mpPlayerName: string`. Route MP URL `/multiplayer` → `mp_hub` initial screen. Wire `room.onStateChange` / `room.onLeave` to advance app state as phase changes server-side.

- [ ] **Commit**

---

## Phase F: Integration (sync, all merge here)

### Task F1: GameplayScene MP branch

**Subagent model:** opus.

**Files:**
- Modify: `src/game/scenes/GameplayScene.ts`
- Modify: `src/game/PhaserGame.ts`

- [ ] Read `netMode` from registry. If `'mp'`: skip `tickSimulation`; read `room.state.sim`; feed positions via `StateSync`; send input via `InputSender`. P key is no-op. Victory/defeat detection reads `room.state.phase === 'results'` instead of sim phase.
- [ ] **Commit**

### Task F2: GameScreen MP branch

**Subagent model:** sonnet.

- [ ] Add `netMode` prop (or derive from `mode === 'mp'`). Pass `matchRoom` through Phaser boot config. HudOverlay receives localSessionId + hostSessionId so it can render P1/P2 labels without reading `actor.team`.
- [ ] **Commit**

### Task F3: Double-loading-screen fix

**Subagent model:** sonnet.

**Files:**
- Modify: `src/screens/LoadingScreen.tsx`
- Modify: `src/game/scenes/BootScene.ts`

- [ ] Consolidate: show the React loading screen while BootScene preloads; only hide the React screen when BootScene emits a `preload-done` event. Currently they run back-to-back; make them concurrent with one visible progress.
- [ ] **Commit**

### Task F4: Manual acceptance (two-tab test)

**Subagent model:** — (human task).

- [ ] Run `npm run dev`.
- [ ] Open two tabs at `localhost:5175/multiplayer`.
- [ ] Walk the 13-step acceptance list from the spec. Log any issue as a follow-up task.
- [ ] **Commit** any fix-ups; otherwise mark all checkboxes done.

### Task F5: Final code review + polish

**Subagent model:** opus (dispatch superpowers:code-reviewer on full diff).

- [ ] Dispatch code-reviewer against the full merge diff (`main..feat/mp-1v1-multiplayer`).
- [ ] Address high-priority findings; open follow-up tasks for lower-priority.
- [ ] **Commit** fixes.

---

## Parallelism summary

| When | Run in parallel |
|---|---|
| After Phase A | — (Phase B is sync) |
| After Phase B | Phase C, D, E (three worktrees) |
| During Phase F | F1+F2 can overlap; F3 independent; F4 last; F5 after F4 |

## Review discipline

After every task:

1. Implementer subagent self-reviews + commits.
2. Spec-compliance review (`superpowers:code-reviewer` with the spec + task text).
3. Code-quality review (same agent, quality lens).
4. Implementer fixes any issues; reviewer re-checks.
5. Controller updates the "Current status" block at the top of this file.
6. Controller moves to the next task.

**Never skip either review. Never start quality review before spec compliance passes.**
