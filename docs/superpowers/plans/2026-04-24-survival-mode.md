# Survival Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an endless survival mode where the player fights escalating waves until KO, with a per-guild high-score leaderboard.

**Architecture:** Survival stays on `SimMode='story'` with two new flags (`survivalMode`, `survivalScore`) on `SimState`. A new `survivalWaves.ts` module replaces the static wave system with infinite procedural spawning. React reads `simState` from the Phaser registry on defeat to extract the final score and wave.

**Tech Stack:** TypeScript, Phaser 3, React, Vitest, localStorage

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/shared/src/simulation/types.ts` | Modify | Add `survivalMode`, `survivalScore` to `SimState` |
| `packages/shared/src/simulation/simulation.ts` | Modify | `createSurvivalState`, patch story tick to call `tickSurvivalWaves` |
| `packages/shared/src/simulation/survivalWaves.ts` | Create | `tickSurvivalWaves`, `spawnSurvivalWave` |
| `packages/shared/src/simulation/__tests__/survival.test.ts` | Create | Unit tests for survival wave logic |
| `src/game/PhaserGame.ts` | Modify | Add `survivalMode` to `GameBootConfig` + registry |
| `src/game/scenes/GameplayScene.ts` | Modify | Call `createSurvivalState` when `survivalMode` is set |
| `src/state/useAppState.ts` | Modify | Add `'survresults'`, `survivalScore`, `survivalWave` |
| `src/screens/SurvivalHUD.tsx` | Create | Wave badge + score counter overlay |
| `src/screens/SurvivalResultsScreen.tsx` | Create | Results screen + localStorage leaderboard |
| `src/screens/GameScreen.tsx` | Modify | `gameMode`/`onSurvivalEnd` props; survival defeat path |
| `src/App.tsx` | Modify | Route `survresults`; pass survival props to `GameScreen` |
| `src/screens/MainMenu.tsx` | Modify | Enable `surv` item |

---

## Task 1: SimState types + createSurvivalState

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Add survival fields to SimState interface**

In `packages/shared/src/simulation/types.ts`, find the `SimState` interface (line ~393) and add two fields after `matchStats`:

```typescript
  matchStats: MatchStats;
  /** Set to true when this state was created via createSurvivalState. Never mutated after init. */
  survivalMode: boolean;
  /** Accumulates score as waves are cleared. Only meaningful when survivalMode. */
  survivalScore: number;
```

- [ ] **Step 2: Initialise new fields in createInitialState**

In `packages/shared/src/simulation/simulation.ts`, find `createInitialState` (line ~181) and add defaults:

```typescript
    matchStats: makeEmptyMatchStats(),
    survivalMode: false,
    survivalScore: 0,
