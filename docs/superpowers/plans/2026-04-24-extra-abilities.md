# Extra Abilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement five unfinished ability systems — persistent ground zones, druid bear form, ranger pet, vampire stealth (MP-safe), and master primed-class utilities.

**Architecture:** All logic added inline to `fireAbility()` and `tickSimulation()` in `simulation.ts`. New `tickGroundZones()` helper runs inside the sim tick. Druid bear form abilities live as exported constants in `guildData.ts` (not a full GuildDef — avoids widening GuildId). New fields added to `Actor` and `SimState` as needed.

**Tech Stack:** TypeScript, Phaser 3, Colyseus 0.17, Vitest

**Spec:** `docs/superpowers/specs/2026-04-24-extra-abilities-design.md`

---

## Execution model

```
Task 1 → Task 2 → ┬─ Tasks 3→4→5→6→7 (sequential, all touch simulation.ts)
                  ├─ Task 8 (parallel — only touches ActorView.ts)
                  └─ Task 9 (parallel — only touches MatchRoom.ts)
                            └─ Task 10 (sequential — verification, after all)
```

- **Tasks 1–2:** Sequential. Foundation — everything else depends on them.
- **Tasks 3–7:** Sequential with each other. All modify `simulation.ts` — parallel would cause merge conflicts.
- **Tasks 8–9:** Parallel with Tasks 3–7. Different files, no shared state.
- **Task 10:** Sequential. Run after all prior tasks complete.
- **Model:** Claude Sonnet 4.6 for all tasks.

---

## Task 1: Types + Schema foundation

**Model:** Sonnet 4.6 | **Execution:** Sequential (run first)

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`
- Modify: `packages/shared/src/schema/ActorSchema.ts`

- [ ] **Step 1: Add `GroundZone` interface and `GroundZoneId` to `types.ts`**

  In `packages/shared/src/simulation/types.ts`, add after the `DamageType` line (line 1):

  ```ts
  export type GroundZoneVfxStyle = 'dome' | 'puddle' | 'ring';

  export interface GroundZone {
    id: string;
    x: number;
    y: number;
    radius: number;
    remainingMs: number;
    ownerTeam: 'player' | 'enemy';
    effects: Partial<Record<StatusEffectType, { magnitude: number; durationMs: number }>>;
    damagePerTick: number;
    damageType: DamageType;
    vfxColor: string;
    vfxStyle: GroundZoneVfxStyle;
    nextPulseMsDown: number;
  }
  ```

- [ ] **Step 2: Add `groundZones` to `SimState` in `types.ts`**

  In the `SimState` interface, add after `projectiles: Projectile[];`:

  ```ts
  groundZones: GroundZone[];
  ```

- [ ] **Step 3: Add `summonedBy` and `petAiMode` to `Actor` in `types.ts`**

  In the `Actor` interface, add after `summonedByPlayer: boolean;`:

  ```ts
  summonedBy?: string;
  petAiMode?: 'aggressive' | 'defensive' | 'passive';
  ```

- [ ] **Step 4: Add `baseHpMax` and `baseMoveSpeed` to `Actor` in `types.ts`**

  These store originals so bear form revert is lossless. Add after the two fields above:

  ```ts
  baseHpMax?: number;
  baseMoveSpeed?: number;
  ```

- [ ] **Step 5: Remove `nocturneActive` from `Actor` in `types.ts`**

  Delete the line:
  ```ts
  nocturneActive?: boolean;
  ```

- [ ] **Step 6: Replace `nocturneActive` with `stealthed` in `ActorSchema.ts`**

  In `packages/shared/src/schema/ActorSchema.ts`, replace:
  ```ts
  @type('boolean') nocturneActive?: boolean;
  ```
  with:
  ```ts
  @type('boolean') stealthed?: boolean;
  ```

- [ ] **Step 7: Initialize `groundZones` in `createInitialState` in `simulation.ts`**

  Find `createInitialState` in `packages/shared/src/simulation/simulation.ts`. Add `groundZones: []` to the returned SimState object alongside the existing `projectiles: []` and `vfxEvents: []`.

- [ ] **Step 8: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: errors only about `nocturneActive` references (they'll be fixed in Task 6). If there are other errors, fix them before proceeding.

- [ ] **Step 9: Commit**

  ```bash
  git add packages/shared/src/simulation/types.ts packages/shared/src/schema/ActorSchema.ts packages/shared/src/simulation/simulation.ts
  git commit -m "feat(types): GroundZone, groundZones, pet fields, stealthed schema"
  ```

---

## Task 2: Druid bear form — guild data

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 1

**Files:**
- Modify: `packages/shared/src/simulation/guildData.ts`

- [ ] **Step 1: Add exported bear form constants to `guildData.ts`**

  At the end of `packages/shared/src/simulation/guildData.ts`, before the closing of the file (after `export function getGuild`), add:

  ```ts
  export const DRUID_BEAR_ABILITIES: AbilityDef[] = [
    makeAbility({
      id: 'bear_maul', name: 'Maul', combo: 'down,down,attack',
      baseDamage: 55, scaleStat: 'STR', scaleAmount: 0.9,
      range: 70, knockdown: true, damageType: 'physical',
      vfxColor: '#8B4513', description: 'Heavy swipe, knocks down target',
    }),
    makeAbility({
      id: 'bear_charge', name: 'Charge', combo: 'right,right,attack',
      baseDamage: 35, scaleStat: 'STR', scaleAmount: 0.6,
      range: 180, isTeleport: true, teleportDist: 180,
      knockbackForce: 200, damageType: 'physical',
      vfxColor: '#A0522D', description: 'Rush forward, knockup first enemy hit',
    }),
    makeAbility({
      id: 'bear_roar', name: 'Roar', combo: 'down,up,attack',
      baseDamage: 0, aoeRadius: 150, cooldownMs: 8000, cost: 20,
      effects: {
        slow: { magnitude: 0.4, durationMs: 2000 },
        fear: { magnitude: 1, durationMs: 1000 },
      },
      damageType: 'physical', vfxColor: '#FFD700',
      description: '150u AoE slow + brief fear',
    }),
    makeAbility({
      id: 'bear_rend', name: 'Rend', combo: 'left,right,attack',
      baseDamage: 20, scaleStat: 'STR', scaleAmount: 0.4,
      range: 75, damageType: 'physical',
      effects: { dot: { magnitude: 8, durationMs: 3000 } },
      vfxColor: '#DC143C', description: 'Melee + stacking bleed DoT',
    }),
    makeAbility({
      id: 'bear_primal_fury', name: 'Primal Fury', combo: 'down,up,down,up,attack',
      baseDamage: 0, cooldownMs: 90000, cost: 60,
      effects: {
        damage_boost: { magnitude: 0.4, durationMs: 6000 },
        speed_boost: { magnitude: 0.2, durationMs: 6000 },
      },
      vfxColor: '#FF4500', description: '6s berserk: +40% dmg +20% speed',
    }),
  ];

  export const DRUID_BEAR_RMB: AbilityDef = makeAbility({
    id: 'bear_revert', name: 'Revert', combo: 'block+attack',
    cooldownMs: 0, cost: 0,
    vfxColor: '#228B22', description: 'Exit bear form, restore stats',
  });
  ```

- [ ] **Step 2: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no new errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/shared/src/simulation/guildData.ts
  git commit -m "feat(guildData): druid bear form ability set"
  ```

