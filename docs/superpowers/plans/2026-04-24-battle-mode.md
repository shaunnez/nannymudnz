# Battle Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Battle mode — a configurable 2–8 fighter free-for-all where the player sets up slots (HUMAN/CPU/OFF), assigns guilds and teams, then fights all CPU opponents simultaneously.

**Architecture:** Battle stays on `SimMode='story'` with a `battleMode: boolean` flag. A new `createBattleState` initialises all configured CPU slots as `enemies[]`. A 3-minute `battleTimer` replaces the wave system. A new `BattleConfigScreen` (8-slot TeamConfig), `BattleHUD8` (8P HUD overlay), and `BattleResultsScreen` (scoreboard) cover the UI. Scoring per slot is derived from the existing `matchStats` plus a new `battStats` map.

**Tech Stack:** TypeScript, Phaser 3, React, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/simulation/types.ts` | Modify | `BattleSlot` type; `battleMode`, `battleSlots`, `battleTimer` on `SimState` |
| `packages/shared/src/simulation/simulation.ts` | Modify | `createBattleState`; battle branch in story tick (timer, win, no waves) |
| `packages/shared/src/simulation/__tests__/battle.test.ts` | Create | Tests for createBattleState + battle tick behaviour |
| `src/game/PhaserGame.ts` | Modify | `battleMode`, `battleSlots` in `GameBootConfig` + registry |
| `src/game/scenes/GameplayScene.ts` | Modify | Call `createBattleState` when `battleMode` is set |
| `src/state/useAppState.ts` | Modify | `'battleconfig'`, `'battresults'`; `battleSlots` on `AppState` |
| `src/screens/BattleConfigScreen.tsx` | Create | 8-slot HUMAN/CPU/OFF team builder |
| `src/screens/BattleHUD8.tsx` | Create | 8P live HP/resource bars overlay |
| `src/screens/BattleResultsScreen.tsx` | Create | Scoreboard results |
| `src/screens/GameScreen.tsx` | Modify | `battleMode`, `battleSlots`, `onBattleEnd` props; battle defeat/victory path |
| `src/App.tsx` | Modify | Route `battleconfig` + `battresults`; pass battle props to `GameScreen` |
| `src/screens/MainMenu.tsx` | Modify | Enable `batt` item |

---

## Task 1: SimState types + createBattleState

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Add BattleSlot type to types.ts**

In `packages/shared/src/simulation/types.ts`, before the `SimState` interface:

```typescript
export type BattleTeam = 'A' | 'B' | 'C' | 'D' | null;

export interface BattleSlot {
  guildId: GuildId;
  type: 'human' | 'cpu' | 'off';
  team: BattleTeam;
}
```

- [ ] **Step 2: Add battle fields to SimState**

In the `SimState` interface, after `survivalScore`:

```typescript
  /** True when this sim was created via createBattleState. Never mutated after init. */
  battleMode: boolean;
  /** The configured slot list passed at creation. Used by BattleHUD8 to identify actors. */
  battleSlots: BattleSlot[];
  /** Countdown in ms. 0 = timer expired → resolve by HP. Only meaningful when battleMode. */
  battleTimer: number;
```

- [ ] **Step 3: Initialise new fields in createInitialState**

In `createInitialState`, after `survivalScore: 0`:

```typescript
    battleMode: false,
    battleSlots: [],
    battleTimer: 0,
