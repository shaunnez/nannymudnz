# Extra Abilities Design

**Date:** 2026-04-24  
**Branch:** feat/vs-mode-hud  
**Status:** Approved — pending implementation plan

## Problem

Several guild abilities fire but do nothing meaningful. This spec defines the sim changes needed to make them functional. Implementation uses **Option A (inline expansion)** — all logic added directly into `fireAbility()` and `tickSimulation()`. Refactor into guild controller files is a future concern.

The five problems to solve:

1. Persistent ground zones (Darkmage Eternal Night, Ranger Bear Trap)
2. Druid bear form — full transformation
3. Ranger pet — summon + AI mode cycling
4. Vampire Nocturne — real invisibility in MP
5. Master Chosen Utility + Class Swap — per-primed-class branching

---

## 1. Persistent Ground Zones

### New SimState field

```ts
groundZones: GroundZone[]   // initialised as []
```

### GroundZone interface

```ts
interface GroundZone {
  id: string;
  x: number;
  y: number;              // depth plane
  radius: number;
  remainingMs: number;
  ownerTeam: 'player' | 'enemy';
  effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
  damagePerTick: number;
  damageType: DamageType;
  vfxColor: string;
  vfxStyle: 'dome' | 'puddle' | 'ring';
  nextPulseMsDown: number;  // counts down from 1000; resets each time a zone_pulse VFX fires
}
```

### `tickGroundZones(state, dt)` — inline in `tickSimulation`

Each tick:
1. Decrement `remainingMs` on all zones; remove expired ones.
2. For each active zone, find all actors within `radius` (world-x + ATTACK_Y_TOLERANCE on depth).
3. Apply `effects` via `addStatusEffect` and deal `damagePerTick * dtSec`.
4. Push a `zone_pulse` VFX event once per second per zone (track with a `nextPulseMsDown` counter on the zone).

### Darkmage — Eternal Night

`fireAbility` Eternal Night block creates a `GroundZone`:
- `radius: 240`, `remainingMs: 6000`, `vfxStyle: 'dome'`
- `effects: { silence: { magnitude: 1, durationMs: 1200 } }` (refreshed each tick while inside)
- `damagePerTick: 8`, `damageType: 'shadow'`
- `vfxColor: '#1a0033'`

### Ranger — Bear Trap