---

## Task 3: Ground zones sim subsystem

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 2

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write the failing test**

  In `packages/shared/src/simulation/__tests__/groundZones.test.ts` (create file):

  ```ts
  import { describe, it, expect } from 'vitest';
  import { createInitialState, tickSimulation } from '../simulation';
  import type { InputState, SimState } from '../types';

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

  describe('tickGroundZones', () => {
    it('expires zones when remainingMs reaches 0', () => {
      let state = createInitialState('knight', 1);
      state.groundZones.push({
        id: 'gz_test',
        x: state.player.x,
        y: state.player.y,
        radius: 999,
        remainingMs: 32,   // 2 ticks of 16ms
        ownerTeam: 'enemy',
        effects: {},
        damagePerTick: 0,
        damageType: 'physical',
        vfxColor: '#fff',
        vfxStyle: 'dome',
        nextPulseMsDown: 1000,
      });
      state = tickSimulation(state, emptyInput(), 16);
      expect(state.groundZones).toHaveLength(1);
      state = tickSimulation(state, emptyInput(), 16);
      expect(state.groundZones).toHaveLength(0);
    });

    it('applies status effects to actors inside the zone each tick', () => {
      let state = createInitialState('knight', 1);
      state.groundZones.push({
        id: 'gz_silence',
        x: state.player.x,
        y: state.player.y,
        radius: 999,
        remainingMs: 5000,
        ownerTeam: 'enemy',
        effects: { silence: { magnitude: 1, durationMs: 1000 } },
        damagePerTick: 0,
        damageType: 'physical',
        vfxColor: '#fff',
        vfxStyle: 'dome',
        nextPulseMsDown: 1000,
      });
      state = tickSimulation(state, emptyInput(), 16);
      const silenced = state.player.statusEffects.some(e => e.type === 'silence');
      expect(silenced).toBe(true);
    });

    it('does not apply effects to actors on ownerTeam', () => {
      let state = createInitialState('knight', 1);
      state.groundZones.push({
        id: 'gz_friendly',
        x: state.player.x,
        y: state.player.y,
        radius: 999,
        remainingMs: 5000,
        ownerTeam: 'player',   // same team as player
        effects: { silence: { magnitude: 1, durationMs: 1000 } },
        damagePerTick: 0,
        damageType: 'physical',
        vfxColor: '#fff',
        vfxStyle: 'dome',
        nextPulseMsDown: 1000,
      });
      state = tickSimulation(state, emptyInput(), 16);
      const silenced = state.player.statusEffects.some(e => e.type === 'silence');
      expect(silenced).toBe(false);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- groundZones
  ```

  Expected: FAIL — `groundZones` is undefined or tickGroundZones not yet called.

- [ ] **Step 3: Add `zone_pulse` to `VFXEvent` type**

  In `packages/shared/src/simulation/types.ts`, find the `VFXEvent` type (or union). Add `'zone_pulse'` to its `type` field options, with additional fields `radius: number` and `style: GroundZoneVfxStyle`. Check the existing `VFXEvent` definition and follow its pattern.

