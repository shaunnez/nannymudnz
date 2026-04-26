# Item Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the pickup system from 2 items (`rock | club`) to 21 items via a data-driven `PICKUP_DEFS` registry, adding weapon attack overrides, gem passive buffs, consumable auto-use, and destructible crates.

**Architecture:** New `pickupData.ts` (mirroring `enemyData.ts`) holds `PICKUP_DEFS`, `CRATE_LOOT_TABLE`, and `STAGE_CRATES`. Simulation reads this registry rather than scattering item logic across conditionals. Crates live in `SimState.crates[]` separate from `state.pickups[]`. All new randomness uses `state.rng()`.

**Tech Stack:** TypeScript, Phaser 3, Vitest

**Spec:** `docs/superpowers/specs/2026-04-26-item-expansion-design.md`

---

## File Map

| File | Action |
|------|--------|
| `packages/shared/src/simulation/pickupData.ts` | **Create** — `PickupDef`, `PickupType`, `PickupCategory`, `PICKUP_DEFS`, `CRATE_LOOT_TABLE`, `STAGE_CRATES` |
| `packages/shared/src/simulation/types.ts` | **Modify** — `Pickup.type` → `PickupType`; add `Crate` interface; `SimState.crates`; add `'pickup_consumed' \| 'crate_break'` to `VFXEventType` |
| `packages/shared/src/simulation/enemyData.ts` | **Modify** — widen `EnemyDef.dropWeapon` from `'rock' \| 'club'` to `PickupType` |
| `packages/shared/src/simulation/simulation.ts` | **Modify** — `spawnPickup` helper; `createInitialState` populates `state.crates`; throw code driven by def; consumable auto-use; gem passive; weapon override; crate hit/break |
| `packages/shared/src/simulation/__tests__/pickupConsumable.test.ts` | **Create** |
| `packages/shared/src/simulation/__tests__/pickupGem.test.ts` | **Create** |
| `packages/shared/src/simulation/__tests__/pickupWeapon.test.ts` | **Create** |
| `packages/shared/src/simulation/__tests__/crate.test.ts` | **Create** |
| `packages/shared/src/index.ts` | **Modify** — export new types |
| `src/game/view/PickupView.ts` | **Modify** — category-driven `drawBody` for all new types |
| `src/game/view/CrateView.ts` | **Create** — crate rendering + shake animation |
| `src/game/scenes/GameplayScene.ts` | **Modify** — `crateViews` map; `reconcileCrates()`; `crate_break` VFX |
| `src/game/view/ParticleFX.ts` | **Modify** — elemental throw VFX for torch, bomb, smoke_bomb, throwing_star |

---

## Task 1: Create `pickupData.ts` — full registry

**Files:**
- Create: `packages/shared/src/simulation/pickupData.ts`

- [ ] **Step 1: Create the file**

