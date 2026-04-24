# Battle Mode Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 battle-mode gaps: team-aware AI targeting, multi-fighter loading screen, 1v1-styled health bars, player controls footer, and stats screen verification.

**Architecture:** Issues 1–2 are pure simulation fixes (packages/shared). Issues 3–4 are UI additions (new BattleLoadingScreen component; HudFooter + mobile controls stitched into BattleHUD8). Issue 5 is confirmed working — no code change needed.

**Tech Stack:** TypeScript, React 18, Phaser 3, Vitest, @nannymud/shared simulation package.

**Spec:** `docs/superpowers/specs/2026-04-24-battle-mode-polish-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `packages/shared/src/simulation/types.ts` | Add `battleTeam?: BattleTeam` to `Actor` |
| Modify | `packages/shared/src/simulation/battleSimulation.ts` | Set `battleTeam` on player + CPUs at spawn |
| Modify | `packages/shared/src/simulation/ai.ts` | Team-aware `findTarget()` for tickAI path |
| Modify | `packages/shared/src/simulation/vsAI.ts` | Team-aware target selection in CPU VS path |
| Modify | `packages/shared/src/simulation/simulation.ts` | Victory check filters out teammates |
| Modify | `packages/shared/src/simulation/__tests__/battle.test.ts` | Tests for team targeting + victory |
| Create | `src/screens/BattleLoadingScreen.tsx` | 2×4 grid loading screen, per-card progress |
| Modify | `src/screens/LoadingScreen.tsx` | Export `TIPS` array for reuse |
| Modify | `src/screens/GameScreen.tsx` | Use `BattleLoadingScreen` when `battleMode` |
| Modify | `src/screens/BattleHUD8.tsx` | Restyled cards + `HudFooter` + mobile controls |

---

## Task 1: Add `battleTeam` to Actor and set it at spawn

**Files:**
- Modify: `packages/shared/src/simulation/types.ts` (Actor interface, around line 238)
- Modify: `packages/shared/src/simulation/battleSimulation.ts` (createBattleState, around lines 22–44)

- [ ] **Step 1: Add `battleTeam` field to Actor**

In `packages/shared/src/simulation/types.ts`, find the `Actor` interface. After the `isAlive: boolean;` line (currently line 237), add:

```typescript
  battleTeam?: BattleTeam;
```

The full tail of the Actor interface should now read:

```typescript
  isAlive: boolean;
  deathTimeMs: number;
  score: number;
  battleTeam?: BattleTeam;
}
```

- [ ] **Step 2: Set `battleTeam` in `createBattleState()`**

In `packages/shared/src/simulation/battleSimulation.ts`, replace the entire function body with:

```typescript
export function createBattleState(
  humanGuildId: GuildId,
  slots: BattleSlot[],
  _stageId: string,
  seed: number = Date.now(),
): SimState {
  const state = createInitialState(humanGuildId, seed);

  state.waves = [];
  state.currentWave = -1;
  state.bossSpawned = false;
  state.battleMode = true;
  state.battleSlots = slots;
  state.battleTimer = BATTLE_TIMER_MS;
  state.battStats = { [state.player.id]: makeEmptyBattStat() };

  // Assign battleTeam to the human player from their slot.
  const humanSlot = slots.find((s) => s.type === 'human');
  if (humanSlot) state.player.battleTeam = humanSlot.team ?? undefined;

  const cpuSlots = slots.filter((s) => s.type === 'cpu');
  for (let i = 0; i < cpuSlots.length; i++) {
    const slot = cpuSlots[i];
    const actor = createPlayerActor(slot.guildId);
    actor.id = `battle_${state.nextActorId++}`;
    actor.team = 'enemy';
    actor.isPlayer = true;
    actor.battleTeam = slot.team ?? undefined;
    actor.x = PLAYER_SPAWN_X + ENEMY_SPAWN_START_OFFSET + i * ENEMY_SPAWN_SPACING;
    actor.y = PLAYER_SPAWN_Y + ((i % 3) - 1) * 40;
    actor.facing = -1;
    actor.aiState = { ...actor.aiState, behavior: 'chaser', targetId: 'player' };
    state.enemies.push(actor);
    state.battStats[actor.id] = makeEmptyBattStat();
  }

  return state;
}
```

- [ ] **Step 3: Run typecheck to confirm no errors**

```bash
npm run typecheck
```

Expected: no errors. `battleTeam` is optional so existing code that constructs `Actor` objects without it is fine.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/battleSimulation.ts
git commit -m "feat(battle): add battleTeam to Actor, set at spawn"
```

