# Guild VFX Pipeline Design

**Date:** 2026-04-23
**Status:** Approved for implementation

## Summary

A repeatable pipeline for producing combat visual effects across all 15 guilds. Covers three output tracks per guild (in-game actor overlays, world-space impact sprites, UI preview overlays) plus one immediate one-time task (wiring AbilityPreview into MoveList).

Viking is the reference implementation. Knight and Leper provide the reference for world-space sprite scripts.

---

## Context

Viking's VFX work established the full pattern:

- **In-game effects** live in `ActorView.ts` as Phaser Graphics draw methods, updated every frame from `syncFrom(actor)`.
- **World-space impact bursts** are procedurally generated PNG sprite strips stored in `public/vfx/{guildId}/`, loaded via `VfxRegistry.ts`, and emitted as `VFXEvent` objects from `simulation.ts`.
- **UI previews** (dossier, move-list cards) live in `AbilityPreview.tsx` as animated SVG overlays over a `SpriteStrip` base.

These three tracks are independent implementations of the same creative brief per ability. They share palette and shape language but not code.

---

## Immediate Task: Wire AbilityPreview into MoveList

`MoveList.tsx` is a pure text table today. The dossier and guild-details screens already use `AbilityPreview`. This task makes the move list consistent.

**Changes:**

1. Add a `preview` column to `TABLE_COLS` grid — insert `100px` before the name column.
2. Pass `guildId` and `abilityIndex` (0-based slot) down to `MoveRow`.
3. Derive `animationId` inside `MoveRow`: `ability_${abilityIndex + 1}` for slots 0–4; for RMB use `'basic_attack'` as fallback.
4. Render `<AbilityPreview guildId={guildId} abilityId={ability.id} animationId={animationId} spriteScale={0.9} vfxScale={1.1} />` inside a fixed `96×96` container in the preview cell.
5. Guilds without preview specs yet show the sprite strip alone — the fallback is already handled inside `AbilityPreview`.

No changes to `AbilityPreview.tsx` itself for this task.

---

## Ability Classification Rules

Before generating any art, each ability is classified into one of four types. The type determines which tracks apply.

| Type | Hook family | Tracks needed | Skip if |
|---|---|---|---|
| **actor-attached** | `aura_pulse`, `channel_pulse`, buff state | A + C | — |
| **impact** | `hit_spark`, `aoe_pop`, `heal_glow` | A (attack swing) + B (burst strip) + C | — |
| **projectile** | `projectile_spawn` | B shape only if simple (arrow, bolt, orb — 48×48, 3 frames); else skip B | Complex art — note as blocked |
| **blink/teleport** | `blink_trail` | Track A only (dissolve or dash on actor); always skip B | — |
| **UI-only** | `damage_number`, `status_text` | none | Always skip |

**Projectile rule:** If the projectile is a simple shape (arrow, bolt, orb), add it to Track B as a small 48×48 sprite. If it requires complex art (Cultist tentacle, Darkmage zone) skip Track B for that ability and note it as blocked. Track C always gets a harpoon/bolt drawn in SVG regardless.

**Blocked effects:** Any ability missing a runtime hook in `simulation.ts` at time of production gets documented in `public/vfx/{guildId}/README.md` under "Blocked" and skipped. Do not generate art for unhooked abilities.

---

## Three-Track Specification

### Track A — ActorView.ts (in-game overlays)

**Pattern:** Private draw methods on `ActorView`, named `draw{Guild}{EffectName}`. Called from `syncFrom(actor)` via state checks on `actor.statusEffects`, `actor.state`, and `actor.animationId`.

**State checks pattern (from Viking):**
```typescript
const isGuild = actor.guildId === '{guildId}';
const isBuffActive = isGuild && actor.statusEffects.some(e => e.type === '{effectType}');
const isChanneling = isGuild && actor.state === 'channeling' && actor.animationId === 'channel';
const isAttack = isGuild && actor.state === 'attacking' && actor.animationId === 'ability_{n}';
```

**Graphics objects:** Reuse the existing shared slots (`auraFx`, `whirlwindFx`, `headFx`, `attackFx`) — they are cleared each frame and are not guild-specific. Only add a new named Graphics object if an effect genuinely requires a fifth simultaneous layer. All slots are cleared in `clearAttachedFx()`.

