# MP Battle Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Battle game mode (up to 8 human + CPU slots) to the multiplayer lobby, letting the host configure slots and teams before launching into the existing battle simulation.

**Architecture:** Extend `MatchRoom` with a new `battle_config` phase, a `BattleSlotSchema` array on `MatchState`, and three new message handlers. The simulation gains an `extraInputs` parameter to route multiple human client inputs to their actors. A new `MpBattleConfig` screen handles host slot config and per-player guild selection.

**Tech Stack:** Colyseus 0.17 (schema, room), TypeScript, React, Vite, Vitest.

---

## File Map

**Create:**
- `packages/shared/src/schema/BattleSlotSchema.ts` — Colyseus schema for one slot entry
- `src/screens/mp/MpBattleConfig.tsx` — MP battle config screen component

**Modify:**
- `packages/shared/src/simulation/battleSimulation.ts` — add `createMpBattleState` (multi-human)
- `packages/shared/src/simulation/simulation.ts` — `tickSimulation` gains optional `extraInputs`
- `packages/shared/src/schema/MatchState.ts` — add `gameMode`, `uniqueGuilds`, `battleSlots`
- `packages/shared/src/schema/index.ts` — export `BattleSlotSchema`
- `packages/shared/src/protocol/messages.ts` — add three new message types
- `packages/server/src/rooms/MatchRoom.ts` — Battle mode throughout
- `src/game/net/ColyseusClient.ts` — extend `HostRoomOpts`
- `src/screens/mp/CreateRoomModal.tsx` — mode toggle + unique guilds toggle
- `src/screens/mp/MpLobby.tsx` — Battle mode variant (8 slots, NEXT button)
- `src/state/useAppState.ts` — add `mp_battle_config` to `AppScreen`
- `src/App.tsx` — route `battle_config` phase, render `MpBattleConfig`

---

## Task 1: BattleSlotSchema + MatchState additions + protocol messages

**Files:**
- Create: `packages/shared/src/schema/BattleSlotSchema.ts`
- Modify: `packages/shared/src/schema/MatchState.ts`
- Modify: `packages/shared/src/schema/index.ts`
- Modify: `packages/shared/src/protocol/messages.ts`

- [ ] **Step 1: Create `BattleSlotSchema.ts`**

```ts
// packages/shared/src/schema/BattleSlotSchema.ts
import { Schema, type } from '@colyseus/schema';

export class BattleSlotSchema extends Schema {
  @type('string') slotType: 'human' | 'cpu' | 'off' = 'off';
  @type('string') guildId = '';
  @type('string') team = '';           // 'A' | 'B' | 'C' | 'D' | ''
  @type('string') ownerSessionId = ''; // set for human slots
}
```

- [ ] **Step 2: Update `MatchState.ts`**

Replace the import line and add three fields. Full file:

```ts
import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { PlayerSlot } from './PlayerSlot';
import { SimStateSchema } from './SimStateSchema';
import { BattleSlotSchema } from './BattleSlotSchema';

export type MatchPhase =
  | 'lobby'
  | 'char_select'
  | 'stage_select'
  | 'loading'
  | 'in_game'
  | 'results'
  | 'battle_config';

export class MatchState extends Schema {
  @type('string') phase: MatchPhase = 'lobby';
  @type('string') code = '';
  @type('number') rounds: number = 3;
  @type('string') visibility: 'public' | 'private' = 'private';
  @type('string') name = '';
  @type('string') hostSessionId = '';
  @type({ map: PlayerSlot }) players = new MapSchema<PlayerSlot>();
  @type('string') stageId = '';
  @type('number') hoveredStageIdx: number = 0;
  @type('number') seed = 0;
  @type(SimStateSchema) sim?: SimStateSchema;
  @type('string') matchWinnerSessionId = '';
  @type('number') createdAtMs = 0;
  @type('string') gameMode: 'versus' | 'battle' = 'versus';
  @type('boolean') uniqueGuilds = false;
  @type([BattleSlotSchema]) battleSlots = new ArraySchema<BattleSlotSchema>();
}
```

- [ ] **Step 3: Export `BattleSlotSchema` from `index.ts`**

Add to the top of `packages/shared/src/schema/index.ts`:
```ts
export * from './BattleSlotSchema';
```

- [ ] **Step 4: Add message types to `messages.ts`**

Append to `packages/shared/src/protocol/messages.ts`:
```ts
export interface SetBattleSlotMsg {
  type: 'set_battle_slot';
  index: number;
  slotType: 'human' | 'cpu' | 'off';
  guildId: string;
  team: string;
}

export interface SetMyGuildMsg {
  type: 'set_my_guild';
  guildId: string;
}

export interface LaunchFromConfigMsg {
  type: 'launch_from_config';
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schema/BattleSlotSchema.ts packages/shared/src/schema/MatchState.ts packages/shared/src/schema/index.ts packages/shared/src/protocol/messages.ts
git commit -m "feat(schema): BattleSlotSchema, gameMode/uniqueGuilds/battleSlots on MatchState, battle_config phase"
```

---

## Task 2: Simulation — multi-human Battle support

**Files:**
- Modify: `packages/shared/src/simulation/battleSimulation.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/mpBattle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createMpBattleState } from '../battleSimulation';
import { tickSimulation } from '../simulation';
import { makeEmptyInputState } from '../simulation';
import type { BattleSlot } from '../types';

const TWO_HUMAN_SLOTS: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: 'A' },
  { guildId: 'knight',     type: 'human', team: 'B' },
];

const HUMAN_PLUS_CPU: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: 'A' },
  { guildId: 'knight',     type: 'cpu',   team: 'B' },
];

describe('createMpBattleState', () => {
  it('returns state + actorIdBySlotIndex with entry per active slot', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    expect(Object.keys(actorIdBySlotIndex)).toHaveLength(2);
    expect(state.player.guildId).toBe('adventurer');
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].guildId).toBe('knight');
  });

  it('slot 0 actor id is "player"', () => {
    const { actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    expect(actorIdBySlotIndex[0]).toBe('player');
  });

  it('cpu slot actor has aiState behavior chaser', () => {
    const { state } = createMpBattleState(HUMAN_PLUS_CPU, 'assembly', 1);
    expect(state.enemies[0].aiState.behavior).toBe('chaser');
  });

  it('human slot actors have no aiState chaser behavior', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    const slot1ActorId = actorIdBySlotIndex[1];
    const slot1Actor = state.enemies.find(e => e.id === slot1ActorId)!;
    expect(slot1Actor.aiState.behavior).not.toBe('chaser');
  });
});

describe('tickSimulation extraInputs', () => {
  it('routes extraInputs to the correct actor without crashing', () => {
    const { state, actorIdBySlotIndex } = createMpBattleState(TWO_HUMAN_SLOTS, 'assembly', 1);
    const extraInputs = { [actorIdBySlotIndex[1]]: { ...makeEmptyInputState(), right: true } };
    expect(() => tickSimulation(state, makeEmptyInputState(), 16, undefined, extraInputs)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- packages/shared/src/simulation/__tests__/mpBattle.test.ts
```
Expected: fails — `createMpBattleState` is not exported.