---

## Task 2: Team-aware targeting — simulation logic + tests

**Files:**
- Modify: `packages/shared/src/simulation/ai.ts` (findTarget, lines 8–19)
- Modify: `packages/shared/src/simulation/vsAI.ts` (synthesizeVsCpuInput, add findVsTarget helper)
- Modify: `packages/shared/src/simulation/simulation.ts` (battle victory block, ~lines 1845–1853)
- Modify: `packages/shared/src/simulation/__tests__/battle.test.ts` (add team tests)

**Key invariant:** Two actors are teammates only when BOTH have a non-null `battleTeam` AND the values match. A null `battleTeam` means "no team" — that actor is a valid target for everyone. This preserves all existing tests (which use `team: null`).

```typescript
// Helper used in both ai.ts and vsAI.ts
function areTeammates(a: Actor, b: Actor): boolean {
  return a.battleTeam != null && b.battleTeam != null && a.battleTeam === b.battleTeam;
}
```

- [ ] **Step 1: Write failing tests for team-aware targeting**

Append to `packages/shared/src/simulation/__tests__/battle.test.ts`:

```typescript
describe('battleTeam assignment', () => {
  it('sets battleTeam on player from human slot', () => {
    const s = createBattleState('adventurer', [
      { guildId: 'adventurer', type: 'human', team: 'A' },
      { guildId: 'knight',     type: 'cpu',   team: 'B' },
    ], 'assembly', 1);
    expect(s.player.battleTeam).toBe('A');
    expect(s.enemies[0].battleTeam).toBe('B');
  });

  it('battleTeam undefined when slot team is null', () => {
    const s = createBattleState('adventurer', [
      { guildId: 'adventurer', type: 'human', team: null },
      { guildId: 'knight',     type: 'cpu',   team: null },
    ], 'assembly', 1);
    expect(s.player.battleTeam).toBeUndefined();
    expect(s.enemies[0].battleTeam).toBeUndefined();
  });
});

describe('team-aware victory condition', () => {
  const teamSlots: BattleSlot[] = [
    { guildId: 'adventurer', type: 'human', team: 'A' },
    { guildId: 'knight',     type: 'cpu',   team: 'A' }, // teammate → enemies[0]
    { guildId: 'mage',       type: 'cpu',   team: 'B' }, // foe      → enemies[1]
  ];

  it('killing only a teammate does not trigger victory', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    s.enemies[0].hp = 0;
    s.enemies[0].isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).not.toBe('victory');
  });

  it('killing all foes triggers victory even when teammate still alive', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    // Kill only the foe (team B mage, enemies[1])
    s.enemies[1].hp = 0;
    s.enemies[1].isAlive = false;
    s = tickSimulation(s, idleInput(), 16);
    expect(s.phase).toBe('victory');
  });

  it('timer resolution: player wins vs foes when player HP > max foe HP', () => {
    let s = createBattleState('adventurer', teamSlots, 'assembly', 1);
    s.battleTimer = 1;
    s.player.hp = 9999;
    s.enemies[1].hp = 1; // foe
    s = tickSimulation(s, idleInput(), 50);
    expect(s.phase).toBe('victory');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- battle
```

Expected: `battleTeam assignment` and `team-aware victory condition` tests fail. Existing tests still pass.

- [ ] **Step 3: Update `findTarget()` in `ai.ts`**

Replace the existing `findTarget` function (lines 8–19):