- [ ] **Step 4: Add `tickGroundZones` inline in `simulation.ts`**

  Add this function above `tickSimulation` in `packages/shared/src/simulation/simulation.ts`:

  ```ts
  function tickGroundZones(state: SimState, dtMs: number): void {
    const dtSec = dtMs / 1000;
    const allActors: Actor[] = [
      state.player,
      ...(state.opponent ? [state.opponent] : []),
      ...state.enemies,
      ...state.allies,
    ];

    state.groundZones = state.groundZones.filter(zone => {
      zone.remainingMs -= dtMs;
      if (zone.remainingMs <= 0) return false;

      zone.nextPulseMsDown -= dtMs;
      if (zone.nextPulseMsDown <= 0) {
        zone.nextPulseMsDown = 1000;
        state.vfxEvents.push({
          type: 'zone_pulse',
          x: zone.x,
          y: zone.y,
          color: zone.vfxColor,
          radius: zone.radius,
          style: zone.vfxStyle,
        } as VFXEvent);
      }

      for (const actor of allActors) {
        if (!actor.isAlive) continue;
        if (actor.team === zone.ownerTeam) continue;
        const dx = actor.x - zone.x;
        const dy = actor.y - zone.y;
        if (Math.abs(dx) > zone.radius || Math.abs(dy) > ATTACK_Y_TOLERANCE * 2) continue;

        for (const [etype, edata] of Object.entries(zone.effects)) {
          addStatusEffect(
            state, actor, etype as StatusEffectType,
            edata.magnitude, edata.durationMs, zone.id,
          );
        }

        if (zone.damagePerTick > 0) {
          applyDamage(actor, zone.damagePerTick * dtSec, zone.damageType, state);
        }
      }

      return true;
    });
  }
  ```

  Then, in `tickSimulation` (or `tickVsSimulation` — wherever `tickProjectiles` is called), add the call immediately after `tickProjectiles`:

  ```ts
  tickGroundZones(state, dtMs);
  ```

- [ ] **Step 5: Update Eternal Night ability block in `fireAbility`**

  Find the existing Eternal Night handling in `fireAbility` (search for `'eternal_night'`). Replace or augment it to push a ground zone:

  ```ts
  if (ability.id === 'eternal_night') {
    state.groundZones.push({
      id: `gz_${state.nextEffectId++}`,
      x: player.x,
      y: player.y,
      radius: 240,
      remainingMs: 6000,
      ownerTeam: player.team === 'player' ? 'enemy' : 'player',
      effects: { silence: { magnitude: 1, durationMs: 1200 } },
      damagePerTick: 8,
      damageType: 'shadow',
      vfxColor: '#1a0033',
      vfxStyle: 'dome',
      nextPulseMsDown: 1000,
    });
  }
  ```

- [ ] **Step 6: Update Bear Trap ability block in `fireAbility`**

  Find the Bear Trap handling in `fireAbility` (search for `'bear_trap'`). Replace any instant root application with a ground zone trigger:

  ```ts
  if (ability.id === 'bear_trap') {
    // Place at ground target position if available, otherwise at player feet
    const trapX = ctrl.groundTargetX ?? player.x + player.facing * 80;
    const trapY = ctrl.groundTargetY ?? player.y;
    state.groundZones.push({
      id: `gz_${state.nextEffectId++}`,
      x: trapX,
      y: trapY,
      radius: 40,
      remainingMs: 8000,
      ownerTeam: player.team === 'player' ? 'enemy' : 'player',
      effects: { root: { magnitude: 1, durationMs: 1500 } },
      damagePerTick: 0,
      damageType: 'physical',
      vfxColor: '#78350f',
      vfxStyle: 'puddle',
      nextPulseMsDown: 1000,
    });
  }
  ```

  Also add trap-trigger logic in `tickGroundZones` — bear traps fire once on first hit then expire. Modify the zone filter loop to handle this: add `triggerOnce?: boolean` to `GroundZone` in `types.ts` and set it on bear traps. In `tickGroundZones`, after applying effects: `if (zone.triggerOnce) return false;` (removes the zone after first trigger).

- [ ] **Step 7: Add `triggerOnce` to `GroundZone` interface**

  In `types.ts`, add to `GroundZone`:
  ```ts
  triggerOnce?: boolean;
  ```

  In `tickGroundZones`, inside the actor loop after effects are applied:
  ```ts
  if (zone.triggerOnce) {
    zone.remainingMs = 0; // will be filtered out next pass
    return true; // keep for this iteration, remove next tick
  }
  ```

  Set `triggerOnce: true` on the bear trap zone push.

- [ ] **Step 8: Run tests**

  ```bash
  npm test -- groundZones
  ```

  Expected: all 3 tests PASS.

- [ ] **Step 9: Run golden test**

  ```bash
  npm test -- golden
  ```

  Expected: PASS — new fields are deterministic (no random, no Date.now).

- [ ] **Step 10: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 11: Commit**

  ```bash
  git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/types.ts packages/shared/src/simulation/__tests__/groundZones.test.ts
  git commit -m "feat(sim): tickGroundZones, Eternal Night dome, Bear Trap zone trigger"
  ```

---

