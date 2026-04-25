# Stage Mode Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform story mode into a locked 9-level progression, with per-stage enemy compositions, guild actors as story enemies, a wired boss phase system, and larger item drops.

**Architecture:** `WaveEnemy` becomes a discriminated union supporting both `EnemyDef` kinds and guild actors. `createInitialState` gains a `stageId` param to select the correct wave set. Guild enemies in the story enemy loop use the existing `synthesizeVsCpuInput`/`handlePlayerInput` pipeline already used by battle and VS modes. Level unlock is tracked in localStorage via a new `useStageProgress` hook.

**Tech Stack:** TypeScript, Vitest, React, Phaser 3. All simulation changes are in `packages/shared/src/simulation/` (pure TS, no DOM). UI changes in `src/screens/` and `src/data/`.

---

### Task 1: Extend types — WaveEnemy union, EnemyDef phases, Actor multipliers

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`

- [ ] **Step 1: Add new boss kinds to `ActorKind`**

In `types.ts` at the `ActorKind` union (currently ends at `'wolf_form'`), append:

```ts
export type ActorKind =
  | 'adventurer' | 'knight' | 'mage' | 'druid' | 'hunter' | 'monk'
  | 'viking' | 'prophet' | 'vampire' | 'cultist' | 'champion' | 'darkmage'
  | 'chef' | 'leper' | 'master'
  | 'plains_bandit' | 'bandit_archer' | 'wolf' | 'bandit_brute' | 'bandit_king'
  | 'wolf_pet' | 'drowned_spawn' | 'rotting_husk' | 'wolf_form'
  | 'giant_blue_wolf' | 'vampire_lord' | 'cult_high_priest' | 'elder_druid'
  | 'plague_darkmage' | 'warlord' | 'shadow_master' | 'bandit_king_ii';
```

- [ ] **Step 2: Change `WaveEnemy` to a discriminated union**

Replace the current `WaveEnemy` interface (around line 382):

```ts
export type WaveEnemy =
  | { kind: ActorKind; count: number; offsetX?: number; offsetY?: number }
  | { guild: GuildId; count: number; difficulty: number };
```

- [ ] **Step 3: Add `phases` to `EnemyDef`**

In the `EnemyDef` interface, add after `projectileRange`:

```ts
  phases?: BossPhase[];
```

- [ ] **Step 4: Add `attackSpeedMult`, `damageMult`, `aiDifficulty` to `Actor`**

In the `Actor` interface, after `bossPhase: number;`:

```ts
  attackSpeedMult?: number;
  damageMult?: number;
  aiDifficulty?: number;
```

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: Errors only from callers of the changed `WaveEnemy` type (will be fixed in later tasks). The `EnemyDef` / `Actor` additions are additive and won't break anything.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/types.ts
git commit -m "feat(types): WaveEnemy union, EnemyDef.phases, Actor multipliers"
```

---

### Task 2: Add 8 new boss EnemyDef entries

**Files:**
- Modify: `packages/shared/src/simulation/enemyData.ts`

- [ ] **Step 1: Add boss definitions to `ENEMY_DEFS`**

In `enemyData.ts`, add after the `rotting_husk` entry (before the closing `}` of `ENEMY_DEFS`):