```typescript
function areTeammateActors(a: Actor, b: Actor): boolean {
  return a.battleTeam != null && b.battleTeam != null && a.battleTeam === b.battleTeam;
}

function findTarget(actor: Actor, state: SimState): Actor | null {
  let candidates: Actor[];
  if (state.battleMode) {
    candidates = [state.player, ...state.enemies].filter(
      (a) => a.isAlive && a.id !== actor.id && !areTeammateActors(a, actor),
    );
  } else {
    candidates = (actor.team === 'enemy'
      ? [state.player, ...state.allies].filter((a) => a.isAlive)
      : state.enemies.filter((a) => a.isAlive)
    );
  }
  candidates = candidates.filter((a) => !a.statusEffects.some((e) => e.type === 'stealth'));
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, t) => {
    const dCurrent = Math.hypot(t.x - actor.x, t.y - actor.y);
    const dBest = Math.hypot(closest.x - actor.x, closest.y - actor.y);
    return dCurrent < dBest ? t : closest;
  });
}
```

- [ ] **Step 4: Add `findVsTarget()` helper and update `synthesizeVsCpuInput()` in `vsAI.ts`**

After the imports and before `createEmptyCpuInput`, add:

```typescript
function areTeammateActors(a: Actor, b: Actor): boolean {
  return a.battleTeam != null && b.battleTeam != null && a.battleTeam === b.battleTeam;
}

function findVsTarget(state: SimState, opp: Actor): Actor | null {
  const candidates = [state.player, ...state.enemies].filter(
    (a) => a.isAlive && a.id !== opp.id && !areTeammateActors(a, opp),
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, t) => {
    const dc = Math.hypot(t.x - opp.x, t.y - opp.y);
    const db = Math.hypot(closest.x - opp.x, closest.y - opp.y);
    return dc < db ? t : closest;
  });
}
```

In `synthesizeVsCpuInput`, replace line 4 of the function body:

```typescript
// BEFORE:
const player = state.player;

// AFTER:
const player = state.battleMode
  ? (findVsTarget(state, opp) ?? state.player)
  : state.player;
```

- [ ] **Step 5: Update battle victory check in `simulation.ts`**

Find the battle victory block (around line 1845):

```typescript
  if (state.battleMode) {
    state.battleTimer = Math.max(0, state.battleTimer - dtMs);

    if (state.enemies.length > 0 && state.enemies.every((e) => !e.isAlive)) {
      state.phase = 'victory';
    } else if (state.battleTimer === 0) {
      const maxEnemyHp = state.enemies.reduce((m, e) => Math.max(m, e.hp), 0);
      state.phase = state.player.hp > maxEnemyHp ? 'victory' : 'defeat';
    }
  }
```

Replace with:

```typescript
  if (state.battleMode) {
    state.battleTimer = Math.max(0, state.battleTimer - dtMs);

    // Foes = enemies NOT on the player's team. Null teamates (no team assigned)
    // are always foes — only same non-null battleTeam means ally.
    const foes = state.enemies.filter(
      (e) => !(e.battleTeam != null && state.player.battleTeam != null && e.battleTeam === state.player.battleTeam),
    );

    if (foes.length > 0 && foes.every((e) => !e.isAlive)) {
      state.phase = 'victory';
    } else if (state.battleTimer === 0) {
      const maxFoeHp = foes.reduce((m, e) => Math.max(m, e.hp), 0);
      state.phase = state.player.hp > maxFoeHp ? 'victory' : 'defeat';
    }
  }
```

- [ ] **Step 6: Run all tests to confirm everything passes**

```bash
npm test
```