```

- [ ] **Step 3: Add createSurvivalState**

In `packages/shared/src/simulation/simulation.ts`, directly after `createInitialState`:

```typescript
// eslint-disable-next-line no-restricted-globals -- seed chosen once at boot, outside tick loop
export function createSurvivalState(guildId: GuildId, seed: number = Date.now()): SimState {
  return {
    ...createInitialState(guildId, seed),
    waves: [],          // no static waves; survivalWaves.ts drives spawning
    currentWave: 0,     // tickSurvivalWaves increments before first spawn → wave 1
    survivalMode: true,
    survivalScore: 0,
  };
}
```

- [ ] **Step 4: Export createSurvivalState from the shared package index**

In `packages/shared/src/simulation/simulation.ts`, confirm `createSurvivalState` is already exported via `export function`. Then verify it appears in the public exports. In `packages/shared/src/index.ts` (or wherever the shared package re-exports simulation), add if missing:

```typescript
export { createSurvivalState } from './simulation/simulation';
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/simulation.ts packages/shared/src/index.ts
git commit -m "feat(sim): add survivalMode/survivalScore to SimState + createSurvivalState"
```

---

## Task 2: survivalWaves.ts — wave spawning logic

**Files:**
- Create: `packages/shared/src/simulation/survivalWaves.ts`
- Create: `packages/shared/src/simulation/__tests__/survival.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `packages/shared/src/simulation/__tests__/survival.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createSurvivalState } from '../simulation';
import { tickSurvivalWaves } from '../survivalWaves';

describe('tickSurvivalWaves', () => {
  it('spawns enemies when none are alive (initial empty state)', () => {
    const s = createSurvivalState('adventurer', 1);
    expect(s.enemies.length).toBe(0);
    tickSurvivalWaves(s);
    expect(s.enemies.length).toBeGreaterThan(0);
    expect(s.currentWave).toBe(1);
  });

  it('does not spawn when enemies are still alive', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s); // spawn wave 1
    const count = s.enemies.length;
    tickSurvivalWaves(s); // enemies still alive — no new spawn
    expect(s.enemies.length).toBe(count);
    expect(s.currentWave).toBe(1);
  });

  it('advances wave and respawns when all enemies are dead', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s); // wave 1
    s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
    tickSurvivalWaves(s); // should advance to wave 2
    expect(s.currentWave).toBe(2);
    expect(s.enemies.some(e => e.isAlive)).toBe(true);
  });

  it('adds survivalScore when advancing wave', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s); // wave 1
    const enemyCount = s.enemies.length;
    s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
    tickSurvivalWaves(s); // clear wave 1, award score
    expect(s.survivalScore).toBe(enemyCount * 100 * 1);
  });

  it('enemy count scales with wave number (wave 10 has more than wave 1)', () => {
    const s = createSurvivalState('adventurer', 1);
    tickSurvivalWaves(s); // wave 1
    const w1Count = s.enemies.length;
    // fast-forward to wave 10
    for (let w = 1; w < 10; w++) {
      s.enemies.forEach(e => { e.hp = 0; e.isAlive = false; });
      tickSurvivalWaves(s);
    }
    expect(s.enemies.filter(e => e.isAlive).length).toBeGreaterThan(w1Count);
  });
});
```

- [ ] **Step 2: Run tests — expect failure (module not found)**

```bash
npm test -- survival
```

Expected: FAIL — `Cannot find module '../survivalWaves'`

- [ ] **Step 3: Implement survivalWaves.ts**

Create `packages/shared/src/simulation/survivalWaves.ts`:

```typescript
import type { SimState, ActorKind } from './types';
import { createEnemyActor } from './simulation';

const ENEMY_SPAWN_Y_RANGE = [80, 340] as const;

// Guild-based enemies by difficulty tier
const TIER_1: ActorKind[] = ['plains_bandit', 'bandit_archer', 'adventurer', 'knight'];
const TIER_2: ActorKind[] = ['bandit_brute', 'mage', 'druid', 'hunter', 'monk', 'viking'];
const TIER_3: ActorKind[] = ['champion', 'darkmage', 'master', 'vampire', 'cultist'];

function tierForWave(wave: number): ActorKind[] {
  if (wave <= 4) return TIER_1;
  if (wave <= 9) return TIER_2;
  return TIER_3;
}

function pickKind(tier: ActorKind[], rng: () => number): ActorKind {
  return tier[Math.floor(rng() * tier.length)];
}

export function spawnSurvivalWave(state: SimState): void {
  const wave = state.currentWave;
  const count = Math.min(8, 2 + Math.floor(wave * 0.6));
  const tier = tierForWave(wave);
  const isBossWave = wave > 0 && wave % 5 === 0;

  // Clear dead bodies from previous wave
  state.enemies = [];

  for (let i = 0; i < count; i++) {
    const kind = pickKind(tier, state.rng);
    const spawnX = state.player.x + 350 + i * 90;
    const spawnY =
      ENEMY_SPAWN_Y_RANGE[0] +
      state.rng() * (ENEMY_SPAWN_Y_RANGE[1] - ENEMY_SPAWN_Y_RANGE[0]);
    const enemy = createEnemyActor(kind, spawnX, spawnY, state);

    if (isBossWave && i === 0) {
      // Boss variant: boosted HP
      enemy.hp = Math.round(enemy.hp * 1.5);
      enemy.hpMax = enemy.hp;
      enemy.hpDark = enemy.hp;
    }

    state.enemies.push(enemy);
  }
}

/**
 * Called every tick (in story branch) when survivalMode is true.
 * Spawns a new wave when all current enemies are dead, awarding score first.
 */
export function tickSurvivalWaves(state: SimState): void {
  const anyAlive = state.enemies.some(e => e.isAlive);
  if (anyAlive) return;

  // Award score for the just-cleared wave before spawning the next
  if (state.currentWave > 0) {
    const deadCount = state.enemies.length; // enemies from the wave just cleared
    state.survivalScore += deadCount * 100 * state.currentWave;
  }

  state.currentWave += 1;
  spawnSurvivalWave(state);
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- survival
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Run golden test — must still pass**

```bash
npm test -- golden
```

Expected: PASS. If it fails, `survivalWaves.ts` introduced non-determinism — check for `Math.random()` usage.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/survivalWaves.ts packages/shared/src/simulation/__tests__/survival.test.ts
git commit -m "feat(sim): add survivalWaves — tickSurvivalWaves + spawnSurvivalWave"
```