**Tint rule:** Buff states that override sprite tint use `setTint(colorInt)` in the existing `buffTint` block at the bottom of `syncFrom`. Add guild cases there.

**Size and placement reference:**
- Aura ellipse: `width * 1.2 to 1.4` wide, `bodyHeight * 0.9 to 1.1` tall, centered at `(0, -bodyHeight * 0.5)`
- Attack arc: radius `24–40`, centered near `(±10, -bodyHeight * 0.5)`, spans `~2.0` radians
- Head dots/orbits: radius `8–12` around `(0, -bodyHeight + 12)`

### Track B — Procedural sprite scripts

**Location:** `scripts/generate_{guildId}_vfx.ps1`

**Template:** Copy from `generate_knight_vfx.ps1`. The reusable helpers (`New-Color`, `New-Brush`, `New-Pen`, `New-Frame`, `Scale-Frame`, `Save-Strip`, `Draw-Pixel`, `Draw-Ring`) are identical across all guild scripts.

**Size tiers:**
- `96×96` — melee impacts, small bursts (`hit_spark`, `heal_glow`)
- `124×124` — medium cast effects, AoE pops on non-ultimate abilities
- `160×160` — large aura pulses, channel bursts, ultimates

**Frame counts:**
- `hit_spark`: 5 frames
- `aoe_pop`: 6 frames
- `aura_pulse`: 6–8 frames (more frames for ultimates)
- `heal_glow`: 6 frames

**Palette source:** `guildData.ts` `color` field for the primary tone; each ability's `vfxColor` for the secondary/effect tone.

**Naming:** Files named by effect, not slot. `plague_vomit_burst.png` not `ability_1.png`.

**metadata.json contract:**
```json
{
  "guildId": "{guildId}",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "{assetKey}": {
      "frames": 6,
      "frameDurationMs": 115,
      "loop": false,
      "anchor": { "x": 48, "y": 76 },
      "scale": 1.5
    }
  }
}
```
Override `frameSize` per-asset when a single guild script produces mixed sizes.

**Wiring after script runs:**

1. Add entries to `getAbilityAssetKey()` in `packages/shared/src/simulation/simulation.ts`:
   ```typescript
   case '{abilityId}':
     return eventType === '{hookFamily}' ? '{assetKey}' : undefined;
   ```
2. Add guildId to `VFX_GUILDS` array in `src/game/view/VfxRegistry.ts`.

### Track C — AbilityPreview.tsx (UI preview overlays)

**Pattern:** Add new values to `PreviewEffect` union, a case in `getAbilityPreviewSpec`, and SVG content in `PreviewOverlay`. Optionally add transform/tint in `getSpriteTransform` and scale in `getOverlayScale`.

**SVG canvas:** 120×120 viewBox. Character center is approximately `(60, 62)`. Effects draw around that anchor.

**Animation:** `progress` is a 0–1 loop over 1200ms from `useLoopProgress`. Use `Math.sin(progress * TAU)` for pulse, `progress * TAU` for orbit/rotation, `progress * N` for travel.

**Effect types by hook:**
- `hit_spark` / `aoe_pop`: arc or ring expanding outward from center, partial opacity
- `aura_pulse`: concentric ellipses around character, pulsing opacity
- `heal_glow`: inward-drawing ring or convergent dots
- `channel_pulse`: rotating or sweeping arc
- `blink_trail`: dash line or dissolve dots trailing behind
- Projectile: animated travel path (line + head shape moving right)

**Tint:** Buff states that recolor the sprite set `tint` in `AbilityPreview`'s existing `tint` derivation block. Use CSS `drop-shadow` + `sepia` + `hue-rotate` pattern matching Viking.

---

## Guild Production Order