## Task 4: Druid bear form

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 3

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write the failing test**

  In `packages/shared/src/simulation/__tests__/druidBear.test.ts` (create file):

  ```ts
  import { describe, it, expect } from 'vitest';
  import { createPlayerActor } from '../simulation';
  import type { Actor } from '../types';

  describe('druid bear form', () => {
    it('entering bear form increases hpMax and stores base values', () => {
      const druid = createPlayerActor('druid');
      const originalHpMax = druid.hpMax;
      const originalSpeed = druid.moveSpeed;
      // Simulate the shapeshift enter path directly
      enterBearForm(druid);
      expect(druid.hpMax).toBeGreaterThan(originalHpMax);
      expect(druid.baseHpMax).toBe(originalHpMax);
      expect(druid.baseMoveSpeed).toBe(originalSpeed);
      expect(druid.shapeshiftForm).toBe('bear');
      expect(druid.kind).toBe('bear_form');
    });

    it('reverting bear form restores exact original hpMax and speed', () => {
      const druid = createPlayerActor('druid');
      const originalHpMax = druid.hpMax;
      const originalSpeed = druid.moveSpeed;
      enterBearForm(druid);
      revertBearForm(druid);
      expect(druid.hpMax).toBe(originalHpMax);
      expect(druid.moveSpeed).toBe(originalSpeed);
      expect(druid.shapeshiftForm).toBe('none');
      expect(druid.kind).toBe('druid');
    });
  });
  ```

  Note: `enterBearForm` and `revertBearForm` will be exported helper functions added in Step 3.

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- druidBear
  ```

  Expected: FAIL — `enterBearForm` is not defined.

- [ ] **Step 3: Add `enterBearForm` and `revertBearForm` exports to `simulation.ts`**

  Add these functions near `createPlayerActor` in `simulation.ts`:

  ```ts
  export function enterBearForm(actor: Actor): void {
    actor.baseHpMax = actor.hpMax;
    actor.baseMoveSpeed = actor.moveSpeed;
    actor.hpMax = Math.round(actor.hpMax * 1.5);
    actor.hp = Math.min(actor.hp + Math.round(actor.baseHpMax * 0.3), actor.hpMax);
    actor.moveSpeed = Math.round(actor.moveSpeed * 0.8);
    actor.kind = 'bear_form';
    actor.shapeshiftForm = 'bear';
  }

  export function revertBearForm(actor: Actor): void {
    actor.hpMax = actor.baseHpMax ?? actor.hpMax;
    actor.hp = Math.min(actor.hp, actor.hpMax);
    actor.moveSpeed = actor.baseMoveSpeed ?? actor.moveSpeed;
    actor.baseHpMax = undefined;
    actor.baseMoveSpeed = undefined;
    actor.kind = 'druid';
    actor.shapeshiftForm = 'none';
    // Remove the bear damage boost status effect
    actor.statusEffects = actor.statusEffects.filter(e => !(e.type === 'damage_boost' && e.source === 'bear_form'));
  }
  ```

- [ ] **Step 4: Update the `shapeshift` ability block in `fireAbility`**

  Find the existing shapeshift block (currently around line 648):

  ```ts
  if (ability.id === 'shapeshift' && player.guildId === 'druid') {
    const form = player.shapeshiftForm || 'none';
    player.shapeshiftForm = form === 'none' ? 'bear' : form === 'bear' ? 'wolf' : 'none';
  }
  ```

  Replace with:

  ```ts
  if (ability.id === 'shapeshift' && player.guildId === 'druid') {
    if ((player.shapeshiftForm ?? 'none') === 'none') {
      enterBearForm(player);
      addStatusEffect(state, player, 'damage_boost', 0.3, 999999, 'bear_form');
    }
    // wolf form not yet implemented — shapeshift now only toggles bear
  }

  if (ability.id === 'bear_revert') {
    revertBearForm(player);
  }
  ```

- [ ] **Step 5: Update combo detection call site for bear form**

  Find the combo detection block in `tickSimulation` (around lines 1097–1105):

  ```ts
  const guild = getGuild(player.guildId!);
  const ability = guild.abilities.find(a => a.combo === comboResult) || (comboResult === 'block+attack' ? guild.rmb : null);
  ```

  Replace these two lines with:

  ```ts
  let ability: AbilityDef | null = null;
  if (player.shapeshiftForm === 'bear') {
    ability = DRUID_BEAR_ABILITIES.find(a => a.combo === comboResult) ??
              (comboResult === 'block+attack' ? DRUID_BEAR_RMB : null) ?? null;
  } else {
    const guild = getGuild(player.guildId!);
    ability = guild.abilities.find(a => a.combo === comboResult) ??
              (comboResult === 'block+attack' ? guild.rmb : null) ?? null;
  }
  ```

  Also add the import at the top of `simulation.ts`:

  ```ts
  import { getGuild, DRUID_BEAR_ABILITIES, DRUID_BEAR_RMB } from './guildData';
  ```

  (Replace the existing `import { getGuild }` line.)

  This same combo detection block likely exists for the opponent (`ctrl` for player 2) — apply the same change for the opponent's combo detection.

- [ ] **Step 6: Run tests**

  ```bash
  npm test -- druidBear
  ```

  Expected: both tests PASS.

- [ ] **Step 7: Run full test suite + typecheck**

  ```bash
  npm test && npm run typecheck
  ```

  Expected: all PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/druidBear.test.ts
  git commit -m "feat(sim): druid bear form — stat swap, revert, combo detection"
  ```

---

