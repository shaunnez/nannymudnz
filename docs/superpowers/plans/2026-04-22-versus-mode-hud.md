# Versus Mode + Battle HUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `mode: 'vs'` into a real BO3 1v1 match with a React/DOM battle HUD overlaid on the Phaser canvas (class badges, HP/MP bars, stage + round timer, per-player ability strip, deterministic in-sim combat log). Story modes untouched.

**Architecture:** Simulation gains a `mode` flag, an `opponent` actor, a `round` state machine, and a deterministic `combatLog` — all pure TS. Phaser's `GameplayScene` branches on mode: story keeps launching `HudScene`; VS skips it, pushes `sim-tick` events, and reserves top/bottom bands of the viewport for the HUD. A new React overlay in `src/screens/hud/` subscribes to `sim-tick`, reads the snapshot, and renders `HudTopBar` + `HudFooter` (combat log + two ability strips) over the Phaser canvas. Input is already wired (`InputState.testAbilitySlot`) — no keybinding work.

**Tech Stack:** Vite + React 18 + TypeScript, Phaser 3 (scenes), Vitest (simulation tests). Existing `ui/` primitives (`MeterBar`, `Chip`, `SectionLabel`, `GuildMonogram`) and `theme` tokens reused.

**Conventions honored:**
- Strict layer separation: `simulation/` stays pure (no DOM, no `Date.now`, no `Math.random`). Use `state.rng()` and tick-based countdowns.
- `npm run test` is Vitest; golden test (`src/simulation/__tests__/golden.test.ts`) must stay green.
- `npm run lint` + `npm run typecheck` must both pass after each task.
- Commit at the end of every task.

---

## File Structure

**Create:**
- `src/simulation/combatLog.ts` — `appendLog`, log cap
- `src/simulation/vsSimulation.ts` — `createVsState`, `tickRound`, `resetActorsForRound`
- `src/simulation/__tests__/combatLog.test.ts`
- `src/simulation/__tests__/vs.test.ts`
- `src/screens/hud/HudOverlay.tsx`
- `src/screens/hud/HudTopBar.tsx`
- `src/screens/hud/RoundTimer.tsx`
- `src/screens/hud/AbilityStrip.tsx`
- `src/screens/hud/CombatLog.tsx`
- `src/screens/hud/HudFooter.tsx`

**Modify:**
- `src/simulation/types.ts` — extend `SimState` + new `LogEntry`, `RoundState`
- `src/simulation/simulation.ts` — `createInitialState` seeds new fields; tick branches on `mode`; `fireAbility` appends log entries
- `src/simulation/combat.ts` — append `[P?] … is KO'd.` on death
- `src/game/PhaserGame.ts` — extend `GameBootConfig` with `mode`, `p2`, `stageId`, `seed`
- `src/game/constants.ts` — add `HUD_TOP_PX`, `HUD_BOTTOM_PX`
- `src/game/scenes/GameplayScene.ts` — VS branch in `create`, emit `sim-tick`, skip `scene.launch('Hud')` in VS
- `src/screens/GameScreen.tsx` — accept `mode/p2/stageId`, mount `HudOverlay` in VS
- `src/App.tsx` — pass `mode/p2/stageId`, handle draw as P2

**Do not touch:**
- `src/game/scenes/HudScene.ts` — still used by story mode
- `src/input/keyBindings.ts` and `src/game/input/PhaserInputAdapter.ts` — keys `1–6` already wired via `InputState.testAbilitySlot`
- Golden determinism test

---

### Task 1: Extend simulation types for VS

**Files:**
- Modify: `src/simulation/types.ts`

- [ ] **Step 1: Add `LogEntry` and `RoundState` types and extend `SimState`**

Open `src/simulation/types.ts`. Add near the bottom of the file (after the existing `VFXEvent` interface, before `Wave`):

```ts
export type LogTag = 'P1' | 'P2' | 'SYS';
export type LogTone = 'info' | 'damage' | 'ko' | 'round';

export interface LogEntry {
  id: number;
  tickId: number;
  tag: LogTag;
  tone: LogTone;
  text: string;
}

export interface RoundState {
  index: 0 | 1 | 2;
  wins: { p1: number; p2: number };
  timeRemainingMs: number;
  phase: 'intro' | 'fighting' | 'resolved' | 'matchOver';
  phaseStartedAtMs: number;
  winnerOfRound: 'p1' | 'p2' | 'draw' | null;
  matchWinner: 'p1' | 'p2' | 'draw' | null;
}

export type SimMode = 'story' | 'vs';
```

Then in the existing `SimState` interface, add these fields (keep them right before the existing `controllers` line so related fields stay grouped):

```ts
  mode: SimMode;
  opponent: Actor | null;
  round: RoundState | null;
  combatLog: LogEntry[];
  nextLogId: number;
```

- [ ] **Step 2: Run typecheck — it should fail on `createInitialState` because it doesn't return these new fields yet**

Run: `npm run typecheck`
Expected: errors on `simulation.ts` `createInitialState` return type ("missing properties: mode, opponent, round, combatLog, nextLogId").

- [ ] **Step 3: Seed the new fields in `createInitialState`**

Open `src/simulation/simulation.ts`. Inside `createInitialState` (around line 156), add these to the returned object just before `controllers: {},`:

```ts
    mode: 'story',
    opponent: null,
    round: null,
    combatLog: [],
    nextLogId: 1,
```

- [ ] **Step 4: Run typecheck and full test suite**

Run: `npm run typecheck && npm test`
Expected: typecheck clean; all tests (including golden) pass.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/types.ts src/simulation/simulation.ts
git commit -m "feat(sim): add VS fields (mode, opponent, round, combatLog) to SimState"
```

---

### Task 2: `combatLog.ts` helpers + tests

**Files:**
- Create: `src/simulation/combatLog.ts`
- Create: `src/simulation/__tests__/combatLog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/simulation/__tests__/combatLog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../simulation';
import { appendLog } from '../combatLog';