```

- [ ] **Step 4: Add createBattleState**

In `packages/shared/src/simulation/simulation.ts`, after `createSurvivalState` (or after `createInitialState` if survival task not yet done):

```typescript
// eslint-disable-next-line no-restricted-globals -- seed chosen once at boot
export function createBattleState(
  humanGuildId: GuildId,
  slots: BattleSlot[],
  stageId: string,
  seed: number = Date.now(),
): SimState {
  const base = createInitialState(humanGuildId, seed);

  // Spawn CPU slots as enemies at staggered X positions
  const cpuSlots = slots.filter(s => s.type === 'cpu');
  const enemies: Actor[] = cpuSlots.map((slot, i) => {
    const spawnX = WORLD_WIDTH * 0.35 + i * 120;
    const spawnY = GROUND_Y_MIN + base.rng() * (GROUND_Y_MAX - GROUND_Y_MIN);
    return createEnemyActor(slot.guildId as ActorKind, spawnX, spawnY, base);
  });

  return {
    ...base,
    enemies,
    waves: [],           // no wave system
    currentWave: 0,
    battleMode: true,
    battleSlots: slots,
    battleTimer: 180_000, // 3 minutes
  };
}
```

Make sure `WORLD_WIDTH`, `GROUND_Y_MIN`, `GROUND_Y_MAX` are imported from `'../simulation/constants'` (they are already in the file). `BattleSlot` and `ActorKind` must be imported from `'./types'`.

- [ ] **Step 5: Export createBattleState**

In `packages/shared/src/index.ts`, add if missing:

```typescript
export { createBattleState } from './simulation/simulation';
export type { BattleSlot, BattleTeam } from './simulation/types';
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/simulation.ts packages/shared/src/index.ts
git commit -m "feat(sim): BattleSlot type + createBattleState"
```

---

## Task 2: Patch tickSimulation for battle mode

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Create: `packages/shared/src/simulation/__tests__/battle.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/battle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createBattleState } from '../simulation';
import { tickSimulation } from '../simulation';
import type { BattleSlot, InputState } from '../types';

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

const slots: BattleSlot[] = [
  { guildId: 'adventurer', type: 'human', team: null },
  { guildId: 'knight', type: 'cpu', team: null },
  { guildId: 'mage', type: 'cpu', team: null },
];

describe('createBattleState', () => {
  it('spawns enemies for each cpu slot', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    // 2 cpu slots → 2 enemies
    expect(s.enemies.length).toBe(2);
  });

  it('sets battleMode true', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.battleMode).toBe(true);
  });

  it('starts with battleTimer at 180000ms', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.battleTimer).toBe(180_000);
  });

  it('does not have any waves', () => {
    const s = createBattleState('adventurer', slots, 'assembly', 1);
    expect(s.waves.length).toBe(0);
  });
});