## Task 5: Ranger pet

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 4

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write the failing test**

  In `packages/shared/src/simulation/__tests__/rangerPet.test.ts` (create file):

  ```ts
  import { describe, it, expect } from 'vitest';
  import { createInitialState, tickSimulation } from '../simulation';
  import type { InputState, SimState } from '../types';

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

  describe('ranger pet_command', () => {
    it('spawns a wolf into allies on first use when no pet exists', () => {
      let state = createInitialState('hunter', 1);
      const startAllies = state.allies.length;
      // testAbilitySlot fires the RMB ability directly
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      expect(state.allies.length).toBe(startAllies + 1);
      const wolf = state.allies.find(a => a.summonedBy === state.player.id);
      expect(wolf).toBeDefined();
      expect(wolf!.petAiMode).toBe('aggressive');
    });

    it('cycles pet AI mode on repeat uses', () => {
      let state = createInitialState('hunter', 1);
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      const wolfId = state.allies.find(a => a.summonedBy === state.player.id)!.id;

      // Allow RMB cooldown to reset (pet_command has cooldownMs: 0)
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      const pet1 = state.allies.find(a => a.id === wolfId)!;
      expect(pet1.petAiMode).toBe('defensive');

      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      const pet2 = state.allies.find(a => a.id === wolfId)!;
      expect(pet2.petAiMode).toBe('passive');

      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      const pet3 = state.allies.find(a => a.id === wolfId)!;
      expect(pet3.petAiMode).toBe('aggressive');
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- rangerPet
  ```

  Expected: FAIL — pet not spawned.

- [ ] **Step 3: Implement `pet_command` block in `fireAbility`**

  Find the existing `pet_command` ability block in `fireAbility`. Replace it with:

  ```ts
  if (ability.id === 'pet_command' && player.guildId === 'hunter') {
    const existingPet = [
      ...state.allies,
      ...(state.opponent ? [state.opponent] : []),
    ].find(a => a.summonedBy === player.id && a.isAlive);

    if (!existingPet) {
      // Summon wolf pet
      const wolf = createEnemyActor('wolf', player.x + player.facing * 60, player.y, state);
      wolf.id = `actor_${state.nextActorId++}`;
      wolf.team = player.team;
      wolf.isPlayer = false;
      wolf.summonedByPlayer = true;
      wolf.summonedBy = player.id;
      wolf.petAiMode = 'aggressive';
      state.allies.push(wolf);
      state.vfxEvents.push({ type: 'summon_spawn', x: wolf.x, y: wolf.y, color: '#8d6e63' } as VFXEvent);
    } else {
      const modes = ['aggressive', 'defensive', 'passive'] as const;
      const idx = modes.indexOf(existingPet.petAiMode ?? 'aggressive');
      existingPet.petAiMode = modes[(idx + 1) % modes.length];
      state.vfxEvents.push({
        type: 'status_text', x: existingPet.x, y: existingPet.y - 60,
        color: '#ffffff', text: existingPet.petAiMode,
      } as VFXEvent);
    }
    return; // pet_command has no standard damage/effect path
  }
  ```

  Note: `createEnemyActor` is a private function in simulation.ts — if it is not accessible at the call site, inline the wolf creation using the same pattern as existing summon code (search for `'drowned_spawn'` to see the pattern).

- [ ] **Step 4: Add `petAiMode` checks to `tickAI` in `ai.ts`**

  In `packages/shared/src/simulation/ai.ts`, find where ally actors get their AI ticked. At the top of the actor AI tick for any actor with `petAiMode` set, add:

  ```ts
  if (actor.petAiMode !== undefined) {
    tickPetAI(actor, state, dtMs);
    return;
  }
  ```

  Then add `tickPetAI` as a new function in `ai.ts`:

  ```ts
  function tickPetAI(actor: Actor, state: SimState, dtMs: number): void {
    if (actor.petAiMode === 'passive') {
      // Follow owner, never attack
      const owner = [state.player, state.opponent].filter(Boolean).find(a => a!.id === actor.summonedBy);
      if (owner) {
        const dx = owner.x - actor.x;
        if (Math.abs(dx) > 80) {
          actor.vx = Math.sign(dx) * actor.moveSpeed;
          actor.facing = Math.sign(dx) as -1 | 1;
        } else {
          actor.vx = 0;
        }
      }
      return;
    }

    if (actor.petAiMode === 'defensive') {
      // Follow owner; attack only enemies attacking the owner
      const owner = [state.player, state.opponent].filter(Boolean).find(a => a!.id === actor.summonedBy);
      if (!owner) return;
      const ownerUnderAttack = state.enemies.some(
        e => e.isAlive && Math.abs(e.x - owner.x) < 120 && e.state === 'attack',
      );
      if (!ownerUnderAttack) {
        // Just follow owner
        const dx = owner.x - actor.x;
        if (Math.abs(dx) > 80) {
          actor.vx = Math.sign(dx) * actor.moveSpeed;
          actor.facing = Math.sign(dx) as -1 | 1;
        } else {
          actor.vx = 0;
        }
        return;
      }
      // Fall through to aggressive behaviour when owner is under attack
    }

    // aggressive (or defensive fallthrough): attack nearest enemy — handled by existing wolf AI
    // No change needed; tickAI continues normally after this function returns.
    // For defensive fallthrough, we re-enter standard AI logic by NOT returning here.
  }
  ```

  Actually, for the `aggressive` mode there's nothing to do — just let the existing wolf AI run normally. Restructure as:

  ```ts
  if (actor.petAiMode === 'passive' || (actor.petAiMode === 'defensive' && !ownerUnderAttack)) {
    // follow-only logic
    return; // skip the normal combat AI
  }
  // aggressive or defensive-with-threat: fall through to normal AI
  ```

- [ ] **Step 5: Run tests**

  ```bash
  npm test -- rangerPet
  ```

  Expected: both tests PASS.

