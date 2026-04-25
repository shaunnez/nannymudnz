# Stage Mode Overhaul — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Overview

Overhaul the story/stage mode to add a linear level progression with unlocking, distinct enemy compositions per stage, guild actors as story enemies, a fully wired boss phase system, and larger/more frequent item drops. A second phase covering new item types is explicitly out of scope and tracked separately.

## Scope

**In scope:**
- Level locking and unlock progression (localStorage)
- Per-stage wave compositions for all 9 stages
- Guild actors in story mode (Option C — any level can spawn guild-controlled fighters)
- 8 new boss EnemyDef entries
- Boss phase system wired up (already partially implemented)
- Item rendering at 2× size + higher base drop rates for existing rock/club

**Out of scope (Phase 2 — item expansion):**
- New item types (knife, bat, axe, chain, gems, bomb, consumables, crates)
- Elemental projectile effects (fireball, ice, poison, lightning)
- Gem passive hold bonuses
- Item/pickup interaction model for melee vs ranged characters

---

## 1. Level Progression & Locking

### Data

`src/data/stages.ts` — the 9 stages map to levels 1–9 in order:

| Level | Stage ID | Name |
|-------|----------|------|
| 1 | `assembly` | Assembly |
| 2 | `market` | Market |
| 3 | `kitchen` | Kitchen |
| 4 | `tower` | Tower |
| 5 | `grove` | Grove |
| 6 | `catacombs` | Catacombs |
| 7 | `throne` | Throne |
| 8 | `docks` | Docks |
| 9 | `rooftops` | Rooftops |

`StageMeta.enabled` becomes a derived property, not a hardcoded field.

### Hook: `useStageProgress`

New file: `src/state/useStageProgress.ts`

```ts
interface StageProgress {
  unlockedStages: StageId[]   // stages the player has beaten
}
const STORAGE_KEY = 'nannymud_stage_progress'
```

- `getProgress(): StageProgress` — reads localStorage, defaults to `{ unlockedStages: [] }`
- `unlockStage(id: StageId): void` — appends to array, writes back
- `isUnlocked(id: StageId): boolean` — `id === 'assembly'` always true; others check array

### Stage Select UI

`src/screens/StageSelect.tsx` — locked stages render with:
- Padlock icon overlay on the preview
- Reduced opacity (`0.4`)
- Click blocked (`canCommit` returns false)

### Victory → Unlock

On stage completion, the existing victory/results flow calls `unlockStage(nextStageId)` before transitioning back to the menu.

---

## 2. Per-Stage Wave Compositions

### Wave type change

`packages/shared/src/simulation/types.ts` — `WaveEnemy` becomes a discriminated union:

```ts
type WaveEnemy =
  | { kind: EnemyActorKind; count: number; offsetX?: number; offsetY?: number }
  | { guild: GuildId; count: number; difficulty: number }
```

`packages/shared/src/simulation/enemyData.ts` — `STAGE_WAVES` changes from a flat `Wave[]` to:

```ts
export const STAGE_WAVES: Record<StageId, Wave[]> = { ... }
```

### Level designs

**Level 1 — Assembly** (intro, easy)
- Wave 1 (x=400): 2 plains_bandit
- Wave 2 (x=900): 3 plains_bandit, 1 bandit_archer
- Wave 3 (x=1400): 2 plains_bandit, 2 bandit_archer
- Wave 4 (x=2000): 4 plains_bandit, 1 bandit_archer
- Wave 5 (x=2600): 3 plains_bandit, 2 bandit_archer
- Wave 6 (x=3800): **Boss: bandit_king**

**Level 2 — Market** (wolf pack rush)
- Wave 1: 3 wolf
- Wave 2: 4 wolf, 2 bandit_archer
- Wave 3: 5 wolf, 2 bandit_archer
- Wave 4: 6 wolf, 3 bandit_archer
- Wave 5: 4 wolf, 4 bandit_archer
- Boss: **giant_blue_wolf**

**Level 3 — Kitchen** (brutes + vampire guild)
- Wave 1: 2 bandit_brute
- Wave 2: 2 bandit_brute, 2 {guild:'vampire', difficulty:2}
- Wave 3: 3 bandit_brute, 2 {guild:'vampire', difficulty:3}
- Wave 4: 2 bandit_brute, 4 {guild:'vampire', difficulty:3}
- Wave 5: 4 {guild:'vampire', difficulty:4}
- Boss: **vampire_lord**

**Level 4 — Tower** (cultist swarms)
- Wave 1: 3 {guild:'cultist', difficulty:2}
- Wave 2: 2 {guild:'cultist', difficulty:2}, 3 drowned_spawn
- Wave 3: 3 {guild:'cultist', difficulty:3}, 4 drowned_spawn
- Wave 4: 4 {guild:'cultist', difficulty:3}, 2 drowned_spawn
- Wave 5: 5 {guild:'cultist', difficulty:4}
- Boss: **cult_high_priest**

