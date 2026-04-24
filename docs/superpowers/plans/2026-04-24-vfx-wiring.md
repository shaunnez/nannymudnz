# VFX Wiring: Projectile Impacts, Teleport Flashes, and Ground-Target Detonation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all PixelLab sprites that exist on disk but never render in-game, and implement the missing ground-target detonation mechanic so Meteor (and similar abilities) actually fires.

**Architecture:** Three root causes to fix. (1) Projectile hit_spark events don't carry `guildId`/`assetKey`, so `spawnGuildVfx` always falls back to generic particles. (2) Teleport and class_swap abilities need an extra VFX event pushed for the flash sprite. (3) `isGroundTarget` abilities are excluded from the AoE code path with no alternative — they consume resources but nothing happens. Fix (1) enables all projectile sprites; fix (2) enables teleport/utility flashes; fix (3) enables Meteor, Bear Trap, Darkness, Tendril Grasp, Eternal Night. A fourth sweep (Task 6) moves 4 PNGs that were generated into the wrong guild folder and wires them.

**Tech Stack:** TypeScript; `packages/shared/src/simulation/simulation.ts` for all sim logic; `packages/shared/src/simulation/types.ts` for types; `public/vfx/*/metadata.json` for sprite registration; Vitest for tests.

---

## Files modified

| File | Change |
|---|---|
| `packages/shared/src/simulation/types.ts` | Add `guildId: GuildId \| null` to `Projectile`; add `castingAbility`, `castMs` to `PlayerController` |
| `packages/shared/src/simulation/simulation.ts` | Set `guildId` on projectile spawn; enrich hit_spark; 19 new `getAbilityAssetKey` cases; push flash events for teleports/class_swap; add `detonateGroundTarget`; casting state tick |
| `public/vfx/mage/metadata.json` | Add `frostbolt_impact`, `arcane_shard_impact`, `blink_flash`, `short_teleport_flash` |
| `public/vfx/hunter/metadata.json` | Add `aimed_shot_impact`, `piercing_volley_impact` |
| `public/vfx/darkmage/metadata.json` | Add `grasping_shadow_burst`, `shadow_bolt_impact` |
| `public/vfx/adventurer/metadata.json` | Add `quickshot_impact` |
| `public/vfx/knight/metadata.json` | Add `shield_block_flash` |
| `public/vfx/druid/metadata.json` | Add `entangle_burst` |
| `public/vfx/viking/metadata.json` | Add `harpoon_impact` |
| `public/vfx/prophet/metadata.json` | Add `smite_burst` |
| `public/vfx/chef/metadata.json` | Add `spice_toss_impact` |
| `public/vfx/master/metadata.json` | Add `class_swap_burst`, `chosen_utility_glow` |
| `public/vfx/vampire/metadata.json` | Add `hemorrhage_burst`, `shadow_step_flash`, `mist_step_flash` (after moving) |
| `public/vfx/cultist/metadata.json` | Add `whispers_aura` (after moving) |
| `public/vfx/vampire/hemorrhage_burst.png` | Moved from `cultist/` |
| `public/vfx/vampire/shadow_step_flash.png` | Moved from `darkmage/` |
| `public/vfx/vampire/mist_step_flash.png` | Moved from `cultist/` |
| `public/vfx/cultist/whispers_aura.png` | Moved from `darkmage/` |

---

## Task 1: Add `guildId` to `Projectile` and enrich projectile hit_spark

The projectile hit event at `simulation.ts:906` pushes a bare `hit_spark` with no `guildId` or `assetKey`. `spawnGuildVfx` checks for both and immediately falls through to generic particles. Fix: store the shooter's guildId on the projectile, and copy it + the looked-up assetKey into the hit event.

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/simulation/__tests__/vfxWiring.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../simulation';
import { createVsState } from '../vsSimulation';
import type { InputState } from '../types';