| Step | Guild | Priority reason |
|---|---|---|
| 0 | **Viking** ✅ complete | All three tracks done. `bloodlust_aura.png`, `undying_rage_aura.png`, `whirlwind_burst.png` are superseded by actor-attached rendering in `ActorView.ts` and can be ignored. `axe_swing_impact` and `shield_bash_impact` are wired and active. No work needed. |
| 1 | **Adventurer** | Sprite baseline complete; physical/gold theme is straightforward |
| 2 | **Mage** | Sprite baseline complete; frost/arcane — iconic, sets quality bar for elemental guilds |
| 3 | **Druid** | Sprite baseline complete; nature/green — heal-heavy, exercises heal_glow track |
| 4 | **Monk** | Sprite baseline complete; chi/gold — many hit_spark abilities, fast to script |
| 5 | **Champion** | Partial sprite; blood/red — melee-heavy, simple geometry |
| 6 | **Hunter** | Partial sprite; range-heavy, exercises projectile classification |
| 7 | **Prophet** | Portrait only; holy/white — exercises aura_pulse + heal_glow |
| 8 | **Vampire** | Portrait only; shadow/crimson — exercises blink_trail + channel |
| 9 | **Darkmage** | Portrait only; dark purple — exercises zone/ground-target effects |
| 10 | **Cultist** | Portrait only; eldritch/teal — most complex blocked set |
| 11 | **Chef** | Portrait only; pink/yellow — utility-heavy, good for testing edge cases |
| 12 | **Master** | Portrait only; neutral/white — primed-class system, many effects are generic |

---

## Per-Guild Ability Classification

Classifications use: `guildData.ts` ability definitions + `docs/codex/plans/guild-ability-prompt-review.md` descriptions.

### Adventurer
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Rallying Cry | actor-attached | `aura_pulse` | `rallying_cry_aura` |
| Slash | impact | `hit_spark` | `slash_impact` |
| Bandage | actor-attached | `heal_glow` | `bandage_glow` |
| Quickshot | projectile | skip B | — |
| Adrenaline Rush | actor-attached | `aura_pulse` | `adrenaline_rush_aura` |
| Second Wind | actor-attached | `aura_pulse` | `second_wind_glow` |

### Mage
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Ice Nova | impact | `aoe_pop` | `ice_nova_burst` |
| Frostbolt | projectile | skip B | — |
| Blink | actor-attached | `blink_trail` | skip B |
| Arcane Shard | projectile | skip B | — |
| Meteor | impact | `aoe_pop` | `meteor_impact` |
| Short Teleport | actor-attached | `blink_trail` | skip B |

### Druid
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Wild Growth | impact | `heal_glow` | `wild_growth_bloom` |
| Entangle | projectile | skip B | — |
| Rejuvenate | actor-attached | `heal_glow` | `rejuvenate_glow` |
| Cleanse | actor-attached | `heal_glow` | `cleanse_glow` |
| Tranquility | actor-attached | `channel_pulse` | `tranquility_pulse` |
| Shapeshift | actor-attached | `aoe_pop` | `shapeshift_burst` |

### Monk
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Serenity | actor-attached | `aura_pulse` | `serenity_aura` |
| Flying Kick | impact | `hit_spark` | `flying_kick_impact` |
| Jab | impact | `hit_spark` | `jab_impact` |
| Five-Point Palm | impact | `hit_spark` | `five_point_impact` |
| Dragon's Fury | actor-attached | `channel_pulse` | `dragons_fury_pulse` |
| Parry | actor-attached | `aoe_pop` | `parry_flash` |

### Champion
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Tithe of Blood | actor-attached | `heal_glow` | `tithe_glow` |
| Berserker Charge | impact | `hit_spark` | `charge_impact` |
| Execute | impact | `hit_spark` | `execute_impact` |
| Cleaver | impact | `hit_spark` | `cleaver_impact` |
| Skullsplitter | impact | `aoe_pop` | `skullsplitter_burst` |
| Challenge | actor-attached | `aoe_pop` | `challenge_mark` |

### Hunter
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Disengage | impact | `aoe_pop` | `disengage_burst` |
| Piercing Volley | projectile | skip B | — |
| Aimed Shot | projectile | skip B | — |
| Bear Trap | impact | `aoe_pop` | `bear_trap_snap` |
| Rain of Arrows | actor-attached | `channel_pulse` | `rain_pulse` |
| Pet Command | skip | — | — |

### Prophet
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Prophetic Shield | actor-attached | `aura_pulse` | `prophetic_shield_aura` |
| Smite | projectile | skip B | — |
| Bless | actor-attached | `aura_pulse` | `bless_aura` |
| Curse | impact | `aoe_pop` | `curse_mark` |
| Divine Intervention | actor-attached | `aura_pulse` | `divine_intervention_aura` |
| Divine Insight | impact | `aoe_pop` | `divine_insight_burst` |