Expected: all tests pass including the new team-targeting tests and existing golden/battle tests.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/ai.ts packages/shared/src/simulation/vsAI.ts packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/battle.test.ts
git commit -m "feat(battle): team-aware AI targeting and victory condition"
```

---

## Task 3: Export TIPS and create BattleLoadingScreen

**Files:**
- Modify: `src/screens/LoadingScreen.tsx` (export TIPS)
- Create: `src/screens/BattleLoadingScreen.tsx`

- [ ] **Step 1: Export TIPS from LoadingScreen**

In `src/screens/LoadingScreen.tsx`, change:

```typescript
// BEFORE:
const TIPS = [
```

```typescript
// AFTER:
export const TIPS = [
```

- [ ] **Step 2: Create `BattleLoadingScreen.tsx`**

Create `src/screens/BattleLoadingScreen.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import type { BattleSlot } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { GUILD_META } from '../data/guildMeta';
import { STAGES_BY_ID } from '../data/stages';
import type { StageId } from '../data/stages';
import { theme, guildAccent, GuildMonogram } from '../ui';
import { TIPS } from './LoadingScreen';

const TEAM_COLORS: Record<string, string> = {
  A: theme.team1,
  B: theme.team2,
  C: theme.team3,
  D: theme.team4,
};

function makeSimDurationsMs(count: number): number[] {
  return Array.from({ length: count }, () => 600 + Math.random() * 1400);
}

interface Props {
  slots: BattleSlot[];
  stageId: StageId;
  /** 0–1 actual Phaser asset load progress for the human player. */
  humanProgress: number;
}

export function BattleLoadingScreen({ slots, stageId, humanProgress }: Props) {
  const stage = STAGES_BY_ID[stageId];
  const accent = `oklch(0.72 0.18 ${stage.hue})`;
  const simDurationsRef = useRef(makeSimDurationsMs(slots.length));
  const startRef = useRef(performance.now());
  const [cpuProgress, setCpuProgress] = useState<number[]>(() => slots.map(() => 0));
  const [tipIdx, setTipIdx] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      let allDone = true;
      const next = slots.map((s, i) => {
        if (s.type !== 'cpu') return 0;
        const p = Math.min(1, elapsed / simDurationsRef.current[i]);
        if (p < 1) allDone = false;
        return p;
      });
      setCpuProgress(next);
      if (!allDone) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 1400);
    return () => clearInterval(id);
  }, []);

  const getProgress = (slot: BattleSlot, i: number): number => {
    if (slot.type === 'human') return humanProgress;
    if (slot.type === 'cpu') return cpuProgress[i] ?? 0;
    return 1; // 'off' slots are shown as complete/placeholder
  };

  const row1 = slots.slice(0, 4);
  const row2 = slots.slice(4, 8);

  return (
    <div
      style={{
        width: '100%', height: '100%', position: 'relative',
        background: `linear-gradient(180deg, ${accent}22, ${theme.bgDeep} 70%)`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* hatching overlay */}
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `repeating-linear-gradient(135deg, transparent 0 22px, ${accent}12 22px 23px)`,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '16px 32px',
          borderBottom: `1px solid ${theme.lineSoft}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          position: 'relative',
        }}
      >
        <div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            NOW LOADING · BATTLE
          </div>
          <div style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, letterSpacing: '-0.01em', marginTop: 2 }}>
            {stage.name}
          </div>
        </div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>
          HUE · {stage.hue}°
        </div>
      </div>

      {/* Fighter grid — 1 or 2 rows of 4 */}
      <div
        style={{
          flex: 1, position: 'relative',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 10, padding: '16px 24px',
        }}
      >
        <FighterRow slots={row1} slotOffset={0} getProgress={getProgress} />
        {row2.length > 0 && (
          <FighterRow slots={row2} slotOffset={4} getProgress={getProgress} />
        )}
      </div>

      {/* Tips footer */}
      <div
        style={{
          position: 'relative',
          padding: '14px 32px 18px',
          borderTop: `1px solid ${theme.lineSoft}`,
          background: theme.bgDeep,
        }}
      >
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
          ▸ ADVICE FROM THE WIZARDS
        </div>
        <div
          key={tipIdx}
          style={{
            fontFamily: theme.fontBody, fontSize: 13, color: theme.inkDim,
            fontStyle: 'italic', lineHeight: 1.55, marginTop: 4,
          }}
        >
          {TIPS[tipIdx]}
        </div>
      </div>
    </div>
  );
}

interface RowProps {
  slots: BattleSlot[];
  slotOffset: number;
  getProgress: (slot: BattleSlot, i: number) => number;
}

function FighterRow({ slots, slotOffset, getProgress }: RowProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${slots.length}, 1fr)`, gap: 10 }}>
      {slots.map((slot, i) => (
        <FighterCard key={i} slot={slot} progress={getProgress(slot, i + slotOffset)} />
      ))}
    </div>
  );
}