---

## Task 3: Patch tickSimulation to call tickSurvivalWaves

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Import tickSurvivalWaves**

At the top of `packages/shared/src/simulation/simulation.ts`, add:

```typescript
import { tickSurvivalWaves } from './survivalWaves';
```

- [ ] **Step 2: Replace tickWaves call with survival-aware dispatch**

Find the call to `tickWaves(state)` in the story-mode branch of `tickSimulation`. It appears in the main tick body. Replace:

```typescript
  tickWaves(state);
```

with:

```typescript
  if (state.survivalMode) {
    tickSurvivalWaves(state);
  } else {
    tickWaves(state);
  }
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test
```

Expected: All tests pass including golden.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts
git commit -m "feat(sim): dispatch to tickSurvivalWaves when survivalMode"
```

---

## Task 4: Phaser boot — survivalMode registry flag

**Files:**
- Modify: `src/game/PhaserGame.ts`
- Modify: `src/game/scenes/GameplayScene.ts`

- [ ] **Step 1: Add survivalMode to GameBootConfig**

In `src/game/PhaserGame.ts`, extend `GameBootConfig`:

```typescript
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
  /** True when game mode is 'surv'. Initialises sim via createSurvivalState. */
  survivalMode?: boolean;
}
```

- [ ] **Step 2: Set registry value in makePhaserGame**

In `makePhaserGame`, after the existing `game.registry.set('difficulty', ...)` line:

```typescript
  game.registry.set('survivalMode', boot.survivalMode ?? false);
```

- [ ] **Step 3: Read survivalMode in GameplayScene init**

In `src/game/scenes/GameplayScene.ts`, find the `create()` method around lines 119-126:

```typescript
    if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      const difficulty = (this.game.registry.get('difficulty') as number | null) ?? 2;
      this.simState = createVsState(guildId, p2, stageId, seed, false, difficulty);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