```typescript
// packages/shared/src/simulation/pickupData.ts
import type { StatusEffectType } from './types';

export type PickupCategory = 'weapon' | 'gem' | 'consumable' | 'throwable' | 'crate';

export type PickupType =
  | 'rock' | 'club'
  | 'knife' | 'bat' | 'axe' | 'chain' | 'torch' | 'throwing_star'
  | 'bomb' | 'smoke_bomb' | 'bottle'
  | 'ruby' | 'sapphire' | 'emerald' | 'amethyst' | 'topaz'
  | 'health_potion' | 'chi_flask' | 'rage_tonic' | 'antidote' | 'iron_skin';

export interface PickupDef {
  type: PickupType;
  category: PickupCategory;
  name: string;
  color: string;
  // weapon: stats when held and swung
  damage?: number;
  attackRange?: number;
  attackCooldownMs?: number;
  // throwable
  throwable: boolean;
  throwDamage?: number;
  throwRange?: number;
  throwRadius?: number; // AoE hit radius for projectile (default 10)
  // applied on melee hit OR throw impact
  hitEffect?: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  // gem: passive status effect while held (source = 'gem')
  holdBonus?: StatusEffectType;
  holdMagnitude?: number;
  // consumable: immediate on-contact effect (never held)
  instantHeal?: number;
  instantResourceRestore?: number;
  cleanseOnUse?: boolean;
  instantEffects?: Array<{ type: StatusEffectType; magnitude: number; durationMs: number }>;
}

export const PICKUP_DEFS: Record<PickupType, PickupDef> = {
  rock: {
    type: 'rock', category: 'throwable', name: 'Rock', color: '#9ca3af',
    throwable: true, throwDamage: 20, throwRange: 400, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 300 } },
  },
  club: {
    type: 'club', category: 'weapon', name: 'Club', color: '#92400e',
    damage: 28, attackRange: 70, attackCooldownMs: 700,
    throwable: true, throwDamage: 22, throwRange: 300, throwRadius: 10,
  },
  knife: {
    type: 'knife', category: 'weapon', name: 'Knife', color: '#c0c0c0',
    damage: 20, attackRange: 45, attackCooldownMs: 500,
    throwable: true, throwDamage: 18, throwRange: 350, throwRadius: 8,
  },
  bat: {
    type: 'bat', category: 'weapon', name: 'Bat', color: '#7c4a1e',
    damage: 32, attackRange: 60, attackCooldownMs: 750,
    throwable: true, throwDamage: 25, throwRange: 280, throwRadius: 10,
  },
  axe: {
    type: 'axe', category: 'weapon', name: 'Axe', color: '#4a4a4a',
    damage: 45, attackRange: 65, attackCooldownMs: 1100,
    throwable: true, throwDamage: 40, throwRange: 250, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 400 } },
  },
  chain: {
    type: 'chain', category: 'weapon', name: 'Chain', color: '#8a8a8a',
    damage: 22, attackRange: 90, attackCooldownMs: 800,
    throwable: false,
    hitEffect: { slow: { magnitude: 0.5, durationMs: 1000 } },
  },
  torch: {
    type: 'torch', category: 'weapon', name: 'Torch', color: '#8B4513',
    damage: 24, attackRange: 50, attackCooldownMs: 700,
    throwable: true, throwDamage: 18, throwRange: 320, throwRadius: 10,
    hitEffect: { dot: { magnitude: 5, durationMs: 3000 } },
  },
  throwing_star: {
    type: 'throwing_star', category: 'weapon', name: 'Throwing Star', color: '#a0a0a0',
    throwable: true, throwDamage: 30, throwRange: 600, throwRadius: 8,
  },
  bomb: {
    type: 'bomb', category: 'throwable', name: 'Bomb', color: '#2d2d2d',
    throwable: true, throwDamage: 60, throwRange: 350, throwRadius: 80,
    hitEffect: { stun: { magnitude: 1, durationMs: 500 } },
  },
  smoke_bomb: {
    type: 'smoke_bomb', category: 'throwable', name: 'Smoke Bomb', color: '#9aab9a',
    throwable: true, throwDamage: 0, throwRange: 350, throwRadius: 100,
    hitEffect: { blind: { magnitude: 1, durationMs: 3000 } },
  },
  bottle: {
    type: 'bottle', category: 'throwable', name: 'Bottle', color: '#4a7c59',
    throwable: true, throwDamage: 15, throwRange: 300, throwRadius: 10,
    hitEffect: { stun: { magnitude: 1, durationMs: 300 } },
  },
  ruby: {
    type: 'ruby', category: 'gem', name: 'Ruby', color: '#ef4444',
    throwable: false, holdBonus: 'damage_boost', holdMagnitude: 0.2,
  },
  sapphire: {
    type: 'sapphire', category: 'gem', name: 'Sapphire', color: '#3b82f6',
    throwable: false, holdBonus: 'speed_boost', holdMagnitude: 0.25,
  },
  emerald: {
    type: 'emerald', category: 'gem', name: 'Emerald', color: '#22c55e',
    throwable: false, holdBonus: 'hot', holdMagnitude: 3,
  },
  amethyst: {
    type: 'amethyst', category: 'gem', name: 'Amethyst', color: '#a855f7',
    throwable: false, holdBonus: 'damage_reduction', holdMagnitude: 12,
  },
  topaz: {
    type: 'topaz', category: 'gem', name: 'Topaz', color: '#eab308',
    throwable: false, holdBonus: 'attack_speed_boost', holdMagnitude: 0.2,
  },
  health_potion: {
    type: 'health_potion', category: 'consumable', name: 'Health Potion', color: '#ef4444',
    throwable: false, instantHeal: 150,
  },
  chi_flask: {
    type: 'chi_flask', category: 'consumable', name: 'Chi Flask', color: '#3b82f6',
    throwable: false, instantResourceRestore: 60,
  },
  rage_tonic: {
    type: 'rage_tonic', category: 'consumable', name: 'Rage Tonic', color: '#f97316',
    throwable: false,
    instantEffects: [
      { type: 'damage_boost', magnitude: 0.25, durationMs: 10_000 },
      { type: 'speed_boost', magnitude: 0.25, durationMs: 10_000 },
    ],
  },
  antidote: {
    type: 'antidote', category: 'consumable', name: 'Antidote', color: '#22c55e',
    throwable: false, cleanseOnUse: true,
  },
  iron_skin: {
    type: 'iron_skin', category: 'consumable', name: 'Iron Skin', color: '#94a3b8',
    throwable: false,
    instantEffects: [{ type: 'damage_reduction', magnitude: 20, durationMs: 8_000 }],
  },
};

export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';

export const CRATE_LOOT_TABLE: PickupType[] = [
  'rock', 'rock', 'club', 'club',
  'bat', 'knife', 'axe', 'torch', 'bottle',
  'bomb', 'smoke_bomb',
  'health_potion', 'chi_flask',
  'ruby', 'sapphire', 'emerald', 'amethyst', 'topaz',
];

export const STAGE_CRATES: Record<StageId, { x: number; y: number }[]> = {
  assembly:  [{ x: 600, y: 180 }, { x: 1600, y: 240 }, { x: 2800, y: 200 }],
  market:    [{ x: 500, y: 200 }, { x: 1800, y: 160 }, { x: 2600, y: 220 }],
  kitchen:   [{ x: 700, y: 190 }, { x: 1500, y: 250 }, { x: 2400, y: 180 }],
  tower:     [{ x: 600, y: 170 }, { x: 1700, y: 210 }, { x: 2900, y: 190 }],
  grove:     [{ x: 500, y: 200 }, { x: 1400, y: 230 }, { x: 2700, y: 200 }],
  catacombs: [{ x: 650, y: 180 }, { x: 1600, y: 200 }, { x: 2800, y: 220 }],
  throne:    [{ x: 600, y: 190 }, { x: 1800, y: 170 }, { x: 3000, y: 210 }],
  docks:     [{ x: 550, y: 200 }, { x: 1500, y: 240 }, { x: 2600, y: 190 }],
  rooftops:  [{ x: 700, y: 180 }, { x: 1700, y: 220 }, { x: 2900, y: 200 }],
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: errors only in files that import `PickupType` but use the old `'rock' | 'club'` literal — those are fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/simulation/pickupData.ts
git commit -m "feat(items): pickupData.ts — PICKUP_DEFS registry, crate tables"
```

---

## Task 2: Extend `types.ts` — PickupType, Crate, SimState, VFXEventType

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`

- [ ] **Step 1: Import PickupType and update Pickup.type**

At the top of `types.ts`, add:

```typescript
import type { PickupType } from './pickupData';
export type { PickupType, PickupCategory, PickupDef } from './pickupData';
```

Find the `Pickup` interface and change the `type` field:

```typescript
// Before:
export interface Pickup {
  id: string;
  type: 'rock' | 'club';
  // ...
}

// After:
export interface Pickup {
  id: string;
  type: PickupType;
  // ...
}
```

- [ ] **Step 2: Add Crate interface**

After the `Pickup` interface, add:

```typescript
export interface Crate {
  id: string;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  isAlive: boolean;
}
```

- [ ] **Step 3: Add SimState.crates**

In the `SimState` interface, after `pickups: Pickup[];`:

```typescript
  crates: Crate[];