interface CardProps {
  slot: BattleSlot;
  progress: number;
}

function FighterCard({ slot, progress }: CardProps) {
  const isOff = slot.type === 'off';
  const isHuman = slot.type === 'human';
  const meta = isOff ? null : GUILD_META[slot.guildId];
  const guild = isOff ? null : GUILDS.find((g) => g.id === slot.guildId);
  const cardAccent = meta ? guildAccent(meta.hue) : theme.lineSoft;
  const teamColor = slot.team ? TEAM_COLORS[slot.team] : cardAccent;
  const borderColor = isHuman ? theme.accent : teamColor;
  const pct = Math.round(progress * 100);
  const ready = progress >= 1;

  if (isOff) {
    return (
      <div
        style={{
          padding: '14px 16px',
          border: `1px solid ${theme.lineSoft}`,
          background: theme.bgDeep,
          opacity: 0.25,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 88,
        }}
      >
        <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 2 }}>
          —
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${borderColor}`,
        background: isHuman ? `${theme.accent}0a` : theme.bgDeep,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Identity row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <GuildMonogram guildId={slot.guildId} size={48} selected={ready} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: theme.fontDisplay, fontSize: 18, color: theme.ink,
              letterSpacing: '-0.01em', lineHeight: 1.1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {guild?.name ?? slot.guildId}
          </div>
          <div style={{ fontFamily: theme.fontMono, fontSize: 9, color: teamColor, letterSpacing: 2, marginTop: 2 }}>
            {meta?.tag.toUpperCase() ?? ''}
          </div>
        </div>
        <div
          style={{
            marginLeft: 'auto', fontFamily: theme.fontMono, fontSize: 10, letterSpacing: 2,
            color: ready ? theme.good : theme.warn, flexShrink: 0,
          }}
        >
          {ready ? 'READY' : 'LOADING…'}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: theme.fontMono, fontSize: 9, color: theme.inkMuted, letterSpacing: 2,
          }}
        >
          <span>PROGRESS</span>
          <span style={{ color: ready ? cardAccent : theme.ink }}>{pct}%</span>
        </div>
        <div
          style={{
            width: '100%', height: 8,
            background: theme.bgDeep, border: `1px solid ${theme.lineSoft}`,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: `${pct}%`,
              background: isHuman ? theme.accent : cardAccent,
              transition: 'width 80ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LoadingScreen.tsx src/screens/BattleLoadingScreen.tsx
git commit -m "feat(battle): BattleLoadingScreen with 2x4 grid and per-card progress"
```

---

## Task 4: Wire BattleLoadingScreen into GameScreen

**Files:**
- Modify: `src/screens/GameScreen.tsx` (loading screen conditional, ~lines 283–293)

- [ ] **Step 1: Add import at the top of GameScreen.tsx**

After the existing `import { LoadingScreen } from './LoadingScreen';` line, add:

```typescript
import { BattleLoadingScreen } from './BattleLoadingScreen';
```

- [ ] **Step 2: Replace the loading screen render block**

Find the preloading block (around lines 283–293):

```typescript
      {preloading && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <LoadingScreen
            p1={p1}
            p2={p2 ?? 'knight'}
            stageId={stageId as StageId}
            showOpponent={mode === 'vs'}
            progress={loadProgress}
          />
        </div>
      )}
```

Replace with:

```typescript
      {preloading && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {battleMode && battleSlots ? (
            <BattleLoadingScreen
              slots={battleSlots}
              stageId={stageId as StageId}
              humanProgress={loadProgress ?? 0}
            />
          ) : (
            <LoadingScreen
              p1={p1}
              p2={p2 ?? 'knight'}
              stageId={stageId as StageId}
              showOpponent={mode === 'vs'}
              progress={loadProgress}
            />
          )}
        </div>
      )}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "feat(battle): use BattleLoadingScreen when battleMode"
```

---

## Task 5: Restyle BattleHUD8 health bar cards

**Files:**
- Modify: `src/screens/BattleHUD8.tsx` (PlayerBarRow + card inner styles)

The target style matches `HudTopBar`: bigger HP bar (10px), MP bar (5px), HP/MP numeric readouts in monospace, full guild name, guild tag below name.

**Note on HP color:** Keep the existing dynamic `hpColor` (good/warn/bad based on HP%) — it's more useful than a static team color when monitoring 8 fighters simultaneously.

- [ ] **Step 1: Update the card rendering inside `PlayerBarRow`**

Replace the entire `PlayerBarRow` function with:

```typescript
function PlayerBarRow({ slots, slotOffset, getActor, isTop, bottomOffset = 0 }: BarRowProps) {
  return (
    <div style={{
      position: 'absolute',
      top: isTop ? 0 : undefined,
      bottom: isTop ? undefined : bottomOffset,
      left: 0, right: 0,
      display: 'grid',
      gridTemplateColumns: `repeat(${slots.length}, 1fr)`,
      gap: 3,
      padding: '5px 8px',
      background: theme.panel,
      borderBottom: isTop ? `1px solid ${theme.line}` : 'none',
      borderTop: isTop ? 'none' : `1px solid ${theme.line}`,
    }}>
      {slots.map((slot, i) => {
        const actor = getActor(i + slotOffset);
        const isHuman = slot.type === 'human';
        const teamColor = slot.team ? TEAM_COLORS[slot.team] : theme.lineSoft;
        const borderColor = isHuman ? theme.accent : teamColor;
        const hpPct = actor ? actor.hp / Math.max(1, actor.hpMax) : 0;
        const mpPct = actor ? actor.mp / Math.max(1, actor.mpMax) : 0;
        const isDead = actor ? !actor.isAlive : true;
        const hpColor = hpPct > 0.35 ? theme.good : hpPct > 0.15 ? theme.warn : theme.bad;
        const guild = GUILDS.find((g) => g.id === slot.guildId);
        const guildName = guild?.name ?? slot.guildId;

        return (
          <div key={i} style={{
            padding: '5px 6px',
            border: `1px solid ${borderColor}`,
            background: isDead ? `${theme.bad}11` : (isHuman ? `${theme.accent}08` : theme.bgDeep),
            opacity: isDead ? 0.4 : 1,
            display: 'grid', gridTemplateColumns: '26px 1fr', gap: 5,
            alignItems: 'start',
          }}>
            <GuildMonogram guildId={slot.guildId} size={26} selected={isHuman} dim={isDead} />
            <div style={{ minWidth: 0 }}>
              {/* Name + KO row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontFamily: theme.fontMono, fontSize: 8,
                  color: isHuman ? theme.accent : (slot.team ? teamColor : theme.ink),
                  letterSpacing: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {guildName.slice(0, 9).toUpperCase()}
                </span>
                {isDead && (
                  <span style={{ fontFamily: theme.fontMono, fontSize: 7, color: theme.bad, letterSpacing: 1, flexShrink: 0 }}>
                    KO
                  </span>
                )}
              </div>
              {/* HP bar */}
              <div style={{ marginTop: 3 }}>
                <div style={{ height: 10, background: theme.line, position: 'relative', overflow: 'hidden', borderRadius: 1 }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${hpPct * 100}%`,
                    background: hpColor,
                    transition: 'width 150ms linear',
                  }} />
                </div>
                <div style={{
                  fontFamily: theme.fontMono, fontSize: 7, color: theme.inkDim,
                  letterSpacing: 1, marginTop: 2,
                }}>
                  HP {actor ? actor.hp : 0}/{actor ? actor.hpMax : 0}
                </div>
              </div>
              {/* MP bar */}
              <div style={{ marginTop: 3 }}>
                <div style={{ height: 5, background: theme.line, position: 'relative', overflow: 'hidden', borderRadius: 1 }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${mpPct * 100}%`,
                    background: theme.accent,
                    transition: 'width 150ms linear',
                  }} />
                </div>
                <div style={{
                  fontFamily: theme.fontMono, fontSize: 7, color: theme.inkDim,
                  letterSpacing: 1, marginTop: 2,
                }}>
                  MP {actor ? actor.mp : 0}/{actor ? actor.mpMax : 0}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

Also update the `BarRowProps` interface to include `bottomOffset`:

```typescript
interface BarRowProps {
  slots: BattleSlot[];
  slotOffset: number;
  getActor: (i: number) => import('@nannymud/shared/simulation/types').Actor | null;
  isTop: boolean;
  bottomOffset?: number;
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/BattleHUD8.tsx
git commit -m "feat(battle): restyle health bar cards to match 1v1 HUD"
```

---

## Task 6: Add HudFooter and mobile controls to BattleHUD8

**Files:**
- Modify: `src/screens/BattleHUD8.tsx`

`HudFooter` is `position: absolute, bottom: 0, height: 128px`. The bottom `PlayerBarRow` must sit above it at `bottom: 128` to avoid overlap. `TouchJoystick` is at `bottom: 148` and `TouchActionButtons` at `bottom: 168` — both clear the footer naturally.

- [ ] **Step 1: Add imports to BattleHUD8.tsx**

At the top of the file, after existing imports, add:

```typescript
import { HudFooter } from './hud/HudFooter';
import { TouchJoystick } from './hud/TouchJoystick';
import { TouchActionButtons } from './hud/TouchActionButtons';
import { useIsMobile } from '../hooks/useIsMobile';
```

- [ ] **Step 2: Add `useIsMobile()` call to the component (before early return)**

In `BattleHUD8`, add the hook call immediately after the existing hooks and before `const state = stateRef.current`:

```typescript
  const mobile = useIsMobile();

  const state = stateRef.current;
  if (!state) return null;
```

- [ ] **Step 3: Pass `bottomOffset={128}` to the bottom `PlayerBarRow`**

In the JSX, change:

```typescript
// BEFORE:
{bottom.length > 0 && (
  <PlayerBarRow slots={bottom} slotOffset={4} getActor={getActor} isTop={false} />
)}

// AFTER:
{bottom.length > 0 && (
  <PlayerBarRow slots={bottom} slotOffset={4} getActor={getActor} isTop={false} bottomOffset={128} />
)}
```

- [ ] **Step 4: Add HudFooter and mobile controls inside the scaled div**

Add after the bottom `PlayerBarRow` block, still inside the `VIRTUAL_WIDTH × VIRTUAL_HEIGHT` scaled div:

```typescript
        <HudFooter
          mode="vs"
          p1={state.player}
          p2={null}
          simTimeMs={state.timeMs}
          state={state}
        />
        {mobile && <TouchJoystick />}
        {mobile && <TouchActionButtons />}
```

The full scaled div JSX should end as:

```typescript
        {/* BOTTOM bar — offset up by HudFooter height (128px) */}
        {bottom.length > 0 && (
          <PlayerBarRow slots={bottom} slotOffset={4} getActor={getActor} isTop={false} bottomOffset={128} />
        )}
        <HudFooter
          mode="vs"
          p1={state.player}
          p2={null}
          simTimeMs={state.timeMs}
          state={state}
        />
        {mobile && <TouchJoystick />}
        {mobile && <TouchActionButtons />}
      </div>
    </div>
  );
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/screens/BattleHUD8.tsx
git commit -m "feat(battle): add HudFooter and mobile controls to battle mode"
```

---

## Final Verification

- [ ] Start dev server and launch a battle mode match

```bash
npm run dev
```

Checklist:
1. **Loading screen:** Fighter grid (2 rows × up to 4 columns) appears with per-card animated progress bars. Human card fills with real asset load progress. CPU cards animate independently.
2. **Health bars:** Taller HP bars (10px), MP bars (5px), numeric readouts below each bar. KO state at 40% opacity with KO badge.
3. **AI targeting:** CPU fighters assigned to the same team as the player do NOT attack the player. They attack fighters on other teams.
4. **Player controls:** Ability strip visible at bottom during battle. Mobile joystick and J/K buttons appear on mobile. Abilities fire correctly.
5. **Stats screen:** After battle ends, scoreboard shows K/D/DMG/HEAL/SCORE columns with real data.

- [ ] Verify golden sim test still passes (confirms no non-determinism introduced)

```bash
npm test -- golden
```

Expected: PASS (battle-mode changes don't touch story-mode simulation paths that the golden test exercises).
