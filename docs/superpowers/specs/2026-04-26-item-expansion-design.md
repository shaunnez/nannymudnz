# Item Expansion — Design Spec

**Date:** 2026-04-26
**Status:** Approved

## Overview

Phase 2 of the pickup system. Expands the existing two-item pickup model (`rock | club`) into a full item ecosystem: six melee weapons, three throwables, five gems with passive hold bonuses, five consumables with instant effects, and destructible crates. All new items follow the data-driven `PICKUP_DEFS` registry pattern (mirroring `ENEMY_DEFS`), keeping item behavior in one auditable place rather than scattered across simulation conditionals.

---

## Scope

**In scope:**
- `pickupData.ts` — `PickupDef` interface + `PICKUP_DEFS` record for all 21 item types
- New `PickupType` union and `PickupCategory` type in `types.ts`
- Held weapon attack override (melee swing or ranged throw replaces guild attacks)
- Gem passive buff — status effect applied on pickup, removed on drop
- Consumable auto-use — instant effect on contact, never enters `heldPickup`
- Crate entity — destructible world prop, breaks into 1–2 random pickups
- `CrateView.ts` — Phaser rendering for crates
- `PickupView.ts` extensions for all new item categories
- Elemental throw VFX in `ParticleFX.ts` for torch, bomb, smoke_bomb
- Unit tests for all four new behaviour paths

**Out of scope:**
- Per-guild weapon preference or effectiveness modifiers (all guilds use all items equally)
- Item crafting or combining
- Persistent inventory between stages

---

## 1. Data Model

### New file: `packages/shared/src/simulation/pickupData.ts`

```ts
import type { StatusEffectType, StageId } from './types';

export type PickupCategory = 'weapon' | 'gem' | 'consumable' | 'throwable' | 'crate';

export type PickupType =
  | 'rock' | 'club'
  | 'knife' | 'bat' | 'axe' | 'chain' | 'torch' | 'throwing_star'
  | 'bomb' | 'smoke_bomb' | 'bottle'
  | 'ruby' | 'sapphire' | 'emerald' | 'amethyst' | 'topaz'
  | 'health_potion' | 'chi_flask' | 'rage_tonic' | 'antidote' | 'iron_skin'
  | 'crate';

export interface PickupDef {
  type: PickupType;
  category: PickupCategory;
  name: string;
  color: string;
  // weapon: stats when held and swung as melee
  damage?: number;
  attackRange?: number;
  attackCooldownMs?: number;
  // throwable: can be thrown; uses throw stats if different from melee stats
  throwable: boolean;
  throwDamage?: number;
  throwRange?: number;
  hitEffect?: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>; // applied on melee hit OR throw impact
  // gem: passive status effect while held (sourceId = 'gem')
  holdBonus?: StatusEffectType;
  holdMagnitude?: number;
  // consumable: immediate on-contact effect (never held)
  instantHeal?: number;
  instantResourceRestore?: number;
  cleanseOnUse?: boolean; // antidote — remove all negative status effects
  instantEffects?: Array<{ type: StatusEffectType; magnitude: number; durationMs: number }>;
}
```

### PICKUP_DEFS

| Type | Category | Damage | Range | Cooldown | Throwable | Special |
|------|----------|--------|-------|----------|-----------|---------|
| rock | throwable | — | — | — | yes | stun on hit |
| club | weapon | 28 | 55 | 700ms | yes | — |
| knife | weapon | 20 | 45 | 500ms | yes | — |
| bat | weapon | 32 | 60 | 750ms | yes | — |
| axe | weapon | 45 | 65 | 1100ms | yes | knockdown on hit |
| chain | weapon | 22 | 90 | 800ms | no | slow on hit (1s) |
| torch | weapon | 24 | 50 | 700ms | yes | dot on throw (fire, 3s) |
| throwing_star | weapon | — | — | — | yes (ranged attack) | piercing |
| bomb | throwable | 60 | — | — | yes | AoE 80u, stun 500ms |
| smoke_bomb | throwable | 0 | — | — | yes | AoE 100u, blind 3s |
| bottle | throwable | 15 | — | — | yes | stun 300ms |
| ruby | gem | — | — | — | no | damage_boost +20% |
| sapphire | gem | — | — | — | no | speed_boost +25% |
| emerald | gem | — | — | — | no | hot (3 HP/s) |
| amethyst | gem | — | — | — | no | damage_reduction 12 armor |
| topaz | gem | — | — | — | no | attack_speed_boost +20% |
| health_potion | consumable | — | — | — | no | +150 HP instant |
| chi_flask | consumable | — | — | — | no | +60 resource instant |
| rage_tonic | consumable | — | — | — | no | damage_boost + speed_boost 10s |
| antidote | consumable | — | — | — | no | cleanse all negative effects |
| iron_skin | consumable | — | — | — | no | damage_reduction 8s |
| crate | crate | — | — | — | no | breaks into 1–2 pickups |