- [ ] **Step 6: Run full test suite + typecheck**

  ```bash
  npm test && npm run typecheck
  ```

  Expected: all PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/ai.ts packages/shared/src/simulation/__tests__/rangerPet.test.ts
  git commit -m "feat(sim): ranger wolf pet — summon, AI mode cycling, tickPetAI"
  ```

---

## Task 6: Vampire Nocturne — stealth sim

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 5

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: `packages/shared/src/simulation/ai.ts`

- [ ] **Step 1: Remove `nocturneActive` references**

  Search for all uses of `nocturneActive` in `simulation.ts` and `ai.ts`:

  ```bash
  npm run typecheck 2>&1 | grep nocturneActive
  ```

  For each reference:
  - If it's setting `player.nocturneActive = true` — delete that line (stealth status effect is already applied by Nocturne)
  - If it's reading `player.nocturneActive` — replace with `player.statusEffects.some(e => e.type === 'stealth')`

- [ ] **Step 2: Write failing test**

  In `packages/shared/src/simulation/__tests__/vampireStealth.test.ts` (create file):

  ```ts
  import { describe, it, expect } from 'vitest';
  import { createInitialState, tickSimulation } from '../simulation';
  import { addStatusEffect } from '../combat';
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

  describe('vampire stealth', () => {
    it('enemy AI does not target a stealthed player', () => {
      let state = createInitialState('vampire', 1);
      // Spawn an enemy close to player
      const enemy = state.enemies[0];
      if (!enemy) return; // skip if no enemies in initial state
      enemy.x = state.player.x + 100;

      addStatusEffect(state, state.player, 'stealth', 1, 5000, 'test');
      state = tickSimulation(state, emptyInput(), 16);

      // Enemy should not have moved toward player (no target acquired while stealthed)
      // Check enemy hasn't entered 'attack' state targeting player
      expect(enemy.state).not.toBe('attack');
    });

    it('first attack from stealth breaks stealth and doubles damage multiplier', () => {
      let state = createInitialState('vampire', 1);
      addStatusEffect(state, state.player, 'stealth', 1, 5000, 'test');

      const hadStealth = state.player.statusEffects.some(e => e.type === 'stealth');
      expect(hadStealth).toBe(true);

      // Fire ability 1 (hemorrhage - first non-RMB ability)
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 1 }, 16);

      const stillStealthed = state.player.statusEffects.some(e => e.type === 'stealth');
      expect(stillStealthed).toBe(false);
    });
  });
  ```

- [ ] **Step 3: Run test to verify it fails**

  ```bash
  npm test -- vampireStealth
  ```

  Expected: FAIL.

- [ ] **Step 4: Add stealth skip to AI targeting in `ai.ts`**

  In `tickAI`, find where the AI selects its target (where it looks for the nearest enemy/player to attack). Add a guard to skip stealthed actors:

  ```ts
  // Skip stealthed targets — cannot be seen
  if (candidate.statusEffects.some(e => e.type === 'stealth')) continue;
  ```

  This goes inside any loop that iterates over candidate targets to find `nearestEnemy` or `nearestTarget`.

- [ ] **Step 5: Add stealth-break-on-attack in `fireAbility`**

  Near the top of `fireAbility`, after the silence check and before the cooldown check, add:

  ```ts
  // Stealth break: first damaging ability from stealth gets +100% damage + applies fear
  const wasStealthed = player.statusEffects.some(e => e.type === 'stealth');
  if (wasStealthed && ability.baseDamage > 0) {
    player.statusEffects = player.statusEffects.filter(e => e.type !== 'stealth');
    // fromStealth flag for damage bonus — store on ctrl for use in damage calc
    ctrl.fromStealthAttack = true;
  }
  ```

  Then in the damage calculation section of `fireAbility` (where `getDamageMultiplier` is called), add:

  ```ts
  let bonus = getDamageMultiplier(player);
  if (ctrl.fromStealthAttack) {
    bonus *= 2.0;
    ctrl.fromStealthAttack = false;
    // Fear applied after damage
  }
  ```

  After the hit spark / damage application in the single-target melee path, add:

  ```ts
  if (ctrl.fromStealthAttack) {
    ctrl.fromStealthAttack = false;
    // Apply fear to whoever was just hit — iterate the same target list used above
    const fearTargets = getEnemiesOf(state, player).filter(
      e => e.isAlive && isInRange(player, e, ability.range, ATTACK_Y_TOLERANCE),
    );
    for (const t of fearTargets) {
      addStatusEffect(state, t, 'fear', 1, 2000, player.id);
    }
  }
  ```

  Add `fromStealthAttack?: boolean` to the `PlayerController` interface in `types.ts`.

- [ ] **Step 6: Run tests**

  ```bash
  npm test -- vampireStealth
  ```

  Expected: both tests PASS.

- [ ] **Step 7: Run full test suite + typecheck**

  ```bash
  npm test && npm run typecheck
  ```

  Expected: all PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/ai.ts packages/shared/src/simulation/types.ts packages/shared/src/simulation/__tests__/vampireStealth.test.ts
  git commit -m "feat(sim): vampire stealth — AI skip, stealth-break bonus, fear on break"
  ```

---

## Task 7: Master — Chosen Utility + Chosen Strike