```

Replace with:

```typescript
    if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      const difficulty = (this.game.registry.get('difficulty') as number | null) ?? 2;
      this.simState = createVsState(guildId, p2, stageId, seed, false, difficulty);
    } else if (this.game.registry.get('survivalMode')) {
      this.simState = createSurvivalState(guildId, seed);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
```

- [ ] **Step 4: Import createSurvivalState in GameplayScene**

At the top of `src/game/scenes/GameplayScene.ts`, update the import from `simulation`:

```typescript
import {
  createInitialState,
  createSurvivalState,
  tickSimulation,
  resetController,
  forcePause,
  forceResume,
} from '@nannymud/shared/simulation/simulation';
```

- [ ] **Step 5: Handle restart in survival mode**

In `GameplayScene.ts`, find the restart handler (around line 183-187):

```typescript
        resetController(this.simState, 'player');
        this.simState = createInitialState(currentGuild, Date.now());
        resetController(this.simState, 'player');
```

Replace:

```typescript
        resetController(this.simState, 'player');
        if (this.game.registry.get('survivalMode')) {
          this.simState = createSurvivalState(currentGuild, Date.now());
        } else {
          this.simState = createInitialState(currentGuild, Date.now());
        }
        resetController(this.simState, 'player');
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/game/PhaserGame.ts src/game/scenes/GameplayScene.ts
git commit -m "feat(phaser): survivalMode registry flag → createSurvivalState on boot"
```

---

## Task 5: AppState routing + SurvivalHUD

**Files:**
- Modify: `src/state/useAppState.ts`
- Create: `src/screens/SurvivalHUD.tsx`

- [ ] **Step 1: Add survresults screen + survival fields to AppState**

In `src/state/useAppState.ts`, update `AppScreen`:

```typescript
export type AppScreen =
  | 'title' | 'menu' | 'charselect' | 'team' | 'stage' | 'game'
  | 'pause' | 'results' | 'moves' | 'guild_dossier' | 'settings'
  | 'mp_hub' | 'mp_lobby' | 'mp_cs' | 'mp_stage' | 'mp_load' | 'mp_battle' | 'mp_results'
  | 'survresults';
```

Add fields to `AppState`:

```typescript
export interface AppState {
  // ... existing fields ...
  survivalScore: number;
  survivalWave: number;
}
```

Add defaults to `DEFAULT_STATE`:

```typescript
const DEFAULT_STATE: AppState = {
  // ... existing defaults ...
  survivalScore: 0,
  survivalWave: 0,
};
```

- [ ] **Step 2: Create SurvivalHUD overlay**

Create `src/screens/SurvivalHUD.tsx`:

```typescript
import { useEffect, useState } from 'react';
import type Phaser from 'phaser';
import type { SimState } from '@nannymud/shared/simulation/types';
import { theme } from '../ui';

interface Props {
  game: Phaser.Game;
}

export function SurvivalHUD({ game }: Props) {
  const [wave, setWave] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const scene = game.scene.getScene('Gameplay');
    if (!scene) return;

    const onTick = (sim: SimState) => {
      setWave(sim.currentWave);
      setScore(sim.survivalScore);
    };
    scene.events.on('sim-tick', onTick);
    return () => { scene.events.off('sim-tick', onTick); };
  }, [game]);

  return (
    <div style={{
      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 24px',
      background: `${theme.bgDeep}cc`,
      border: `1px solid ${theme.lineSoft}`,
      borderTop: 'none',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
        SURVIVAL
      </div>
      <div style={{ fontFamily: theme.fontDisplay, fontSize: 28, color: theme.accent, letterSpacing: '-0.02em', lineHeight: 1 }}>
        WAVE {String(wave).padStart(2, '0')}
      </div>
      <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkDim, letterSpacing: 2, marginTop: 2 }}>
        {score.toLocaleString()} PTS
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
git add src/state/useAppState.ts src/screens/SurvivalHUD.tsx
git commit -m "feat(ui): survresults AppScreen + SurvivalHUD wave/score overlay"
```

---

## Task 6: SurvivalResultsScreen

**Files:**
- Create: `src/screens/SurvivalResultsScreen.tsx`

- [ ] **Step 1: Create SurvivalResultsScreen**

Create `src/screens/SurvivalResultsScreen.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { theme, GuildMonogram, Btn, SectionLabel } from '../ui';
import { GUILD_META } from '../data/guildMeta';

interface LeaderboardEntry {
  score: number;
  wave: number;
  date: string;
}

interface Props {
  guildId: GuildId;
  score: number;
  wave: number;
  onRetry: () => void;
  onMenu: () => void;
}

const STORAGE_KEY = (gid: GuildId) => `nannymud-surv-scores-${gid}`;
const MAX_ENTRIES = 10;

function loadEntries(gid: GuildId): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(gid));
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntry(gid: GuildId, entry: LeaderboardEntry): LeaderboardEntry[] {
  const entries = loadEntries(gid);
  const updated = [...entries, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY(gid), JSON.stringify(updated));
  } catch { /* storage full */ }
  return updated;
}