function idleInput(): InputState {
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

describe('projectile hit_spark carries guildId and assetKey', () => {
  it('frostbolt hit_spark has guildId=mage and assetKey=frostbolt_impact', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // frostbolt is mage ability index 0 → slot 1
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 1 };
    state = tickSimulation(state, fireInput, 16);
    state = tickSimulation(state, idleInput(), 16);

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles[0].guildId).toBe('mage');

    // Tick until the projectile hits (≤400u range, speed 450/s ≈ 56 ticks @ 16ms)
    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'mage' && e.assetKey === 'frostbolt_impact',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No enriched hit_spark found after 60 ticks');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: FAIL — `guildId` is `undefined`.

- [ ] **Step 3: Add `guildId` to the `Projectile` interface in `types.ts`**

Add `guildId` immediately after `ownerId`:

```ts
export interface Projectile {
  id: string;
  ownerId: string;
  guildId: GuildId | null;   // add this line
  team: ActorTeam;
  // ... rest unchanged
```

- [ ] **Step 4: Set `guildId` when spawning projectiles in `simulation.ts`**

In the `Projectile` object literal (around line 489), add `guildId` after `ownerId`:

```ts
const proj: Projectile = {
  id: `proj_${state.nextProjectileId++}`,
  ownerId: player.id,
  guildId: player.guildId,   // add this line
  team: player.team,
  // ... rest unchanged
```

- [ ] **Step 5: Enrich the projectile hit_spark push (~line 906)**

```ts
// Before:
state.vfxEvents.push({ type: 'hit_spark', color: proj.color, x: proj.x, y: proj.y, z: proj.z });

// After:
state.vfxEvents.push({
  type: 'hit_spark',
  color: proj.color,
  x: proj.x,
  y: proj.y,
  z: proj.z,
  guildId: proj.guildId,
  assetKey: proj.guildId ? getAbilityAssetKey(proj.type, 'hit_spark') : undefined,
});
```

- [ ] **Step 6: Run typecheck**

```
npm run typecheck
```

Expected: PASS. If you see errors about missing `guildId` on a `Projectile` literal elsewhere in the codebase, search for `nextProjectileId++` to find all construction sites and add `guildId: player.guildId` (or `guildId: null` if the shooter has no guild).

- [ ] **Step 7: Commit**

```
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/simulation.ts
git commit -m "feat(vfx): add guildId to Projectile and enrich projectile hit_spark with assetKey"
```

---

## Task 2: Wire all impact and flash sprites in `getAbilityAssetKey` and `metadata.json`

Add 15 ability → sprite mappings and update 9 metadata files. The teleport destination flash event is pushed in Task 3 — here we just register the sprites so they load.

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: 9 `public/vfx/*/metadata.json` files

- [ ] **Step 1: Add 15 cases to `getAbilityAssetKey` in `simulation.ts`**

Add these before the `default:` (around line 352):

```ts
// Mage projectile impacts
case 'frostbolt':        return eventType === 'hit_spark' ? 'frostbolt_impact'        : undefined;
case 'arcane_shard':     return eventType === 'hit_spark' ? 'arcane_shard_impact'     : undefined;
// Mage teleport flashes (event pushed in fireAbility isTeleport block)
case 'blink':            return eventType === 'aoe_pop'   ? 'blink_flash'             : undefined;
case 'short_teleport':   return eventType === 'aoe_pop'   ? 'short_teleport_flash'    : undefined;
// Hunter projectile impacts
case 'aimed_shot':       return eventType === 'hit_spark' ? 'aimed_shot_impact'       : undefined;
case 'piercing_volley':  return eventType === 'hit_spark' ? 'piercing_volley_impact'  : undefined;
// Darkmage projectile impacts
case 'grasping_shadow':  return eventType === 'hit_spark' ? 'grasping_shadow_burst'   : undefined;
case 'shadow_bolt':      return eventType === 'hit_spark' ? 'shadow_bolt_impact'      : undefined;
// Adventurer
case 'quickshot':        return eventType === 'hit_spark' ? 'quickshot_impact'        : undefined;
// Knight
case 'shield_block':     return eventType === 'aura_pulse' ? 'shield_block_flash'     : undefined;
// Druid
case 'entangle':         return eventType === 'hit_spark' ? 'entangle_burst'          : undefined;
// Viking
case 'harpoon':          return eventType === 'hit_spark' ? 'harpoon_impact'          : undefined;
// Prophet
case 'smite':            return eventType === 'hit_spark' ? 'smite_burst'             : undefined;
// Chef
case 'spice_toss':       return eventType === 'hit_spark' ? 'spice_toss_impact'       : undefined;
// Master teleport flash
case 'chosen_utility':   return eventType === 'aoe_pop'   ? 'chosen_utility_glow'    : undefined;
```

- [ ] **Step 2: Update `public/vfx/mage/metadata.json`**

```json
{
  "guildId": "mage",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "ice_nova_burst":       { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "meteor_impact":        { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "frostbolt_impact":     { "frames": 1, "frameDurationMs": 300, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "arcane_shard_impact":  { "frames": 1, "frameDurationMs": 300, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "blink_flash":          { "frames": 1, "frameDurationMs": 350, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "short_teleport_flash": { "frames": 1, "frameDurationMs": 280, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.1 }
  }
}
```

- [ ] **Step 3: Update `public/vfx/hunter/metadata.json`**

```json
{
  "guildId": "hunter",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "disengage_burst":        { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "bear_trap_snap":         { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":60}, "scale": 1.2 },
    "rain_pulse":             { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "aimed_shot_impact":      { "frames": 1, "frameDurationMs": 300, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.15 },
    "piercing_volley_impact": { "frames": 1, "frameDurationMs": 280, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.1 }
  }
}
```

- [ ] **Step 4: Update `public/vfx/darkmage/metadata.json`**

```json
{
  "guildId": "darkmage",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "darkness_burst":        { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},  "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "soul_leech_drain":      { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},  "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "eternal_night_burst":   { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "shadow_cloak_aura":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},  "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "grasping_shadow_burst": { "frames": 1, "frameDurationMs": 320, "loop": false, "frameSize": {"w":96,"h":96},  "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "shadow_bolt_impact":    { "frames": 1, "frameDurationMs": 300, "loop": false, "frameSize": {"w":96,"h":96},  "anchor": {"x":48,"y":48}, "scale": 1.2 }
  }
}
```

- [ ] **Step 5: Update `public/vfx/adventurer/metadata.json`**

```json
{
  "guildId": "adventurer",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "rallying_cry_aura":    { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "slash_impact":         { "frames": 5, "frameDurationMs": 95,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "bandage_glow":         { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "adrenaline_rush_aura": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "second_wind_glow":     { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "quickshot_impact":     { "frames": 1, "frameDurationMs": 280, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.1 }
  }
}
```

- [ ] **Step 6: Update `public/vfx/knight/metadata.json`**

```json
{
  "guildId": "knight",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "holy_rebuke_burst":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "valorous_strike_impact": { "frames": 5, "frameDurationMs": 95,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "taunt_shout":            { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.5 },
    "shield_wall_barrier":    { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "last_stand_aura":        { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "shield_block_flash":     { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

- [ ] **Step 7: Update `public/vfx/druid/metadata.json`**

```json
{
  "guildId": "druid",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "wild_growth_bloom": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "rejuvenate_glow":   { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "cleanse_glow":      { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "tranquility_pulse": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "shapeshift_burst":  { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "entangle_burst":    { "frames": 1, "frameDurationMs": 320, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.2 }
  }
}
```

- [ ] **Step 8: Update `public/vfx/viking/metadata.json`**

Viking's global frameSize is 160×160; harpoon_impact is 96×96 so it needs a per-asset override:

```json
{
  "guildId": "viking",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "whirlwind_burst":    { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "axe_swing_impact":   { "frames": 1, "frameDurationMs": 140, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "bloodlust_aura":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "shield_bash_impact": { "frames": 1, "frameDurationMs": 140, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "undying_rage_aura":  { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "harpoon_impact":     { "frames": 1, "frameDurationMs": 300, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 }
  }
}
```

- [ ] **Step 9: Update `public/vfx/prophet/metadata.json`**

Prophet's global frameSize is 96×96; smite_burst is 160×160 so it needs a per-asset override:

```json
{
  "guildId": "prophet",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "prophetic_shield_aura":    { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "bless_aura":               { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "curse_mark":               { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "divine_insight_burst":     { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "divine_intervention_aura": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "smite_burst":              { "frames": 1, "frameDurationMs": 380, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 }
  }
}
```

- [ ] **Step 10: Update `public/vfx/chef/metadata.json`**

```json
{
  "guildId": "chef",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "feast_burst":          { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "ladle_impact":         { "frames": 4, "frameDurationMs": 85,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.15 },
    "hot_soup_glow":        { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "signature_dish_pulse": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "spice_toss_impact":    { "frames": 1, "frameDurationMs": 280, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.1 }
  }
}
```

- [ ] **Step 11: Run the vfxWiring test**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: PASS on the frostbolt test. The `assetKey: 'frostbolt_impact'` is now returned by `getAbilityAssetKey`.

- [ ] **Step 12: Run full test suite and typecheck**

```
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 13: Commit**

```
git add packages/shared/src/simulation/simulation.ts \
        public/vfx/mage/metadata.json \
        public/vfx/hunter/metadata.json \
        public/vfx/darkmage/metadata.json \
        public/vfx/adventurer/metadata.json \
        public/vfx/knight/metadata.json \
        public/vfx/druid/metadata.json \
        public/vfx/viking/metadata.json \
        public/vfx/prophet/metadata.json \
        public/vfx/chef/metadata.json
git commit -m "feat(vfx): wire 15 impact/flash sprites across 9 guilds"
```

---

## Task 3: Push flash VFX event for all teleport abilities

`getAbilityAssetKey` now maps blink, short_teleport, and chosen_utility to `aoe_pop` → flash sprite. But no `aoe_pop` is pushed for teleport abilities — only `blink_trail`. Fix: add a destination flash event in the `isTeleport` block. This one change covers all three teleport abilities simultaneously.

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`

- [ ] **Step 1: Add a test for teleport flash**

Add to `vfxWiring.test.ts`:

```ts
describe('blink fires aoe_pop flash at destination', () => {
  it('blink aoe_pop has guildId=mage and assetKey=blink_flash', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // blink is mage ability index 2 → slot 3
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 3 };
    state = tickSimulation(state, fireInput, 16);

    const flash = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'mage' && e.assetKey === 'blink_flash',
    );
    expect(flash.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: FAIL — no `aoe_pop` with `assetKey=blink_flash`.

- [ ] **Step 3: Add destination flash to the `isTeleport` block in `fireAbility`**

In `simulation.ts`, find the `isTeleport` block (around line 464). Add a `pushAbilityVfx` call at the destination before the `return`:

```ts
if (ability.isTeleport) {
  const tx = player.x + player.facing * ability.teleportDist;
  pushAbilityVfx(state.vfxEvents, player, ability, {
    type: 'blink_trail',
    x: player.x,
    y: player.y,
    x2: tx,
    y2: player.y,
  });
  player.x = Math.max(20, Math.min(3980, tx));
  if (ability.effects.stealth) {
    addStatusEffect(state, player, 'stealth', 1, ability.effects.stealth.durationMs, player.id);
  }
  pushAbilityVfx(state.vfxEvents, player, ability, {
    type: 'aoe_pop',
    x: player.x,   // player.x is already the destination at this point
    y: player.y,
    radius: 40,
  });
  clearCombo(ctrl.comboBuffer);
  return;
}
```

- [ ] **Step 4: Run the test**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add packages/shared/src/simulation/simulation.ts
git commit -m "feat(vfx): push destination aoe_pop flash for all teleport abilities"
```

---

## Task 4: Wire `class_swap` burst sprite and update master metadata

`class_swap` pushes only a `status_text`. Add an `aoe_pop` alongside it, wire the assetKey, and register `class_swap_burst` + `chosen_utility_glow` in master's metadata.

**Files:**
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: `public/vfx/master/metadata.json`

- [ ] **Step 1: Add a test**

Add to `vfxWiring.test.ts`:

```ts
describe('class_swap fires aoe_pop burst', () => {
  it('class_swap aoe_pop has assetKey=class_swap_burst', () => {
    let state = createVsState('master', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // class_swap is master ability index 4 → slot 5
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 5 };
    state = tickSimulation(state, fireInput, 16);

    const burst = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'master' && e.assetKey === 'class_swap_burst',
    );
    expect(burst.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add `aoe_pop` to the `class_swap` handler and add `getAbilityAssetKey` case**

In `simulation.ts`, find the `class_swap` block (around line 649) and add a `pushAbilityVfx` call:

```ts
if (ability.id === 'class_swap' && player.guildId === 'master') {
  const classes = ['knight', 'mage', 'monk', 'hunter', 'druid'];
  const idx = classes.indexOf(player.primedClass || 'knight');
  player.primedClass = classes[(idx + 1) % classes.length];
  state.vfxEvents.push({ type: 'status_text', color: '#e0e0e0', x: player.x, y: player.y - 80, text: `Primed: ${player.primedClass}` });
  pushAbilityVfx(state.vfxEvents, player, ability, {
    type: 'aoe_pop',
    x: player.x,
    y: player.y,
    radius: 50,
  });
}
```

Then in `getAbilityAssetKey`, add (alongside the other master cases near the end of the switch):

```ts
case 'class_swap': return eventType === 'aoe_pop' ? 'class_swap_burst' : undefined;
```

- [ ] **Step 4: Update `public/vfx/master/metadata.json`**

This adds both `class_swap_burst` and `chosen_utility_glow` (chosen_utility is a teleport wired in Task 3, but it needs to be registered here). `chosen_utility_glow` is 96×96 which matches the global frameSize so no override needed; `class_swap_burst` is 160×160 so it needs one.

```json
{
  "guildId": "master",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "chosen_strike_impact": { "frames": 5, "frameDurationMs": 90,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "chosen_nuke_burst":    { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "eclipse_aura":         { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "apotheosis_aura":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "class_swap_burst":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "chosen_utility_glow":  { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

- [ ] **Step 5: Run tests and typecheck**

```
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```
git add packages/shared/src/simulation/simulation.ts public/vfx/master/metadata.json
git commit -m "feat(vfx): wire class_swap burst and chosen_utility glow sprites"
```

---

## Task 5: Implement ground-target detonation

Ground-target abilities (`isGroundTarget: true`) are excluded from both AoE and melee paths — abilities fire their cooldown/cost but do nothing else. This implements: (a) immediate detonation for `castTimeMs === 0` abilities (Bear Trap, Darkness, Tendril Grasp, Eternal Night), and (b) a `casting` state timer for `castTimeMs > 0` (Meteor: 1200ms).

The detonation center is `ctrl.groundTargetX/Y` (defaults to `{ x: 500, y: 220 }`). Cursor-tracking input is a future task; the mechanic is fully functional at the default position.

**Files:**
- Modify: `packages/shared/src/simulation/types.ts`
- Modify: `packages/shared/src/simulation/simulation.ts`

### 5a: Types

- [ ] **Step 1: Write the failing tests**

Add to `vfxWiring.test.ts`:

```ts
describe('ground-target detonation', () => {
  it('meteor enters casting state on fire', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = 100;

    // meteor is mage ability index 4 → slot 5
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 5 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.player.state).toBe('casting');
  });

  it('meteor detonates with aoe_pop after 1200ms', () => {
    let state = createVsState('mage', 'knight', 'assembly', 1);
    state.player.mp = 100;

    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 5 };
    state = tickSimulation(state, fireInput, 16);

    // Tick 1200ms + buffer (80 ticks × 16ms = 1280ms)
    for (let i = 0; i < 80; i++) {
      state = tickSimulation(state, idleInput(), 16);
    }

    const impact = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'mage' && e.assetKey === 'meteor_impact',
    );
    expect(impact.length).toBeGreaterThan(0);
    expect(state.player.state).not.toBe('casting');
  });

  it('bear_trap (castTimeMs=0) detonates immediately', () => {
    let state = createVsState('hunter', 'knight', 'assembly', 1);
    state.player.mp = 50;

    // bear_trap is hunter ability index 3 → slot 4
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 4 };
    state = tickSimulation(state, fireInput, 16);

    const snap = state.vfxEvents.filter(
      e => e.type === 'aoe_pop' && e.guildId === 'hunter' && e.assetKey === 'bear_trap_snap',
    );
    expect(snap.length).toBeGreaterThan(0);
    expect(state.player.state).not.toBe('casting');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: FAIL — `state.player.state` is `'attacking'` not `'casting'`.

### 5b: PlayerController type changes

- [ ] **Step 3: Add `castingAbility` and `castMs` to `PlayerController` in `types.ts`**

```ts
export interface PlayerController {
  input: InputState;
  comboBuffer: ComboBuffer;
  lastAttackMs: number;
  blockingMs: number;
  dodgeMs: number;
  parryWindowMs: number;
  channelMs: number;
  channelingAbility: string | null;
  castingAbility: string | null;   // add
  castMs: number;                  // add
  groundTargetX: number;
  groundTargetY: number;
  attackChain: number;
  runningDir: number;
}
```

- [ ] **Step 4: Initialize new fields in `getOrCreateController` in `simulation.ts`**

After `channelingAbility: null,`, add:

```ts
castingAbility: null,
castMs: 0,
```

### 5c: `detonateGroundTarget` function

- [ ] **Step 5: Add `detonateGroundTarget` immediately before `fireAbility` in `simulation.ts`**

```ts
function detonateGroundTarget(player: Actor, ability: AbilityDef, state: SimState, ctrl: PlayerController): void {
  const cx = ctrl.groundTargetX;
  const cy = ctrl.groundTargetY;
  const dmgMult = getDamageMultiplier(player);
  const enemies = getEnemiesOf(state, player).filter(
    e => e.isAlive && Math.hypot(e.x - cx, e.y - cy) <= ability.aoeRadius,
  );
  for (const target of enemies) {
    const isCrit = checkCrit(player, state.rng);
    const dmg = Math.round(calcDamage(ability, player.stats, target, isCrit, state.rng) * dmgMult);
    applyDamage(target, dmg, state.vfxEvents, isCrit);
    applyEffects(ability, target, player, state);
    if (ability.knockdown || dmg >= KNOCKDOWN_THRESHOLD) {
      applyKnockback(target, ability.knockbackForce || 100, player.facing, ability.knockdown, state.vfxEvents);
    }
  }
  pushAbilityVfx(state.vfxEvents, player, ability, {
    type: 'aoe_pop',
    x: cx,
    y: cy,
    radius: ability.aoeRadius,
  });
}
```

### 5d: Trigger in `fireAbility`

- [ ] **Step 6: Add ground-target dispatch in `fireAbility`**

Add this block after the `isChannel` block (around line 628), before `if (ability.isSummon)`. The `!ability.isChannel` guard keeps Rain of Arrows on its existing channel path.

```ts
if (ability.isGroundTarget && !ability.isChannel) {
  if (ability.castTimeMs > 0) {
    player.state = 'casting';
    player.animationId = 'channel';
    player.stateTimeMs = 0;
    ctrl.castingAbility = ability.id;
    ctrl.castMs = 0;
  } else {
    detonateGroundTarget(player, ability, state, ctrl);
  }
  clearCombo(ctrl.comboBuffer);
  return;
}
```

### 5e: Tick the casting state timer

- [ ] **Step 7: Add casting state tick in `handlePlayerInput`**

In `handlePlayerInput`, after the `if (player.state === 'channeling') { ... return; }` block (around line 999), add:

```ts
if (player.state === 'casting') {
  ctrl.castMs += dtMs;
  const guild = getGuild(player.guildId!);
  const ability = [...guild.abilities, guild.rmb].find(a => a.id === ctrl.castingAbility);
  if (!ability || ctrl.castMs >= ability.castTimeMs) {
    if (ability) detonateGroundTarget(actor ?? player, ability, state, ctrl);
    player.state = 'idle';
    ctrl.castingAbility = null;
    ctrl.castMs = 0;
  }
  return;
}
```

- [ ] **Step 8: Run all tests**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: all vfxWiring tests pass.

- [ ] **Step 9: Run full suite and typecheck**

```
npm test && npm run typecheck
```

Expected: all pass. The golden test (knight, no ability slots, no ground targets) is unaffected.

- [ ] **Step 10: Commit**

```
git add packages/shared/src/simulation/types.ts packages/shared/src/simulation/simulation.ts
git commit -m "feat(vfx): implement ground-target detonation — meteor, bear_trap, darkness, tendril_grasp, eternal_night"
```

---

## Task 6: Fix misplaced PNGs and wire remaining 4 vampire/cultist abilities

During PixelLab generation, 4 sprites landed in the wrong guild folders. The abilities and the PNGs are real; only the folder is wrong.

| Ability | Correct guild | PNG currently in |
|---|---|---|
| `hemorrhage` | vampire | `cultist/hemorrhage_burst.png` |
| `shadow_step` | vampire | `darkmage/shadow_step_flash.png` |
| `mist_step` (rmb) | vampire | `cultist/mist_step_flash.png` |
| `whispers` | cultist | `darkmage/whispers_aura.png` |

**Files:**
- Move: 4 PNG files
- Modify: `packages/shared/src/simulation/simulation.ts`
- Modify: `public/vfx/vampire/metadata.json`
- Modify: `public/vfx/cultist/metadata.json`

- [ ] **Step 1: Write a test**

Add to `vfxWiring.test.ts`:

```ts
describe('misplaced-PNG abilities fire correct sprites', () => {
  it('vampire hemorrhage hit_spark has assetKey=hemorrhage_burst', () => {
    let state = createVsState('vampire', 'knight', 'assembly', 1);
    state.player.mp = state.player.mpMax;

    // hemorrhage is vampire ability index 2 → slot 3
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 3 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);
    expect(state.projectiles[0].guildId).toBe('vampire');

    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'vampire' && e.assetKey === 'hemorrhage_burst',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No hemorrhage hit_spark found');
  });

  it('cultist whispers hit_spark has assetKey=whispers_aura', () => {
    let state = createVsState('cultist', 'knight', 'assembly', 1);
    // whispers costs -10 sanity (cultist resource), starts at 0 — sanity is gained on use

    // whispers is cultist ability index 1 → slot 2
    const fireInput: InputState = { ...idleInput(), testAbilitySlot: 2 };
    state = tickSimulation(state, fireInput, 16);

    expect(state.projectiles.length).toBeGreaterThan(0);

    for (let i = 0; i < 60; i++) {
      state = tickSimulation(state, idleInput(), 16);
      const hit = state.vfxEvents.filter(
        e => e.type === 'hit_spark' && e.guildId === 'cultist' && e.assetKey === 'whispers_aura',
      );
      if (hit.length > 0) return;
    }
    throw new Error('No whispers hit_spark found');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test -- --reporter=verbose packages/shared/src/simulation/__tests__/vfxWiring.test.ts
```

Expected: FAIL — assets not registered, getAbilityAssetKey cases missing.

- [ ] **Step 3: Move the 4 PNG files**

```bash
cp public/vfx/cultist/hemorrhage_burst.png   public/vfx/vampire/hemorrhage_burst.png
cp public/vfx/darkmage/shadow_step_flash.png public/vfx/vampire/shadow_step_flash.png
cp public/vfx/cultist/mist_step_flash.png    public/vfx/vampire/mist_step_flash.png
cp public/vfx/darkmage/whispers_aura.png     public/vfx/cultist/whispers_aura.png

rm public/vfx/cultist/hemorrhage_burst.png
rm public/vfx/darkmage/shadow_step_flash.png
rm public/vfx/cultist/mist_step_flash.png
rm public/vfx/darkmage/whispers_aura.png
```

- [ ] **Step 4: Add 4 cases to `getAbilityAssetKey` in `simulation.ts`**

```ts
case 'hemorrhage':  return eventType === 'hit_spark' ? 'hemorrhage_burst'  : undefined;
case 'shadow_step': return eventType === 'aoe_pop'   ? 'shadow_step_flash' : undefined;
case 'mist_step':   return eventType === 'aoe_pop'   ? 'mist_step_flash'   : undefined;
case 'whispers':    return eventType === 'hit_spark' ? 'whispers_aura'     : undefined;
```

- [ ] **Step 5: Update `public/vfx/vampire/metadata.json`**

All three new sprites are 96×96, matching vampire's global frameSize:

```json
{
  "guildId": "vampire",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "blood_drain_glow":   { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "fang_strike_impact": { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":60}, "scale": 1.25 },
    "nocturne_aura":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "hemorrhage_burst":   { "frames": 1, "frameDurationMs": 320, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "shadow_step_flash":  { "frames": 1, "frameDurationMs": 300, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "mist_step_flash":    { "frames": 1, "frameDurationMs": 280, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.15 }
  }
}
```

- [ ] **Step 6: Update `public/vfx/cultist/metadata.json`**

`whispers_aura` is 96×96; cultist's global frameSize is 160×160 so it needs a per-asset override:

```json
{
  "guildId": "cultist",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "summon_burst":  { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "madness_burst": { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "tendril_burst": { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":72}, "scale": 1.35 },
    "gate_pulse":    { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "gaze_aura":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "whispers_aura": { "frames": 1, "frameDurationMs": 300, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 }
  }
}
```

- [ ] **Step 7: Run tests and typecheck**

```
npm test && npm run typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit**

```
git add packages/shared/src/simulation/simulation.ts \
        public/vfx/vampire/ \
        public/vfx/cultist/ \
        public/vfx/darkmage/
git commit -m "feat(vfx): move misplaced PNGs to correct guild folders and wire hemorrhage, shadow_step, mist_step, whispers"
```

---

## Final verification

After all 6 tasks, run in browser (`npm run dev`):

- **Mage:** Frostbolt/Arcane Shard hit shows impact sprite. Blink shows trail + destination flash. Meteor (↓↑↓↑J, full mana) player pauses 1.2s then impact erupts at target position.
- **Hunter:** Aimed Shot / Piercing Volley hits show impact sprite. Bear Trap shows instant ground burst.
- **Knight:** Shield Block (RMB) shows aura flash.
- **Viking:** Harpoon hit shows impact sprite.
- **Adventurer:** Quickshot hit shows impact sprite.
- **Druid:** Entangle hit shows burst sprite.
- **Prophet:** Smite hit shows burst sprite.
- **Chef:** Spice Toss hit shows impact sprite.
- **Master:** Class Swap shows burst. Chosen Utility teleport shows destination flash.
- **Vampire:** Hemorrhage hit shows burst. Shadow Step / Mist Step show destination flash.
- **Cultist:** Whispers hit shows aura sprite.
- **Darkmage:** Grasping Shadow / Shadow Bolt hits show impact sprites. Darkness/Eternal Night show instant ground bursts.