**Level 5 — Grove** (druid + hunter ambushes)
- Wave 1: 2 {guild:'druid', difficulty:2}
- Wave 2: 2 {guild:'druid', difficulty:2}, 2 {guild:'hunter', difficulty:2}
- Wave 3: 2 wolf, 2 {guild:'hunter', difficulty:3}, 1 {guild:'druid', difficulty:3}
- Wave 4: 4 {guild:'hunter', difficulty:3}, 2 wolf
- Wave 5: 3 {guild:'druid', difficulty:4}, 2 {guild:'hunter', difficulty:4}
- Boss: **elder_druid**

**Level 6 — Catacombs** (disease and dark magic)
- Wave 1: 3 {guild:'leper', difficulty:3}
- Wave 2: 2 {guild:'leper', difficulty:3}, 3 rotting_husk
- Wave 3: 2 {guild:'darkmage', difficulty:3}, 3 rotting_husk
- Wave 4: 2 {guild:'leper', difficulty:4}, 2 {guild:'darkmage', difficulty:4}
- Wave 5: 4 {guild:'darkmage', difficulty:4}, 2 rotting_husk
- Boss: **plague_darkmage**

**Level 7 — Throne** (elite fighters)
- Wave 1: 3 {guild:'viking', difficulty:4}
- Wave 2: 2 {guild:'knight', difficulty:4}, 2 {guild:'viking', difficulty:4}
- Wave 3: 3 {guild:'knight', difficulty:4}, 2 {guild:'champion', difficulty:4}
- Wave 4: 2 {guild:'viking', difficulty:5}, 3 {guild:'champion', difficulty:5}
- Wave 5: 2 {guild:'knight', difficulty:5}, 2 {guild:'champion', difficulty:5}, 1 {guild:'viking', difficulty:5}
- Boss: **warlord**

**Level 8 — Docks** (CPU guild gauntlet)
- Wave 1: 2 bandit_brute
- Wave 2: 3 {guild:'adventurer', difficulty:4}, 2 bandit_brute
- Wave 3: 3 {guild:'mage', difficulty:4}, 3 {guild:'monk', difficulty:4}
- Wave 4: 3 {guild:'prophet', difficulty:5}, 3 {guild:'viking', difficulty:5}
- Wave 5: 2 {guild:'master', difficulty:5}, 2 {guild:'champion', difficulty:5}
- Boss: **shadow_master**

**Level 9 — Rooftops** (everything, full gauntlet)
- Wave 1: 3 plains_bandit, 3 wolf
- Wave 2: 3 {guild:'vampire', difficulty:5}, 2 bandit_brute
- Wave 3: 3 {guild:'darkmage', difficulty:5}, 3 rotting_husk
- Wave 4: 2 {guild:'knight', difficulty:5}, 2 {guild:'viking', difficulty:5}, 2 {guild:'champion', difficulty:5}
- Wave 5: 4 {guild:'cultist', difficulty:5}, 4 drowned_spawn
- Boss: **bandit_king_ii** (3-phase)

All non-boss enemies gain a flat stat multiplier based on level: `hpMult = 1 + (level - 1) * 0.15`, `damageMult = 1 + (level - 1) * 0.12`. Applied at spawn time.

---

## 3. Guild Actors in Story Mode

### Spawning

`packages/shared/src/simulation/simulation.ts` — wave spawn logic:

```ts
for (const enemy of wave.enemies) {
  if ('guild' in enemy) {
    const actor = createGuildActor(state, enemy.guild, spawnX, spawnY)
    actor.isPlayer = false
    actor.aiDifficulty = enemy.difficulty
    state.enemies.push(actor)
  } else {
    // existing path
    spawnEnemy(state, enemy.kind, spawnX, spawnY)
  }
}
```

`createGuildActor` already exists for VS/MP; it just needs `isPlayer = false` and to be pushed to `state.enemies` rather than treated as opponent.

### AI tick

Story mode tick currently calls `tickEnemyAI(actor, state)` for all enemies. Guild actors with `!actor.isPlayer && actor.guildId` instead call `tickVsAI(actor, state, actor.aiDifficulty)` — the same AI used for VS CPU mode.

### Target resolution

`vsAI` currently looks for `state.player` as its target. In story mode, guild enemies should target `state.player` as well — no change needed. `state.player.isPlayer === true` remains the target discriminator.

---

## 4. Boss System

### EnemyDef extension

`packages/shared/src/simulation/types.ts`:

```ts
interface EnemyDef {
  // ... existing fields ...
  phases?: BossPhase[]   // only set on boss enemies
}
```

### Phase transition (simulation.ts)

Each tick, for any actor with `def.phases`:

```ts
const nextPhase = def.phases[actor.bossPhase]
if (nextPhase && actor.hp / actor.hpMax < nextPhase.hpThreshold) {
  actor.bossPhase += 1
  actor.attackSpeedMult = (actor.attackSpeedMult ?? 1) * nextPhase.attackSpeedMult
  actor.damageMult      = (actor.damageMult ?? 1)      * nextPhase.damageMult
  if (nextPhase.summons) spawnSummons(state, actor, nextPhase.summons)
  state.vfxEvents.push({ type: 'boss_phase', actorId: actor.id, phase: actor.bossPhase })
}
```

`actor.attackSpeedMult` and `actor.damageMult` are new optional `number` fields on `Actor` (default `1.0`), multiplied into existing attack/damage calculations.

### New EnemyDef entries

| ID | Level | HP | Phases |
|----|-------|----|--------|
| `giant_blue_wolf` | 2 | 1400 | 1: @50% spawn 4 wolves, speed ×1.3 |
| `vampire_lord` | 3 | 1800 | 2: @60% spawn 3 vampire fighters; @30% damageMult ×1.5 |
| `cult_high_priest` | 4 | 1600 | 2: @50% spawn drowned_spawn swarm (6); @25% damageMult ×1.5 |
| `elder_druid` | 5 | 1500 | 1: @40% spawn 4 wolf + 2 hunter guild; damageMult ×1.4, speed ×1.2 |
| `plague_darkmage` | 6 | 2000 | 2: @60% poison AOE field; @30% speed ×1.4 |
| `warlord` | 7 | 2500 | 3: @70% speed ×1.2; @40% damage ×1.3; @15% both ×1.4 |
| `shadow_master` | 8 | 2200 | 2: @50% spawn 3 guild CPU (difficulty 5); @25% speed ×2 |
| `bandit_king_ii` | 9 | 3200 | 3: @66% spawn 3 brutes; @33% spawn bandit_king ghost (half HP); @15% all stats ×1.5 |

All bosses use `ai: 'boss'` (existing behaviour). Phase-specific summons use existing `spawnEnemy`/`createGuildActor` paths.

---

## 5. Item Size & Drop Rate

### PickupView

`src/game/view/PickupView.ts` — all `drawBody` geometry scaled by a `PICKUP_SCALE = 2` constant:
- Rock: 16×12 → 32×24
- Club: shaft and head dimensions ×2

### Drop rates

`packages/shared/src/simulation/enemyData.ts` — `dropWeaponChance` increases:
- `bandit_archer`: rock chance 20% → 50%
- `bandit_brute`: club chance 100% (unchanged, already good)
- All new boss enemies: 100% drop of a rock or club on defeat

---

## 6. Sprite Strategy

New enemy/boss types need sprites. Two sources:

**PixelLab (user-generated):** Use for humanoid bosses and bipedal creature bosses. Recommended size: 80px (consistent with existing guilds, `DISPLAY_SCALE = 1.5`). Generate: vampire_lord, cult_high_priest, plague_darkmage, warlord, shadow_master, bandit_king_ii.

**Free assets:** For wolf-type and creature bosses.
- **CraftPix free section** (`craftpix.net/freebies`) — knights, samurai, werewolf packs, royalty-free commercial use. Dark Oracle chibi fits plague_darkmage/cult_high_priest well.
- **OpenGameArt LPC wolf** (`opengameart.org`) — CC-BY, 64×64, 6 colour variants — use for giant_blue_wolf scaled up.
- **itch.io free beat-em-up packs** — 100×100 side-view characters, up to 25 animations each.

All sprites follow the existing key convention: `tex:boss_${bossId}:${animId}`. `AnimationRegistry` fallback chain handles missing animations gracefully during development.

---

## File Map

| File | Change |
|------|--------|
| `packages/shared/src/simulation/types.ts` | Add `WaveEnemy` union, `Actor.attackSpeedMult/damageMult`, `EnemyDef.phases` |
| `packages/shared/src/simulation/enemyData.ts` | `STAGE_WAVES` → `Record<StageId, Wave[]>`; add 8 new boss EnemyDef entries |
| `packages/shared/src/simulation/simulation.ts` | Guild actor spawning in wave loop; boss phase transition tick; vsAI dispatch for guild enemies |
| `src/data/stages.ts` | Remove hardcoded `enabled`; derive from `useStageProgress` |
| `src/state/useStageProgress.ts` | New — localStorage progress hook |
| `src/screens/StageSelect.tsx` | Padlock UI for locked stages; read `isUnlocked()` |
| `src/screens/` (results/victory screen) | Call `unlockStage` on victory |
| `src/game/view/PickupView.ts` | `PICKUP_SCALE = 2` constant applied to all geometry |

---

## Phase 2 (deferred)

Full item type expansion: knife, bat, axe, chain, torch, throwing_star, bomb, smoke_bomb, bottle, 5 gem types, 5 consumable types, crate props, elemental projectile VFX, gem passive hold bonuses, melee/ranged interaction model.