```ts
  giant_blue_wolf: {
    kind: 'giant_blue_wolf',
    name: 'Giant Blue Wolf',
    color: '#3b82f6',
    initial: 'W',
    hp: 1400,
    armor: 8,
    magicResist: 5,
    moveSpeed: 180,
    damage: 28,
    attackRange: 70,
    attackCooldownMs: 1200,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'rock',
    dropWeaponChance: 1.0,
    width: 90,
    height: 100,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.5, attackSpeedMult: 1.3, damageMult: 1.1,
        summons: [{ kind: 'wolf', count: 4 }], abilities: [] },
    ],
  },
  vampire_lord: {
    kind: 'vampire_lord',
    name: 'Vampire Lord',
    color: '#7c3aed',
    initial: 'V',
    hp: 1800,
    armor: 10,
    magicResist: 15,
    moveSpeed: 130,
    damage: 30,
    attackRange: 65,
    attackCooldownMs: 1000,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'club',
    dropWeaponChance: 1.0,
    width: 50,
    height: 80,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.6, attackSpeedMult: 1.1, damageMult: 1.1,
        summons: [{ kind: 'vampire_lord', count: 0 }], abilities: [] },
      { hpThreshold: 0.3, attackSpeedMult: 1.3, damageMult: 1.5,
        summons: [], abilities: [] },
    ],
  },
  cult_high_priest: {
    kind: 'cult_high_priest',
    name: 'Cult High Priest',
    color: '#065f46',
    initial: 'P',
    hp: 1600,
    armor: 5,
    magicResist: 20,
    moveSpeed: 85,
    damage: 26,
    attackRange: 60,
    attackCooldownMs: 1400,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'rock',
    dropWeaponChance: 1.0,
    width: 50,
    height: 80,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.5, attackSpeedMult: 1.1, damageMult: 1.1,
        summons: [{ kind: 'drowned_spawn', count: 6 }], abilities: [] },
      { hpThreshold: 0.25, attackSpeedMult: 1.2, damageMult: 1.5,
        summons: [], abilities: [] },
    ],
  },
  elder_druid: {
    kind: 'elder_druid',
    name: 'Elder Druid',
    color: '#166534',
    initial: 'D',
    hp: 1500,
    armor: 8,
    magicResist: 12,
    moveSpeed: 95,
    damage: 24,
    attackRange: 60,
    attackCooldownMs: 1300,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'club',
    dropWeaponChance: 1.0,
    width: 55,
    height: 80,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.4, attackSpeedMult: 1.4, damageMult: 1.4,
        summons: [{ kind: 'wolf', count: 4 }], abilities: [] },
    ],
  },
  plague_darkmage: {
    kind: 'plague_darkmage',
    name: 'Plague Darkmage',
    color: '#4c1d95',
    initial: 'M',
    hp: 2000,
    armor: 5,
    magicResist: 25,
    moveSpeed: 80,
    damage: 32,
    attackRange: 55,
    attackCooldownMs: 1100,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'rock',
    dropWeaponChance: 1.0,
    width: 50,
    height: 75,
    isRanged: true,
    projectileSpeed: 350,
    projectileRange: 280,
    phases: [
      { hpThreshold: 0.6, attackSpeedMult: 1.1, damageMult: 1.2,
        summons: [{ kind: 'rotting_husk', count: 4 }], abilities: [] },
      { hpThreshold: 0.3, attackSpeedMult: 1.4, damageMult: 1.3,
        summons: [], abilities: [] },
    ],
  },
  warlord: {
    kind: 'warlord',
    name: 'Warlord',
    color: '#b45309',
    initial: 'W',
    hp: 2500,
    armor: 25,
    magicResist: 10,
    moveSpeed: 110,
    damage: 40,
    attackRange: 75,
    attackCooldownMs: 900,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'club',
    dropWeaponChance: 1.0,
    width: 60,
    height: 90,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.7, attackSpeedMult: 1.2, damageMult: 1.0,
        summons: [], abilities: [] },
      { hpThreshold: 0.4, attackSpeedMult: 1.3, damageMult: 1.3,
        summons: [{ kind: 'bandit_brute', count: 2 }], abilities: [] },
      { hpThreshold: 0.15, attackSpeedMult: 1.4, damageMult: 1.4,
        summons: [], abilities: [] },
    ],
  },
  shadow_master: {
    kind: 'shadow_master',
    name: 'Shadow Master',
    color: '#1e1b4b',
    initial: 'S',
    hp: 2200,
    armor: 12,
    magicResist: 18,
    moveSpeed: 150,
    damage: 36,
    attackRange: 65,
    attackCooldownMs: 800,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'club',
    dropWeaponChance: 1.0,
    width: 45,
    height: 75,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.5, attackSpeedMult: 1.2, damageMult: 1.2,
        summons: [{ kind: 'plains_bandit', count: 3 }], abilities: [] },
      { hpThreshold: 0.25, attackSpeedMult: 2.0, damageMult: 1.4,
        summons: [], abilities: [] },
    ],
  },
  bandit_king_ii: {
    kind: 'bandit_king_ii',
    name: 'Bandit King II',
    color: '#991b1b',
    initial: 'K',
    hp: 3200,
    armor: 25,
    magicResist: 15,
    moveSpeed: 100,
    damage: 45,
    attackRange: 85,
    attackCooldownMs: 900,
    ai: 'boss',
    dropCopper: [0, 0],
    dropWeapon: 'club',
    dropWeaponChance: 1.0,
    width: 90,
    height: 130,
    isRanged: false,
    projectileSpeed: 0,
    projectileRange: 0,
    phases: [
      { hpThreshold: 0.66, attackSpeedMult: 1.2, damageMult: 1.1,
        summons: [{ kind: 'bandit_brute', count: 3 }], abilities: [] },
      { hpThreshold: 0.33, attackSpeedMult: 1.3, damageMult: 1.3,
        summons: [{ kind: 'bandit_king', count: 1 }], abilities: [] },
      { hpThreshold: 0.15, attackSpeedMult: 1.5, damageMult: 1.5,
        summons: [], abilities: [] },
    ],
  },
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: Clean (new ActorKind variants match the ENEMY_DEFS keys; `phases` field matches `BossPhase[]`).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/simulation/enemyData.ts
git commit -m "feat(enemies): add 8 new boss EnemyDef entries with phase data"
```

---

### Task 3: STAGE_WAVES per-stage record + all 9 level compositions

**Files:**
- Modify: `packages/shared/src/simulation/enemyData.ts`
- Modify: `packages/shared/src/simulation/types.ts` (import needed)

- [ ] **Step 1: Add `StageId` import to enemyData.ts**

At the top of `enemyData.ts`, change the import to:

```ts
import type { EnemyDef, Wave, ActorKind, GuildId } from './types';
import type { StageId } from '../../../src/data/stages';
```

Wait — `enemyData.ts` is in `packages/shared/` which must not import from `src/`. Instead, duplicate the `StageId` type as a local alias, or extract it into shared types. The cleanest approach: add `StageId` to `packages/shared/src/simulation/types.ts` and keep it in sync.

- [ ] **Step 1 (revised): Add `StageId` to shared types**

In `packages/shared/src/simulation/types.ts`, add before `ActorKind`:

```ts
export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';
```

Then in `src/data/stages.ts`, re-export from shared instead of defining locally:

```ts
export type { StageId } from '@nannymud/shared/simulation/types';
```

And remove the local `StageId` type declaration from `src/data/stages.ts`.

- [ ] **Step 2: Update enemyData.ts import**

```ts
import type { EnemyDef, Wave, ActorKind, GuildId, StageId } from './types';
```

- [ ] **Step 3: Replace `STAGE_WAVES` with per-stage record**

Remove the existing `export const STAGE_WAVES: Wave[] = [...]` entirely and replace with:

```ts
const LEVEL_STAT_MULT = (level: number) => ({
  hpMult: 1 + (level - 1) * 0.15,
  dmgMult: 1 + (level - 1) * 0.12,
});
export { LEVEL_STAT_MULT };

function w(triggerX: number, enemies: Wave['enemies']): Wave {
  return { triggerX, enemies, triggered: false, cleared: false };
}

function e(kind: ActorKind, count: number): { kind: ActorKind; count: number } {
  return { kind, count };
}

function g(guild: GuildId, count: number, difficulty: number): { guild: GuildId; count: number; difficulty: number } {
  return { guild, count, difficulty };
}

export const STAGE_WAVES: Record<StageId, Wave[]> = {
  assembly: [
    w(400,  [e('plains_bandit', 2)]),
    w(900,  [e('plains_bandit', 3), e('bandit_archer', 1)]),
    w(1400, [e('plains_bandit', 2), e('bandit_archer', 2)]),
    w(2000, [e('plains_bandit', 4), e('bandit_archer', 1)]),
    w(2600, [e('plains_bandit', 3), e('bandit_archer', 2)]),
    w(3800, [e('bandit_king', 1)]),
  ],
  market: [
    w(400,  [e('wolf', 3)]),
    w(900,  [e('wolf', 4), e('bandit_archer', 2)]),
    w(1400, [e('wolf', 5), e('bandit_archer', 2)]),
    w(2000, [e('wolf', 6), e('bandit_archer', 3)]),
    w(2600, [e('wolf', 4), e('bandit_archer', 4)]),
    w(3800, [e('giant_blue_wolf', 1)]),
  ],
  kitchen: [
    w(400,  [e('bandit_brute', 2)]),
    w(900,  [e('bandit_brute', 2), g('vampire', 2, 2)]),
    w(1400, [e('bandit_brute', 3), g('vampire', 2, 3)]),
    w(2000, [e('bandit_brute', 2), g('vampire', 4, 3)]),
    w(2600, [g('vampire', 4, 4)]),
    w(3800, [e('vampire_lord', 1)]),
  ],
  tower: [
    w(400,  [g('cultist', 3, 2)]),
    w(900,  [g('cultist', 2, 2), e('drowned_spawn', 3)]),
    w(1400, [g('cultist', 3, 3), e('drowned_spawn', 4)]),
    w(2000, [g('cultist', 4, 3), e('drowned_spawn', 2)]),
    w(2600, [g('cultist', 5, 4)]),
    w(3800, [e('cult_high_priest', 1)]),
  ],
  grove: [
    w(400,  [g('druid', 2, 2)]),
    w(900,  [g('druid', 2, 2), g('hunter', 2, 2)]),
    w(1400, [e('wolf', 2), g('hunter', 2, 3), g('druid', 1, 3)]),
    w(2000, [g('hunter', 4, 3), e('wolf', 2)]),
    w(2600, [g('druid', 3, 4), g('hunter', 2, 4)]),
    w(3800, [e('elder_druid', 1)]),
  ],
  catacombs: [
    w(400,  [g('leper', 3, 3)]),
    w(900,  [g('leper', 2, 3), e('rotting_husk', 3)]),
    w(1400, [g('darkmage', 2, 3), e('rotting_husk', 3)]),
    w(2000, [g('leper', 2, 4), g('darkmage', 2, 4)]),
    w(2600, [g('darkmage', 4, 4), e('rotting_husk', 2)]),
    w(3800, [e('plague_darkmage', 1)]),
  ],
  throne: [
    w(400,  [g('viking', 3, 4)]),
    w(900,  [g('knight', 2, 4), g('viking', 2, 4)]),
    w(1400, [g('knight', 3, 4), g('champion', 2, 4)]),
    w(2000, [g('viking', 2, 5), g('champion', 3, 5)]),
    w(2600, [g('knight', 2, 5), g('champion', 2, 5), g('viking', 1, 5)]),
    w(3800, [e('warlord', 1)]),
  ],
  docks: [
    w(400,  [e('bandit_brute', 2)]),
    w(900,  [g('adventurer', 3, 4), e('bandit_brute', 2)]),
    w(1400, [g('mage', 3, 4), g('monk', 3, 4)]),
    w(2000, [g('prophet', 3, 5), g('viking', 3, 5)]),
    w(2600, [g('master', 2, 5), g('champion', 2, 5)]),
    w(3800, [e('shadow_master', 1)]),
  ],
  rooftops: [
    w(400,  [e('plains_bandit', 3), e('wolf', 3)]),
    w(900,  [g('vampire', 3, 5), e('bandit_brute', 2)]),
    w(1400, [g('darkmage', 3, 5), e('rotting_husk', 3)]),
    w(2000, [g('knight', 2, 5), g('viking', 2, 5), g('champion', 2, 5)]),
    w(2600, [g('cultist', 4, 5), e('drowned_spawn', 4)]),
    w(3800, [e('bandit_king_ii', 1)]),
  ],
};
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: Errors at `simulation.ts:193` where `STAGE_WAVES` is used without a stage key — this is intentional and will be fixed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/enemyData.ts src/data/stages.ts
git commit -m "feat(waves): per-stage STAGE_WAVES record with all 9 level compositions"
```