- [ ] **Step 3: Add `createMpBattleState` to `battleSimulation.ts`**

Append after the existing `createBattleState` function. The existing function is unchanged.

```ts
/**
 * MP variant: creates actors for ALL active human slots (not just the first).
 * Returns the state and a mapping from slot index → actor ID so the server
 * can route per-client inputs to the correct actor.
 */
export function createMpBattleState(
  slots: BattleSlot[],
  _stageId: string,
  seed: number,
  difficulty = 2,
): { state: SimState; actorIdBySlotIndex: Record<number, string> } {
  const activeSlots = slots.filter((s) => s.type !== 'off');
  const firstHumanIdx = slots.findIndex((s) => s.type === 'human');
  if (firstHumanIdx === -1) throw new Error('MP Battle requires at least one human slot');

  const firstHuman = slots[firstHumanIdx];
  // eslint-disable-next-line no-restricted-globals -- seed chosen once at startMatch
  const state = createInitialState(firstHuman.guildId as GuildId, seed);

  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  state.battleMode = true;
  state.battleSlots = activeSlots;
  state.battleTimer = BATTLE_TIMER_MS;
  state.battleDifficulty = difficulty;
  state.battStats = {};

  const actorIdBySlotIndex: Record<number, string> = {};

  // Slot 0 (first human) → state.player
  state.player.battleTeam = firstHuman.team as string | undefined || undefined;
  state.battStats[state.player.id] = makeEmptyBattStat();
  actorIdBySlotIndex[firstHumanIdx] = state.player.id;

  let spawnOffset = 0;
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.type === 'off') continue;
    if (i === firstHumanIdx) continue; // already state.player

    const actor = createPlayerActor(slot.guildId as GuildId);
    actor.id = slot.type === 'human' ? `mp_human_${i}` : `battle_${state.nextActorId++}`;
    actor.team = 'enemy';
    actor.isPlayer = true;
    actor.battleTeam = slot.team as string | undefined || undefined;
    actor.x = PLAYER_SPAWN_X + ENEMY_SPAWN_START_OFFSET + spawnOffset * ENEMY_SPAWN_SPACING;
    actor.y = PLAYER_SPAWN_Y + ((spawnOffset % 3) - 1) * 40;
    actor.facing = -1;
    if (slot.type === 'cpu') {
      actor.aiState = { ...actor.aiState, behavior: 'chaser', targetId: 'player' };
    }
    // Human-type actors have no AI — driven by extraInputs in tick
    state.enemies.push(actor);
    state.battStats[actor.id] = makeEmptyBattStat();
    actorIdBySlotIndex[i] = actor.id;
    spawnOffset++;
  }

  return { state, actorIdBySlotIndex };
}
```

- [ ] **Step 4: Extend `tickSimulation` to accept `extraInputs`**

In `packages/shared/src/simulation/simulation.ts`, change the `tickSimulation` signature:

```ts
export function tickSimulation(
  state: SimState,
  input: InputState,
  dtMs: number,
  opponentInput?: InputState,
  extraInputs?: Record<string, InputState>,
): SimState {
```

Then in the enemy loop (~line 1845), replace the existing block:
```ts
    if (state.battleMode && enemy.isPlayer) {
      // Battle CPU: guild actor driven by synthesized VS input, not tickAI.
      // handlePlayerInput already decrements invulnerableMs for this branch.
      const oppCtrl = getOrCreateController(state, enemy.id, createEmptyCpuInput());
      const cpuInput = synthesizeVsCpuInput(state, enemy, oppCtrl.input, dtMs, state.battleDifficulty);
      handlePlayerInput(state, cpuInput, oppCtrl, dtMs, enemy);
    } else {
```

with:

```ts
    if (extraInputs?.[enemy.id] !== undefined) {
      // MP Battle: human actor driven by remote client input instead of AI.
      const humanCtrl = getOrCreateController(state, enemy.id, extraInputs[enemy.id]);
      handlePlayerInput(state, extraInputs[enemy.id], humanCtrl, dtMs, enemy);
    } else if (state.battleMode && enemy.isPlayer) {
      // Battle CPU: guild actor driven by synthesized VS input, not tickAI.
      const oppCtrl = getOrCreateController(state, enemy.id, createEmptyCpuInput());
      const cpuInput = synthesizeVsCpuInput(state, enemy, oppCtrl.input, dtMs, state.battleDifficulty);
      handlePlayerInput(state, cpuInput, oppCtrl, dtMs, enemy);
    } else {
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test -- packages/shared/src/simulation/__tests__/mpBattle.test.ts
```
Expected: all 5 pass.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```
Expected: all pass (golden test must still pass — `extraInputs` is optional so existing callers are unaffected).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/battleSimulation.ts packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/mpBattle.test.ts
git commit -m "feat(sim): createMpBattleState + extraInputs param on tickSimulation for multi-human MP Battle"
```

---

## Task 3: MatchRoom — Battle mode init (`onCreate`, `maxClients`)

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Write failing test**

In `packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts`, first extend the existing `createRoom` helper to accept `gameMode` and `uniqueGuilds`:

```ts
// Update the createRoom signature:
function createRoom(opts: {
  name?: string;
  rounds?: number;
  visibility?: 'public' | 'private';
  gameMode?: 'versus' | 'battle';
  uniqueGuilds?: boolean;
} = {}) {
  // ... same body as before, just pass opts straight through to room.onCreate(opts)
```

Then add the new tests:

```ts
it('Battle room sets maxClients to 8', () => {
  const room = createRoom({ gameMode: 'battle', name: 'TestBattle', rounds: 3, visibility: 'public' });
  expect(room.maxClients).toBe(8);
  expect(room.state.gameMode).toBe('battle');
  expect(room.state.uniqueGuilds).toBe(false);
});

it('Versus room keeps maxClients at 2', () => {
  const room = createRoom({ name: 'TestVersus', rounds: 3, visibility: 'public' });
  expect(room.maxClients).toBe(2);
  expect(room.state.gameMode).toBe('versus');
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```
Expected: fail — `state.gameMode` undefined.