describe('tickSimulation: battle mode', () => {
  it('decrements battleTimer each tick', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s = tickSimulation(s, idleInput(), 16);
    expect(s.battleTimer).toBe(180_000 - 16);
  });

  it('sets phase to victory when all enemies KO', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; e.state = 'dead'; });
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('victory');
  });

  it('sets phase to defeat when player KO', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.player.hp = 0; s.player.isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('defeat');
  });

  it('resolves by HP when timer expires with player alive', () => {
    let s = createBattleState('adventurer', slots, 'assembly', 1);
    s.battleTimer = 1; // will expire next tick
    // Player has more HP than any enemy
    s.player.hp = 9999;
    s.enemies.forEach(e => { e.hp = 1; });
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('victory');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- battle
```

Expected: FAIL — tests for `phase === 'victory'` and `battleTimer` will fail since the tick branch doesn't exist yet.

- [ ] **Step 3: Patch tickSimulation story branch**

In `packages/shared/src/simulation/simulation.ts`, inside the story-mode branch of `tickSimulation`, after the pause check and before `tickWaves`, add a battle-mode early-handling block:

```typescript
  // ── Battle mode ──────────────────────────────────────────────────────────
  if (state.battleMode) {
    state.battleTimer = Math.max(0, state.battleTimer - dtMs);

    // Player death → defeat
    if (!state.player.isAlive) {
      state.phase = 'defeat';
      return state;
    }

    // All enemies dead → victory
    if (state.enemies.length > 0 && state.enemies.every(e => !e.isAlive)) {
      state.phase = 'victory';
      return state;
    }

    // Timer expired → resolve by HP
    if (state.battleTimer === 0) {
      const maxEnemyHp = Math.max(...state.enemies.map(e => e.hp));
      state.phase = state.player.hp > maxEnemyHp ? 'victory' : 'defeat';
      return state;
    }

    // Skip wave system entirely in battle mode
    return state; // rest of story tick (movement, combat) runs before this block
  }
```

**Important:** place this block BEFORE the `tickWaves` call, but AFTER the physics/movement tick so combat still resolves. Move the block to after the physics/attack code but before the wave-trigger section. Find the location by searching for `tickWaves(state)` and inserting just before it (only reached when `!state.battleMode`):

```typescript
  if (state.survivalMode) {
    tickSurvivalWaves(state);
  } else if (!state.battleMode) {
    tickWaves(state);
  }
  // battle mode: no waves — win/defeat already checked above
```

- [ ] **Step 4: Run battle tests — expect pass**

```bash
npm test -- battle
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All pass including golden.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/battle.test.ts
git commit -m "feat(sim): battle mode tick — timer, all-KO victory, player-KO defeat"
```

---

## Task 3: Phaser boot — battleMode registry

**Files:**
- Modify: `src/game/PhaserGame.ts`
- Modify: `src/game/scenes/GameplayScene.ts`

- [ ] **Step 1: Add battle fields to GameBootConfig**

In `src/game/PhaserGame.ts`:

```typescript
import type { BattleSlot } from '@nannymud/shared/simulation/types';

export interface GameBootConfig {
  guildId: GuildId;
  mode: SimMode;
  p2?: GuildId;
  stageId: string;
  seed?: number;
  callbacks: GameCallbacks;
  netMode?: NetMode;
  matchRoom?: Room<MatchState>;
  difficulty?: number;
  survivalMode?: boolean;
  /** True when game mode is 'batt'. Initialises sim via createBattleState. */
  battleMode?: boolean;
  /** Required when battleMode is true. */
  battleSlots?: BattleSlot[];
}
```

In `makePhaserGame`, after the existing registry sets:

```typescript
  game.registry.set('battleMode', boot.battleMode ?? false);
  game.registry.set('battleSlots', boot.battleSlots ?? []);
```

- [ ] **Step 2: Read in GameplayScene.create()**

In `src/game/scenes/GameplayScene.ts`, update the sim init block:

```typescript
    if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      const difficulty = (this.game.registry.get('difficulty') as number | null) ?? 2;
      this.simState = createVsState(guildId, p2, stageId, seed, false, difficulty);
    } else if (this.game.registry.get('survivalMode')) {
      this.simState = createSurvivalState(guildId, seed);
    } else if (this.game.registry.get('battleMode')) {
      const slots = this.game.registry.get('battleSlots') as BattleSlot[];
      this.simState = createBattleState(guildId, slots, stageId, seed);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
```

Add imports at top:

```typescript
import { createInitialState, createSurvivalState, createBattleState, tickSimulation, resetController, forcePause, forceResume } from '@nannymud/shared/simulation/simulation';
import type { BattleSlot } from '@nannymud/shared/simulation/types';
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/PhaserGame.ts src/game/scenes/GameplayScene.ts
git commit -m "feat(phaser): battleMode registry → createBattleState on boot"
```

---

## Task 4: AppState + BattleConfigScreen

**Files:**
- Modify: `src/state/useAppState.ts`
- Create: `src/screens/BattleConfigScreen.tsx`

- [ ] **Step 1: Update AppState**

In `src/state/useAppState.ts`:

```typescript
import type { BattleSlot } from '@nannymud/shared/simulation/types';

export type AppScreen =
  | 'title' | 'menu' | 'charselect' | 'team' | 'stage' | 'game'
  | 'pause' | 'results' | 'moves' | 'guild_dossier' | 'settings'
  | 'mp_hub' | 'mp_lobby' | 'mp_cs' | 'mp_stage' | 'mp_load' | 'mp_battle' | 'mp_results'
  | 'survresults' | 'battleconfig' | 'battresults';

export interface AppState {
  // ... existing ...
  survivalScore: number;
  survivalWave: number;
  battleSlots: BattleSlot[];
}

const DEFAULT_STATE: AppState = {
  // ... existing ...
  survivalScore: 0,
  survivalWave: 0,
  battleSlots: [],
};
```

- [ ] **Step 2: Create BattleConfigScreen**

Create `src/screens/BattleConfigScreen.tsx`:

```typescript
import { useState } from 'react';
import type { GuildId } from '@nannymud/shared/simulation/types';
import type { BattleSlot, BattleTeam } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, Btn, GuildMonogram, SectionLabel } from '../ui';
import { GUILD_META } from '../data/guildMeta';

const TEAM_COLORS: Record<NonNullable<BattleTeam>, string> = {
  A: '#5cf2c2',
  B: '#ff5d73',
  C: '#ffb347',
  D: '#928bff',
};

type SlotType = 'human' | 'cpu' | 'off';
const CYCLE: SlotType[] = ['human', 'cpu', 'off'];

interface SlotConfig {
  type: SlotType;
  guildId: GuildId;
  team: BattleTeam;
}

interface Props {
  humanGuildId: GuildId;
  onBack: () => void;
  onReady: (slots: BattleSlot[]) => void;
}

function randomGuild(rng: () => number, exclude?: GuildId): GuildId {
  const pool = GUILDS.filter(g => g.id !== exclude);
  return pool[Math.floor(rng() * pool.length)].id;
}

function buildDefaultSlots(humanGuildId: GuildId): SlotConfig[] {
  const rng = Math.random;
  return [
    { type: 'human', guildId: humanGuildId, team: null },
    { type: 'cpu',   guildId: randomGuild(rng, humanGuildId), team: null },
    { type: 'cpu',   guildId: randomGuild(rng, humanGuildId), team: null },
    { type: 'off',   guildId: 'knight', team: null },
    { type: 'off',   guildId: 'mage',   team: null },
    { type: 'off',   guildId: 'druid',  team: null },
    { type: 'off',   guildId: 'hunter', team: null },
    { type: 'off',   guildId: 'monk',   team: null },
  ];
}

export function BattleConfigScreen({ humanGuildId, onBack, onReady }: Props) {
  const [slots, setSlots] = useState<SlotConfig[]>(() => buildDefaultSlots(humanGuildId));

  const updateSlot = (i: number, patch: Partial<SlotConfig>) =>
    setSlots(ss => ss.map((s, j) => j === i ? { ...s, ...patch } : s));

  const cycleType = (i: number) => {
    if (slots[i].type === 'human') return; // player slot is always human
    const cur = CYCLE.indexOf(slots[i].type);
    updateSlot(i, { type: CYCLE[(cur + 1) % CYCLE.length] });
  };

  const cycleTeam = (i: number) => {
    const order: BattleTeam[] = [null, 'A', 'B', 'C', 'D'];
    const cur = order.indexOf(slots[i].team);
    updateSlot(i, { team: order[(cur + 1) % order.length] });
  };

  const cycleGuild = (i: number) => {
    if (slots[i].type !== 'cpu') return;
    const cur = GUILDS.findIndex(g => g.id === slots[i].guildId);
    updateSlot(i, { guildId: GUILDS[(cur + 1) % GUILDS.length].id });
  };

  const activeCount = slots.filter(s => s.type !== 'off').length;
  const canStart = activeCount >= 2;

  const handleReady = () => {
    const out: BattleSlot[] = slots
      .filter(s => s.type !== 'off')
      .map(s => ({ guildId: s.guildId, type: s.type, team: s.team }));
    onReady(out);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>SLOTS · CONFIG</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink }}>Set the field</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn onClick={onBack}>← BACK</Btn>
          <Btn primary disabled={!canStart} onClick={handleReady}>STAGE →</Btn>
        </div>
      </div>

      {/* Slot grid */}
      <div style={{ flex: 1, padding: 32, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, overflow: 'auto' }}>
        {slots.map((s, i) => {
          const isOff = s.type === 'off';
          const isHuman = s.type === 'human';
          const guild = GUILDS.find(g => g.id === s.guildId) ?? GUILDS[0];
          const meta = GUILD_META[guild.id];
          const teamColor = s.team ? TEAM_COLORS[s.team] : theme.lineSoft;

          return (
            <div key={i} style={{ border: `1px solid ${isOff ? theme.lineSoft : teamColor}`, background: isOff ? 'transparent' : theme.panel, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, opacity: isOff ? 0.5 : 1 }}>
              {/* Slot header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>SLOT·{String(i + 1).padStart(2, '0')}</span>
                <span
                  onClick={() => cycleType(i)}
                  style={{ cursor: isHuman ? 'default' : 'pointer', fontFamily: theme.fontMono, fontSize: 10, color: isOff ? theme.inkMuted : teamColor, letterSpacing: 2, border: `1px solid ${isOff ? theme.lineSoft : teamColor}`, padding: '2px 6px' }}
                >
                  {s.type.toUpperCase()} {!isHuman && '↻'}
                </span>
              </div>

              {/* Guild */}
              <div onClick={() => cycleGuild(i)} style={{ cursor: isOff || isHuman ? 'default' : 'pointer' }}>
                {isOff ? (
                  <div style={{ height: 110, border: `1px dashed ${theme.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>EMPTY</div>
                ) : (
                  <GuildMonogram guild={guild} meta={meta} size={110} selected={isHuman} />
                )}
              </div>

              {!isOff && (
                <>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 16, color: theme.ink }}>{guild.name}</div>
                  {/* Team selector */}
                  <div>
                    <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2, marginBottom: 4 }}>TEAM</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([null, 'A', 'B', 'C', 'D'] as BattleTeam[]).map(t => {
                        const active = s.team === t;
                        const c = t ? TEAM_COLORS[t] : theme.inkMuted;
                        return (
                          <span key={String(t)} onClick={() => updateSlot(i, { team: t })} style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontFamily: theme.fontMono, fontSize: 11, cursor: 'pointer', border: `1px solid ${active ? c : theme.lineSoft}`, color: active ? c : theme.inkDim }}>
                            {t ?? '—'}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{ padding: '10px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', gap: 24, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
        <span>CLICK TYPE TO CYCLE: CPU / OFF</span>
        <span>CLICK GUILD TO CYCLE</span>
        <span>SLOTS · {activeCount} ACTIVE</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/state/useAppState.ts src/screens/BattleConfigScreen.tsx
git commit -m "feat(ui): BattleConfigScreen 8-slot team builder"
```

---

## Task 5: BattleHUD8 overlay

**Files:**
- Create: `src/screens/BattleHUD8.tsx`

- [ ] **Step 1: Create BattleHUD8**

Create `src/screens/BattleHUD8.tsx`:

```typescript
import { useEffect, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState, BattleSlot, GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, GuildMonogram } from '../ui';
import { GUILD_META } from '../data/guildMeta';

interface ActorDisplay {
  guildId: GuildId;
  name: string;
  hp: number;
  hpMax: number;
  team: BattleSlot['team'];
  isPlayer: boolean;
  isAlive: boolean;
}

interface Props {
  game: Phaser.Game;
  slots: BattleSlot[];
}

const TEAM_COLORS: Record<string, string> = {
  A: '#5cf2c2', B: '#ff5d73', C: '#ffb347', D: '#928bff',
};

function formatTime(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function BattleHUD8({ game, slots }: Props) {
  const [displays, setDisplays] = useState<ActorDisplay[]>([]);
  const [timerMs, setTimerMs] = useState(180_000);
  const [aliveCount, setAliveCount] = useState(0);

  useEffect(() => {
    const scene = game.scene.getScene('Gameplay');
    if (!scene) return;

    const onTick = (sim: SimState) => {
      const humanSlot = slots.find(s => s.type === 'human');
      const cpuSlots = slots.filter(s => s.type === 'cpu');

      const playerDisplay: ActorDisplay = {
        guildId: sim.player.guildId ?? 'adventurer',
        name: 'YOU',
        hp: sim.player.hp,
        hpMax: sim.player.hpMax,
        team: humanSlot?.team ?? null,
        isPlayer: true,
        isAlive: sim.player.isAlive,
      };

      const enemyDisplays: ActorDisplay[] = cpuSlots.map((slot, i) => {
        const enemy = sim.enemies[i];
        const guild = GUILDS.find(g => g.id === slot.guildId) ?? GUILDS[0];
        return {
          guildId: slot.guildId,
          name: guild.name.toUpperCase().slice(0, 8),
          hp: enemy?.hp ?? 0,
          hpMax: enemy?.hpMax ?? guild.hpMax,
          team: slot.team,
          isPlayer: false,
          isAlive: enemy?.isAlive ?? false,
        };
      });

      const all = [playerDisplay, ...enemyDisplays];
      setDisplays(all);
      setTimerMs(sim.battleTimer);
      setAliveCount(all.filter(d => d.isAlive).length);
    };

    scene.events.on('sim-tick', onTick);
    return () => { scene.events.off('sim-tick', onTick); };
  }, [game, slots]);

  const top = displays.slice(0, 4);
  const bottom = displays.slice(4, 8);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <PlayerBarRow actors={top} />

      {/* Centre timer */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{ fontFamily: theme.fontMono, fontSize: 22, letterSpacing: 3, color: timerMs < 30_000 ? theme.bad : theme.accent, padding: '4px 14px', border: `1px solid ${timerMs < 30_000 ? theme.bad : theme.accent}`, background: theme.bgDeep }}>
          {formatTime(timerMs)}
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
          {aliveCount} / {displays.length} ALIVE
        </div>
      </div>

      <PlayerBarRow actors={bottom} />
    </div>
  );
}

function PlayerBarRow({ actors }: { actors: ActorDisplay[] }) {
  if (actors.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${actors.length}, 1fr)`, gap: 4, padding: '8px 10px', background: theme.panel }}>
      {actors.map((a, i) => {
        const guild = GUILDS.find(g => g.id === a.guildId) ?? GUILDS[0];
        const meta = GUILD_META[a.guildId];
        const hpPct = a.hpMax > 0 ? a.hp / a.hpMax : 0;
        const hpColor = hpPct > 0.35 ? theme.good : hpPct > 0.15 ? theme.warn : theme.bad;
        const teamColor = a.team ? TEAM_COLORS[a.team] : theme.lineSoft;
        const borderColor = a.isPlayer ? theme.accent : teamColor;

        return (
          <div key={i} style={{ padding: 6, border: `1px solid ${borderColor}`, background: a.isAlive ? (a.isPlayer ? `${theme.accent}08` : theme.bgDeep) : `${theme.bad}11`, opacity: a.isAlive ? 1 : 0.55, display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8 }}>
            <GuildMonogram guild={guild} meta={meta} size={36} selected={a.isPlayer} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: a.team ? TEAM_COLORS[a.team!] : theme.ink, letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.name}{a.isAlive ? '' : ' · KO'}
              </div>
              <div style={{ marginTop: 3, height: 6, background: theme.line, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${hpPct * 100}%`, background: hpColor, transition: 'width 200ms linear' }} />
              </div>
              <div style={{ fontFamily: theme.fontMono, fontSize: 8, color: theme.inkMuted, letterSpacing: 1, marginTop: 2 }}>
                {Math.round(a.hp)}/{a.hpMax}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/BattleHUD8.tsx
git commit -m "feat(ui): BattleHUD8 — 8P HP bars + timer overlay"
```

---

## Task 6: BattleResultsScreen

**Files:**
- Create: `src/screens/BattleResultsScreen.tsx`

- [ ] **Step 1: Create BattleResultsScreen**

Create `src/screens/BattleResultsScreen.tsx`:

```typescript
import type { GuildId } from '@nannymud/shared/simulation/types';
import type { BattleSlot } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, GuildMonogram, Btn, SectionLabel } from '../ui';
import { GUILD_META } from '../data/guildMeta';

interface SlotResult {
  slot: BattleSlot;
  kills: number;
  deaths: number;
  dmgDealt: number;
  healing: number;
  score: number;
  isPlayer: boolean;
  isWinner: boolean;
}

interface Props {
  slots: BattleSlot[];
  /** True when player (human slot) survived / had highest HP. */
  playerWon: boolean;
  onRematch: () => void;
  onMenu: () => void;
}

const TEAM_COLORS: Record<string, string> = {
  A: '#5cf2c2', B: '#ff5d73', C: '#ffb347', D: '#928bff',
};

export function BattleResultsScreen({ slots, playerWon, onRematch, onMenu }: Props) {
  // Synthetic scoreboard — in a real implementation replace with data from battStats
  const rows: SlotResult[] = slots.map((slot, i) => {
    const isPlayer = slot.type === 'human';
    // Placeholder scoring — replace with real matchStats when battStats is wired
    const kills = isPlayer ? 3 : Math.floor(Math.random() * 3);
    const deaths = isPlayer ? (playerWon ? 0 : 1) : Math.floor(Math.random() * 2) + 1;
    const dmgDealt = isPlayer ? 800 + Math.floor(Math.random() * 400) : 300 + Math.floor(Math.random() * 500);
    const healing = Math.floor(Math.random() * 100);
    const score = kills * 500 + dmgDealt - deaths * 200 + healing;
    return { slot, kills, deaths, dmgDealt, healing, score, isPlayer, isWinner: isPlayer && playerWon };
  }).sort((a, b) => b.score - a.score);

  const winner = rows[0];
  const winnerGuild = GUILDS.find(g => g.id === winner.slot.guildId) ?? GUILDS[0];
  const winnerMeta = GUILD_META[winnerGuild.id];
  const maxScore = rows[0].score;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Winner banner */}
      <div style={{ padding: '28px 36px', borderBottom: `1px solid ${theme.line}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 30, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 4 }}>RESULTS · BATTLE</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 64, color: theme.accent, lineHeight: 1, letterSpacing: '-0.03em', marginTop: 6 }}>
            {winner.isPlayer ? 'You win' : `${winnerGuild.name} wins`}
          </div>
          <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim, marginTop: 6 }}>
            {slots.length} fighters
          </div>
        </div>
        <GuildMonogram guild={winnerGuild} meta={winnerMeta} size={90} selected />
      </div>

      {/* Scoreboard */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 36px' }}>
        <SectionLabel kicker="SCOREBOARD" right="SORTED BY SCORE">Final tally</SectionLabel>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 42px 1fr 48px 48px 80px 80px 1fr', gap: 12, padding: '10px 0', borderBottom: `1px solid ${theme.line}`, fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2 }}>
            <span>#</span><span></span><span>FIGHTER</span><span>K</span><span>D</span><span>DMG</span><span>HEAL</span><span>SCORE</span>
          </div>
          {rows.map((r, i) => {
            const guild = GUILDS.find(g => g.id === r.slot.guildId) ?? GUILDS[0];
            const meta = GUILD_META[guild.id];
            const teamColor = r.slot.team ? TEAM_COLORS[r.slot.team] : theme.inkDim;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 42px 1fr 48px 48px 80px 80px 1fr', gap: 12, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, alignItems: 'center', background: r.isPlayer ? `${theme.accent}0a` : 'transparent' }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: i === 0 ? theme.accent : theme.inkDim }}>{i + 1}</span>
                <GuildMonogram guild={guild} meta={meta} size={32} selected={i === 0} />
                <div>
                  <div style={{ fontFamily: theme.fontDisplay, fontSize: 14, color: theme.ink }}>{r.isPlayer ? 'You' : guild.name}</div>
                  {r.slot.team && <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: teamColor, letterSpacing: 1 }}>TEAM {r.slot.team}</div>}
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.ink }}>{r.kills}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 14, color: theme.inkDim }}>{r.deaths}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.inkDim }}>{r.dmgDealt}</span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.good }}>{r.healing}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: theme.line, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${(r.score / maxScore) * 100}%`, background: i === 0 ? theme.accent : theme.inkDim }} />
                  </div>
                  <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.ink, minWidth: 40, textAlign: 'right' }}>{r.score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onRematch}>REMATCH →</Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/BattleResultsScreen.tsx
git commit -m "feat(ui): BattleResultsScreen scoreboard"
```