```

- [ ] **Step 4: Extend VFXEventType**

Search for `VFXEventType` in `types.ts`. It will be a string union. Add:

```typescript
// Add to the VFXEventType union:
| 'pickup_consumed'
| 'crate_break'
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: errors where `SimState` is constructed without `crates` — fixed in Task 4.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/types.ts
git commit -m "feat(types): PickupType, Crate, SimState.crates, VFXEventType additions"
```

---

## Task 3: Widen `dropWeapon` in `enemyData.ts`

**Files:**
- Modify: `packages/shared/src/simulation/enemyData.ts`

- [ ] **Step 1: Import PickupType**

At the top of `enemyData.ts`, add the import alongside existing ones:

```typescript
import type { PickupType } from './pickupData';
```

- [ ] **Step 2: Update EnemyDef.dropWeapon type**

Find the `EnemyDef` interface (or wherever `dropWeapon` is declared). Change:

```typescript
// Before:
dropWeapon?: 'rock' | 'club';

// After:
dropWeapon?: PickupType;
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors (existing `'rock'` and `'club'` values are still valid under `PickupType`).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/simulation/enemyData.ts
git commit -m "feat(enemies): widen dropWeapon to PickupType"
```

---

## Task 4: `simulation.ts` plumbing — spawnPickup, createInitialState crates, throw refactor

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Import PICKUP_DEFS and related types**

At the top of `simulation.ts`, add:

```typescript
import { PICKUP_DEFS, STAGE_CRATES } from './pickupData';
import type { PickupType } from './pickupData';
```

- [ ] **Step 2: Add spawnPickup helper**

Add this function after `createInitialState` (or near the other pickup/spawn helpers):

```typescript
function spawnPickup(state: SimState, type: PickupType, x: number, y: number): Pickup {
  return {
    id: `pickup_${state.nextPickupId++}`,
    type,
    x,
    y,
    z: 0,
    hitsLeft: 999,
    heldBy: null,
  };
}
```

- [ ] **Step 3: Add crates to createInitialState**

In `createInitialState`, add `crates: []` to the returned state object after `pickups: []`:

```typescript
    pickups: [],
    crates: (STAGE_CRATES[resolvedStageId] ?? []).map((pos, i) => ({
      id: `crate_${i}`,
      x: pos.x,
      y: pos.y,
      hp: 60,
      hpMax: 60,
      isAlive: true,
    })),
```

Also add `crates: []` to `createSurvivalState`, `createVsState`, `createBattleState` (search for each and add `crates: []` in their returned state objects if they spread `createInitialState` — they'll inherit it, so no change needed if they use spread).

- [ ] **Step 4: Refactor the throw code to use PICKUP_DEFS**

Find the throw block inside the `grabJustPressed` handler (the `if (player.heldPickup)` branch). Replace the hardcoded rock/club checks with def-driven values:

```typescript
// Find this block:
if (player.heldPickup) {
  const pickup = player.heldPickup;
  const proj: Projectile = {
    // ...
    type: `thrown_${pickup.type}`,
    // hardcoded damage: 20
    // hardcoded knockdown: pickup.type === 'rock'
    // hardcoded effects: pickup.type === 'rock' ? { stun... } : {}
    // hardcoded color: pickup.type === 'rock' ? '#9ca3af' : '#92400e'
  };
  state.projectiles.push(proj);
  player.heldPickup = null;
  player.animationId = 'throw';
}

// Replace with:
if (player.heldPickup) {
  const pickup = player.heldPickup;
  const def = PICKUP_DEFS[pickup.type as PickupType];

  if (def && !def.throwable) {
    // Non-throwable (gems, chain): drop to ground instead
    if (def.category === 'gem') {
      player.statusEffects = player.statusEffects.filter(e => e.source !== 'gem');
    }
    pickup.heldBy = null;
    pickup.x = player.x;
    pickup.y = player.y;
    state.pickups.push(pickup);
    player.heldPickup = null;
  } else {
    const proj: Projectile = {
      id: `proj_${state.nextProjectileId++}`,
      ownerId: player.id,
      type: `thrown_${pickup.type}`,
      x: player.x,
      y: player.y,
      z: player.z + 20,
      vx: player.facing * 400,
      vy: 0,
      vz: 0,
      damage: def?.throwDamage ?? 20,
      traveled: 0,
      radius: def?.throwRadius ?? 10,
      knockdown: false,
      knockbackForce: 60,
      effects: def?.hitEffect ? { ...def.hitEffect } : {},
      piercing: false,
      color: def?.color ?? '#9ca3af',
      hitActorIds: [],
    };
    state.projectiles.push(proj);
    if (def?.category === 'gem') {
      player.statusEffects = player.statusEffects.filter(e => e.source !== 'gem');
    }
    player.heldPickup = null;
    player.animationId = 'throw';
  }
}
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all pass including golden.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts
git commit -m "feat(sim): spawnPickup helper, crate init, throw code driven by PICKUP_DEFS"
```

---

## Task 5: Consumable auto-use — tests then implementation

**Files:**
- Create: `packages/shared/src/simulation/__tests__/pickupConsumable.test.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/pickupConsumable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Pickup } from '../types';

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

function grabInput(): InputState {
  return { ...idleInput(), grab: true, grabJustPressed: true };
}

function makePickup(type: Pickup['type'], x: number, y: number): Pickup {
  return { id: 'test_pickup_1', type, x, y, z: 0, hitsLeft: 999, heldBy: null };
}