### Type changes in `types.ts`

`Pickup.type` changes from `'rock' | 'club'` to `PickupType` (imported from `pickupData.ts`).

New `Crate` interface added to `types.ts`:

```ts
export interface Crate {
  id: string;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  isAlive: boolean;
}
```

`SimState` gains: `crates: Crate[]` (initialised to `[]` in `createInitialState`).

---

## 2. Simulation Changes

### 2.1 Held weapon attack override

In the attack resolution path (`simulation.ts`, basic attack branch), before applying damage stats:

```ts
const heldDef = actor.heldPickup ? PICKUP_DEFS[actor.heldPickup.type] : null;

if (heldDef?.category === 'weapon') {
  // throwing_star: attack fires a projectile instead of melee swing
  if (heldDef.type === 'throwing_star') {
    throwHeldPickup(state, actor); // existing throw path
    return;
  }
  // all other weapons: substitute weapon stats for guild stats
  effectiveDamage = heldDef.damage ?? effectiveDamage;
  effectiveRange = heldDef.attackRange ?? effectiveRange;
  effectiveCooldown = heldDef.attackCooldownMs ?? effectiveCooldown;
  // apply weapon hit effects on melee hit (e.g. axe knockdown, chain slow)
  if (heldDef.hitEffect) applyWeaponHitEffects(state, target, heldDef);
}
```

Guilds that normally use ranged attacks (Hunter, Darkmage, etc.) perform a melee swing when holding any weapon with `category === 'weapon'` and `type !== 'throwing_star'`. The `throwing_star` forces a ranged throw regardless of guild. No guild-specific logic — all equally.

### 2.2 Gem passive buff

On pickup (`collectPickup` in `simulation.ts`):

```ts
if (def.category === 'gem' && def.holdBonus) {
  // remove any existing gem effect first (only one gem held at a time)
  removeEffectsBySource(state, actor, 'gem');
  addStatusEffect(state, actor, def.holdBonus, def.holdMagnitude ?? 1, 999_999_999, 'gem');
}
```

On drop or throw:

```ts
removeEffectsBySource(state, actor, 'gem');
```

`removeEffectsBySource` is a new one-line helper: `actor.statusEffects = actor.statusEffects.filter(e => e.sourceId !== source)`.

### 2.3 Consumable auto-use

Consumables never enter `actor.heldPickup`. In `collectPickup`, before the existing held-pickup assignment:

```ts
if (def.category === 'consumable') {
  if (def.instantHeal)            actor.hp = Math.min(actor.hpMax, actor.hp + def.instantHeal);
  if (def.instantResourceRestore) actor.mp = Math.min(actor.mpMax, actor.mp + def.instantResourceRestore);
  if (def.cleanseOnUse)           removeNegativeEffects(state, actor);
  for (const e of def.instantEffects ?? []) {
    addStatusEffect(state, actor, e.type, e.magnitude, e.durationMs, 'consumable');
  }
  state.pickups = state.pickups.filter(p => p.id !== pickup.id);
  state.vfxEvents.push({ type: 'pickup_consumed', actorId: actor.id, pickupType: pickup.type });
  return;
}
```

`removeNegativeEffects` removes all effects with `type` in: `slow | root | stun | silence | blind | dot | infected | chilled | curse`.

### 2.4 Crates

**Hit detection** — melee attack resolution already iterates a hit zone. Extend it to also check `state.crates`:

```ts
for (const crate of state.crates) {
  if (!crate.isAlive) continue;
  if (Math.abs(crate.x - attackX) < attackRange && Math.abs(crate.y - actor.y) < ATTACK_Y_TOLERANCE) {
    crate.hp -= effectiveDamage;
    if (crate.hp <= 0) breakCrate(state, crate);
  }
}
```

**`breakCrate`**:

```ts
function breakCrate(state: SimState, crate: Crate): void {
  crate.isAlive = false;
  const count = 1 + Math.floor(state.rng() * 2); // 1 or 2 drops
  for (let i = 0; i < count; i++) {
    const type = CRATE_LOOT_TABLE[Math.floor(state.rng() * CRATE_LOOT_TABLE.length)];
    state.pickups.push(spawnPickup(state, type, crate.x + (i * 40 - 20), crate.y));
  }
  state.vfxEvents.push({ type: 'crate_break', x: crate.x, y: crate.y });
}
```

**Loot table** (in `pickupData.ts`, weighted by repetition):

```ts
export const CRATE_LOOT_TABLE: PickupType[] = [
  'rock', 'rock', 'club', 'club',
  'bat', 'knife', 'axe', 'torch', 'bottle',
  'bomb', 'smoke_bomb',
  'health_potion', 'chi_flask',
  'ruby', 'sapphire', 'emerald', 'amethyst', 'topaz',
];
```

**Stage crate positions** (in `pickupData.ts`):