Bear Trap ability currently applies an instant root. Replace with a small ground zone:
- `radius: 40`, `remainingMs: 8000` (waits for trigger), `vfxStyle: 'puddle'`
- On first **enemy** actor entering (skip owner's team): apply `root` 1.5s, then remove the zone immediately.
- `damagePerTick: 0` (no ongoing damage, only the trigger effect)

---

## 2. Druid Bear Form

### New guild entry in `guildData.ts`

Add `druid_bear` as a separate guild-like entry with its own ability set. The shapeshift toggle passes `'druid_bear'` to `detectComboFromInput` when `actor.shapeshiftForm === 'bear'`.

### Bear form ability set

| Combo | ID | Name | Effect |
|---|---|---|---|
| `↓↓J` | `bear_maul` | Maul | Heavy melee swipe, knockdown |
| `→→J` | `bear_charge` | Charge | 180u dash + knockup |
| `↓↑J` | `bear_roar` | Roar | 150u AoE slow + brief fear on enemies |
| `←→J` | `bear_rend` | Rend | Bleed DoT (stacking, 3s per stack) |
| `↓↑↓↑J` | `bear_primal_fury` | Primal Fury | 6s berserk: +40% damage + +20% speed |
| `J+K` | `bear_revert` | Revert | Exit bear form, restore stats |

### Combo detection call site

In `tickSimulation`, change the `detectComboFromInput` call for player/opponent to:

```ts
const effectiveGuildId = actor.shapeshiftForm === 'bear' ? 'druid_bear' : actor.guildId;
detectComboFromInput(actor.comboBuffer, effectiveGuildId);
```

### Stat swap — entering bear form

In `fireAbility` shapeshift block, when transitioning `none → bear`:

```ts
actor.kind = 'bear_form';
actor.shapeshiftForm = 'bear';
actor.hpMax = Math.round(actor.hpMax * 1.5);
actor.hp = Math.min(actor.hp + Math.round(actor.hpMax * 0.3), actor.hpMax); // partial heal on shift
actor.speed = Math.round(actor.speed * 0.8);
addStatusEffect(actor, 'damage_boost', { magnitude: 0.3, durationMs: 999999 }); // cleared on revert
```

### Stat revert — leaving bear form (`bear_revert` ability)

```ts
actor.kind = 'druid';
actor.shapeshiftForm = 'none';
actor.hpMax = Math.round(actor.hpMax / 1.5);
actor.hp = Math.min(actor.hp, actor.hpMax);
actor.speed = Math.round(actor.speed / 0.8);
removeStatusEffect(actor, 'damage_boost'); // remove the bear damage boost only
```

---

## 3. Ranger Pet

### New Actor fields

```ts
summonedBy?: string;                              // owner actor id
petAiMode?: 'aggressive' | 'defensive' | 'passive';
```

### `fireAbility` pet_command block

```ts
const pet = state.allies.find(a => a.summonedBy === player.id);
if (!pet) {
  // First press — summon wolf
  const wolf = createActor('wolf', state.nextActorId++);  // reuse existing wolf kind
  wolf.team = player.team;
  wolf.summonedBy = player.id;
  wolf.petAiMode = 'aggressive';
  wolf.x = player.x + (player.facing === 'right' ? 60 : -60);
  wolf.y = player.y;
  state.allies.push(wolf);
  pushVfx(state, { type: 'summon_spawn', x: wolf.x, y: wolf.y });
} else {
  // Repeat press — cycle AI mode
  const modes = ['aggressive', 'defensive', 'passive'] as const;
  const idx = modes.indexOf(pet.petAiMode ?? 'aggressive');
  pet.petAiMode = modes[(idx + 1) % modes.length];
  pushVfx(state, { type: 'status_text', x: pet.x, y: pet.y, text: pet.petAiMode });
}
```

### Pet AI modes — inline in `tickAI`

For any actor with `petAiMode` set:

- `aggressive` — standard behaviour: attack nearest enemy (no change from existing wolf AI)
- `defensive` — follow owner (`state.actors.find(a => a.id === actor.summonedBy)`), only attack enemies currently targeting the owner
- `passive` — follow owner at close range (within 80u), never attack, no aggro

The wolf's existing pounce ability fires normally through the standard ability dispatch — no changes needed.

### Cleanup

Pet is removed via the standard HP→0 removal path. No special cleanup needed — `resetController` already clears `state.allies` on scene remount.

---

## 4. Vampire Nocturne — Invisibility

### Source of truth: `stealth` status effect

Remove `nocturneActive` from `Actor` — the `stealth` status effect (already applied by Nocturne) is the single source of truth. All checks use `hasStatusEffect(actor, 'stealth')`.

### Simulation changes

**AI targeting** — in `tickAI`, before selecting a target:
```ts
if (hasStatusEffect(target, 'stealth')) continue; // skip stealthed actors
```

**Stealth break on attack** — in `fireAbility`, when a damage ability fires from an actor with `stealth`:
```ts
const fromStealth = hasStatusEffect(player, 'stealth');
if (fromStealth) {
  removeStatusEffect(player, 'stealth');
  // apply +100% damage bonus to this hit
  damageMultiplier *= 2.0;
  // apply fear to target
  addStatusEffect(target, 'fear', { magnitude: 1, durationMs: 2000 });
}
```

### Colyseus schema sync

Add `stealthed: boolean` to `ActorSchema`. Server sets it each tick:
```ts
actorSchema.stealthed = hasStatusEffect(actor, 'stealth');
```

### Client render — `ActorView`

```ts
if (actor.stealthed) {
  const isLocalPlayer = actor.id === localPlayerId;
  this.container.setAlpha(isLocalPlayer ? 0.3 : 0.0);
} else {
  this.container.setAlpha(1.0);
}
```

---

## 5. Master — Chosen Utility + Class Swap

### Class Swap feedback

After cycling `primedClass` in `fireAbility`, emit:
```ts
pushVfx(state, { type: 'status_text', x: player.x, y: player.y, text: player.primedClass });
```

### Chosen Strike — inline branch on `primedClass`

| Primed class | Behaviour |
|---|---|
| `knight` / `monk` / `druid` | Melee hit (uses existing single-target damage path) |
| `mage` | Short-range magic bolt (isProjectile, `damageType: 'magical'`) |
| `hunter` | Arrow projectile (isProjectile, `damageType: 'physical'`, longer range) |

### Chosen Utility — inline `switch (player.primedClass)` in `fireAbility`

| Primed class | Effect |
|---|---|
| `knight` | Shield Wall — 2s `damage_reduction` buff on self (magnitude 0.4) |
| `mage` | Arcane Step — 150u blink teleport (reuse isTeleport path) |
| `monk` | Swift Strike — fast melee dash attack |
| `hunter` | Disengage — leap back 120u + `slow` on nearby enemies 1.5s |
| `druid` | Nature's Grace — HoT on self: 20 HP over 4s |

Eclipse ability remains stubbed — separate feature.

---

## Implementation approach

All changes are **inline in `fireAbility()` and `tickSimulation()`** using the existing `if (guildId === 'x')` / `if (abilityId === 'y')` pattern. New fields added to `Actor` and `SimState` as needed.

### Files touched

| File | Change |
|---|---|
| `packages/shared/src/simulation/types.ts` | `GroundZone` interface, `summonedBy`, `petAiMode` on Actor, `groundZones` on SimState, remove `nocturneActive` |
| `packages/shared/src/simulation/guildData.ts` | Add `druid_bear` entry with 6 abilities |
| `packages/shared/src/simulation/simulation.ts` | `tickGroundZones()`, shapeshift stat swap, pet command logic, stealth AI check, stealth-break-on-attack, Master utility branches |
| `packages/shared/src/schema/ActorSchema.ts` | Add `stealthed: boolean` |
| `src/game/view/ActorView.ts` | Alpha based on `stealthed` |

### Golden test

The golden determinism test must still pass. All new logic uses `state.rng()`, tick-based counters, and `state.nextActorId` — no `Math.random()` or `Date.now()`.