- [ ] **Step 3: Update `CreateOpts` and `onCreate` in `MatchRoom.ts`**

Change the `CreateOpts` interface:
```ts
interface CreateOpts {
  name?: string;
  rounds?: number;
  visibility?: 'public' | 'private';
  gameMode?: 'versus' | 'battle';
  uniqueGuilds?: boolean;
}
```

In `onCreate`, after the existing `this.state.createdAtMs = Date.now();` line, add:
```ts
this.state.gameMode = opts.gameMode ?? 'versus';
this.state.uniqueGuilds = opts.uniqueGuilds ?? false;
this.maxClients = this.state.gameMode === 'battle' ? 8 : 2;
```

Also update `setMetadata` call to include gameMode:
```ts
void this.setMetadata({
  name: this.state.name,
  rounds: this.state.rounds,
  visibility: this.state.visibility,
  hostName: '',
  gameMode: this.state.gameMode,
});
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```
Expected: new tests pass, existing tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): MatchRoom reads gameMode/uniqueGuilds from CreateOpts, sets maxClients=8 for battle"
```

---

## Task 4: MatchRoom — `launch_battle` → `battle_config` for Battle mode

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Write failing test**

In `MatchRoom.phase.test.ts`, add (using the existing `sendMsg`, `createRoom`, `joinRoom` helpers already defined in that file):

```ts
it('launch_battle in battle mode transitions to battle_config and initialises 8 battleSlots', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const c1 = makeClient('host');
  const c2 = makeClient('p2');
  joinRoom(room, c1, { name: 'Alice' });
  joinRoom(room, c2, { name: 'Bob' });

  room.state.players.get('host')!.ready = true;
  room.state.players.get('p2')!.ready = true;

  sendMsg(room, c1, 'launch_battle', {});

  expect(room.state.phase).toBe('battle_config');
  expect(room.state.battleSlots.length).toBe(8);

  const humanSlots = [...room.state.battleSlots].filter(s => s.slotType === 'human');
  expect(humanSlots).toHaveLength(2);

  const offSlots = [...room.state.battleSlots].filter(s => s.slotType === 'off');
  expect(offSlots).toHaveLength(6);
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

- [ ] **Step 3: Update `launch_battle` handler in `MatchRoom.ts`**

Find the existing handler:
```ts
this.onMessage('launch_battle', (client: Client) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  const slots = [...this.state.players.values()];
  if (slots.length !== 2 || !slots.every(s => s.ready)) return;
  this.state.phase = 'char_select';
  slots.forEach(s => { s.locked = false; s.guildId = ''; });
});
```

Replace with:
```ts
this.onMessage('launch_battle', (client: Client) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  const slots = [...this.state.players.values()];
  const allReady = slots.length >= 2 && slots.every(s => s.ready);
  if (!allReady) return;

  if (this.state.gameMode === 'battle') {
    // Initialise 8 battleSlots — human entries for each connected player, rest off
    this.state.battleSlots.clear();
    const { BattleSlotSchema } = require('@nannymud/shared');
    const connectedSessions = [...this.state.players.keys()];
    for (let i = 0; i < 8; i++) {
      const slot = new BattleSlotSchema();
      if (i < connectedSessions.length) {
        slot.slotType = 'human';
        slot.ownerSessionId = connectedSessions[i];
      } else {
        slot.slotType = 'off';
      }
      this.state.battleSlots.push(slot);
    }
    this.state.phase = 'battle_config';
  } else {
    // Versus: unchanged
    if (slots.length !== 2) return;
    this.state.phase = 'char_select';
    slots.forEach(s => { s.locked = false; s.guildId = ''; });
  }
});
```

Note: `require` is used here because this is a CommonJS/ESM hybrid env (swc-node). If the project uses ESM imports at top-of-file already for `@nannymud/shared`, move the destructure to the top-level import instead. Match the pattern already used in the file (look at how `MatchState` and `PlayerSlot` are imported at the top and follow that).

Correct import approach — add to the top of `MatchRoom.ts`:
```ts
import { MatchState, PlayerSlot, BattleSlotSchema } from '@nannymud/shared';
```
(Remove the inline `require`.)

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): launch_battle initialises battle_config phase + 8 BattleSlots for battle mode"
```

---

## Task 5: MatchRoom — `set_battle_slot`, `set_my_guild`, unique guilds guard

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Write failing tests**

In `MatchRoom.phase.test.ts`, add a helper and new tests (using the existing `sendMsg`, `createRoom`, `joinRoom`, `makeClient` helpers):

```ts
function reachBattleConfig(room: ReturnType<typeof createRoom>, host: ReturnType<typeof makeClient>, p2: ReturnType<typeof makeClient>) {
  joinRoom(room, host, { name: 'Alice' });
  joinRoom(room, p2, { name: 'Bob' });
  room.state.players.get(host.sessionId)!.ready = true;
  room.state.players.get(p2.sessionId)!.ready = true;
  sendMsg(room, host, 'launch_battle', {});
}

it('host can set a cpu slot guild and team', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const host = makeClient('host');
  const p2   = makeClient('p2');
  reachBattleConfig(room, host, p2);

  sendMsg(room, host, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'knight', team: 'B' });

  const s = room.state.battleSlots[2];
  expect(s.slotType).toBe('cpu');
  expect(s.guildId).toBe('knight');
  expect(s.team).toBe('B');
});

it('non-host cannot call set_battle_slot', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const host = makeClient('host');
  const p2   = makeClient('p2');
  reachBattleConfig(room, host, p2);

  sendMsg(room, p2, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'knight', team: 'A' });
  expect(room.state.battleSlots[2].slotType).toBe('off');
});

it('set_my_guild updates the calling player own slot', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const host = makeClient('host');
  const p2   = makeClient('p2');
  reachBattleConfig(room, host, p2);

  sendMsg(room, p2, 'set_my_guild', { guildId: 'mage' });
  const ownSlot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
  expect(ownSlot.guildId).toBe('mage');
});

it('unique guilds: rejects duplicate guildId', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public', uniqueGuilds: true });
  const host = makeClient('host');
  const p2   = makeClient('p2');
  reachBattleConfig(room, host, p2);

  sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
  sendMsg(room, p2,   'set_my_guild', { guildId: 'adventurer' });
  const p2Slot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
  expect(p2Slot.guildId).toBe(''); // rejected — unchanged
});