export function SurvivalResultsScreen({ guildId, score, wave, onRetry, onMenu }: Props) {
  const guild = GUILDS.find(g => g.id === guildId) ?? GUILDS[0];
  const meta = GUILD_META[guildId];

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const isNewRecord = useMemo(() => {
    const current = loadEntries(guildId);
    return current.length === 0 || score > current[0].score;
  }, [guildId, score]);

  useEffect(() => {
    const updated = saveEntry(guildId, {
      score,
      wave,
      date: new Date().toLocaleDateString(),
    });
    setEntries(updated);
  }, [guildId, score, wave]);

  const playerRank = entries.findIndex(e => e.score === score && e.wave === wave) + 1;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '20px 36px', borderBottom: `1px solid ${theme.lineSoft}`, display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>GAME OVER · SURVIVAL</div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 48, color: theme.bad, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 4 }}>
            Wave {wave} Reached
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: theme.accent, letterSpacing: 2 }}>
              SCORE · {score.toLocaleString()}
            </span>
            {isNewRecord && (
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.good, letterSpacing: 2, border: `1px solid ${theme.good}`, padding: '2px 6px' }}>
                ★ NEW RECORD
              </span>
            )}
            {playerRank > 0 && (
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2, border: `1px solid ${theme.lineSoft}`, padding: '2px 6px' }}>
                RANK #{playerRank}
              </span>
            )}
          </div>
        </div>
        <GuildMonogram guild={guild} meta={meta} size={120} selected />
      </div>

      {/* Leaderboard */}
      <div style={{ flex: 1, padding: '20px 36px', overflow: 'auto' }}>
        <SectionLabel kicker="LOCAL LEADERBOARD" right={guild.name.toUpperCase()}>
          Best runs
        </SectionLabel>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
          {entries.length === 0 ? (
            <div style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 2, padding: '20px 0' }}>
              NO ENTRIES YET
            </div>
          ) : entries.map((e, i) => {
            const isYou = e.score === score && e.wave === wave;
            const maxScore = entries[0].score;
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 80px 80px', gap: 14, padding: '10px 0', borderBottom: `1px solid ${theme.lineSoft}`, alignItems: 'center', background: isYou ? `${theme.accent}0a` : 'transparent' }}>
                <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: i === 0 ? theme.accent : theme.inkDim }}>{i + 1}</span>
                <div style={{ position: 'relative', height: 6, background: theme.line }}>
                  <div style={{ position: 'absolute', inset: 0, width: `${(e.score / maxScore) * 100}%`, background: i === 0 ? theme.accent : theme.inkDim }} />
                </div>
                <span style={{ fontFamily: theme.fontMono, fontSize: 13, color: theme.ink, textAlign: 'right' }}>
                  {e.score.toLocaleString()}
                </span>
                <span style={{ fontFamily: theme.fontMono, fontSize: 11, color: theme.inkMuted, letterSpacing: 1, textAlign: 'right' }}>
                  WV·{String(e.wave).padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 36px', borderTop: `1px solid ${theme.lineSoft}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn onClick={onMenu}>← MENU</Btn>
        <Btn primary onClick={onRetry}>RETRY →</Btn>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. If `GUILD_META` doesn't have the shape needed by `GuildMonogram`, adjust the import to match existing patterns from other screens like `CharSelect.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SurvivalResultsScreen.tsx
git commit -m "feat(ui): SurvivalResultsScreen with localStorage leaderboard"
```

---

## Task 7: Patch GameScreen + wire App.tsx

**Files:**
- Modify: `src/screens/GameScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add survival props to GameScreen**

In `src/screens/GameScreen.tsx`, extend the `Props` interface:

```typescript
interface Props {
  mode: SimMode;
  p1: GuildId;
  p2?: GuildId;
  stageId: string;
  animateHud: boolean;
  difficulty?: number;
  matchRoom?: Room<MatchState>;
  onVictory: (score: number, matchStats: MatchStats) => void;
  onDefeat: (matchStats: MatchStats) => void;
  onQuit: () => void;
  /** Pass true when gameMode === 'surv'. Enables survivalMode registry flag and survival defeat path. */
  survivalMode?: boolean;
  /** Called in place of onDefeat when survivalMode is true. Receives final score and wave reached. */
  onSurvivalEnd?: (score: number, wave: number) => void;
}
```

- [ ] **Step 2: Pass survivalMode to makePhaserGame**

In `GameScreen`, find the `makePhaserGame` call and add `survivalMode`:

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
    });