---

### Task 4: createInitialState accepts stageId; update callers

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: `src/game/scenes/GameplayScene.ts`

- [ ] **Step 1: Add `stageId` param to `createInitialState`**

In `simulation.ts`, change the signature and add a resolver block at the top of the function body. The current signature is `(guildId: GuildId, seed: number = Date.now())`. Replace it with:

```ts
// eslint-disable-next-line no-restricted-globals -- seed is chosen once at boot, outside the tick loop
export function createInitialState(
  guildId: GuildId,
  stageIdOrSeed: StageId | number = 'assembly',
  seed: number = Date.now(),  // eslint-disable-line no-restricted-globals
): SimState {
  let resolvedStageId: StageId = 'assembly';
  let resolvedSeed = seed;
  if (typeof stageIdOrSeed === 'number') {
    resolvedSeed = stageIdOrSeed;
  } else {
    resolvedStageId = stageIdOrSeed;
  }
```

Then in the `return { ... }` block, change **only two lines**:

1. The `waves:` line — change from `STAGE_WAVES.map(...)` to:
```ts
    waves: STAGE_WAVES[resolvedStageId].map(w => ({ ...w, enemies: w.enemies.map(e => ({ ...e })), triggered: false, cleared: false })),
```

2. The `rngSeed:` / `rng:` lines — change from `seed` to `resolvedSeed`:
```ts
    rngSeed: resolvedSeed,
    rng: makeRng(resolvedSeed),
```

3. Add `stageLevel` to the return (see Task 6 Step 5 for the `STAGE_LEVELS` map):
```ts
    stageLevel: STAGE_LEVELS[resolvedStageId],
```

All other fields in the return object remain exactly as they are.
```

Add `StageId` to the import at the top of `simulation.ts`:

```ts
import type {
  SimState, Actor, InputState, GuildId, StageId, ...
} from './types';
```

- [ ] **Step 2: Update `createSurvivalState` (no change needed — it passes empty waves)**

Verify `createSurvivalState` still compiles — it spreads `createInitialState(guildId, seed)` which still works via the overloaded signature.

- [ ] **Step 3: Update story mode callers in `GameplayScene.ts`**

In `GameplayScene.ts` around line 90, `stageId` is already retrieved from the registry. At line 134 (story mode init) and line 202 (story mode restart), change:

```ts
// line 134 — initial story state
this.simState = createInitialState(guildId, stageId as StageId, seed);

// line 202 — restart
this.simState = createInitialState(currentGuild, stageId as StageId, Date.now());
```

- [ ] **Step 4: Verify typecheck + tests**

```bash
npm run typecheck && npm test
```

Expected: typecheck clean. Golden test passes (same seed + same inputs = same result — the new assembly waves don't introduce non-determinism).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts src/game/scenes/GameplayScene.ts
git commit -m "feat(sim): createInitialState accepts stageId to select wave set"
```

---

### Task 5: Boss phase tick

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/simulation/__tests__/bossPhases.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createEnemyActor, createInitialState } from '../simulation';
import { ENEMY_DEFS } from '../enemyData';