```ts
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

`createInitialState` reads `STAGE_CRATES[resolvedStageId]` and populates `state.crates`.

### 2.5 Enemy drop table extension

`EnemyDef.dropWeapon` changes from `'rock' | 'club'` to `PickupType`. Existing entries keep their current values. New boss enemies added in the stage overhaul already use `'rock'` or `'club'` — no changes needed there.

---

## 3. Rendering

### PickupView.ts

`drawBody` gains a category-driven branch using `PICKUP_DEFS[pickup.type]`:

| Category | Visual |
|----------|--------|
| weapon | Elongated rectangle in `def.color`, length proportional to `def.attackRange`. Torch adds a small orange circle at tip. |
| throwable | Per-shape: bomb = dark circle + short fuse line; smoke_bomb = grey oval; bottle = narrow trapezoid; rock = existing grey ellipse |
| gem | Small diamond (rotated square) in `def.color`, with a looping Phaser alpha tween (0.6→1.0→0.6, 800ms) |
| consumable | Small rounded square in category color. Rendered only for the single tick they exist before auto-consume removes them. |

### CrateView.ts

New file: `src/game/view/CrateView.ts`

- Brown rectangle (`#8B6914`) sized `44×44`
- `×` cross-hatch drawn in a darker shade
- At `hp / hpMax < 0.5`: crack overlay (three diagonal lines) added
- On `crate_break` VFX event: short Phaser shake tween (4px, 150ms) then container destroyed

### ParticleFX.ts — elemental throw VFX

New cases for projectile types already handled by the existing `type`-keyed switch:

| Projectile type | VFX |
|-----------------|-----|
| `thrown_torch` | Orange particle trail + small ember burst on impact |
| `thrown_bomb` | No trail; large yellow-orange flash burst on impact (radius 80u) |
| `thrown_smoke_bomb` | Grey expanding cloud on impact, fades over 1.5s |
| `thrown_throwing_star` | Silver trail |

---

## 4. Tests

All tests in `packages/shared/src/simulation/__tests__/`.

### `pickupWeapon.test.ts`
- Holding a bat overrides basic attack damage and range with bat def values
- Holding a throwing_star causes attack press to fire a projectile, not a melee swing
- Dropping a weapon (heldPickup set to null) restores guild's original attack stats on next hit

### `pickupGem.test.ts`
- Picking up a ruby applies a `damage_boost` status effect with sourceId `'gem'`
- Dropping the ruby removes the effect
- Picking up a second gem after dropping the first correctly applies the new gem's bonus only

### `pickupConsumable.test.ts`
- health_potion heals `instantHeal` amount (capped at hpMax) and is removed from `state.pickups`
- antidote removes `dot`, `slow`, `stun`, `infected`, `chilled` effects and leaves positive effects intact
- chi_flask restores `instantResourceRestore` to `actor.mp` (capped at mpMax)

### `crate.test.ts`
- A melee hit within range damages the crate
- At 0 HP, crate is marked `isAlive = false` and 1–2 pickups appear in `state.pickups`
- Loot roll uses `state.rng()` — seeded sim produces the same result across runs (determinism gate)

Golden test must continue to pass — all new sim paths use `state.rng()`, no `Math.random()`.

---

## File Map

| File | Action |
|------|--------|
| `packages/shared/src/simulation/pickupData.ts` | Create — `PickupDef`, `PickupType`, `PickupCategory`, `PICKUP_DEFS`, `CRATE_LOOT_TABLE`, `STAGE_CRATES` |
| `packages/shared/src/simulation/types.ts` | Modify — `PickupType` import; add `Crate` interface; `SimState.crates`; add `pickup_consumed` and `crate_break` to `VFXEvent` union; add `sourceId` to `StatusEffect` if not present |
| `packages/shared/src/simulation/simulation.ts` | Modify — weapon override, gem on-pickup/drop, consumable auto-use, crate hit + break, crate init; new `spawnPickup(state, type, x, y): Pickup` helper using `state.nextPickupId++` |
| `packages/shared/src/simulation/enemyData.ts` | Modify — `dropWeapon` type widened to `PickupType` |
| `packages/shared/src/index.ts` | Modify — export new types |
| `src/game/view/PickupView.ts` | Modify — category-driven `drawBody` for all new types |
| `src/game/view/CrateView.ts` | Create — crate rendering + break animation |
| `src/game/scenes/GameplayScene.ts` | Modify — create/update/destroy `CrateView` instances from `state.crates` |
| `src/game/view/ParticleFX.ts` | Modify — elemental throw VFX cases |
| `packages/shared/src/simulation/__tests__/pickupWeapon.test.ts` | Create |
| `packages/shared/src/simulation/__tests__/pickupGem.test.ts` | Create |
| `packages/shared/src/simulation/__tests__/pickupConsumable.test.ts` | Create |
| `packages/shared/src/simulation/__tests__/crate.test.ts` | Create |