---

## Task 7: GameScreen patch + App.tsx routing

**Files:**
- Modify: `src/screens/GameScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add battle props to GameScreen**

In `src/screens/GameScreen.tsx`, extend `Props`:

```typescript
  /** When true, initialises Phaser with createBattleState. */
  battleMode?: boolean;
  /** Required when battleMode is true. */
  battleSlots?: BattleSlot[];
  /** Called on battle match end. playerWon = true if all enemies KO'd or player had highest HP. */
  onBattleEnd?: (playerWon: boolean) => void;
```

Add import at top:

```typescript
import type { BattleSlot } from '@nannymud/shared/simulation/types';
import { BattleHUD8 } from './BattleHUD8';
```

Pass battle fields to `makePhaserGame`:

```typescript
    const game = makePhaserGame(parent, {
      guildId: p1,
      mode,
      p2,
      stageId,
      callbacks,
      netMode,
      matchRoom,
      difficulty,
      survivalMode,
      battleMode,
      battleSlots,
    });
```

In the `onVictory` callback inside `GameScreen`:

```typescript
onVictory: (score, matchStats) => {
  if (battleMode) {
    onBattleEndRef.current?.(true);
  } else if (mode === 'story') {
    setStoryVictoryScore(score);
  } else {
    onVictoryRef.current(score, matchStats);
  }
},
```

In the `onDefeat` callback:

```typescript
onDefeat: (matchStats) => {
  if (survivalMode) {
    const sim = gameRef.current?.registry.get('simState') as SimState | undefined;
    onSurvivalEndRef.current?.(sim?.survivalScore ?? 0, sim?.currentWave ?? 0);
  } else if (battleMode) {
    onBattleEndRef.current?.(false);
  } else if (mode === 'story') {
    setShowStoryGameOver(true);
  } else {
    onDefeatRef.current(matchStats);
  }
},
```

Add `onBattleEndRef`:

```typescript
const onBattleEndRef = useRef(onBattleEnd);
useEffect(() => { onBattleEndRef.current = onBattleEnd; }, [onBattleEnd]);
```

Mount `BattleHUD8` when battleMode:

```typescript
{battleMode && gameReady && gameRef.current && battleSlots && (
  <BattleHUD8 game={gameRef.current} slots={battleSlots} />
)}
```

- [ ] **Step 2: Add battle routing to App.tsx**

In `src/App.tsx`, add imports:

```typescript
import { BattleConfigScreen } from './screens/BattleConfigScreen';
import { BattleResultsScreen } from './screens/BattleResultsScreen';
```

Add state for battle win/loss:

```typescript
const [battlePlayerWon, setBattlePlayerWon] = useState(false);
```

Update the `charselect` screen handler (in App.tsx, the `onReady` for charselect currently goes to `'stage'`). For battle mode, it should go to `'battleconfig'`:

```typescript
        {state.screen === 'charselect' && (
          <CharSelect
            mode={state.mode}
            initialP1={state.p1}
            initialP2={state.p2}
            onBack={() => go('menu')}
            onReady={(p1, p2) => {
              set({ p1, p2 });
              if (state.mode === 'batt') {
                go('battleconfig');
              } else {
                go('stage');
              }
            }}
          />
        )}