```

- [ ] **Step 3: Handle survival defeat in callbacks**

In `GameScreen`, the `onDefeat` callback inside the `useEffect` currently calls:

```typescript
onDefeat: (matchStats) => {
  if (mode === 'story') {
    setShowStoryGameOver(true);
  } else {
    onDefeatRef.current(matchStats);
  }
},
```

Replace with:

```typescript
onDefeat: (matchStats) => {
  if (survivalMode) {
    const sim = gameRef.current?.registry.get('simState') as SimState | undefined;
    onSurvivalEndRef.current?.(sim?.survivalScore ?? 0, sim?.currentWave ?? 0);
  } else if (mode === 'story') {
    setShowStoryGameOver(true);
  } else {
    onDefeatRef.current(matchStats);
  }
},
```

Add a ref for `onSurvivalEnd` (same pattern as `onVictoryRef`):

```typescript
const onSurvivalEndRef = useRef(onSurvivalEnd);
useEffect(() => { onSurvivalEndRef.current = onSurvivalEnd; }, [onSurvivalEnd]);
```

Add `import type { SimState } from '@nannymud/shared/simulation/types';` if not already imported.

- [ ] **Step 4: Mount SurvivalHUD when survivalMode**

In `GameScreen`'s JSX return, after the `HudOverlay` (or wherever the VS HUD is conditionally mounted), add:

```typescript
{survivalMode && gameReady && gameRef.current && (
  <SurvivalHUD game={gameRef.current} />
)}
```

Import `SurvivalHUD` at the top:

```typescript
import { SurvivalHUD } from './SurvivalHUD';
```

- [ ] **Step 5: Add survival routing to App.tsx**

In `src/App.tsx`, update the `game` screen block:

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
            onQuit={() => go('menu')}
          />
        )}
```

Add the `survresults` screen:

```typescript
        {state.screen === 'survresults' && (
          <SurvivalResultsScreen
            guildId={state.p1}
            score={state.survivalScore}
            wave={state.survivalWave}
            onRetry={() => go('game')}
            onMenu={() => go('menu')}
          />
        )}
```

Import at the top of `App.tsx`:

```typescript
import { SurvivalResultsScreen } from './screens/SurvivalResultsScreen';
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens/GameScreen.tsx src/App.tsx
git commit -m "feat(ui): wire survival mode end → SurvivalResultsScreen"
```

---

## Task 8: Enable Survival in MainMenu

**Files:**
- Modify: `src/screens/MainMenu.tsx`

- [ ] **Step 1: Set surv to enabled**

In `src/screens/MainMenu.tsx`, find the `MENU_ITEMS` array. Change the `surv` entry:

```typescript
  { id: 'surv', label: 'SURVIVAL', sub: 'Endless waves, ranked table', target: 'charselect', mode: 'surv', enabled: true },
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/MainMenu.tsx
git commit -m "feat: enable survival mode in main menu"
```

---

## Manual Test Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Navigate: Title → Menu → SURVIVAL → CharSelect (P2 panel hidden) → pick guild → Stage → game starts
- [ ] Verify wave badge appears top-center showing "WAVE 01" and "0 PTS"
- [ ] Kill all enemies: wave 02 spawns, score increments
- [ ] Let player die: `SurvivalResultsScreen` appears with wave reached, score, and leaderboard row
- [ ] Click RETRY: game restarts at wave 01 with score 0
- [ ] Play again and score higher: leaderboard reorders, "★ NEW RECORD" badge shows
- [ ] Wave 5 boss: first enemy has noticeably more HP (1.5× boost)
- [ ] Wave 10+ enemies: tier 3 guilds appear (Champion, Darkmage, Master, etc.)
- [ ] Run `npm test` — all pass