**Model:** Sonnet 4.6 | **Execution:** Sequential after Task 6

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write failing test**

  In `packages/shared/src/simulation/__tests__/masterUtility.test.ts` (create file):

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

  describe('master class_swap', () => {
    it('emits a status_text VFX showing the new primed class', () => {
      let state = createInitialState('master', 1);
      state.player.primedClass = 'knight';
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 'rmb' }, 16);
      const textEvent = state.vfxEvents.find(e => e.type === 'status_text' && e.text?.includes('mage'));
      expect(textEvent).toBeDefined();
    });
  });

  describe('master chosen_utility', () => {
    it('applies damage_reduction when primed as knight', () => {
      let state = createInitialState('master', 1);
      state.player.primedClass = 'knight';
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 2 }, 16);
      const buffed = state.player.statusEffects.some(e => e.type === 'damage_reduction');
      expect(buffed).toBe(true);
    });

    it('applies teleport behaviour when primed as mage', () => {
      let state = createInitialState('master', 1);
      state.player.primedClass = 'mage';
      const startX = state.player.x;
      state = tickSimulation(state, { ...emptyInput(), testAbilitySlot: 2 }, 16);
      // Player should have moved (teleported)
      expect(state.player.x).not.toBe(startX);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  ```bash
  npm test -- masterUtility
  ```

  Expected: FAIL.

- [ ] **Step 3: Update `class_swap` block to emit VFX**

  Find the `class_swap` block in `fireAbility` (currently around line 653). It already cycles `primedClass`. Add VFX after the cycle:

  ```ts
  if (ability.id === 'class_swap' && player.guildId === 'master') {
    const classes = ['knight', 'mage', 'monk', 'hunter', 'druid'];
    const idx = classes.indexOf(player.primedClass || 'knight');
    player.primedClass = classes[(idx + 1) % classes.length];
    state.vfxEvents.push({
      type: 'status_text',
      x: player.x,
      y: player.y - 80,
      color: '#e0e0e0',
      text: player.primedClass,
    } as VFXEvent);
  }
  ```

  (The existing block may already have partial VFX — replace it entirely with the above.)

- [ ] **Step 4: Implement `chosen_utility` in `fireAbility`**

  Find the `chosen_utility` ability block (or add it after the `class_swap` block):

  ```ts
  if (ability.id === 'chosen_utility' && player.guildId === 'master') {
    const primed = player.primedClass ?? 'knight';
    switch (primed) {
      case 'knight':
        addStatusEffect(state, player, 'damage_reduction', 0.4, 2000, player.id);
        state.vfxEvents.push({ type: 'aura_pulse', x: player.x, y: player.y, color: '#fbbf24' } as VFXEvent);
        break;
      case 'mage': {
        const dir = player.facing;
        player.x = Math.max(0, Math.min(player.x + dir * 150, 4000));
        state.vfxEvents.push({ type: 'blink_trail', x: player.x, y: player.y, color: '#818cf8' } as VFXEvent);
        break;
      }
      case 'monk': {
        // Fast dash attack — deal 25 damage to nearest enemy in 120u
        const targets = [...state.enemies, ...(state.opponent ? [state.opponent] : [])]
          .filter(e => e.isAlive && Math.abs(e.x - player.x) < 120 && Math.abs(e.y - player.y) < ATTACK_Y_TOLERANCE);
        for (const t of targets) applyDamage(t, 25, 'physical', state);
        player.x = Math.max(0, Math.min(player.x + player.facing * 80, 4000));
        state.vfxEvents.push({ type: 'hit_spark', x: player.x, y: player.y, color: '#fde68a' } as VFXEvent);
        break;
      }
      case 'hunter':
        player.x = Math.max(0, Math.min(player.x - player.facing * 120, 4000));
        {
          const nearby = [...state.enemies, ...(state.opponent ? [state.opponent] : [])]
            .filter(e => e.isAlive && Math.abs(e.x - player.x) < 150 && Math.abs(e.y - player.y) < ATTACK_Y_TOLERANCE);
          for (const t of nearby) addStatusEffect(state, t, 'slow', 0.4, 1500, player.id);
        }
        state.vfxEvents.push({ type: 'aoe_pop', x: player.x, y: player.y, color: '#78350f' } as VFXEvent);
        break;
      case 'druid':
        addStatusEffect(state, player, 'hot', 20, 4000, player.id);
        state.vfxEvents.push({ type: 'heal_glow', x: player.x, y: player.y, color: '#86efac' } as VFXEvent);
        break;
    }
    return;
  }
  ```

- [ ] **Step 5: Implement `chosen_strike` branches in `fireAbility`**

  Find `chosen_strike` in `fireAbility`. Add a branch before the standard damage path:

  ```ts
  if (ability.id === 'chosen_strike' && player.guildId === 'master') {
    const primed = player.primedClass ?? 'knight';
    if (primed === 'mage' || primed === 'hunter') {
      // Projectile variant
      const projDamageType = primed === 'mage' ? 'magical' : 'physical' as const;
      const projRange = primed === 'hunter' ? 450 : 280;
      const proj: Projectile = {
        id: `proj_${state.nextProjectileId++}`,
        ownerId: player.id,
        guildId: player.guildId,
        team: player.team,
        x: player.x,
        y: player.y,
        z: player.z + player.height * 0.55,
        vx: player.facing * 500,
        vy: 0,
        vz: 0,
        damage: ability.baseDamage,
        damageType: projDamageType,
        range: projRange,
        traveled: 0,
        radius: 8,
        knockdown: false,
        knockbackForce: 0,
        effects: {},
        piercing: false,
        color: primed === 'mage' ? '#818cf8' : '#8d6e63',
        type: ability.id,
        hitActorIds: [],
      };
      state.projectiles.push(proj);
      state.vfxEvents.push({ type: 'projectile_spawn', x: proj.x, y: proj.y, color: proj.color } as VFXEvent);
      return;
    }
    // knight / monk / druid → melee hit; fall through to standard single-target path
  }
  ```

- [ ] **Step 6: Run tests**

  ```bash
  npm test -- masterUtility
  ```

  Expected: all tests PASS.

- [ ] **Step 7: Run full test suite + typecheck**

  ```bash
  npm test && npm run typecheck
  ```

  Expected: all PASS.

- [ ] **Step 8: Commit**

  ```bash
  git add packages/shared/src/simulation/simulation.ts packages/shared/src/simulation/__tests__/masterUtility.test.ts
  git commit -m "feat(sim): master chosen_utility per primed class, chosen_strike projectile branch"
  ```

---

## Task 8: ActorView — stealth alpha

**Model:** Sonnet 4.6 | **Execution:** Parallel with Tasks 3–7 (only touches `ActorView.ts`)

**Files:**
- Modify: `src/game/view/ActorView.ts`

- [ ] **Step 1: Add `isLocalPlayerActor` parameter to `ActorView`**

  Find the `ActorView` constructor. Add an `isLocalPlayerActor: boolean` parameter:

  ```ts
  constructor(scene: Phaser.Scene, actor: Actor | ActorSchema, isLocalPlayerActor: boolean = false) {
    // ... existing constructor body
    this.isLocalPlayerActor = isLocalPlayerActor;
  }
  ```

  Add the property declaration:
  ```ts
  private isLocalPlayerActor: boolean;
  ```

- [ ] **Step 2: Update construction call sites**

  In `GameplayScene.ts` (or wherever `ActorView` is constructed for the player), pass `true` for the local player's actor view. For opponent and enemy views, omit the parameter (defaults to `false`).

  Search for `new ActorView` to find all construction sites. The player's view likely looks like:

  ```ts
  this.playerView = new ActorView(this, state.player, true);  // local player
  this.opponentView = new ActorView(this, state.opponent);    // remote player
  ```

- [ ] **Step 3: Replace stealth alpha logic in `syncFrom`**

  In the alpha calculation section of `syncFrom` (currently around line 1201):

  Find:
  ```ts
  if (actor.statusEffects.some(e => e.type === 'stealth')) alpha = Math.min(alpha, 0.35);
  ```

  Replace with:
  ```ts
  const isStealthed = actor.statusEffects.some((e: { type: string }) => e.type === 'stealth');
  if (isStealthed) {
    alpha = this.isLocalPlayerActor ? 0.3 : 0.0;
  }
  ```

- [ ] **Step 4: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/game/view/ActorView.ts src/game/scenes/GameplayScene.ts
  git commit -m "feat(view): stealth alpha — local player 0.3, opponent fully hidden"
  ```

---

## Task 9: MatchRoom — sync `stealthed` flag

**Model:** Sonnet 4.6 | **Execution:** Parallel with Tasks 3–7 (only touches `MatchRoom.ts`)

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Find the actor schema sync loop in `MatchRoom.ts`**

  In `packages/server/src/rooms/MatchRoom.ts`, find where actor fields are copied from `Actor` (sim state) to `ActorSchema` (Colyseus schema). It will look something like:

  ```ts
  actorSchema.hp = actor.hp;
  actorSchema.x = actor.x;
  // ... etc
  ```

- [ ] **Step 2: Remove `nocturneActive` sync, add `stealthed` sync**

  In the actor sync loop, find the line:
  ```ts
  actorSchema.nocturneActive = actor.nocturneActive;
  ```

  Replace with:
  ```ts
  actorSchema.stealthed = actor.statusEffects.some(e => e.type === 'stealth');
  ```

- [ ] **Step 3: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add packages/server/src/rooms/MatchRoom.ts
  git commit -m "feat(server): sync stealthed boolean from stealth status effect"
  ```

---

## Task 10: Final verification

**Model:** Sonnet 4.6 | **Execution:** Sequential, after all tasks complete

**Files:** Read-only verification — no changes expected

- [ ] **Step 1: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests PASS including golden test.

- [ ] **Step 2: Run typecheck**

  ```bash
  npm run typecheck
  ```

  Expected: zero errors.

- [ ] **Step 3: Run lint**

  ```bash
  npm run lint
  ```

  Expected: zero errors.

- [ ] **Step 4: Smoke test in browser (SP)**

  ```bash
  npm run dev:client
  ```

  Verify each feature manually:
  - Druid: shapeshift to bear, use all 5 bear abilities, revert — stats should change visibly (HP bar grows/shrinks)
  - Hunter: press J+K once → wolf appears; press again → mode text pops above wolf
  - Darkmage: use Eternal Night (`↓↑↓↑J`) — a dark dome should appear on the map and persist for ~6s
  - Ranger: Bear Trap (`←→J`) — place trap, walk an enemy into it — should root
  - Master: J+K cycles class text; `→→J` (Chosen Utility) should behave differently per primed class

- [ ] **Step 5: Smoke test stealth render (SP VS mode)**

  Start a VS CPU match as Vampire. Use Nocturne (`↓↑↓↑J`). Verify:
  - Vampire sprite goes to ~30% alpha (player can see themselves)
  - CPU stops attacking for the duration of stealth
  - First attack from stealth breaks stealth and deals extra damage

- [ ] **Step 6: Final commit if any fixes were needed**

  ```bash
  git add -p
  git commit -m "fix: smoke test corrections from Task 10 verification"
  ```