describe('boss phase transitions', () => {
  it('increments bossPhase when HP drops below threshold', () => {
    const state = createInitialState('knight');
    const boss = createEnemyActor('warlord', 500, 200, state);
    const def = ENEMY_DEFS['warlord'];
    boss.hp = Math.floor(boss.hpMax * 0.69); // below 0.7 threshold

    tickBossPhases(state, boss, def);

    expect(boss.bossPhase).toBe(1);
    expect(boss.attackSpeedMult).toBeCloseTo(1.2);
  });

  it('does not re-trigger a phase already passed', () => {
    const state = createInitialState('knight');
    const boss = createEnemyActor('warlord', 500, 200, state);
    const def = ENEMY_DEFS['warlord'];
    boss.bossPhase = 1;
    boss.hp = Math.floor(boss.hpMax * 0.69);

    tickBossPhases(state, boss, def);

    expect(boss.bossPhase).toBe(1); // unchanged
  });

  it('does nothing for an enemy without phases', () => {
    const state = createInitialState('knight');
    const enemy = createEnemyActor('plains_bandit', 500, 200, state);
    const def = ENEMY_DEFS['plains_bandit'];
    enemy.hp = 1;

    tickBossPhases(state, enemy, def);

    expect(enemy.bossPhase).toBe(0);
  });
});
```

Export `tickBossPhases` as a named export from `simulation.ts` — it's a pure function useful for testing and may be reused later.

- [ ] **Step 2: Run the failing test**

```bash
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/bossPhases.test.ts
```

Expected: FAIL — `tickBossPhases is not exported`.

- [ ] **Step 3: Implement `tickBossPhases` in `simulation.ts`**

Add this function (before `tickWaves`):

```ts
function tickBossPhases(state: SimState, actor: Actor, def: EnemyDef): void {
  if (!def.phases || def.phases.length === 0) return;
  const nextPhase = def.phases[actor.bossPhase];
  if (!nextPhase) return;
  if (actor.hp / actor.hpMax >= nextPhase.hpThreshold) return;

  actor.bossPhase += 1;
  actor.attackSpeedMult = (actor.attackSpeedMult ?? 1) * nextPhase.attackSpeedMult;
  actor.damageMult = (actor.damageMult ?? 1) * nextPhase.damageMult;

  if (nextPhase.summons) {
    for (const s of nextPhase.summons) {
      for (let i = 0; i < s.count; i++) {
        const spawnX = actor.x + (i % 2 === 0 ? -120 : 120) - i * 40;
        const spawnY = actor.y + state.rng() * 60 - 30;
        state.enemies.push(createEnemyActor(s.kind, spawnX, spawnY, state));
      }
    }
  }

  state.vfxEvents.push({ type: 'boss_phase', actorId: actor.id, phase: actor.bossPhase } as VFXEvent);
}
```

Also add `'boss_phase'` to the `VFXEvent` union in `types.ts` if not already present. Check with:

```bash
npm run typecheck
```

If `VFXEvent` doesn't accept `type: 'boss_phase'`, find its definition in `types.ts` and add the variant:

```ts
| { type: 'boss_phase'; actorId: string; phase: number }
```

- [ ] **Step 4: Wire `tickBossPhases` into the story enemy loop**

In `tickSimulation` (story mode), inside the enemy loop (after `tickGetup` for each enemy, around line 1864), add:

```ts
    const enemyDef = ENEMY_DEFS[enemy.kind];
    if (enemyDef) tickBossPhases(state, enemy, enemyDef);
```

- [ ] **Step 5: Apply `attackSpeedMult` and `damageMult` in damage calculation**

In the existing damage/attack code, find where enemy `damage` is applied (likely in `combat.ts` or `calcDamage`). Add multiplier application when spawning the attack. The cleanest approach: in `tickAI` or wherever boss melee damage is applied, multiply:

```ts
const effectiveDamage = Math.round(rawDamage * (actor.damageMult ?? 1));
```

Search for where `def.damage` is used for enemies in `ai.ts`:

```bash
grep -n "def.damage\|\.damage" packages/shared/src/simulation/ai.ts | head -20
```

Apply `actor.damageMult` at the call site.

- [ ] **Step 6: Run test**

```bash
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/bossPhases.test.ts
```

Expected: PASS — all 3 boss phase tests green.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: All tests pass including golden determinism test.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/types.ts packages/shared/src/simulation/__tests__/bossPhases.test.ts
git commit -m "feat(sim): wire up boss phase transitions with stat scaling and summons"
```

---

### Task 6: Guild enemy actor factory + wave spawning

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: `packages/shared/src/simulation/enemyData.ts` (for LEVEL_STAT_MULT)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/simulation/__tests__/guildEnemySpawn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState } from '../types';

function emptyInput(): InputState {
  return {
    left: false, right: false, up: false, down: false,
    jump: false, attack: false, block: false, grab: false, pause: false,
    leftJustPressed: false, rightJustPressed: false, jumpJustPressed: false,
    attackJustPressed: false, blockJustPressed: false, grabJustPressed: false,
    pauseJustPressed: false, fullscreenToggleJustPressed: false,
    lastLeftPressMs: 0, lastRightPressMs: 0,
    runningLeft: false, runningRight: false,
    testAbilitySlot: null,
  };
}