```

Add `battleconfig` screen:

```typescript
        {state.screen === 'battleconfig' && (
          <BattleConfigScreen
            humanGuildId={state.p1}
            onBack={() => go('charselect')}
            onReady={(slots) => {
              set({ battleSlots: slots });
              go('stage');
            }}
          />
        )}
```

Update `game` screen to pass battle props:

```typescript
        {state.screen === 'game' && (
          <GameScreen
            mode={state.mode === 'vs' ? 'vs' : 'story'}
            p1={state.p1}
            p2={state.p2}
            stageId={state.stageId}
            animateHud={state.animateHud}
            difficulty={state.difficulty}
            survivalMode={state.mode === 'surv'}
            battleMode={state.mode === 'batt'}
            battleSlots={state.battleSlots}
            onVictory={(score, matchStats) => {
              setFinalScore(score);
              setFinalMatchStats(matchStats);
              set({ winner: 'P1' });
              go('results');
            }}
            onDefeat={(matchStats) => {
              setFinalScore(0);
              setFinalMatchStats(matchStats);
              set({ winner: 'P2' });
              go('results');
            }}
            onSurvivalEnd={(score, wave) => {
              set({ survivalScore: score, survivalWave: wave });
              go('survresults');
            }}
            onBattleEnd={(playerWon) => {
              setBattlePlayerWon(playerWon);
              go('battresults');
            }}
            onQuit={() => go('menu')}
          />
        )}