describe('consumable auto-use', () => {
  it('health_potion heals instantHeal and is removed from state.pickups', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.hp = 100;
    state.player.hpMax = 500;
    // place potion at player position (within grab range)
    state.pickups = [makePickup('health_potion', state.player.x, state.player.y)];

    state = tickSimulation(state, grabInput(), 16);

    expect(state.player.hp).toBe(250); // 100 + 150
    expect(state.pickups).toHaveLength(0);
    expect(state.player.heldPickup).toBeNull();
  });

  it('health_potion caps at hpMax', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.hp = state.player.hpMax - 10;
    state.pickups = [makePickup('health_potion', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.hp).toBe(state.player.hpMax);
  });

  it('chi_flask restores instantResourceRestore to mp', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.mp = 0;
    state.player.mpMax = 100;
    state.pickups = [makePickup('chi_flask', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.mp).toBe(60);
    expect(state.player.heldPickup).toBeNull();
  });

  it('antidote removes dot, slow, stun but leaves speed_boost intact', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    // manually add effects
    state.player.statusEffects = [
      { id: 'e1', type: 'dot', magnitude: 5, durationMs: 5000, remainingMs: 5000, source: 'enemy1' },
      { id: 'e2', type: 'slow', magnitude: 0.5, durationMs: 3000, remainingMs: 3000, source: 'enemy1' },
      { id: 'e3', type: 'speed_boost', magnitude: 0.2, durationMs: 5000, remainingMs: 5000, source: 'ability' },
    ];
    state.pickups = [makePickup('antidote', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const types = state.player.statusEffects.map(e => e.type);
    expect(types).not.toContain('dot');
    expect(types).not.toContain('slow');
    expect(types).toContain('speed_boost');
  });

  it('rage_tonic applies damage_boost and speed_boost', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('rage_tonic', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const types = state.player.statusEffects.map(e => e.type);
    expect(types).toContain('damage_boost');
    expect(types).toContain('speed_boost');
    expect(state.player.heldPickup).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- pickupConsumable
```

Expected: FAIL — consumables are currently picked up as held items, not auto-consumed.

- [ ] **Step 3: Implement applyConsumableEffect helper**

In `simulation.ts`, add this function near `spawnPickup`:

```typescript
import type { PickupDef } from './pickupData';

function applyConsumableEffect(state: SimState, actor: Actor, def: PickupDef): void {
  if (def.instantHeal) {
    actor.hp = Math.min(actor.hpMax, actor.hp + def.instantHeal);
  }
  if (def.instantResourceRestore) {
    actor.mp = Math.min(actor.mpMax, actor.mp + def.instantResourceRestore);
  }
  if (def.cleanseOnUse) {
    const NEGATIVE: StatusEffectType[] = [
      'slow', 'root', 'stun', 'silence', 'blind', 'dot', 'infected', 'chilled', 'curse',
    ];
    actor.statusEffects = actor.statusEffects.filter(e => !NEGATIVE.includes(e.type));
  }
  for (const e of def.instantEffects ?? []) {
    addStatusEffect(state, actor, e.type, e.magnitude, e.durationMs, 'consumable');
  }
}
```

(`PickupDef` import should already be present from Task 4, or add to the imports.)

- [ ] **Step 4: Modify the pickup collection block**

Find the `if (nearPickup)` block inside the `grabJustPressed` handler (where `player.heldPickup` is assigned). Replace it:

```typescript
if (nearPickup) {
  const def = PICKUP_DEFS[nearPickup.type as PickupType];
  if (def?.category === 'consumable') {
    applyConsumableEffect(state, player, def);
    state.pickups = state.pickups.filter(p => p.id !== nearPickup.id);
    state.vfxEvents.push({
      type: 'pickup_consumed',
      color: def.color,
      x: nearPickup.x,
      y: nearPickup.y,
    });
    player.animationId = 'pickup';
  } else {
    nearPickup.heldBy = player.id;
    player.heldPickup = nearPickup;
    state.pickups = state.pickups.filter(p => p.id !== nearPickup.id);
    player.animationId = 'pickup';
  }
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test -- pickupConsumable
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all pass including golden.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/pickupConsumable.test.ts
git commit -m "feat(sim): consumable auto-use — heal, resource, cleanse, buff"
```

---

## Task 6: Gem passive buff — tests then implementation

**Files:**
- Create: `packages/shared/src/simulation/__tests__/pickupGem.test.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/pickupGem.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Pickup } from '../types';

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

function grabInput(): InputState {
  return { ...idleInput(), grab: true, grabJustPressed: true };
}

function makePickup(type: Pickup['type'], x: number, y: number): Pickup {
  return { id: 'gem_1', type, x, y, z: 0, hitsLeft: 999, heldBy: null };
}

describe('gem passive buff', () => {
  it('picking up ruby adds damage_boost status effect with source gem', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('ruby', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effect = state.player.statusEffects.find(e => e.type === 'damage_boost' && e.source === 'gem');
    expect(effect).toBeDefined();
    expect(effect?.magnitude).toBeCloseTo(0.2);
    expect(state.player.heldPickup?.type).toBe('ruby');
  });

  it('picking up sapphire adds speed_boost', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.pickups = [makePickup('sapphire', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effect = state.player.statusEffects.find(e => e.type === 'speed_boost' && e.source === 'gem');
    expect(effect).toBeDefined();
  });

  it('swapping gems removes old bonus and applies new one', () => {
    // Start holding ruby (damage_boost)
    let state = createInitialState('adventurer', 'assembly', 1);
    const ruby: Pickup = { id: 'gem_ruby', type: 'ruby', x: 0, y: 0, z: 0, hitsLeft: 999, heldBy: null };
    state.pickups = [{ ...ruby, x: state.player.x, y: state.player.y }];
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.statusEffects.some(e => e.type === 'damage_boost' && e.source === 'gem')).toBe(true);

    // Drop ruby (press grab again to throw/drop)
    state = tickSimulation(state, grabInput(), 16);
    expect(state.player.statusEffects.some(e => e.source === 'gem')).toBe(false);

    // Pick up sapphire
    state.pickups = [makePickup('sapphire', state.player.x, state.player.y)];
    state = tickSimulation(state, grabInput(), 16);
    const effects = state.player.statusEffects.filter(e => e.source === 'gem');
    expect(effects).toHaveLength(1);
    expect(effects[0].type).toBe('speed_boost');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- pickupGem
```

Expected: FAIL — gems are picked up but no status effect is applied.

- [ ] **Step 3: Apply gem bonus on pickup**

In the `else` branch of the modified `if (nearPickup)` block (from Task 5), after `player.animationId = 'pickup'`:

```typescript
  } else {
    nearPickup.heldBy = player.id;
    player.heldPickup = nearPickup;
    state.pickups = state.pickups.filter(p => p.id !== nearPickup.id);
    player.animationId = 'pickup';
    // NEW: apply gem passive
    if (def?.category === 'gem' && def.holdBonus) {
      player.statusEffects = player.statusEffects.filter(e => e.source !== 'gem');
      addStatusEffect(state, player, def.holdBonus, def.holdMagnitude ?? 1, 999_999_999, 'gem');
    }
  }
```

Gem removal on drop/throw is already handled in Task 4's throw refactor (`player.statusEffects = player.statusEffects.filter(e => e.source !== 'gem')`).

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- pickupGem
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/pickupGem.test.ts
git commit -m "feat(sim): gem passive buff — status effect applied/removed on pick/drop"
```

---

## Task 7: Weapon attack override — tests then implementation

**Files:**
- Create: `packages/shared/src/simulation/__tests__/pickupWeapon.test.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/pickupWeapon.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation, createEnemyActor } from '../simulation';
import type { InputState, Pickup } from '../types';

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

function attackInput(): InputState {
  return { ...idleInput(), attack: true, attackJustPressed: true };
}

function grabInput(): InputState {
  return { ...idleInput(), grab: true, grabJustPressed: true };
}

function makePickup(type: Pickup['type'], heldBy: string): Pickup {
  return { id: 'w_1', type, x: 0, y: 0, z: 0, hitsLeft: 999, heldBy };
}

describe('weapon attack override', () => {
  it('bat extends attack range — hits enemy at 58u that default range 55 would miss', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;

    // enemy at x + 58, exactly within bat range (60) but outside default (55)
    const enemy = createEnemyActor('plains_bandit', state.player.x + 58, state.player.y, state);
    enemy.hp = 500; enemy.hpMax = 500; enemy.armor = 0; enemy.magicResist = 0;

    // Without weapon
    const noWeaponState = tickSimulation(
      { ...state, enemies: [{ ...enemy }] },
      attackInput(),
      16,
    );
    // Enemy should NOT be hit (58 > 55)
    expect(noWeaponState.enemies[0].hp).toBe(500);

    // With bat (range 60)
    const batState = tickSimulation(
      { ...state, enemies: [{ ...enemy }], player: { ...state.player, heldPickup: makePickup('bat', state.player.id) } },
      attackInput(),
      16,
    );
    // Enemy SHOULD be hit (58 < 60)
    expect(batState.enemies[0].hp).toBeLessThan(500);
  });

  it('axe applies stun hitEffect on melee hit', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;
    state.player.heldPickup = makePickup('axe', state.player.id);

    const enemy = createEnemyActor('plains_bandit', state.player.x + 40, state.player.y, state);
    enemy.hp = 500; enemy.hpMax = 500; enemy.armor = 0; enemy.magicResist = 0;
    state.enemies = [enemy];

    state = tickSimulation(state, attackInput(), 16);
    const stunEffect = state.enemies[0].statusEffects.find(e => e.type === 'stun');
    expect(stunEffect).toBeDefined();
  });

  it('throwing_star fires a projectile on attack press instead of melee swing', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;
    state.player.heldPickup = makePickup('throwing_star', state.player.id);

    const projCountBefore = state.projectiles.length;
    state = tickSimulation(state, attackInput(), 16);

    expect(state.projectiles.length).toBe(projCountBefore + 1);
    expect(state.projectiles[state.projectiles.length - 1].type).toBe('thrown_throwing_star');
    expect(state.player.heldPickup).toBeNull();
  });

  it('chain cannot be thrown — pressing grab drops it to ground', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    const chain: Pickup = { id: 'chain_1', type: 'chain', x: 0, y: 0, z: 0, hitsLeft: 999, heldBy: state.player.id };
    state.player.heldPickup = chain;

    const projCountBefore = state.projectiles.length;
    state = tickSimulation(state, grabInput(), 16);

    expect(state.projectiles.length).toBe(projCountBefore); // no projectile
    expect(state.player.heldPickup).toBeNull();
    expect(state.pickups.some(p => p.type === 'chain')).toBe(true); // dropped to ground
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- pickupWeapon
```

Expected: FAIL — range still hardcoded, axe stun not applied, throwing_star not handled.

- [ ] **Step 3: Implement weapon attack override**

In `simulation.ts`, find the basic attack block triggered by `attackJustPressed`. It will look like:

```typescript
if (/* attackJustPressed condition */) {
  const range = (player.heldPickup?.type === 'club' ? 70 : 55) * (isJumpAttack ? 1.2 : 1);
  // ... target filtering and damage ...
}
```

Replace with:

```typescript
if (/* attackJustPressed condition */) {
  const heldDef = player.heldPickup ? PICKUP_DEFS[player.heldPickup.type as PickupType] : null;

  // throwing_star: attack fires a projectile, not a melee swing
  if (heldDef?.type === 'throwing_star' && player.heldPickup) {
    state.projectiles.push({
      id: `proj_${state.nextProjectileId++}`,
      ownerId: player.id,
      type: 'thrown_throwing_star',
      x: player.x,
      y: player.y,
      z: player.z + 20,
      vx: player.facing * 600,
      vy: 0,
      vz: 0,
      damage: heldDef.throwDamage ?? 30,
      traveled: 0,
      radius: heldDef.throwRadius ?? 8,
      knockdown: false,
      knockbackForce: 0,
      effects: {},
      piercing: true,
      color: heldDef.color,
      hitActorIds: [],
    });
    player.heldPickup = null;
    player.animationId = 'throw';
  } else {
    // Replace the hardcoded range:
    const baseRange = heldDef?.attackRange ?? 55;
    const range = baseRange * (isJumpAttack ? 1.2 : 1);

    // ... existing target filtering (unchanged) ...

    // After baseDmg is set from guild stats, override with weapon damage:
    if (heldDef?.damage !== undefined && heldDef.category === 'weapon') {
      baseDmg = heldDef.damage;
    }

    // ... existing damage loop (unchanged) ...

    // After the damage loop, apply weapon hit effects to each hit target.
    // `targets` is the filtered enemy array already in scope from the range check above.
    if (heldDef?.hitEffect) {
      for (const target of targets) {
        for (const [etype, edata] of Object.entries(heldDef.hitEffect)) {
          addStatusEffect(state, target, etype as StatusEffectType, edata.magnitude, edata.durationMs, player.id);
        }
      }
    }

    // Keep club durability check as-is (only change: also keep it since it's explicit behaviour)
    if (player.heldPickup?.type === 'club') {
      player.heldPickup.hitsLeft--;
      if (player.heldPickup.hitsLeft <= 0) player.heldPickup = null;
    }
  }
}
```

**Important:** the variable holding enemies that were hit varies by the actual code — search for where `calcDamage` or `applyDamage` is called in the attack loop and collect those targets into `hitTargets` to apply the weapon hit effects.

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- pickupWeapon
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all pass including golden.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/pickupWeapon.test.ts
git commit -m "feat(sim): weapon attack override — range, damage, hitEffect, throwing_star"
```

---

## Task 8: Crate hit detection and break — tests then implementation

**Files:**
- Create: `packages/shared/src/simulation/__tests__/crate.test.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/simulation/__tests__/crate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import type { InputState, Crate } from '../types';

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

function attackInput(): InputState {
  return { ...idleInput(), attack: true, attackJustPressed: true };
}

function makeCrate(x: number, y: number): Crate {
  return { id: 'crate_test', x, y, hp: 60, hpMax: 60, isAlive: true };
}

describe('crate hit detection', () => {
  it('melee attack within range damages crate', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;
    state.enemies = []; // no enemies to distract
    state.crates = [makeCrate(state.player.x + 40, state.player.y)];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].hp).toBeLessThan(60);
  });

  it('crate beyond attack range is not damaged', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;
    state.enemies = [];
    state.crates = [makeCrate(state.player.x + 200, state.player.y)];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].hp).toBe(60);
  });

  it('crate at 0 HP is marked dead and spawns pickups', () => {
    let state = createInitialState('adventurer', 'assembly', 1);
    state.player.facing = 1;
    state.enemies = [];
    state.crates = [{ ...makeCrate(state.player.x + 40, state.player.y), hp: 1 }];

    state = tickSimulation(state, attackInput(), 16);
    expect(state.crates[0].isAlive).toBe(false);
    expect(state.pickups.length).toBeGreaterThanOrEqual(1);
    expect(state.pickups.length).toBeLessThanOrEqual(2);
  });

  it('crate break loot roll is deterministic — same seed = same loot', () => {
    function runBreak(seed: number) {
      let state = createInitialState('adventurer', 'assembly', seed);
      state.player.facing = 1;
      state.enemies = [];
      state.crates = [{ ...makeCrate(state.player.x + 40, state.player.y), hp: 1 }];
      state = tickSimulation(state, attackInput(), 16);
      return state.pickups.map(p => p.type);
    }
    expect(runBreak(42)).toEqual(runBreak(42));
    expect(runBreak(42)).toEqual(runBreak(42));
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- crate
```

Expected: FAIL — crates are not checked in attack resolution.

- [ ] **Step 3: Add breakCrate function**

In `simulation.ts`, add after `spawnPickup`:

```typescript
import { CRATE_LOOT_TABLE } from './pickupData';

function breakCrate(state: SimState, crate: Crate): void {
  crate.isAlive = false;
  const count = 1 + Math.floor(state.rng() * 2); // 1 or 2
  for (let i = 0; i < count; i++) {
    const type = CRATE_LOOT_TABLE[Math.floor(state.rng() * CRATE_LOOT_TABLE.length)];
    const offsetX = i === 0 ? -20 : 20;
    state.pickups.push(spawnPickup(state, type, crate.x + offsetX, crate.y));
  }
  state.vfxEvents.push({
    type: 'crate_break',
    color: '#8B6914',
    x: crate.x,
    y: crate.y,
    actorId: crate.id,
  });
}
```

(`CRATE_LOOT_TABLE` import should be added alongside the existing pickupData imports.)

- [ ] **Step 4: Add crate hit detection in attack resolution**

In `simulation.ts`, find the attack resolution block (after the existing enemy target loop). Add crate hit checking immediately after it:

```typescript
// After the enemy damage loop, add:
for (const crate of state.crates) {
  if (!crate.isAlive) continue;
  const dx = crate.x - player.x;
  const dy = crate.y - player.y;
  if (Math.abs(dx) < range && Math.abs(dy) < ATTACK_Y_TOLERANCE) {
    if (Math.abs(dx) < 1 || Math.sign(dx) === player.facing) {
      crate.hp -= baseDmg;
      if (crate.hp <= 0) breakCrate(state, crate);
    }
  }
}
```

`range`, `baseDmg`, and `ATTACK_Y_TOLERANCE` are already in scope at the attack site.

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test -- crate
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all pass including golden.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/crate.test.ts
git commit -m "feat(sim): crate hit detection, breakCrate, deterministic loot drop"
```

---

## Task 9: `PickupView.ts` — category-driven rendering

**Files:**
- Modify: `src/game/view/PickupView.ts`

- [ ] **Step 1: Import PICKUP_DEFS**

At the top of `PickupView.ts`:

```typescript
import { PICKUP_DEFS } from '@nannymud/shared/simulation/pickupData';
```

- [ ] **Step 2: Replace drawBody with category-driven version**

Replace the existing `drawBody` method entirely:

```typescript
private drawBody(pickup: Pickup): void {
  const g = this.body;
  g.clear();
  g.lineStyle(1, 0x1f2937, 1);

  const def = PICKUP_DEFS[pickup.type as keyof typeof PICKUP_DEFS];
  if (!def) return;

  const colorHex = parseInt(def.color.replace('#', '0x'), 16);

  switch (def.category) {
    case 'throwable':
      this.drawThrowable(g, pickup.type, colorHex);
      break;
    case 'weapon':
      this.drawWeapon(g, pickup.type, colorHex, def.attackRange ?? 55);
      break;
    case 'gem':
      g.fillStyle(colorHex, 1);
      // diamond: two triangles
      g.fillTriangle(-9, 0, 0, -13, 9, 0);
      g.fillTriangle(-9, 0, 0, 13, 9, 0);
      g.lineStyle(1, 0xffffff, 0.4);
      g.strokeTriangle(-9, 0, 0, -13, 9, 0);
      g.strokeTriangle(-9, 0, 0, 13, 9, 0);
      break;
    case 'consumable':
      g.fillStyle(colorHex, 1);
      g.fillRoundedRect(-8, -8, 16, 16, 3);
      g.lineStyle(1, 0xffffff, 0.4);
      g.strokeRoundedRect(-8, -8, 16, 16, 3);
      break;
    default:
      // fallback: grey square
      g.fillStyle(0x666666, 1);
      g.fillRect(-8, -8, 16, 16);
  }
}

private drawWeapon(g: Phaser.GameObjects.Graphics, type: string, colorHex: number, range: number): void {
  const len = Math.min(range * 0.45, 36);
  g.fillStyle(colorHex, 1);
  if (type === 'torch') {
    g.fillRect(-3, -len + 4, 6, len); // handle
    g.fillStyle(0xff6600, 1);
    g.fillCircle(0, -len + 4, 7); // flame
  } else if (type === 'throwing_star') {
    // star: 4 points
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      g.fillRect(
        Math.cos(a) * 2 - 2, Math.sin(a) * 2 - 2,
        Math.cos(a) * 8 + 4, Math.sin(a) * 8 + 4,
      );
    }
  } else if (type === 'chain') {
    for (let i = 0; i < 3; i++) {
      g.strokeCircle(0, -len / 2 + i * (len / 2.5), 4);
    }
  } else {
    // default elongated rectangle
    g.fillRect(-4, -len, 8, len);
    g.lineStyle(1, 0x1f2937, 1);
    g.strokeRect(-4, -len, 8, len);
  }
}

private drawThrowable(g: Phaser.GameObjects.Graphics, type: string, colorHex: number): void {
  g.fillStyle(colorHex, 1);
  if (type === 'rock') {
    g.fillEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
    g.strokeEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
  } else if (type === 'bomb') {
    g.fillCircle(0, 4, 12);
    g.strokeCircle(0, 4, 12);
    g.fillStyle(0x555555, 1);
    g.fillRect(-2, -11, 4, 10); // fuse
  } else if (type === 'smoke_bomb') {
    g.fillEllipse(0, 0, 26, 18);
    g.strokeEllipse(0, 0, 26, 18);
  } else if (type === 'bottle') {
    g.fillRect(-5, -2, 10, 14); // body
    g.strokeRect(-5, -2, 10, 14);
    g.fillRect(-3, -11, 6, 9);  // neck
    g.strokeRect(-3, -11, 6, 9);
  } else {
    // generic throwable
    g.fillRect(-8, -8, 16, 16);
  }
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 4: Manual visual check**

```bash
npm run dev:client
```

Open http://localhost:5173. Play the assembly stage. Verify rock and club still look correct. Crates are not yet visible (Task 10).

- [ ] **Step 5: Commit**

```bash
git add src/game/view/PickupView.ts
git commit -m "feat(view): PickupView category-driven drawBody for all 20 pickup types"
```

---

## Task 10: `CrateView.ts` + `GameplayScene.ts` wiring

**Files:**
- Create: `src/game/view/CrateView.ts`
- Modify: `src/game/scenes/GameplayScene.ts`

- [ ] **Step 1: Create CrateView.ts**

```typescript
// src/game/view/CrateView.ts
import Phaser from 'phaser';
import type { Crate } from '@nannymud/shared/simulation/types';
import { worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';

export class CrateView {
  readonly crateId: string;
  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private readonly band: ScreenYBand;
  private lastHpRatio = 1;

  constructor(scene: Phaser.Scene, crate: Crate) {
    this.crateId = crate.id;
    this.band = getScreenYBand(scene);
    this.body = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.body]);
    this.drawBody(crate.hp / crate.hpMax);
  }

  private drawBody(hpRatio: number): void {
    const g = this.body;
    g.clear();

    // main box
    g.fillStyle(0x8B6914, 1);
    g.fillRect(-22, -22, 44, 44);
    g.lineStyle(2, 0x5a4010, 1);
    g.strokeRect(-22, -22, 44, 44);

    // cross-hatch planks
    g.lineStyle(1, 0x5a4010, 0.8);
    g.lineBetween(-22, -22, 22, 22);
    g.lineBetween(22, -22, -22, 22);

    // crack overlay when damaged
    if (hpRatio < 0.5) {
      g.lineStyle(1, 0x2d1a00, 1);
      g.lineBetween(-10, -22, 5, 0);
      g.lineBetween(5, 0, -5, 22);
      g.lineBetween(8, -22, 20, 10);
    }
  }

  syncFrom(crate: Crate): void {
    if (!crate.isAlive) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const hpRatio = crate.hp / crate.hpMax;
    if (Math.abs(hpRatio - this.lastHpRatio) > 0.01) {
      this.drawBody(hpRatio);
      this.lastHpRatio = hpRatio;
    }
    const screenY = worldYToScreenY(crate.y, this.band.min, this.band.max);
    this.container.setPosition(crate.x, screenY);
    this.container.setDepth(crate.y - 1);
  }

  shake(scene: Phaser.Scene): void {
    scene.tweens.add({
      targets: this.container,
      x: this.container.x + 4,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.container.setVisible(false),
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
```

- [ ] **Step 2: Add crateViews map to GameplayScene**

In `GameplayScene.ts`, find where `pickupViews` is declared:

```typescript
private pickupViews = new Map<string, PickupView>();
```

Add directly after it:

```typescript
private crateViews = new Map<string, CrateView>();
```

Add the import at the top:

```typescript
import { CrateView } from '../view/CrateView';
```

- [ ] **Step 3: Add reconcileCrates method**

In `GameplayScene.ts`, add after `reconcilePickups()`:

```typescript
private reconcileCrates(): void {
  const live = this.simState.crates;
  const seen = new Set<string>();
  for (const crate of live) {
    seen.add(crate.id);
    let view = this.crateViews.get(crate.id);
    if (!view) {
      view = new CrateView(this, crate);
      this.crateViews.set(crate.id, view);
    }
    view.syncFrom(crate);
  }
  for (const [id, view] of this.crateViews) {
    if (!seen.has(id)) {
      view.destroy();
      this.crateViews.delete(id);
    }
  }
}
```

- [ ] **Step 4: Call reconcileCrates in update**

In `updateSp` (and `updateMp` if it exists), find where `reconcilePickups()` is called and add after it:

```typescript
this.reconcilePickups();
this.reconcileCrates(); // add this line
```

- [ ] **Step 5: Wire crate_break VFX event**

In the file that contains `consumeVfxEvents` (search for `consumeVfxEvents` in `src/game/`), add a case for `'crate_break'`:

```typescript
case 'crate_break': {
  const crateView = (scene as GameplayScene).crateViews.get(event.actorId ?? '');
  if (crateView) crateView.shake(scene);
  break;
}
```

If `crateViews` is private on `GameplayScene`, add a public getter:

```typescript
// In GameplayScene.ts:
getCrateView(id: string): CrateView | undefined {
  return this.crateViews.get(id);
}
```

Then in the VFX handler:
```typescript
case 'crate_break': {
  const gs = scene as GameplayScene;
  const crateView = gs.getCrateView(event.actorId ?? '');
  if (crateView) crateView.shake(scene);
  break;
}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 7: Manual visual check**

```bash
npm run dev:client
```

Play assembly stage. Crates should appear as brown boxes. Attack one — it should take damage (crack overlay at <50% HP), then shake and disappear on death. Pickups should drop.

- [ ] **Step 8: Commit**

```bash
git add src/game/view/CrateView.ts src/game/scenes/GameplayScene.ts
git commit -m "feat(view): CrateView + GameplayScene reconcileCrates + crate_break VFX"
```

---

## Task 11: `ParticleFX.ts` — elemental throw VFX

**Files:**
- Modify: `src/game/view/ParticleFX.ts`

- [ ] **Step 1: Find the projectile type switch**

Search in `ParticleFX.ts` for the switch or if-chain on projectile `type` that already handles `'thrown_rock'` and `'thrown_club'`. Add the following cases in the same location:

```typescript
case 'thrown_torch': {
  // orange trail
  scene.add.particles(x, y, undefined, {
    speed: { min: 20, max: 60 },
    angle: { min: 160, max: 200 },
    lifespan: 300,
    quantity: 2,
    tint: [0xff6600, 0xff8800],
    scale: { start: 0.4, end: 0 },
    blendMode: 'ADD',
    duration: 80,
  });
  // ember burst on impact
  scene.add.particles(x, y, undefined, {
    speed: { min: 40, max: 120 },
    angle: { min: 0, max: 360 },
    lifespan: 500,
    quantity: 8,
    tint: 0xff6600,
    scale: { start: 0.5, end: 0 },
    blendMode: 'ADD',
    duration: 50,
  });
  break;
}
case 'thrown_bomb': {
  // large flash burst — no trail
  scene.add.particles(x, y, undefined, {
    speed: { min: 80, max: 200 },
    angle: { min: 0, max: 360 },
    lifespan: 400,
    quantity: 20,
    tint: [0xffcc00, 0xff8800, 0xff4400],
    scale: { start: 0.8, end: 0 },
    blendMode: 'ADD',
    duration: 60,
  });
  break;
}
case 'thrown_smoke_bomb': {
  // grey expanding cloud
  scene.add.particles(x, y, undefined, {
    speed: { min: 10, max: 40 },
    angle: { min: 0, max: 360 },
    lifespan: 1500,
    quantity: 15,
    tint: 0x9aab9a,
    alpha: { start: 0.6, end: 0 },
    scale: { start: 0.5, end: 2.0 },
    blendMode: 'NORMAL',
    duration: 80,
  });
  break;
}
case 'thrown_throwing_star': {
  // silver trail
  scene.add.particles(x, y, undefined, {
    speed: { min: 10, max: 30 },
    angle: { min: 0, max: 360 },
    lifespan: 150,
    quantity: 3,
    tint: 0xc0c0c0,
    scale: { start: 0.3, end: 0 },
    blendMode: 'ADD',
    duration: 30,
  });
  break;
}
```

**Note:** If `ParticleFX.ts` uses Phaser's older particle API (not the constructor-based one above), match the existing call style. The particle emitter pattern should match whatever is already used in the file for `'thrown_rock'`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/view/ParticleFX.ts
git commit -m "feat(vfx): elemental throw VFX — torch, bomb, smoke_bomb, throwing_star"
```

---

## Task 12: Export new types from `index.ts`

**Files:**
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add exports**

In `packages/shared/src/index.ts`, add alongside the existing simulation exports:

```typescript
export type { PickupType, PickupCategory, PickupDef } from './simulation/pickupData';
export { PICKUP_DEFS, CRATE_LOOT_TABLE, STAGE_CRATES } from './simulation/pickupData';
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "chore: export new pickup types from shared package index"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass including golden determinism test. New tests: `pickupConsumable`, `pickupGem`, `pickupWeapon`, `crate`.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: No new errors.

- [ ] **Step 4: Manual play test**

```bash
npm run dev:client
```

Checklist:
- [ ] Rock and club pickups still render and can be grabbed/thrown
- [ ] Bat pickup renders as elongated brown rectangle; attack range visibly longer than base
- [ ] Axe renders as dark rectangle; melee hit applies stun
- [ ] Chain renders as chain links; cannot be thrown (drops to ground on grab press)
- [ ] Torch renders with orange flame tip; throw leaves orange trail
- [ ] Throwing star renders as silver star; attack fires a projectile
- [ ] Bomb throws with a large yellow flash burst on impact
- [ ] Smoke bomb throws with a grey expanding cloud
- [ ] Ruby renders as a red diamond with glow; holding it should boost damage (verify via damage numbers)
- [ ] Health potion renders as a red rounded square; walking over it heals 150 HP immediately
- [ ] Antidote removes a dot effect when consumed
- [ ] Crates appear as brown boxes in the assembly stage
- [ ] Attacking a crate damages it (crack overlay at <50% HP)
- [ ] Crate break spawns 1–2 random pickups with a shake animation

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(items): item expansion complete — 21 items, gems, consumables, crates"
```