describe('combatLog', () => {
  it('appends entries with incrementing ids and current tick', () => {
    const s = createInitialState('knight', 1);
    s.tick = 7;
    appendLog(s, { tag: 'P1', tone: 'info', text: 'hello' });
    expect(s.combatLog).toHaveLength(1);
    expect(s.combatLog[0]).toMatchObject({
      id: 1,
      tickId: 7,
      tag: 'P1',
      tone: 'info',
      text: 'hello',
    });
    expect(s.nextLogId).toBe(2);
  });

  it('caps the log at 64 entries, dropping oldest', () => {
    const s = createInitialState('knight', 1);
    for (let i = 0; i < 100; i++) {
      appendLog(s, { tag: 'SYS', tone: 'info', text: `entry ${i}` });
    }
    expect(s.combatLog).toHaveLength(64);
    expect(s.combatLog[0].text).toBe('entry 36');
    expect(s.combatLog[63].text).toBe('entry 99');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- combatLog`
Expected: FAIL — cannot find module `../combatLog`.

- [ ] **Step 3: Create the module**

Create `src/simulation/combatLog.ts`:

```ts
import type { SimState, LogEntry, LogTag, LogTone } from './types';

const LOG_CAP = 64;

export interface LogEntryInput {
  tag: LogTag;
  tone: LogTone;
  text: string;
}

export function appendLog(state: SimState, input: LogEntryInput): void {
  const entry: LogEntry = {
    id: state.nextLogId++,
    tickId: state.tick,
    tag: input.tag,
    tone: input.tone,
    text: input.text,
  };
  state.combatLog.push(entry);
  if (state.combatLog.length > LOG_CAP) {
    state.combatLog.splice(0, state.combatLog.length - LOG_CAP);
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- combatLog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/combatLog.ts src/simulation/__tests__/combatLog.test.ts
git commit -m "feat(sim): combat log append helper with 64-entry cap"
```

---

### Task 3: `vsSimulation.ts` — createVsState + round reset

**Files:**
- Create: `src/simulation/vsSimulation.ts`
- Create: `src/simulation/__tests__/vs.test.ts`

- [ ] **Step 1: Write the failing test (state construction)**

Create `src/simulation/__tests__/vs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createVsState, resetActorsForRound } from '../vsSimulation';

describe('vsSimulation: createVsState', () => {
  it('creates a VS state with player, opponent, and round intro phase', () => {
    const s = createVsState('knight', 'mage', 'assembly', 42);
    expect(s.mode).toBe('vs');
    expect(s.player.id).toBe('player');
    expect(s.player.guildId).toBe('knight');
    expect(s.player.team).toBe('player');
    expect(s.opponent).not.toBeNull();
    expect(s.opponent!.id).toBe('opponent');
    expect(s.opponent!.guildId).toBe('mage');
    expect(s.opponent!.team).toBe('enemy');
    expect(s.opponent!.facing).toBe(-1);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]).toBe(s.opponent);
    expect(s.waves).toEqual([]);
    expect(s.round).not.toBeNull();
    expect(s.round!.index).toBe(0);
    expect(s.round!.phase).toBe('intro');
    expect(s.round!.timeRemainingMs).toBe(60_000);
    expect(s.round!.wins).toEqual({ p1: 0, p2: 0 });
    expect(s.combatLog.length).toBeGreaterThan(0);
    expect(s.combatLog.some(e => e.text.includes('arena'))).toBe(true);
  });

  it('places opponent to the right of the player', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    expect(s.opponent!.x).toBeGreaterThan(s.player.x);
  });

  it('throws if p2 is the same as p1? NO — mirror match is allowed', () => {
    const s = createVsState('knight', 'knight', 'assembly', 1);
    expect(s.opponent!.id).toBe('opponent');
    expect(s.opponent!.guildId).toBe('knight');
  });
});

describe('vsSimulation: resetActorsForRound', () => {
  it('restores HP/MP and clears status effects on both actors', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    s.player.hp = 10;
    s.player.mp = 0;
    s.player.statusEffects = [
      { id: 1, type: 'burn', magnitude: 1, durationMs: 500, sourceId: 'opponent', tickAccumMs: 0 },
    ];
    s.opponent!.hp = 5;
    s.opponent!.abilityCooldowns['fireball'] = 9_999_999;

    resetActorsForRound(s);

    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.player.statusEffects).toEqual([]);
    expect(s.opponent!.hp).toBe(s.opponent!.hpMax);
    expect(s.opponent!.abilityCooldowns).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- vs`
Expected: FAIL — cannot find module `../vsSimulation`.

- [ ] **Step 3: Implement the module (construction + reset only for now)**

Create `src/simulation/vsSimulation.ts`:

```ts
import type { SimState, GuildId, Actor, RoundState } from './types';
import { createInitialState, createPlayerActor } from './simulation';
import { appendLog } from './combatLog';
import { getGuild } from './guildData';

const OPPONENT_SPAWN_X_OFFSET = 160;
const ROUND_TIME_MS = 60_000;

export function createVsState(
  p1: GuildId,
  p2: GuildId,
  _stageId: string,
  seed: number,
): SimState {
  const state = createInitialState(p1, seed);
  state.mode = 'vs';
  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;

  const opponent = buildOpponent(p2, state.player.x + OPPONENT_SPAWN_X_OFFSET);
  state.opponent = opponent;
  state.enemies = [opponent];

  const round: RoundState = {
    index: 0,
    wins: { p1: 0, p2: 0 },
    timeRemainingMs: ROUND_TIME_MS,
    phase: 'intro',
    phaseStartedAtMs: 0,
    winnerOfRound: null,
    matchWinner: null,
  };
  state.round = round;

  const g1 = getGuild(p1);
  const g2 = getGuild(p2);
  appendLog(state, { tag: 'SYS', tone: 'round', text: `${g1.name} has entered the arena.` });
  appendLog(state, { tag: 'SYS', tone: 'round', text: `${g2.name} has entered the arena.` });

  return state;
}

function buildOpponent(guildId: GuildId, x: number): Actor {
  const a = createPlayerActor(guildId);
  a.id = 'opponent';
  a.team = 'enemy';
  a.isPlayer = false;
  a.x = x;
  a.facing = -1;
  a.aiState = {
    ...a.aiState,
    behavior: 'chaser',
    targetId: 'player',
  };
  return a;
}

export function resetActorsForRound(state: SimState): void {
  if (!state.opponent) return;
  resetActorState(state.player);
  resetActorState(state.opponent);
}

function resetActorState(a: Actor): void {
  a.hp = a.hpMax;
  a.hpDark = a.hpMax;
  a.mp = getGuild(a.guildId!).resource.startValue;
  a.mpMax = getGuild(a.guildId!).resource.max;
  a.statusEffects = [];
  a.abilityCooldowns = {};
  a.rmbCooldown = 0;
  a.comboHits = 0;
  a.knockdownTimeMs = 0;
  a.getupTimeMs = 0;
  a.invulnerableMs = 0;
  a.heldPickup = null;
  a.vx = 0;
  a.vy = 0;
  a.vz = 0;
  a.z = 0;
  a.state = 'idle';
  a.stateTimeMs = 0;
  a.animationId = 'idle';
  a.animationFrame = 0;
  a.animationTimeMs = 0;
  a.isAlive = true;
  a.deathTimeMs = 0;
  a.chiOrbs = 0;
  a.sanity = 0;
  a.bloodtally = 0;
  a.shapeshiftForm = 'none';
  a.miasmaActive = false;
  a.nocturneActive = false;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- vs combatLog`
Expected: PASS for both suites. Golden test still green: `npm test -- golden`.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/vsSimulation.ts src/simulation/__tests__/vs.test.ts
git commit -m "feat(sim): createVsState + resetActorsForRound"
```

---

### Task 4: Round state machine in `vsSimulation.ts`

**Files:**
- Modify: `src/simulation/vsSimulation.ts`
- Modify: `src/simulation/__tests__/vs.test.ts`

- [ ] **Step 1: Append failing tests for the state machine**

Add to the bottom of `src/simulation/__tests__/vs.test.ts`:

```ts
import { tickRound } from '../vsSimulation';

describe('vsSimulation: tickRound', () => {
  it('transitions intro -> fighting after 1500ms', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    expect(s.round!.phase).toBe('intro');
    tickRound(s, 800);
    expect(s.round!.phase).toBe('intro');
    tickRound(s, 800);
    expect(s.round!.phase).toBe('fighting');
    expect(s.round!.timeRemainingMs).toBe(60_000);
  });

  it('decrements timer while fighting', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000); // intro -> fighting
    tickRound(s, 1000);
    expect(s.round!.timeRemainingMs).toBe(59_000);
  });

  it('resolves round when opponent hp hits 0 — p1 wins', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000); // fighting
    s.opponent!.hp = 0;
    s.opponent!.isAlive = false;
    tickRound(s, 16);
    expect(s.round!.phase).toBe('resolved');
    expect(s.round!.winnerOfRound).toBe('p1');
    expect(s.round!.wins.p1).toBe(1);
  });

  it('times out as draw on equal hp, p2-leaning otherwise', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000);
    s.round!.timeRemainingMs = 0;
    s.player.hp = 100;
    s.opponent!.hp = 100;
    tickRound(s, 16);
    expect(s.round!.phase).toBe('resolved');
    expect(s.round!.winnerOfRound).toBe('draw');
  });

  it('resolved -> intro of next round after 2000ms, with reset', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16); // resolved
    s.player.hp = 1;
    tickRound(s, 2100); // should flip to intro & reset
    expect(s.round!.phase).toBe('intro');
    expect(s.round!.index).toBe(1);
    expect(s.player.hp).toBe(s.player.hpMax);
    expect(s.opponent!.hp).toBe(s.opponent!.hpMax);
  });

  it('declares matchWinner after 2 round wins and sets simPhase to victory for p1', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    // Round 1: p1 wins
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16);
    tickRound(s, 2100); // next round intro
    // Round 2: p1 wins again
    tickRound(s, 2000);
    s.opponent!.hp = 0; s.opponent!.isAlive = false;
    tickRound(s, 16);
    tickRound(s, 2100);
    expect(s.round!.phase).toBe('matchOver');
    expect(s.round!.matchWinner).toBe('p1');
    expect(s.phase).toBe('victory');
  });

  it('sets simPhase to defeat when p2 wins the match', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    for (let r = 0; r < 2; r++) {
      tickRound(s, 2000);
      s.player.hp = 0; s.player.isAlive = false;
      tickRound(s, 16);
      tickRound(s, 2100);
    }
    expect(s.round!.matchWinner).toBe('p2');
    expect(s.phase).toBe('defeat');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- vs`
Expected: FAIL — `tickRound` is not exported.

- [ ] **Step 3: Implement `tickRound`**

Append to `src/simulation/vsSimulation.ts`:

```ts
const INTRO_MS = 1500;
const RESOLVED_MS = 2000;

export function tickRound(state: SimState, dtMs: number): void {
  const r = state.round;
  if (!r || r.phase === 'matchOver') return;

  r.phaseStartedAtMs += dtMs;

  if (r.phase === 'intro') {
    if (r.phaseStartedAtMs >= INTRO_MS) {
      r.phase = 'fighting';
      r.phaseStartedAtMs = 0;
      r.timeRemainingMs = ROUND_TIME_MS;
      appendLog(state, { tag: 'SYS', tone: 'round', text: `Round ${r.index + 1} — FIGHT!` });
    }
    return;
  }

  if (r.phase === 'fighting') {
    r.timeRemainingMs = Math.max(0, r.timeRemainingMs - dtMs);
    const playerDown = !state.player.isAlive || state.player.hp <= 0;
    const oppDown = !state.opponent?.isAlive || (state.opponent?.hp ?? 0) <= 0;

    if (playerDown || oppDown || r.timeRemainingMs === 0) {
      let winner: 'p1' | 'p2' | 'draw';
      if (playerDown && oppDown) winner = 'draw';
      else if (playerDown) winner = 'p2';
      else if (oppDown) winner = 'p1';
      else {
        // timer out
        const pHp = state.player.hp;
        const oHp = state.opponent?.hp ?? 0;
        if (pHp > oHp) winner = 'p1';
        else if (oHp > pHp) winner = 'p2';
        else winner = 'draw';
      }
      r.winnerOfRound = winner;
      if (winner === 'p1') r.wins.p1++;
      if (winner === 'p2') r.wins.p2++;
      const label = winner === 'draw' ? 'DRAW' : (winner === 'p1' ? 'P1 WINS' : 'P2 WINS');
      appendLog(state, { tag: 'SYS', tone: 'round', text: `Round ${r.index + 1} — ${label}` });
      r.phase = 'resolved';
      r.phaseStartedAtMs = 0;
    }
    return;
  }

  if (r.phase === 'resolved') {
    if (r.phaseStartedAtMs < RESOLVED_MS) return;

    const matchOver =
      r.wins.p1 >= 2 ||
      r.wins.p2 >= 2 ||
      r.index >= 2;

    if (matchOver) {
      let winner: 'p1' | 'p2' | 'draw';
      if (r.wins.p1 > r.wins.p2) winner = 'p1';
      else if (r.wins.p2 > r.wins.p1) winner = 'p2';
      else winner = 'draw';
      r.matchWinner = winner;
      r.phase = 'matchOver';
      state.phase = winner === 'p1' ? 'victory' : 'defeat';
      return;
    }

    r.index = (r.index + 1) as 0 | 1 | 2;
    r.phase = 'intro';
    r.phaseStartedAtMs = 0;
    r.timeRemainingMs = ROUND_TIME_MS;
    r.winnerOfRound = null;
    resetActorsForRound(state);
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- vs`
Expected: all 8 `vsSimulation` tests pass. Run `npm test` to confirm no regressions (golden still green).

- [ ] **Step 5: Commit**

```bash
git add src/simulation/vsSimulation.ts src/simulation/__tests__/vs.test.ts
git commit -m "feat(sim): BO3 round state machine with intro/fighting/resolved/matchOver"
```

---

### Task 5: Branch `tickSimulation` on mode + wire VS tick path

**Files:**
- Modify: `src/simulation/simulation.ts`
- Modify: `src/simulation/__tests__/vs.test.ts`

- [ ] **Step 1: Write the failing test for end-to-end VS ticking**

Append to `src/simulation/__tests__/vs.test.ts`:

```ts
import { tickSimulation } from '../simulation';
import type { InputState } from '../types';

function idleInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false,
    jumpJustPressed: false, attackJustPressed: false, blockJustPressed: false,
    grabJustPressed: false, pauseJustPressed: false,
    fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

describe('vsSimulation: integrated tick', () => {
  it('ticks opponent AI and does not treat VS as story', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    // advance past intro
    let st = s;
    for (let i = 0; i < 150; i++) {
      st = tickSimulation(st, idleInput(), 16);
    }
    expect(st.round!.phase === 'fighting' || st.round!.phase === 'resolved' || st.round!.phase === 'matchOver').toBe(true);
    // sanity: VS never triggers story wave spawns
    expect(st.waves).toEqual([]);
  });

  it('caps combat log at 64 entries across a full match', () => {
    let st = createVsState('knight', 'mage', 'assembly', 1);
    for (let i = 0; i < 4000; i++) {
      st = tickSimulation(st, idleInput(), 16);
      if (st.phase === 'victory' || st.phase === 'defeat') break;
    }
    expect(st.combatLog.length).toBeLessThanOrEqual(64);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- vs`
Expected: first new test likely fails (round never advances because `tickSimulation` doesn't call `tickRound`); second may or may not but the integration must be wired.

- [ ] **Step 3: Branch `tickSimulation` on `state.mode`**

In `src/simulation/simulation.ts`, locate `tickSimulation` (line ~1133). Add this near the top of the function, just after the pause-handling block and before `state.bloodtallyDecayMs += dtMs;`:

```ts
  if (state.mode === 'vs') {
    return tickVsSimulation(state, input, dtMs);
  }
```

Then add at the very bottom of `src/simulation/simulation.ts` (after `forceResume`):

```ts
import { tickRound } from './vsSimulation';

function tickVsSimulation(state: SimState, input: InputState, dtMs: number): SimState {
  const dtSec = dtMs / 1000;
  state.timeMs += dtMs;
  state.tick++;
  state.vfxEvents = [];

  const ctrl = getOrCreateController(state, 'player', input);

  const fighting = state.round?.phase === 'fighting';

  if (state.player.isAlive) {
    if (fighting) handlePlayerInput(state, input, ctrl, dtMs);
    tickPhysics(state.player, dtSec);
    tickKnockdown(state.player, dtSec);
    tickGetup(state.player, dtSec);
    tickStatusEffects(state.player, dtMs, state.vfxEvents);
    tickHPRegen(state.player, dtMs, true);
    tickPlayerResourceRegen(state.player, dtMs, true, state);
  }

  const opp = state.opponent;
  if (opp && opp.isAlive) {
    if (fighting) tickAI(opp, state, dtSec, state.vfxEvents);
    tickPhysics(opp, dtSec);
    tickKnockdown(opp, dtSec);
    tickGetup(opp, dtSec);
    tickStatusEffects(opp, dtMs, state.vfxEvents);
    tickHPRegen(opp, dtMs, true);
  }

  tickProjectiles(state, dtSec);
  updateCamera(state);
  tickRound(state, dtMs);

  return state;
}
```

**Note:** `tickProjectiles`, `tickPlayerResourceRegen`, `tickHPRegen` are private to `simulation.ts` — you're inside the same module, so no import changes are needed. `handlePlayerInput` and `tickAI` are already imported. If any of them are not defined in the file (check Read output), declare the import.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all simulation tests (including new vs.test.ts integrated tests and golden) pass. `npm run typecheck` clean.

- [ ] **Step 5: Commit**

```bash
git add src/simulation/simulation.ts src/simulation/__tests__/vs.test.ts
git commit -m "feat(sim): branch tickSimulation on mode; VS tick path with opponent AI"
```

---

### Task 6: Combat log entries on ability fire + KO

**Files:**
- Modify: `src/simulation/simulation.ts`
- Modify: `src/simulation/combat.ts`
- Modify: `src/simulation/__tests__/vs.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/simulation/__tests__/vs.test.ts`:

```ts
describe('vsSimulation: combat log sources', () => {
  it('appends [P1] ... uses <ability> on player ability fire', () => {
    const s = createVsState('knight', 'mage', 'assembly', 1);
    // force to fighting phase
    let st = s;
    for (let i = 0; i < 120; i++) st = tickSimulation(st, idleInput(), 16);
    const input = idleInput();
    input.testAbilitySlot = 1;
    st = tickSimulation(st, input, 16);
    const entry = st.combatLog.find(e => e.tag === 'P1' && e.text.toLowerCase().includes('uses'));
    expect(entry).toBeDefined();
  });

  it('appends [SYS] <name> is KO\'d when an actor dies in VS', () => {
    let st = createVsState('knight', 'mage', 'assembly', 1);
    for (let i = 0; i < 120; i++) st = tickSimulation(st, idleInput(), 16);
    st.opponent!.hp = 0.1;
    // any damage event — cheap way: directly set to 0 and tick once so KO append runs
    st.opponent!.hp = 0;
    st.opponent!.isAlive = false;
    st = tickSimulation(st, idleInput(), 16);
    expect(st.combatLog.some(e => /KO/i.test(e.text))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- vs`
Expected: both new tests fail (no log append in `fireAbility`, no KO append).

- [ ] **Step 3: Append log in `fireAbility`**

In `src/simulation/simulation.ts`, locate `fireAbility` (~line 292). Right after the `state.vfxEvents.push({ type: 'ability_name', ... });` block (line 313–320), add:

```ts
  if (state.mode === 'vs') {
    const tag = player.id === 'player' ? 'P1' : player.id === 'opponent' ? 'P2' : 'SYS';
    const guild = getGuild(player.guildId!);
    appendCombatLog(state, {
      tag,
      tone: 'info',
      text: `${guild.name} uses ${ability.name}`,
    });
  }
```

At the top of `src/simulation/simulation.ts`, add import:

```ts
import { appendLog as appendCombatLog } from './combatLog';
```

- [ ] **Step 4: Append log on KO in VS**

In the VS tick function `tickVsSimulation` (added in Task 5), right before the final `return state;` add:

```ts
  // KO detection (VS-only)
  if (state.player.isAlive && state.player.hp <= 0) {
    state.player.isAlive = false;
    state.player.deathTimeMs = state.timeMs;
    appendCombatLog(state, {
      tag: 'SYS', tone: 'ko',
      text: `${getGuild(state.player.guildId!).name} is KO'd.`,
    });
  }
  if (opp && opp.isAlive && opp.hp <= 0) {
    opp.isAlive = false;
    opp.deathTimeMs = state.timeMs;
    appendCombatLog(state, {
      tag: 'SYS', tone: 'ko',
      text: `${getGuild(opp.guildId!).name} is KO'd.`,
    });
  }
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all tests pass including the two new log-source tests. Golden test still green (story mode untouched; `state.mode === 'vs'` gate ensures no log noise in story).

- [ ] **Step 6: Commit**

```bash
git add src/simulation/simulation.ts src/simulation/__tests__/vs.test.ts
git commit -m "feat(sim): append combat log on VS ability fire and KO"
```

---

### Task 7: Extend `GameBootConfig` with mode/p2/stageId

**Files:**
- Modify: `src/game/PhaserGame.ts`

- [ ] **Step 1: Update the config type and wire into registry**

Replace the contents of `src/game/PhaserGame.ts` with:

```ts
import Phaser from 'phaser';
import type { GuildId, SimMode } from '../simulation/types';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameplayScene } from './scenes/GameplayScene';
import { HudScene } from './scenes/HudScene';

export interface GameCallbacks {
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
  toggleFullscreen: () => void;
  getIsFullscreen: () => boolean;
}

export interface GameBootConfig {
  guildId: GuildId;
  mode: SimMode;
  p2?: GuildId;
  stageId: string;
  seed?: number;
  callbacks: GameCallbacks;
}

export function makePhaserGame(parent: HTMLElement, boot: GameBootConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    backgroundColor: '#000000',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameplayScene, HudScene],
    disableContextMenu: true,
    input: { keyboard: true },
    render: { antialias: false },
  });

  game.registry.set('guildId', boot.guildId);
  game.registry.set('mode', boot.mode);
  game.registry.set('p2', boot.p2 ?? null);
  game.registry.set('stageId', boot.stageId);
  game.registry.set('seed', boot.seed ?? null);
  game.registry.set('callbacks', boot.callbacks);

  return game;
}
```

- [ ] **Step 2: Typecheck will fail in GameScreen.tsx — that's fine, fixed in Task 9. Run lint to confirm no other breakage here:**

Run: `npm run lint -- src/game`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/game/PhaserGame.ts
git commit -m "feat(phaser): boot config accepts mode, p2, stageId, seed"
```

---

### Task 8: HUD reserve bands in game constants + GameplayScene VS branch

**Files:**
- Modify: `src/game/constants.ts`
- Modify: `src/game/scenes/GameplayScene.ts`

- [ ] **Step 1: Add HUD band constants**

Append to `src/game/constants.ts`:

```ts
// VS HUD band reservations — the React HUD overlay covers these strips,
// so the camera viewport shrinks to the middle to keep action centered.
export const HUD_TOP_PX = 72;
export const HUD_BOTTOM_PX = 160;
```

- [ ] **Step 2: Branch `GameplayScene.create` on mode**

In `src/game/scenes/GameplayScene.ts`:

At the top, replace the existing `createInitialState` import block with:

```ts
import {
  createInitialState,
  tickSimulation,
  resetController,
  forcePause,
  forceResume,
} from '../../simulation/simulation';
import { createVsState } from '../../simulation/vsSimulation';
```

And add to the constants import line:

```ts
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, HUD_TOP_PX, HUD_BOTTOM_PX } from '../constants';
```

Replace the `create()` body's state-construction + scene.launch block. Find these lines (~line 47–65):

```ts
    const guildId = this.game.registry.get('guildId') as GuildId;
    this.callbacks = this.game.registry.get('callbacks') as GameCallbacks;

    const seed = Date.now();
    this.simState = createInitialState(guildId, seed);
    this.inputAdapter = new PhaserInputAdapter(this);
    this.phaseHandoffFired = false;

    resetController(this.simState, 'player');

    this.audio = new AudioManager();
    this.bossMusicStarted = false;
    this.audio.startStageMusic();

    this.background = new BackgroundView(this);

    this.scene.launch('Hud');
```

Replace with:

```ts
    const guildId = this.game.registry.get('guildId') as GuildId;
    const mode = (this.game.registry.get('mode') as 'story' | 'vs' | null) ?? 'story';
    const p2 = this.game.registry.get('p2') as GuildId | null;
    const stageId = (this.game.registry.get('stageId') as string | null) ?? 'assembly';
    const seedOverride = this.game.registry.get('seed') as number | null;
    this.callbacks = this.game.registry.get('callbacks') as GameCallbacks;

    const seed = seedOverride ?? Date.now();
    if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      this.simState = createVsState(guildId, p2, stageId, seed);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
    this.inputAdapter = new PhaserInputAdapter(this);
    this.phaseHandoffFired = false;

    resetController(this.simState, 'player');

    this.audio = new AudioManager();
    this.bossMusicStarted = false;
    this.audio.startStageMusic();

    this.background = new BackgroundView(this);

    if (mode === 'story') {
      this.scene.launch('Hud');
    } else {
      // VS: React HUD overlays the canvas; shrink camera viewport to the un-covered band.
      this.cameras.main.setViewport(
        0,
        HUD_TOP_PX,
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX,
      );
    }
```

- [ ] **Step 3: Emit `sim-tick` each frame (VS only)**

In the same file's `update()` method, locate the line:

```ts
    this.game.registry.set('simState', this.simState);
```

Replace with:

```ts
    this.game.registry.set('simState', this.simState);
    if (this.simState.mode === 'vs') {
      this.events.emit('sim-tick', this.simState);
    }
```

- [ ] **Step 4: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck errors only in `GameScreen.tsx` (not yet updated — next task). `src/game/**` clean.

- [ ] **Step 5: Commit**

```bash
git add src/game/constants.ts src/game/scenes/GameplayScene.ts
git commit -m "feat(phaser): GameplayScene VS branch with HUD-band viewport and sim-tick event"
```

---

### Task 9: `CombatLog.tsx` — list of log entries, colored tags

**Files:**
- Create: `src/screens/hud/CombatLog.tsx`

- [ ] **Step 1: Implement the component**

Create `src/screens/hud/CombatLog.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../simulation/types';
import { theme } from '../../ui';

interface Props {
  entries: LogEntry[];
  visible: boolean;
}

const TAG_COLOR: Record<LogEntry['tag'], string> = {
  P1: theme.team1,
  P2: theme.team2,
  SYS: theme.inkDim,
};

const TONE_COLOR: Record<LogEntry['tone'], string> = {
  info: theme.ink,
  damage: theme.accent,
  ko: theme.warn,
  round: theme.ink,
};

export function CombatLog({ entries, visible }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  if (!visible) return null;

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        minWidth: 0,
        maxHeight: 148,
        overflowY: 'hidden',
        padding: '8px 10px',
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderRadius: 4,
        fontFamily: theme.fontMono,
        fontSize: 11,
        lineHeight: 1.4,
        color: theme.ink,
      }}
    >
      {entries.slice(-12).map((e) => (
        <div key={e.id}>
          <span style={{ color: TAG_COLOR[e.tag], marginRight: 6 }}>[{e.tag}]</span>
          <span style={{ color: TONE_COLOR[e.tone] }}>{e.text}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean for this file (any remaining errors are in unrelated upstream tasks).

- [ ] **Step 3: Commit**

```bash
git add src/screens/hud/CombatLog.tsx
git commit -m "feat(hud): CombatLog renders last 12 log entries with tag/tone colors"
```

---

### Task 10: `RoundTimer.tsx` — 60px tabular countdown + round counter

**Files:**
- Create: `src/screens/hud/RoundTimer.tsx`

- [ ] **Step 1: Implement**

Create `src/screens/hud/RoundTimer.tsx`:

```tsx
import type { RoundState } from '../../simulation/types';
import { theme } from '../../ui';

interface Props {
  round: RoundState | null;
  animate: boolean;
}

export function RoundTimer({ round, animate }: Props) {
  const seconds = round ? Math.ceil(round.timeRemainingMs / 1000) : 0;
  const low = seconds <= 10 && round?.phase === 'fighting';
  const color = low ? theme.bad : theme.ink;
  const pulse = low && animate ? 'pulse 1s infinite' : undefined;

  return (
    <div style={{ textAlign: 'center', lineHeight: 1 }}>
      <div
        style={{
          fontFamily: theme.fontMono,
          fontSize: 60,
          fontVariantNumeric: 'tabular-nums',
          color,
          animation: pulse,
        }}
      >
        {String(seconds).padStart(2, '0')}
      </div>
      <div
        style={{
          marginTop: 4,
          fontFamily: theme.fontDisplay,
          fontSize: 10,
          letterSpacing: 2,
          color: theme.inkDim,
        }}
      >
        ROUND {round ? round.index + 1 : 1}/3
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: clean for this file.

```bash
git add src/screens/hud/RoundTimer.tsx
git commit -m "feat(hud): RoundTimer with tabular numerals and low-time pulse"
```

---

### Task 11: `AbilityStrip.tsx` — 6 cards (5 abilities + RMB)

**Files:**
- Create: `src/screens/hud/AbilityStrip.tsx`

- [ ] **Step 1: Implement**

Create `src/screens/hud/AbilityStrip.tsx`:

```tsx
import type { Actor } from '../../simulation/types';
import { getGuild } from '../../simulation/guildData';
import { theme } from '../../ui';

interface Props {
  actor: Actor;
  side: 'p1' | 'p2';
  showKeys: boolean;
  simTimeMs: number;
}

const KEY_LABELS = ['1', '2', '3', '4', '5', 'R'];

export function AbilityStrip({ actor, side, showKeys, simTimeMs }: Props) {
  const guild = getGuild(actor.guildId!);
  const cards = [...guild.abilities.slice(0, 5), guild.rmb];

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {cards.map((a, i) => {
        const cdUntil = actor.abilityCooldowns[a.id] || 0;
        const cdRemaining = Math.max(0, cdUntil - simTimeMs);
        const onCd = cdRemaining > 0;
        const cdFrac = onCd ? cdRemaining / a.cooldownMs : 0;
        const unaffordable = actor.mp < a.cost;
        const dim = onCd || unaffordable;

        return (
          <div
            key={a.id}
            style={{
              position: 'relative',
              width: 56,
              height: 64,
              background: theme.panel,
              border: `1px solid ${side === 'p1' ? theme.team1 : theme.team2}`,
              borderRadius: 4,
              padding: 4,
              opacity: dim ? 0.45 : 1,
              fontFamily: theme.fontMono,
              fontSize: 9,
              color: theme.ink,
              overflow: 'hidden',
            }}
          >
            {showKeys && (
              <div style={{ position: 'absolute', top: 2, left: 4, fontSize: 10, color: theme.inkDim }}>
                {KEY_LABELS[i]}
              </div>
            )}
            <div style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: theme.accent }}>
              {a.cost}
            </div>
            <div style={{ position: 'absolute', bottom: 4, left: 4, right: 4, textAlign: 'center' }}>
              <div style={{ fontSize: 9, lineHeight: 1.1 }}>{a.name}</div>
            </div>
            {onCd && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${cdFrac * 100}%`,
                  background: 'rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: clean for this file.

```bash
git add src/screens/hud/AbilityStrip.tsx
git commit -m "feat(hud): AbilityStrip renders 5 abilities + RMB with cd overlay"
```

---

### Task 12: `HudTopBar.tsx` — players + stage + round timer

**Files:**
- Create: `src/screens/hud/HudTopBar.tsx`

- [ ] **Step 1: Implement**

Create `src/screens/hud/HudTopBar.tsx`:

```tsx
import type { Actor, RoundState } from '../../simulation/types';
import { getGuild } from '../../simulation/guildData';
import { GUILD_META } from '../../data/guildMeta';
import { theme, guildAccent } from '../../ui';
import { MeterBar } from '../../ui/MeterBar';
import { RoundTimer } from './RoundTimer';

interface Props {
  p1: Actor;
  p2: Actor;
  round: RoundState | null;
  stageName: string;
  animate: boolean;
}

export function HudTopBar({ p1, p2, round, stageName, animate }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 72,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 16,
        padding: '6px 12px',
        background: theme.bg,
        borderBottom: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <PlayerSlot actor={p1} side="left" />
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 11,
            letterSpacing: 2,
            color: theme.inkDim,
            textTransform: 'uppercase',
            marginBottom: 2,
          }}
        >
          {stageName}
        </div>
        <RoundTimer round={round} animate={animate} />
      </div>
      <PlayerSlot actor={p2} side="right" />
    </div>
  );
}

function PlayerSlot({ actor, side }: { actor: Actor; side: 'left' | 'right' }) {
  const guild = getGuild(actor.guildId!);
  const meta = GUILD_META[actor.guildId!];
  const accent = guildAccent(meta.hue);
  const teamColor = side === 'left' ? theme.team1 : theme.team2;
  const align = side === 'left' ? 'flex-start' : 'flex-end';
  const row = side === 'left' ? 'row' : 'row-reverse';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: row,
        alignItems: 'center',
        gap: 10,
        justifyContent: align,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: theme.panel,
          border: `2px solid ${teamColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: theme.fontDisplay,
          fontSize: 18,
          fontWeight: 700,
          color: accent,
        }}
      >
        {meta.glyph}
      </div>
      <div style={{ minWidth: 220, textAlign: side === 'left' ? 'left' : 'right' }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 14,
            color: theme.ink,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {guild.name}
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkDim, marginBottom: 4 }}>
          {meta.tag.toUpperCase()}
        </div>
        <MeterBar value={actor.hp} max={actor.hpMax} color={teamColor} height={8} />
        <div style={{ height: 3 }} />
        <MeterBar value={actor.mp} max={actor.mpMax} color={accent} height={5} />
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 9,
            color: theme.inkDim,
            marginTop: 2,
          }}
        >
          HP {Math.round(actor.hp)}/{actor.hpMax} · {guild.resource.name.toUpperCase()}{' '}
          {Math.round(actor.mp)}/{actor.mpMax}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: clean for this file (upstream screens/GameScreen still broken — fixed in Task 15).

```bash
git add src/screens/hud/HudTopBar.tsx
git commit -m "feat(hud): HudTopBar with player badges, hp/mp bars, stage, round timer"
```

---

### Task 13: `HudFooter.tsx` — log + two ability strips

**Files:**
- Create: `src/screens/hud/HudFooter.tsx`

- [ ] **Step 1: Implement**

Create `src/screens/hud/HudFooter.tsx`:

```tsx
import type { Actor, LogEntry } from '../../simulation/types';
import { theme } from '../../ui';
import { CombatLog } from './CombatLog';
import { AbilityStrip } from './AbilityStrip';

interface Props {
  p1: Actor;
  p2: Actor;
  log: LogEntry[];
  showLog: boolean;
  simTimeMs: number;
}

export function HudFooter({ p1, p2, log, showLog, simTimeMs }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 160,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        padding: '6px 12px',
        background: theme.bg,
        borderTop: `1px solid ${theme.line}`,
        pointerEvents: 'none',
      }}
    >
      <CombatLog entries={log} visible={showLog} />
      <AbilityStrip actor={p1} side="p1" showKeys simTimeMs={simTimeMs} />
      <AbilityStrip actor={p2} side="p2" showKeys={false} simTimeMs={simTimeMs} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/hud/HudFooter.tsx
git commit -m "feat(hud): HudFooter composes CombatLog and two AbilityStrips"
```

---

### Task 14: `HudOverlay.tsx` — subscribes to `sim-tick`, renders top/footer

**Files:**
- Create: `src/screens/hud/HudOverlay.tsx`

- [ ] **Step 1: Implement**

Create `src/screens/hud/HudOverlay.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState } from '../../simulation/types';
import { HudTopBar } from './HudTopBar';
import { HudFooter } from './HudFooter';

interface Props {
  game: Phaser.Game | null;
  stageName: string;
  animate: boolean;
  showLog: boolean;
}

export function HudOverlay({ game, stageName, animate, showLog }: Props) {
  const stateRef = useRef<SimState | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!game) return;
    const onTick = (state: SimState) => {
      stateRef.current = state;
      setTick((n) => (n + 1) & 0xffff);
    };
    const scene = game.scene.getScene('Gameplay');
    if (!scene) return;
    scene.events.on('sim-tick', onTick);
    return () => {
      scene.events.off('sim-tick', onTick);
    };
  }, [game]);

  const state = stateRef.current;
  if (!state || state.mode !== 'vs' || !state.opponent) return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <HudTopBar
        p1={state.player}
        p2={state.opponent}
        round={state.round}
        stageName={stageName}
        animate={animate}
      />
      <HudFooter
        p1={state.player}
        p2={state.opponent}
        log={state.combatLog}
        showLog={showLog}
        simTimeMs={state.timeMs}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/hud/HudOverlay.tsx
git commit -m "feat(hud): HudOverlay subscribes to sim-tick and renders top bar + footer"
```

---

### Task 15: Wire `GameScreen.tsx` — new props, mount HudOverlay in VS

**Files:**
- Modify: `src/screens/GameScreen.tsx`

- [ ] **Step 1: Update props and mount logic**

Replace the contents of `src/screens/GameScreen.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { GuildId, SimMode, SimState } from '../simulation/types';
import { PauseOverlay } from './PauseOverlay';
import { GuildDetails } from './GuildDetails';
import { useFullscreen } from '../layout/useFullscreen';
import { makePhaserGame, type GameCallbacks } from '../game/PhaserGame';
import { HudOverlay } from './hud/HudOverlay';
import { STAGES } from '../data/stages';

interface Props {
  mode: SimMode;
  p1: GuildId;
  p2?: GuildId;
  stageId: string;
  animateHud: boolean;
  showLog: boolean;
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
}

export function GameScreen({
  mode, p1, p2, stageId, animateHud, showLog,
  onVictory, onDefeat, onQuit,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameReady, setGameReady] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showMoves, setShowMoves] = useState(false);
  const pausedByMovesRef = useRef(false);

  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const isFullscreenRef = useRef(isFullscreen);
  const toggleFullscreenRef = useRef(toggleFullscreen);
  useEffect(() => { isFullscreenRef.current = isFullscreen; }, [isFullscreen]);
  useEffect(() => { toggleFullscreenRef.current = toggleFullscreen; }, [toggleFullscreen]);

  const onVictoryRef = useRef(onVictory);
  const onDefeatRef = useRef(onDefeat);
  const onQuitRef = useRef(onQuit);
  useEffect(() => { onVictoryRef.current = onVictory; }, [onVictory]);
  useEffect(() => { onDefeatRef.current = onDefeat; }, [onDefeat]);
  useEffect(() => { onQuitRef.current = onQuit; }, [onQuit]);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const callbacks: GameCallbacks = {
      onVictory: (score) => onVictoryRef.current(score),
      onDefeat: () => onDefeatRef.current(),
      onQuit: () => onQuitRef.current(),
      toggleFullscreen: () => toggleFullscreenRef.current(),
      getIsFullscreen: () => isFullscreenRef.current,
    };

    const game = makePhaserGame(parent, {
      guildId: p1,
      mode,
      p2,
      stageId,
      callbacks,
    });
    gameRef.current = game;
    setGameReady(true);

    const onPhaseChange = (phase: SimState['phase']) => {
      setIsPaused(phase === 'paused');
    };
    game.events.on('phase-change', onPhaseChange);

    return () => {
      game.events.off('phase-change', onPhaseChange);
      game.destroy(true);
      gameRef.current = null;
      setGameReady(false);
    };
  }, [mode, p1, p2, stageId]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    game.registry.set('isFullscreen', isFullscreen);
  }, [isFullscreen]);

  const emitToGameplay = useCallback((event: string) => {
    const game = gameRef.current;
    if (!game) return;
    const scene = game.scene.getScene('Gameplay');
    if (scene) scene.events.emit(event);
  }, []);

  const handleResume = useCallback(() => {
    emitToGameplay('resume-requested');
  }, [emitToGameplay]);

  const handleRestart = useCallback(() => {
    emitToGameplay('restart-requested');
  }, [emitToGameplay]);

  const closeMoves = useCallback(() => {
    setShowMoves(false);
    if (pausedByMovesRef.current) {
      emitToGameplay('resume-requested');
      pausedByMovesRef.current = false;
    }
  }, [emitToGameplay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      if (showMoves) {
        closeMoves();
        return;
      }
      const game = gameRef.current;
      if (!game) return;
      const simState = game.registry.get('simState') as SimState | undefined;
      if (!simState) return;
      if (simState.phase !== 'playing' && simState.phase !== 'paused') return;
      if (simState.phase === 'playing') {
        emitToGameplay('pause-requested');
        pausedByMovesRef.current = true;
      }
      setShowMoves(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeMoves, emitToGameplay, showMoves]);

  const stage = STAGES.find((s) => s.id === stageId);
  const stageName = stage?.name ?? 'Arena';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: '#000',
      }}
    >
      <div ref={parentRef} style={{ width: '100%', height: '100%' }} />
      {mode === 'vs' && gameReady && (
        <HudOverlay
          game={gameRef.current}
          stageName={stageName}
          animate={animateHud}
          showLog={showLog}
        />
      )}
      {isPaused && !showMoves && (
        <PauseOverlay
          onResume={handleResume}
          onRestart={handleRestart}
          onQuit={onQuit}
        />
      )}
      {showMoves && <GuildDetails guildId={p1} onClose={closeMoves} />}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: errors only in `App.tsx` (next task).

- [ ] **Step 3: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "feat(screen): GameScreen accepts mode/p2/stageId and mounts HudOverlay in VS"
```

---

### Task 16: Wire `App.tsx` — pass mode/p2/stageId; route winner

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update the GameScreen invocation**

In `src/App.tsx`, find the `state.screen === 'game'` branch and replace with:

```tsx
        {state.screen === 'game' && (
          <GameScreen
            mode={state.mode === 'vs' ? 'vs' : 'story'}
            p1={state.p1}
            p2={state.p2}
            stageId={state.stageId}
            animateHud={state.animateHud}
            showLog={state.showLog}
            onVictory={(score) => {
              setFinalScore(score);
              set({ winner: 'P1' });
              go('results');
            }}
            onDefeat={() => {
              setFinalScore(0);
              set({ winner: 'P2' });
              go('results');
            }}
            onQuit={() => go('menu')}
          />
        )}
```

*Note: for draw detection we'd need `round.matchWinner === 'draw'` — today it falls into `onDefeat` since `state.phase` becomes `'defeat'` per Task 4. The spec flagged draw UI as out-of-scope; leaving it at P2-leaning.*

- [ ] **Step 2: Typecheck + lint + test full suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all clean / all green. Golden test still passes.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): pass mode/p2/stageId into GameScreen"
```

---

### Task 17: Manual browser verification

**Files:** none (verification task)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: http://localhost:5173

- [ ] **Step 2: Story-mode regression check**

- From the main menu, pick a story mode (Stage / Surv / Champ). Start a run.
- Confirm: Phaser `HudScene` (old HUD) renders exactly as before. React overlay is **not** visible. Ability test-keys 1–5 still work (no combat log, no round timer).
- Escape/pause → resume works. Quit to menu works.

- [ ] **Step 3: VS flow**

- From main menu pick Versus, pick P1 guild, pick P2 opponent guild, pick stage, enter game.
- Confirm on first round:
  - Top bar shows P1 glyph+name+tag on left, stage name + round timer in center ("ROUND 1/3"), P2 glyph+name+tag on right, with HP/MP bars and numeric readouts.
  - Intro freeze ~1.5s, then log appends `[SYS] Round 1 — FIGHT!`.
  - Bottom-left combat log pane populates as you act.
  - Bottom-center shows P1 ability strip with key labels `1–5, R`; bottom-right shows P2 strip without key labels.
  - Press `1` → character casts first ability (same as story test slot). Log records `[P1] <Guild> uses <AbilityName>`.
  - Press `5`, `R` etc — each ability fires if resource/CD permit.
- Let round finish. Confirm win/loss/draw handling per outcome.
- Continue through BO3 to match resolution. Confirm transition to ResultsScreen with correct winner (draw currently routes to P2 — documented tradeoff).
- Pause (`P` key) → pause overlay appears; timer freezes. Resume → timer continues.
- Fullscreen toggle (`F`) still works and auto-pauses on exit.

- [ ] **Step 4: Sanity tests**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green.

- [ ] **Step 5: Final commit (if any docs/notes need updating)**

No code changes likely. If any last-minute adjustments were needed during verification, commit them:

```bash
git status
# if nothing, skip. Otherwise:
git add -A
git commit -m "chore(vs): manual verification fixes"
```

---

## Post-implementation self-review

After completing all tasks, run the full gate one more time:

```bash
npm run typecheck
npm run lint
npm test
```

All three must pass. Golden test must be green (story-mode determinism preserved).

## Out-of-scope reminders (do NOT add these)

- 4v4 BATTLE mode — HUD primitives are ready to accept 4 players but no sim work here.
- Draw UI on ResultsScreen — flagged; treat draws as P2.
- Second resource bar ("Resolve") from the mock — decorative only; not implemented.
- Combo glyph rendering inside AbilityStrip cards — left out for scope; Batch-6 glyphs can slot in later.
- Story-mode HUD refresh — separate project.