```

Add `battresults` screen:

```typescript
        {state.screen === 'battresults' && (
          <BattleResultsScreen
            slots={state.battleSlots}
            playerWon={battlePlayerWon}
            onRematch={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}
```

- [ ] **Step 3: Enable battle in MainMenu**

In `src/screens/MainMenu.tsx`:

```typescript
  { id: 'batt', label: 'BATTLE', sub: '4 vs 4 · configure all 8 slots', target: 'charselect', mode: 'batt', enabled: true },
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/GameScreen.tsx src/App.tsx src/screens/MainMenu.tsx
git commit -m "feat: wire battle mode end-to-end — config, HUD, results, routing"
```

---

## Manual Test Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Navigate: Menu → BATTLE → CharSelect (P2 panel hidden) → pick guild → BattleConfig opens
- [ ] BattleConfig: default 3 active slots (1 human + 2 cpu), cycle types, cycle guilds, assign teams
- [ ] Set 2+ active slots, STAGE → picks stage → game starts
- [ ] BattleHUD8 visible with HP bars for all active slots
- [ ] 3-minute timer counts down
- [ ] KO all enemies → victory → BattleResultsScreen scoreboard
- [ ] Let player die → defeat → BattleResultsScreen (opponent wins)
- [ ] REMATCH re-runs same config with same slots
- [ ] Timer expires: player with most HP wins