it('unique guilds off: allows duplicate guildId', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public', uniqueGuilds: false });
  const host = makeClient('host');
  const p2   = makeClient('p2');
  reachBattleConfig(room, host, p2);

  sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
  sendMsg(room, p2,   'set_my_guild', { guildId: 'adventurer' });
  const p2Slot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
  expect(p2Slot.guildId).toBe('adventurer');
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

- [ ] **Step 3: Add handlers in `MatchRoom.ts`**

Add these three handlers inside `onCreate`, after the existing `launch_battle` handler:

```ts
// ── Battle config handlers ──────────────────────────────────────────

this.onMessage('set_battle_slot', (client: Client, msg: { index: number; slotType: 'human' | 'cpu' | 'off'; guildId: string; team: string }) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  if (this.state.phase !== 'battle_config') return;
  const slot = this.state.battleSlots[msg.index];
  if (!slot) return;
  if (this.state.uniqueGuilds && msg.guildId) {
    const taken = [...this.state.battleSlots].some(
      (s, i) => i !== msg.index && s.slotType !== 'off' && s.guildId === msg.guildId,
    );
    if (taken) return;
  }
  slot.slotType = msg.slotType;
  slot.guildId = msg.guildId;
  slot.team = msg.team;
  if (msg.slotType !== 'human') slot.ownerSessionId = '';
});

this.onMessage('set_my_guild', (client: Client, msg: { guildId: string }) => {
  if (this.state.phase !== 'battle_config') return;
  const slot = [...this.state.battleSlots].find(s => s.ownerSessionId === client.sessionId);
  if (!slot) return;
  if (this.state.uniqueGuilds && msg.guildId) {
    const taken = [...this.state.battleSlots].some(
      s => s !== slot && s.slotType !== 'off' && s.guildId === msg.guildId,
    );
    if (taken) return;
  }
  slot.guildId = msg.guildId;
});

this.onMessage('launch_from_config', (client: Client) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  if (this.state.phase !== 'battle_config') return;
  const activeCount = [...this.state.battleSlots].filter(s => s.slotType !== 'off').length;
  if (activeCount < 2) return;
  // Copy guildId into PlayerSlot so existing MP results screen can read guild
  for (const slot of this.state.battleSlots) {
    if (slot.slotType === 'human' && slot.ownerSessionId) {
      const ps = this.state.players.get(slot.ownerSessionId);
      if (ps) ps.guildId = slot.guildId;
    }
  }
  this.state.phase = 'stage_select';
});
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): set_battle_slot, set_my_guild, launch_from_config handlers + uniqueGuilds enforcement"
```

---

## Task 6: MatchRoom — `startMatch` Battle branch + multi-input tick

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Write failing test**

In `MatchRoom.sim.test.ts`, add (using the `sendMsg`, `createRoom`, `joinRoom`, `makeClient` helpers — import or copy them from `MatchRoom.phase.test.ts` if not already present in `sim.test.ts`):

```ts
it('startMatch in battle mode uses createMpBattleState and ticks without crash', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const host = makeClient('host');
  const p2   = makeClient('p2');

  joinRoom(room, host, { name: 'A' });
  joinRoom(room, p2,   { name: 'B' });
  room.state.players.get('host')!.ready = true;
  room.state.players.get('p2')!.ready = true;
  sendMsg(room, host, 'launch_battle', {});

  sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
  sendMsg(room, p2,   'set_my_guild', { guildId: 'knight' });
  sendMsg(room, host, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'mage', team: 'B' });
  sendMsg(room, host, 'launch_from_config', {});

  // Simulate stage select → loading
  room.state.phase = 'loading';
  room.state.stageId = 'assembly';

  sendMsg(room, host, 'ready_to_start', {});
  sendMsg(room, p2,   'ready_to_start', {});

  expect(room.state.phase).toBe('in_game');
  expect(() => room.tick(16)).not.toThrow();
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.sim.test.ts
```

- [ ] **Step 3: Add imports and private fields to `MatchRoom.ts`**

Add to the imports at the top:
```ts
import { createMpBattleState } from '@nannymud/shared/simulation/battleSimulation';
import type { InputState } from '@nannymud/shared/simulation/types';
```

Add a private field to the class (near `private plainSim`):
```ts
/** Maps actor ID → session ID for MP Battle multi-input routing. Built in startMatch. */
private actorToSession = new Map<string, string>();
```

- [ ] **Step 4: Update `startMatch` for Battle mode**

Find `private startMatch()`. Add a Battle mode branch before the existing Versus logic:

```ts
private startMatch() {
  const seed = Math.floor(Math.random() * 2 ** 31);
  this.state.seed = seed;

  if (this.state.gameMode === 'battle') {
    const slots = [...this.state.battleSlots].map(s => ({
      guildId: s.guildId || 'adventurer',
      type: s.slotType as 'human' | 'cpu' | 'off',
      team: s.team || undefined,
    }));
    const { state: sim, actorIdBySlotIndex } = createMpBattleState(slots, this.state.stageId, seed);
    this.plainSim = sim;
    this.state.sim = createSimSchema(this.plainSim);

    // Build reverse map: actorId → ownerSessionId
    this.actorToSession.clear();
    for (const [slotIdx, actorId] of Object.entries(actorIdBySlotIndex)) {
      const bSlot = this.state.battleSlots[Number(slotIdx)];
      if (bSlot?.ownerSessionId) {
        this.actorToSession.set(actorId, bSlot.ownerSessionId);
      }
    }

    this.state.phase = 'in_game';
    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 60);
    this.setPatchRate(50);
    return;
  }

  // Versus (existing logic — unchanged)
  const hostSlot = this.state.players.get(this.state.hostSessionId);
  const joinerId = this.getJoinerId();
  const joinerSlot = joinerId ? this.state.players.get(joinerId) : undefined;
  if (!hostSlot || !joinerSlot) return;
  if (!hostSlot.guildId || !joinerSlot.guildId) return;

  this.plainSim = createMpVsState(
    hostSlot.guildId as GuildId,
    joinerSlot.guildId as GuildId,
    seed,
    this.state.stageId,
  );
  this.state.sim = createSimSchema(this.plainSim);
  this.state.phase = 'in_game';
  this.setSimulationInterval((dt) => this.tick(dt), 1000 / 60);
  this.setPatchRate(50);
}
```

- [ ] **Step 5: Update `tick` for Battle mode multi-input**

Find the `tick(dtMs: number)` method. Replace the `tickSimulation` call with a mode branch:

```ts
tick(dtMs: number) {
  if (!this.plainSim || !this.state.sim) return;
  if (this.state.phase !== 'in_game') return;

  const p1 = this.coalesceInput(this.state.hostSessionId);

  if (this.state.gameMode === 'battle') {
    const extraInputs: Record<string, InputState> = {};
    for (const [actorId, sessionId] of this.actorToSession) {
      if (sessionId !== this.state.hostSessionId) {
        extraInputs[actorId] = this.coalesceInput(sessionId);
      }
    }
    tickSimulation(this.plainSim, p1, dtMs, undefined, extraInputs);
  } else {
    const joinerId = this.getJoinerId();
    const p2 = joinerId ? this.coalesceInput(joinerId) : makeEmptyInputState();
    tickSimulation(this.plainSim, p1, dtMs, p2);
  }

  mirrorSimToSchema(this.plainSim, this.state.sim);
  if (this.plainSim.vfxEvents.length > 0) {
    this.broadcast('vfx', this.plainSim.vfxEvents);
  }

  if (this.plainSim.round?.phase === 'matchOver') {
    const winner = this.plainSim.round.matchWinner;
    const joinerId2 = this.getJoinerId();
    if (winner === 'p1') this.state.matchWinnerSessionId = this.state.hostSessionId;
    else if (winner === 'p2') this.state.matchWinnerSessionId = joinerId2;
    else this.state.matchWinnerSessionId = '';
    this.state.phase = 'results';
    this.broadcast('match_result', { matchStats: this.plainSim.matchStats });
  }
}
```

- [ ] **Step 6: Run — expect pass**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.sim.test.ts
```

- [ ] **Step 7: Run full suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): startMatch + tick support Battle mode via createMpBattleState + extraInputs routing"
```

---

## Task 7: MatchRoom — `onLeave` in `battle_config` phase

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Write failing test**

In `MatchRoom.disconnect.test.ts`, add (using the `sendMsg`, `createRoom`, `joinRoom`, `leaveRoom`, `makeClient` helpers from that file):

```ts
it('player leaving during battle_config flips their slot to off', () => {
  const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
  const host = makeClient('host');
  const p2   = makeClient('p2');

  joinRoom(room, host, { name: 'A' });
  joinRoom(room, p2,   { name: 'B' });
  room.state.players.get('host')!.ready = true;
  room.state.players.get('p2')!.ready = true;
  sendMsg(room, host, 'launch_battle', {});

  // p2 disconnects
  leaveRoom(room, p2);

  // p2's slot ownerSessionId should be cleared
  const p2Slot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2');
  expect(p2Slot).toBeUndefined();
  const offSlots = [...room.state.battleSlots].filter(s => s.slotType === 'off');
  expect(offSlots.length).toBeGreaterThanOrEqual(7);
});
```

- [ ] **Step 2: Run — expect fail**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.disconnect.test.ts
```

- [ ] **Step 3: Update `onLeave` in `MatchRoom.ts`**

In the existing `onLeave` method, find the block that checks `else if (phase === 'lobby' || phase === 'char_select' ...`. Add `|| phase === 'battle_config'` **or** handle it separately before that block:

Add a new branch (insert before the `else if (phase === 'lobby' || ...)` block):

```ts
else if (phase === 'battle_config') {
  // Flip the departing player's slot to off
  for (const bSlot of this.state.battleSlots) {
    if (bSlot.ownerSessionId === client.sessionId) {
      bSlot.slotType = 'off';
      bSlot.ownerSessionId = '';
      bSlot.guildId = '';
      break;
    }
  }
  // Remove the PlayerSlot entry
  this.state.players.delete(client.sessionId);
  // Promote host if needed
  if (this.state.hostSessionId === client.sessionId) {
    const next = [...this.state.players.keys()][0];
    if (next) this.state.hostSessionId = next;
  }
}
```

- [ ] **Step 4: Run — expect pass**

```bash
npm test -- packages/server/src/rooms/__tests__/MatchRoom.disconnect.test.ts
```

- [ ] **Step 5: Run full suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): onLeave during battle_config flips player slot to off"
```

---

## Task 8: `ColyseusClient` + `CreateRoomModal`

**Files:**
- Modify: `src/game/net/ColyseusClient.ts`
- Modify: `src/screens/mp/CreateRoomModal.tsx`

- [ ] **Step 1: Extend `HostRoomOpts` in `ColyseusClient.ts`**

```ts
export interface HostRoomOpts {
  name: string;
  rounds: 1 | 3 | 5 | 7;
  visibility: 'public' | 'private';
  playerName: string;
  gameMode?: 'versus' | 'battle';
  uniqueGuilds?: boolean;
}

export async function hostRoom(opts: HostRoomOpts): Promise<Room<MatchState>> {
  return await getClient().create<MatchState>('match', {
    name: opts.name,
    rounds: opts.rounds,
    visibility: opts.visibility,
    playerName: opts.playerName,
    gameMode: opts.gameMode ?? 'versus',
    uniqueGuilds: opts.uniqueGuilds ?? false,
  });
}
```

- [ ] **Step 2: Update `CreateRoomModal.tsx`**

Add state for the new fields and update the UI. Full replacement of the component:

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import { theme, ModalShell } from '../../ui';
import { hostRoom } from '../../game/net/ColyseusClient';

interface Props {
  playerName: string;
  onCancel: () => void;
  onCreated: (room: Room<MatchState>) => void;
}

const ROUNDS_OPTIONS = [1, 3, 5, 7] as const;
type RoundsOption = (typeof ROUNDS_OPTIONS)[number];

export function CreateRoomModal({ playerName, onCancel, onCreated }: Props) {
  const [roomName, setRoomName] = useState('Room');
  const [rounds, setRounds] = useState<RoundsOption>(3);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [gameMode, setGameMode] = useState<'versus' | 'battle'>('versus');
  const [uniqueGuilds, setUniqueGuilds] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const canCreate = roomName.trim().length > 0 && !loading;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError(null);
    try {
      const room = await hostRoom({ name: roomName.trim(), rounds, visibility, playerName, gameMode, uniqueGuilds });
      onCreated(room);
    } catch (err) {
      console.log(err);
      setError(err instanceof Error ? err.message : 'Failed to create room. Check your connection.');
      setLoading(false);
    }
  };

  const toggleStyle = (active: boolean) => ({
    padding: '8px 20px',
    background: active ? theme.accent : 'transparent',
    color: active ? theme.bgDeep : theme.ink,
    border: `1px solid ${active ? theme.accent : theme.line}`,
    fontFamily: theme.fontMono,
    fontSize: 13,
    letterSpacing: 2,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.5 : 1,
    borderRadius: 2,
    transition: 'all 100ms ease',
  });

  return (
    <ModalShell
      kicker="MULTIPLAYER"
      title="Create Room"
      onCancel={onCancel}
      primary={{ label: loading ? 'CREATING…' : 'CREATE', onClick: handleCreate, disabled: !canCreate }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Room name */}
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>ROOM NAME</div>
          <input
            ref={inputRef}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            maxLength={32}
            disabled={loading}
            style={{ width: '100%', background: theme.panel, border: `1px solid ${theme.line}`, color: theme.ink, fontFamily: theme.fontBody, fontSize: 16, padding: '10px 14px', outline: 'none', boxSizing: 'border-box', opacity: loading ? 0.5 : 1 }}
          />
        </div>

        {/* Game mode */}
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>GAME MODE</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => !loading && setGameMode('versus')} disabled={loading} style={toggleStyle(gameMode === 'versus')}>
              VERSUS · 1V1
            </button>
            <button onClick={() => !loading && setGameMode('battle')} disabled={loading} style={toggleStyle(gameMode === 'battle')}>
              BATTLE · UP TO 8
            </button>
          </div>
        </div>

        {/* Rounds */}
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>ROUNDS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROUNDS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRounds(r)}
                disabled={loading}
                style={{ padding: '8px 20px', background: rounds === r ? theme.accent : 'transparent', color: rounds === r ? theme.bgDeep : theme.ink, border: `1px solid ${rounds === r ? theme.accent : theme.line}`, fontFamily: theme.fontMono, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, borderRadius: 2, transition: 'all 100ms ease' }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Unique guilds (battle only) */}
        {gameMode === 'battle' && (
          <div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>OPTIONS</div>
            <label
              onClick={() => !loading && setUniqueGuilds(u => !u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: loading ? 'not-allowed' : 'pointer', userSelect: 'none' }}
            >
              <span style={{ width: 16, height: 16, border: `2px solid ${uniqueGuilds ? theme.accent : theme.line}`, background: uniqueGuilds ? theme.accent : 'transparent', display: 'inline-block', flexShrink: 0, transition: 'all 100ms ease' }} />
              <span style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.ink }}>Unique guilds — no two players share a guild</span>
            </label>
          </div>
        )}

        {/* Visibility */}
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3, marginBottom: 8 }}>VISIBILITY</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {(['private', 'public'] as const).map((v) => (
              <label key={v} onClick={() => !loading && setVisibility(v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: theme.fontBody, fontSize: 14, color: loading ? theme.inkMuted : theme.ink, opacity: loading ? 0.5 : 1, userSelect: 'none' }}>
                <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${visibility === v ? theme.accent : theme.line}`, background: visibility === v ? theme.accent : 'transparent', display: 'inline-block', flexShrink: 0, transition: 'all 100ms ease' }} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.bad, letterSpacing: 1, padding: '8px 12px', border: `1px solid ${theme.bad}`, background: `${theme.bad}18` }}>
            {error}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/net/ColyseusClient.ts src/screens/mp/CreateRoomModal.tsx
git commit -m "feat(client): CreateRoomModal adds game mode + unique guilds toggles; ColyseusClient passes them to server"
```

---

## Task 9: AppScreen + App.tsx routing for `battle_config`

**Files:**
- Modify: `src/state/useAppState.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `mp_battle_config` to `AppScreen` in `useAppState.ts`**

Find:
```ts
  | 'mp_load'
```
Replace with:
```ts
  | 'mp_load'
  | 'mp_battle_config'
```

- [ ] **Step 2: Update `PHASE_TO_SCREEN` and add `MpBattleConfig` import in `App.tsx`**

Add import (alongside the other `mp/` imports):
```ts
import { MpBattleConfig } from './screens/mp/MpBattleConfig';
```

Update `PHASE_TO_SCREEN`:
```ts
const PHASE_TO_SCREEN: Record<MatchPhase, AppScreen> = {
  lobby: 'mp_lobby',
  char_select: 'mp_cs',
  stage_select: 'mp_stage',
  loading: 'mp_load',
  in_game: 'mp_battle',
  results: 'mp_results',
  battle_config: 'mp_battle_config',
};
```

Add the screen render (after the `mp_lobby` block, before `mp_cs`):
```tsx
{state.screen === 'mp_battle_config' && state.mpRoom && (
  <MpBattleConfig
    room={state.mpRoom}
    onLeave={leaveMp}
    onPhaseChange={onPhaseChange}
  />
)}
```

Also add `'mp_battle_config'` to the `isMpScreen` check:
```ts
const isMpScreen =
  state.screen === 'mp_hub' ||
  state.screen === 'mp_lobby' ||
  state.screen === 'mp_cs' ||
  state.screen === 'mp_stage' ||
  state.screen === 'mp_load' ||
  state.screen === 'mp_battle' ||
  state.screen === 'mp_results' ||
  state.screen === 'mp_battle_config';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: will fail until `MpBattleConfig` is created in Task 10. That's fine — proceed.

- [ ] **Step 4: Commit schema changes only (no typecheck gate yet)**

```bash
git add src/state/useAppState.ts src/App.tsx
git commit -m "feat(client): add mp_battle_config AppScreen and route battle_config phase to MpBattleConfig"
```

---

## Task 10: `MpLobby` — Battle mode variant

**Files:**
- Modify: `src/screens/mp/MpLobby.tsx`

- [ ] **Step 1: Update `MpLobby.tsx`**

The component needs to handle Battle mode. Key changes:
1. Read `state.gameMode` from `MatchState`
2. In Battle mode: BATTLE chip, N/8 counter, 8-slot grid, NEXT button
3. `canLaunch` check becomes `atLeastTwo && allReady` (not exactly 2)

Find the `getMatchSlots` import and note that in Battle mode we don't use it the same way. Instead we read directly from `state.players`.

Replace the derived state block and the body. The full changed sections:

**Meta strip** — change the hardcoded chip:
```tsx
{/* Meta strip */}
<div style={{ padding: '10px 32px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
  <Chip tone="accent" mono>{state.gameMode === 'battle' ? 'BATTLE' : '1V1'}</Chip>
  <Chip mono>BO{state.rounds}</Chip>
  <Chip mono>{state.visibility.toUpperCase()}</Chip>
  {state.gameMode === 'battle' && state.uniqueGuilds && <Chip mono>UNIQUE GUILDS</Chip>}
</div>
```

**Header slot counter** — change `PRE-GAME · {filledCount}/2`:
```tsx
PRE-GAME · {filledCount}/{state.gameMode === 'battle' ? 8 : 2}
```

**Derived state** — replace the `bothPresent` / `canLaunch` block. Add after the `isHost` line:
```ts
const connectedSlots = state ? [...state.players.values()].filter(p => p.connected) : [];
const filledCount = connectedSlots.length;
const maxSlots = state?.gameMode === 'battle' ? 8 : 2;
const atLeastTwo = filledCount >= 2;
const allReady = filledCount > 0 && [...(state?.players.values() ?? [])].every(p => p.ready);
const canLaunch = isHost && atLeastTwo && allReady;
const notReadyCount = [...(state?.players.values() ?? [])].filter(p => !p.ready).length;
```
(Remove the old `bothPresent`, `localSlot`, `opponentSlot` usage from this block — keep them only where needed for the slot cards in Versus mode.)

**Slot grid** — replace the two hardcoded `SlotCard` calls with mode-aware rendering:

```tsx
{/* Left: slot cards + footer */}
<div style={{ padding: 24, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
  <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.accent, letterSpacing: 3 }}>▸ PLAYERS</div>
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    {state.gameMode === 'battle' ? (
      // Battle: show all connected players + empty slots up to 8
      Array.from({ length: maxSlots }, (_, i) => {
        const playerEntries = [...state.players.entries()];
        const [sid, slot] = playerEntries[i] ?? [null, null];
        const isYou = sid === room.sessionId;
        const showKick = isHost && !!slot && !isYou;
        return (
          <SlotCard
            key={i}
            slot={slot ? { name: slot.name, sessionId: slot.sessionId, ready: slot.ready, ping: slot.ping, connected: slot.connected } : null}
            isYou={isYou}
            showHost={!!slot && slot.sessionId === state.hostSessionId}
            showKick={showKick}
            onKick={() => slot && room.send('kick', { sessionId: slot.sessionId })}
            slotIndex={i}
          />
        );
      })
    ) : (
      // Versus: existing two-slot layout
      <>
        <SlotCard slot={localSlot ?? null} isYou showHost={isHost} showKick={false} slotIndex={0} />
        <SlotCard
          slot={opponentSlot ?? null}
          isYou={false}
          showHost={!isHost && !!opponentSlot && opponentSlot.sessionId === state.hostSessionId}
          showKick={isHost && !!opponentSlot}
          onKick={() => opponentSlot && room.send('kick', { sessionId: opponentSlot.sessionId })}
          slotIndex={1}
        />
      </>
    )}
  </div>
  {/* Footer actions */}
  <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
    <div style={{ flex: 1, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
      {allReady ? '▸ ALL PLAYERS READY' : `▸ WAITING FOR ${notReadyCount} PLAYER(S)`}
    </div>
    <Btn size="md" onClick={() => room.send('ready_toggle', { ready: !currentReady })}>
      {currentReady ? '■ READY' : '□ READY UP'}
    </Btn>
    {isHost && (
      <Btn size="md" primary disabled={!canLaunch} onClick={() => room.send('launch_battle', {})}>
        {state.gameMode === 'battle' ? 'NEXT →' : 'LAUNCH BATTLE →'}
      </Btn>
    )}
  </div>
</div>
```

Keep `localSlot` / `opponentSlot` from `getMatchSlots` for the Versus branch — they're still needed there.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: errors only from missing `MpBattleConfig` import in App.tsx (that's fine until Task 11).

- [ ] **Step 3: Commit**

```bash
git add src/screens/mp/MpLobby.tsx
git commit -m "feat(client): MpLobby Battle mode — 8-slot grid, BATTLE chip, NEXT button"
```

---

## Task 11: `MpBattleConfig` screen

**Files:**
- Create: `src/screens/mp/MpBattleConfig.tsx`

- [ ] **Step 1: Create `MpBattleConfig.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, Btn, GuildMonogram } from '../../ui';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { MpLoading } from './MpLoading';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const TEAM_COLORS: Record<string, string> = {
  A: '#5cf2c2',
  B: '#ff5d73',
  C: '#ffb347',
  D: '#928bff',
};

const GUILD_IDS = GUILDS.map(g => g.id);

export function MpBattleConfig({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  usePhaseBounce(state?.phase ?? 'battle_config', 'battle_config', onPhaseChange);

  // Track which slot index last showed "TAKEN" flash
  const [takenFlash, setTakenFlash] = useState<number | null>(null);

  const flashTaken = useCallback((index: number) => {
    setTakenFlash(index);
    setTimeout(() => setTakenFlash(null), 800);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onLeave]);

  if (!state) return <MpLoading />;

  const slots = [...state.battleSlots];
  const isHost = room.sessionId === state.hostSessionId;
  const mySlotIndex = slots.findIndex(s => s.ownerSessionId === room.sessionId);
  const activeCount = slots.filter(s => s.slotType !== 'off').length;
  const canLaunch = isHost && activeCount >= 2;

  // Map guildId → list of slot indices that claim it (for taken indicator)
  const claimsByGuild = new Map<string, number[]>();
  slots.forEach((s, i) => {
    if (s.slotType !== 'off' && s.guildId) {
      const existing = claimsByGuild.get(s.guildId) ?? [];
      existing.push(i);
      claimsByGuild.set(s.guildId, existing);
    }
  });

  const cycleGuildForSlot = (slotIndex: number, currentGuildId: string, direction = 1) => {
    const cur = GUILD_IDS.indexOf(currentGuildId as typeof GUILD_IDS[number]);
    const next = GUILD_IDS[(cur + direction + GUILD_IDS.length) % GUILD_IDS.length];
    if (state.uniqueGuilds && claimsByGuild.has(next)) {
      flashTaken(slotIndex);
      return;
    }
    return next;
  };

  const handleHostSlotCycle = (index: number) => {
    if (!isHost) return;
    const slot = slots[index];
    if (slot.slotType === 'human') return; // can't cycle human slots away
    const next = cycleGuildForSlot(index, slot.guildId);
    if (!next) return;
    room.send('set_battle_slot', { index, slotType: slot.slotType, guildId: next, team: slot.team });
  };

  const handleMyGuildCycle = () => {
    if (mySlotIndex === -1) return;
    const slot = slots[mySlotIndex];
    const next = cycleGuildForSlot(mySlotIndex, slot.guildId);
    if (!next) return;
    room.send('set_my_guild', { guildId: next });
  };

  const handleCycleType = (index: number) => {
    if (!isHost) return;
    const slot = slots[index];
    if (slot.slotType === 'human') return;
    const next = slot.slotType === 'cpu' ? 'off' : 'cpu';
    room.send('set_battle_slot', { index, slotType: next, guildId: slot.guildId, team: slot.team });
  };

  const handleSetTeam = (index: number, team: string) => {
    if (!isHost) return;
    const slot = slots[index];
    room.send('set_battle_slot', { index, slotType: slot.slotType, guildId: slot.guildId, team });
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>BATTLE MODE · CONFIGURE SLOTS</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Set the field</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onLeave}>← LEAVE</Btn>
          {isHost && (
            <Btn primary disabled={!canLaunch} onClick={() => room.send('launch_from_config', {})}>
              STAGE →
            </Btn>
          )}
        </div>
      </div>

      {/* 4-column slot grid */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, overflow: 'auto' }}>
        {slots.map((slot, i) => {
          const isOff = slot.slotType === 'off';
          const isHuman = slot.slotType === 'human';
          const isMySlot = i === mySlotIndex;
          const teamColor = slot.team ? TEAM_COLORS[slot.team] ?? theme.lineSoft : theme.lineSoft;
          const borderColor = isMySlot ? theme.accent : isOff ? theme.lineSoft : isHuman ? theme.warn : teamColor;
          const claimsOfThisSlotGuild = claimsByGuild.get(slot.guildId) ?? [];

          return (
            <div
              key={i}
              style={{ border: `1px solid ${borderColor}`, background: isOff ? 'transparent' : theme.panel, padding: '14px 12px 16px', display: 'flex', flexDirection: 'column', gap: 12, opacity: isOff ? 0.4 : 1, position: 'relative' }}
            >
              {/* Slot header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>SLOT {String(i + 1).padStart(2, '0')}</span>
                {isHost && !isHuman && (
                  <span
                    onClick={() => handleCycleType(i)}
                    style={{ cursor: 'pointer', fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: isOff ? theme.inkMuted : theme.good, border: `1px solid ${isOff ? theme.lineSoft : theme.good}`, padding: '3px 8px' }}
                  >
                    {slot.slotType.toUpperCase()}
                  </span>
                )}
                {isHuman && (
                  <span style={{ fontFamily: theme.fontMono, fontSize: 9, letterSpacing: 2, color: theme.warn, border: `1px solid ${theme.warn}55`, padding: '3px 8px' }}>
                    HUMAN
                  </span>
                )}
              </div>

              {/* Guild portrait */}
              {isOff ? (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 110, height: 110, border: `1px dashed ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>EMPTY</div>
                </div>
              ) : (
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <div
                    onClick={() => {
                      if (isMySlot) handleMyGuildCycle();
                      else if (isHost && !isHuman) handleHostSlotCycle(i);
                    }}
                    style={{ cursor: (isMySlot || (isHost && !isHuman)) ? 'pointer' : 'default', position: 'relative' }}
                  >
                    <GuildMonogram guildId={(slot.guildId || 'adventurer') as Parameters<typeof GuildMonogram>[0]['guildId']} size={110} selected={isMySlot} />

                    {/* Guild claimed-by tags (always shown) */}
                    {claimsOfThisSlotGuild.map((claimerIdx, tagI) => {
                      if (claimerIdx === i) return null; // don't tag own slot
                      const claimerSlot = slots[claimerIdx];
                      const tagColor = claimerSlot.team ? TEAM_COLORS[claimerSlot.team] ?? theme.inkMuted : theme.inkMuted;
                      const label = claimerSlot.slotType === 'human'
                        ? claimerSlot.ownerSessionId === room.sessionId ? 'YOU' : claimerSlot.ownerSessionId.slice(0, 3).toUpperCase()
                        : `CPU${claimerIdx + 1}`;
                      return (
                        <div key={tagI} style={{ position: 'absolute', top: 4 + tagI * 20, right: 4, fontFamily: theme.fontMono, fontSize: 9, color: tagColor, letterSpacing: 1, background: theme.bgDeep, padding: '1px 4px', border: `1px solid ${tagColor}66` }}>
                          ◆ {label}
                        </div>
                      );
                    })}

                    {/* TAKEN flash */}
                    {takenFlash === i && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${theme.bad}cc`, fontFamily: theme.fontMono, fontSize: 13, color: theme.bg, letterSpacing: 2 }}>TAKEN</div>
                    )}
                  </div>
                </div>
              )}

              {/* Guild name + owner */}
              {!isOff && (
                <>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: isMySlot ? theme.accent : theme.ink, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {GUILDS.find(g => g.id === slot.guildId)?.name ?? '—'}
                  </div>
                  {isHuman && slot.ownerSessionId && (
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 1, textAlign: 'center' }}>
                      {slot.ownerSessionId === room.sessionId ? 'YOU' : ''}
                    </div>
                  )}

                  {/* Team selector (host only) */}
                  {isHost && (
                    <div>
                      <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>TEAM</div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {(['', 'A', 'B', 'C', 'D'] as const).map(t => {
                          const active = slot.team === t;
                          const c = t ? TEAM_COLORS[t] : theme.inkMuted;
                          return (
                            <span key={t} onClick={() => handleSetTeam(i, t)} style={{ flex: 1, textAlign: 'center', padding: '5px 0', fontFamily: theme.fontMono, fontSize: 10, cursor: 'pointer', border: `1px solid ${active ? c : theme.lineSoft}`, color: active ? c : theme.inkDim, background: active ? `${c}22` : 'transparent' }}>
                              {t || '—'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>CLICK PORTRAIT TO CYCLE GUILD</span>
        {isHost && <span>CLICK TYPE TO TOGGLE CPU/OFF</span>}
        <span>{activeCount} ACTIVE SLOTS</span>
        <span>ESC LEAVE</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/mp/MpBattleConfig.tsx
git commit -m "feat(client): MpBattleConfig screen — 8-slot grid, guild taken indicators, host config, player guild cycle"
```

---

## Self-Review Checklist

After completing all tasks, verify:

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (all tests including golden sim test)
- [ ] `npm run lint` passes
- [ ] Manual smoke test: host creates a Battle room → second browser joins → both ready → NEXT → both see `MpBattleConfig` → host cycles CPU slots/teams → player cycles own guild → STAGE → stage select → game launches
- [ ] Versus mode end-to-end unaffected: create Versus room, 1v1 flow unchanged