### Vampire
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Hemorrhage | projectile | skip B | — |
| Shadow Step | actor-attached | `blink_trail` | skip B |
| Blood Drain | actor-attached | `heal_glow` | `blood_drain_glow` |
| Fang Strike | impact | `hit_spark` | `fang_strike_impact` |
| Nocturne | actor-attached | `aura_pulse` | `nocturne_aura` |
| Mist Step | actor-attached | `blink_trail` | skip B |

### Darkmage
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Darkness | impact | `aoe_pop` | `darkness_burst` |
| Grasping Shadow | projectile | skip B | — |
| Soul Leech | impact | `heal_glow` | `soul_leech_drain` |
| Shadow Bolt | projectile | skip B | — |
| Eternal Night | impact | `aoe_pop` | `eternal_night_burst` |
| Shadow Cloak | actor-attached | `aura_pulse` | `shadow_cloak_aura` |

### Cultist
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Summon Spawn | impact | `aoe_pop` | `summon_burst` |
| Whispers | projectile | skip B | — |
| Madness | impact | `aoe_pop` | `madness_burst` |
| Tendril Grasp | impact | `aoe_pop` | `tendril_burst` |
| Open the Gate | actor-attached | `channel_pulse` | `gate_pulse` |
| Gaze into Abyss | actor-attached | `aura_pulse` | `gaze_aura` |

### Chef
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Feast | impact | `aoe_pop` | `feast_burst` |
| Ladle Bash | impact | `hit_spark` | `ladle_impact` |
| Hot Soup | impact | `heal_glow` | `hot_soup_glow` |
| Spice Toss | projectile | skip B | — |
| Signature Dish | actor-attached | `channel_pulse` | `signature_dish_pulse` |
| Pocket Dish | skip | — | — |

### Master
| Ability | Type | Track B hook | Asset key |
|---|---|---|---|
| Chosen Strike | impact | `hit_spark` | `chosen_strike_impact` |
| Chosen Utility | actor-attached | `blink_trail` | skip B |
| Chosen Nuke | impact | `aoe_pop` | `chosen_nuke_burst` |
| Eclipse | actor-attached | `aura_pulse` | `eclipse_aura` |
| Apotheosis | actor-attached | `aura_pulse` | `apotheosis_aura` |
| Class Swap | skip | — | — |

---

## Loop Iteration Checklist

Per guild, in order:

```
[ ] 1. Classify abilities (verify against table above)
[ ] 2. Track B: write scripts/generate_{guild}_vfx.ps1
[ ] 3. Track B: run script → public/vfx/{guild}/*.png
[ ] 4. Track B: write public/vfx/{guild}/metadata.json
[ ] 5. Track B: add entries to getAbilityAssetKey() in simulation.ts
[ ] 6. Track B: add guild to VFX_GUILDS in VfxRegistry.ts
[ ] 7. Track A: add draw{Guild}* methods to ActorView.ts
[ ] 8. Track A: wire state checks into syncFrom()
[ ] 9. Track A: add tint cases to buffTint block if needed
[ ] 10. Track C: add {guild}_* values to PreviewEffect union
[ ] 11. Track C: add cases to getAbilityPreviewSpec()
[ ] 12. Track C: add SVG content to PreviewOverlay switch
[ ] 13. Track C: add transform/tint cases if needed
[ ] 14. Write public/vfx/{guild}/README.md (note blocked effects)
[ ] 15. Commit
```

---

## Source of Truth Files

| File | Role |
|---|---|
| `packages/shared/src/simulation/guildData.ts` | Ability definitions, vfxColor per ability |
| `docs/codex/plans/guild-ability-prompt-review.md` | Plain-language ability descriptions |
| `packages/shared/src/simulation/simulation.ts` | `getAbilityAssetKey()` wiring |
| `src/game/view/ActorView.ts` | In-game overlay draw methods |
| `src/game/view/VfxRegistry.ts` | `VFX_GUILDS` list, asset loading |
| `src/ui/AbilityPreview.tsx` | UI preview overlay components |
| `src/screens/MoveList.tsx` | Move list table (needs AbilityPreview wired) |
| `public/vfx/knight/` | Track B reference (multi-frame animated strips) |
| `public/vfx/viking/` | Full three-track reference implementation |
| `scripts/generate_knight_vfx.ps1` | Track B script template |