describe('guild enemy spawning in story mode', () => {
  it('spawns guild actors from guild wave entries with isPlayer=false', () => {
    // kitchen level 3 has guild:'vampire' wave entries
    let state = createInitialState('knight', 'kitchen', 12345);
    // Move player past first wave triggerX (400)
    state.player.x = 450;
    state = tickSimulation(state, emptyInput(), 16);

    // First wave is bandit_brute - no guilds yet
    // Second wave (triggerX 900) has guild:'vampire'
    state.player.x = 950;
    state = tickSimulation(state, emptyInput(), 16);

    const guildEnemies = state.enemies.filter(e => e.guildId !== null);
    expect(guildEnemies.length).toBeGreaterThan(0);
    guildEnemies.forEach(e => {
      expect(e.isPlayer).toBe(false);
      expect(e.team).toBe('enemy');
      expect(e.guildId).toBe('vampire');
    });
  });

  it('applies level stat multiplier to guild enemy HP', () => {
    let state = createInitialState('knight', 'kitchen', 99999);
    state.player.x = 450;
    state = tickSimulation(state, emptyInput(), 16);

    // Level 3 hpMult = 1 + 2 * 0.15 = 1.3
    // Vampire guild hpMax = check guildData for actual value
    const brutes = state.enemies.filter(e => e.kind === 'bandit_brute');
    brutes.forEach(b => {
      expect(b.hpMax).toBeGreaterThan(256); // base brute HP is 256, mult should boost it
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/guildEnemySpawn.test.ts
```

Expected: FAIL — guild enemies not yet spawned, `guildEnemies.length` is 0.

- [ ] **Step 3: Implement `createGuildEnemyActor` in `simulation.ts`**

Add after `createEnemyActor`:

```ts
export function createGuildEnemyActor(
  guildId: GuildId,
  x: number,
  y: number,
  state: SimState,
  difficulty: number = 3,
): Actor {
  const guild = getGuild(guildId);
  return {
    id: `actor_${state.nextActorId++}`,
    kind: guildId as ActorKind,
    team: 'enemy',
    x,
    y,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: -1,
    width: 40,
    height: 60,
    hp: guild.hpMax,
    hpMax: guild.hpMax,
    hpDark: guild.hpMax,
    mp: guild.resource.startValue,
    mpMax: guild.resource.max,
    armor: guild.armor,
    magicResist: guild.magicResist,
    moveSpeed: guild.moveSpeed,
    stats: { ...guild.stats },
    statusEffects: [],
    animationId: 'idle',
    animationFrame: 0,
    animationTimeMs: 0,
    state: 'idle',
    stateTimeMs: 0,
    isPlayer: false,
    guildId,
    abilityCooldowns: new Map(),
    rmbCooldown: 0,
    comboHits: 0,
    lastAttackTimeMs: 0,
    knockdownTimeMs: 0,
    getupTimeMs: 0,
    invulnerableMs: 0,
    heldPickup: null,
    aiState: {
      behavior: 'none',
      targetId: null,
      lastActionMs: state.rng() * 600,
      retreating: false,
      packRole: null,
      phase: 0,
      patrolDir: 1,
      leapCooldown: 0,
      windupActive: false,
      windupTimeMs: 0,
      lungeMs: 0,
    },
    bossPhase: 0,
    aiDifficulty: difficulty,
    summonedByPlayer: false,
    isAlive: true,
    deathTimeMs: 0,
    score: 0,
  };
}
```

- [ ] **Step 4: Extend `tickWaves` to handle guild wave entries and apply stat multipliers**

Replace the spawn loop inside `tickWaves` (currently lines 1255–1270):

```ts
      for (const spawn of wave.enemies) {
        for (let j = 0; j < spawn.count; j++) {
          const spawnX = state.player.x + 300 + j * 80;
          const spawnY = ENEMY_SPAWN_Y_RANGE[0] + state.rng() * (ENEMY_SPAWN_Y_RANGE[1] - ENEMY_SPAWN_Y_RANGE[0]);

          if ('guild' in spawn) {
            const actor = createGuildEnemyActor(spawn.guild, spawnX, spawnY, state, spawn.difficulty);
            const mult = LEVEL_STAT_MULT(state.stageLevel ?? 1);
            actor.hpMax = Math.round(actor.hpMax * mult.hpMult);
            actor.hp = actor.hpMax;
            actor.hpDark = actor.hpMax;
            state.enemies.push(actor);
          } else {
            if (spawn.kind === 'bandit_king' || spawn.kind === 'bandit_king_ii' ||
                spawn.kind === 'giant_blue_wolf' || spawn.kind === 'vampire_lord' ||
                spawn.kind === 'cult_high_priest' || spawn.kind === 'elder_druid' ||
                spawn.kind === 'plague_darkmage' || spawn.kind === 'warlord' ||
                spawn.kind === 'shadow_master') {
              state.bossSpawned = true;
            }
            const enemy = createEnemyActor(spawn.kind, spawnX, spawnY, state);
            const mult = LEVEL_STAT_MULT(state.stageLevel ?? 1);
            enemy.hpMax = Math.round(enemy.hpMax * mult.hpMult);
            enemy.hp = enemy.hpMax;
            enemy.hpDark = enemy.hpMax;
            enemy.damage = Math.round(enemy.damage * mult.dmgMult);
            state.enemies.push(enemy);
          }
        }
      }
```

- [ ] **Step 5: Add `stageLevel` to `SimState` and set it in `createInitialState`**

In `types.ts`, add to `SimState`:

```ts
  stageLevel?: number; // 1–9, used for stat scaling
```

In `simulation.ts`, `createInitialState` body — derive from stageId:

```ts
const STAGE_LEVELS: Record<StageId, number> = {
  assembly: 1, market: 2, kitchen: 3, tower: 4, grove: 5,
  catacombs: 6, throne: 7, docks: 8, rooftops: 9,
};
// ... in the returned state object:
stageLevel: STAGE_LEVELS[resolvedStageId],
```

- [ ] **Step 6: Run test**

```bash
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/guildEnemySpawn.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/types.ts
git add packages/shared/src/simulation/__tests__/guildEnemySpawn.test.ts
git commit -m "feat(sim): createGuildEnemyActor + guild wave spawning + level stat scaling"
```

---

### Task 7: Guild enemy AI tick in story mode

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Extend the enemy loop in story `tickSimulation`**

In the enemy loop (around line 1846–1861), add a branch for guild enemies before the final `else`:

```ts
    } else if (enemy.guildId !== null) {
      // Story-mode guild actor: drive with VS CPU AI (same pipeline as Battle/VS modes)
      const oppCtrl = getOrCreateController(state, enemy.id, createEmptyCpuInput());
      const cpuInput = synthesizeVsCpuInput(state, enemy, oppCtrl.input, dtMs, enemy.aiDifficulty ?? 3);
      handlePlayerInput(state, cpuInput, oppCtrl, dtMs, enemy);
    } else {
      tickAI(enemy, state, dtSec, state.vfxEvents);
      if (enemy.invulnerableMs > 0) {
        enemy.invulnerableMs = Math.max(0, enemy.invulnerableMs - dtMs);
      }
    }
```

- [ ] **Step 2: Add resource regen for guild enemies**

Directly after `tickHPRegen(enemy, dtMs, true)` in the enemy loop, add:

```ts
    if (enemy.guildId !== null) {
      tickPlayerResourceRegen(enemy, dtMs, true, state);
    }
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: Clean.

- [ ] **Step 4: Run test suite**

```bash
npm test
```

Expected: All pass.

- [ ] **Step 5: Manual smoke test**

Start the dev server and play Level 3 (Kitchen). Verify vampire guild fighters spawn, move towards the player, and attempt to use abilities. They should fight back rather than standing idle.

```bash
npm run dev:client
```

Open `http://localhost:5173`, pick a character, select Kitchen stage.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts
git commit -m "feat(sim): guild enemies in story mode use vsAI pipeline"
```

---

### Task 8: useStageProgress hook

**Files:**
- Create: `src/state/useStageProgress.ts`

- [ ] **Step 1: Write the test**

Create `src/state/__tests__/useStageProgress.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getProgress, unlockStage, isStageUnlocked } from '../useStageProgress';

const STORAGE_KEY = 'nannymud_stage_progress';

describe('useStageProgress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('assembly is always unlocked', () => {
    expect(isStageUnlocked('assembly')).toBe(true);
  });

  it('other stages start locked', () => {
    expect(isStageUnlocked('market')).toBe(false);
    expect(isStageUnlocked('rooftops')).toBe(false);
  });

  it('unlockStage persists and isStageUnlocked reflects it', () => {
    unlockStage('market');
    expect(isStageUnlocked('market')).toBe(true);
  });

  it('unlockStage does not duplicate entries', () => {
    unlockStage('market');
    unlockStage('market');
    const progress = getProgress();
    expect(progress.unlockedStages.filter(s => s === 'market').length).toBe(1);
  });

  it('getProgress returns empty array on fresh state', () => {
    expect(getProgress().unlockedStages).toEqual([]);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
npm test -- --reporter=verbose src/state/__tests__/useStageProgress.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useStageProgress.ts`**

Create `src/state/useStageProgress.ts`:

```ts
import type { StageId } from '@nannymud/shared/simulation/types';

const STORAGE_KEY = 'nannymud_stage_progress';

interface StageProgress {
  unlockedStages: StageId[];
}

export function getProgress(): StageProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { unlockedStages: [] };
    return JSON.parse(raw) as StageProgress;
  } catch {
    return { unlockedStages: [] };
  }
}

export function unlockStage(id: StageId): void {
  const progress = getProgress();
  if (!progress.unlockedStages.includes(id)) {
    progress.unlockedStages.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
}

export function isStageUnlocked(id: StageId): boolean {
  if (id === 'assembly') return true;
  return getProgress().unlockedStages.includes(id);
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- --reporter=verbose src/state/__tests__/useStageProgress.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/state/useStageProgress.ts src/state/__tests__/useStageProgress.test.ts
git commit -m "feat(progress): useStageProgress localStorage hook with unlock logic"
```

---

### Task 9: StageSelect locking UI

**Files:**
- Modify: `src/data/stages.ts`
- Modify: `src/screens/StageSelect.tsx`
- Modify: `src/screens/StagePanels.tsx` (if StageTile lives there)

- [ ] **Step 1: Make `enabled` dynamic in `StageSelect.tsx`**

In `StageSelect.tsx`, import `isStageUnlocked`:

```ts
import { isStageUnlocked } from '../state/useStageProgress';
```

Replace `const canCommit = cur.enabled;` with:

```ts
const canCommit = isStageUnlocked(cur.id);
```

Replace the `onClick` on `StageTile`:

```ts
onClick={() => { if (isStageUnlocked(s.id)) onReady(s.id); }}
```

Update the footer counter:

```ts
{STAGES.filter((s) => isStageUnlocked(s.id)).length} / {STAGES.length} UNLOCKED
```

- [ ] **Step 2: Add padlock overlay to `StageTile`**

In `StagePanels.tsx` (where `StageTile` is defined), find the tile render. Add a locked overlay when not unlocked. Import `isStageUnlocked` and add:

```tsx
import { isStageUnlocked } from '../state/useStageProgress';

// Inside StageTile render, wrap existing content:
const unlocked = isStageUnlocked(stage.id);

// Add over the tile:
{!unlocked && (
  <div style={{
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  }}>
    <span style={{ fontSize: 28 }}>🔒</span>
  </div>
)}
```

- [ ] **Step 3: Remove `enabled` from `StageMeta` interface**

In `src/data/stages.ts`, remove `enabled: boolean` from the `StageMeta` interface and all `enabled: true` entries in `STAGES`. The `STAGES_BY_ID` export stays.

If anything else references `stage.enabled`, update those callers to use `isStageUnlocked(stage.id)`.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Fix any remaining `stage.enabled` references.

- [ ] **Step 5: Visual check**

Start the dev server. Navigate to Stage Select. Only Assembly Hall should be selectable; others should show the padlock overlay.

```bash
npm run dev:client
```

- [ ] **Step 6: Commit**

```bash
git add src/data/stages.ts src/screens/StageSelect.tsx src/screens/StagePanels.tsx
git commit -m "feat(ui): stage select shows padlock on locked stages"
```

---

### Task 10: Victory → unlockStage in GameScreen

**Files:**
- Modify: `src/screens/GameScreen.tsx`

- [ ] **Step 1: Wire unlock on story victory**

In `GameScreen.tsx`, import `unlockStage` and the stage order:

```ts
import { unlockStage } from '../state/useStageProgress';
import { STAGES } from '../data/stages';
import type { StageId } from '@nannymud/shared/simulation/types';
```

In the `onVictory` callback (around line 93), add before `setStoryVictoryScore(score)`:

```ts
} else if (mode === 'story') {
  // Unlock the next stage in the linear sequence
  const stageList = STAGES.map(s => s.id);
  const currentIdx = stageList.indexOf(stageId as StageId);
  if (currentIdx >= 0 && currentIdx < stageList.length - 1) {
    unlockStage(stageList[currentIdx + 1]);
  }
  setStoryVictoryScore(score);
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step 3: Manual test**

Start dev client, play through Assembly Hall (or use devtools to fast-forward). On victory, navigate back to Stage Select and verify Night Market is now unlocked.

- [ ] **Step 4: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "feat(progress): unlock next stage on story mode victory"
```

---

### Task 11: PickupView 2× item size

**Files:**
- Modify: `src/game/view/PickupView.ts`

- [ ] **Step 1: Add scale constant and apply to rock geometry**

In `PickupView.ts`, find `drawBody`. Add a constant at the top of the file:

```ts
const PICKUP_SCALE = 2;
```

Apply to rock render (currently `16×12` ellipse):

```ts
// rock
graphics.fillStyle(0x888888).fillEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
```

Apply to club render — multiply all pixel dimensions by `PICKUP_SCALE`.

- [ ] **Step 2: Visual check**

Run dev client, play assembly stage. Confirm rock and club pickups are visibly larger and easier to see.

- [ ] **Step 3: Increase rock drop rate on bandit_archer**

In `enemyData.ts`, change `bandit_archer.dropWeaponChance` from `0.2` to `0.5`.

- [ ] **Step 4: Commit**

```bash
git add src/game/view/PickupView.ts packages/shared/src/simulation/enemyData.ts
git commit -m "feat(pickups): 2x render size; archer rock drop rate 20%→50%"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass including golden determinism test.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: Clean.

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Expected: No new lint errors.

- [ ] **Step 4: Smoke test all 9 stages in-game**

```bash
npm run dev:client
```

For each stage, verify:
- Assembly: locked stages show padlock; only Assembly is clickable initially
- Start Assembly, complete it (kill bandit_king), verify Market unlocks
- Start Market, verify wolves + wolf boss spawn
- Start Kitchen, verify brute + vampire guild enemies spawn and fight back

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(stage-mode): complete stage mode overhaul — progression, guild enemies, boss phases, item size"
```
