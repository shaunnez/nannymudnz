# Leper VFX Plan

## Goal

Define the first guild VFX pack for Leper before generating other guilds.

This plan uses the current runtime hooks in simulation and rendering as the implementation boundary, so we know which Leper effects can be generated now and which need extra code support first.

## Source Of Truth

- Guild identity and ability definitions: `src/simulation/guildData.ts`
- Current emitted VFX hooks: `src/simulation/simulation.ts`
- Generic damage/heal/status VFX events: `src/simulation/combat.ts`
- Current procedural renderer: `src/rendering/particles.ts`
- Projectile drawing path: `src/rendering/gameRenderer.ts`

If the Leper fantasy in an art prompt conflicts with `guildData.ts`, trust `guildData.ts`.

## Leper Ability Map

From `src/simulation/guildData.ts`:

- `ability_1`: `Plague Vomit`
- `ability_2`: `Diseased Claw`
- `ability_3`: `Necrotic Embrace`
- `ability_4`: `Contagion`
- `ability_5`: `Rotting Tide`
- RMB: `Miasma`

## Current Runtime Hook Inventory

The current system can render these VFX lanes:

- `projectile_spawn`
- `aoe_pop`
- `hit_spark`
- `heal_glow`
- `blink_trail`
- `damage_number`
- `status_text`

Projectiles are also drawn directly from `state.projectiles` in `src/rendering/gameRenderer.ts`.

## Leper Hook Matrix

### `Plague Vomit`

- Code identity: necrotic cone, infected DoT, slow
- Current runtime hook: `aoe_pop`
- Assetizable now: yes
- First-pass VFX target:
  - cone burst / splash ring
  - sickly green necrotic spray
  - target size tier `160x160`

### `Diseased Claw`

- Code identity: melee strike with infected DoT
- Current runtime hook: `hit_spark`
- Assetizable now: yes
- First-pass VFX target:
  - short-range claw slash / infection spark
  - blighted green impact shards
  - target size tier `96x96`

### `Necrotic Embrace`

- Code identity: grab plus heal-for-damage fantasy
- Current runtime hook: `heal_glow`
- Assetizable now: partially
- First-pass VFX target:
  - self-centered drain/heal pulse
  - dark olive siphon glow
  - target size tier `96x96`

Note:

The current gameplay path emits self-heal visuals but does not expose a dedicated victim-side grab impact event. The first VFX pass should target the heal/drain pulse, not a two-body grab effect.

### `Contagion`

- Code identity: infect target, spread on death
- Current runtime hook: none dedicated
- Assetizable now: no
- Required before asset generation:
  - add a cast or impact event for the initial infection application
  - ideally add a spread/jump event for secondary propagation

Recommended first hook:

- a new ability-aware impact event or an enriched `hit_spark` event tagged for `contagion`

### `Rotting Tide`

- Code identity: necrotic channel, point-blank area, revive husks
- Current runtime hook: `aoe_pop` at ability resolution
- Assetizable now: partially
- First-pass VFX target:
  - large necrotic pulse for the release
  - target size tier `160x160`

Required before full asset generation:

- a sustained channel aura or pulse hook if we want the 3-second channel to read continuously
- a separate husk-raise or summon cue if we want the revive fantasy to land visually

### `Miasma`

- Code identity: toggled aura with persistent necrotic damage
- Current runtime hook: none dedicated
- Assetizable now: no
- Required before asset generation:
  - toggle-on/toggle-off aura event
  - periodic aura pulse or persistent attached VFX hook while active

## Leper VFX Pack Scope

### Batch 1: Generate immediately from current hooks

- `plague_vomit_burst`
- `diseased_claw_impact`
- `necrotic_embrace_drain`
- `rotting_tide_burst`

### Batch 2: Generate after hook support

- `contagion_mark`
- `contagion_spread`
- `rotting_tide_channel`
- `miasma_aura`

## Folder Contract

Leper VFX assets should live in:

`public/vfx/leper/`

Suggested first-pass file names:

- `plague_vomit_burst.png`
- `diseased_claw_impact.png`
- `necrotic_embrace_drain.png`
- `rotting_tide_burst.png`
- `contagion_mark.png`
- `contagion_spread.png`
- `rotting_tide_channel.png`
- `miasma_aura.png`

## Prompt Direction

### Palette

Use the Leper color language from code:

- guild color: `#738d3f`
- plague accent: `#65a30d`
- necrotic drain: `#3f6212`
- dark ultimate accent: `#1a2e05`
- contagion aura accent: `#4d7c0f`

### Style

- side-view readable pixel-art VFX
- strong silhouette against a battlefield background
- transparent background
- high contrast edges
- no UI text baked into the frames

## Immediate Coding Gaps

Before we generate the full Leper pack, the runtime should gain:

- an ability-aware event or metadata tag so VFX can distinguish one `aoe_pop` from another
- a dedicated event for `Contagion`
- a dedicated persistent or pulsed aura event for `Miasma`
- a channeling event for the sustained phase of `Rotting Tide`

## Definition Of Done

The Leper VFX lane is ready to execute when:

- the current-hook batch is approved
- the missing hook list is accepted
- `public/vfx/leper/` exists as the target folder
- the generation runbook is written
