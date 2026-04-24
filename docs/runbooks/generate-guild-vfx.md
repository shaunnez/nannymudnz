# Runbook - Generate Guild VFX

## Purpose

Use this runbook when producing guild VFX sheets after the character baseline exists.

This runbook is VFX-first, not character-first. It assumes the guild already has a prompt pack and a gameplay definition in `src/simulation/guildData.ts`.

## Source Of Truth

- ability identity: `src/simulation/guildData.ts`
- current runtime hooks: `packages/shared/src/simulation/simulation.ts` and `packages/shared/src/simulation/combat.ts`
- current Phaser renderer behavior: `src/game/view/ParticleFX.ts` and `src/game/view/VfxRegistry.ts`
- existing examples: `public/vfx/knight/` and `public/vfx/leper/`

## Step 1 - Map the guild to runtime hooks

Before generating any art, list the guild abilities and note which runtime hook each one currently uses.

Supported hook families today:

- `projectile_spawn`
- `aoe_pop`
- `hit_spark`
- `heal_glow`
- `blink_trail`
- `damage_number`
- `status_text`
- `status_mark`
- `channel_pulse`
- `aura_pulse`

If an ability has no hook yet, do not generate the asset blindly. Write down the missing hook and decide whether to add it before generation.

## Step 2 - Define the VFX pack scope

Split the guild VFX into:

- effects that can be generated immediately from existing hooks
- effects blocked on missing runtime support

For each effect, define:

- effect name
- source ability
- hook family
- target size tier
- palette notes

Suggested size tiers:

- `96x96` for melee impacts, small bursts, drains
- `124x124` for medium pulses and cast effects
- `160x160` for large area bursts, channels, or ultimate effects

## Step 3 - Create the guild VFX folder

Create:

`public/vfx/<guildId>/`

Keep generated sheets, `metadata.json`, and any per-guild notes there.

## Step 4 - Generate the first hook-compatible batch

Start with the abilities that already have a usable hook.

Author prompts from:

- `abilities[i].name`
- `abilities[i].description`
- `rmb.name`
- `rmb.description`
- `vfxColor`
- guild `color`

Do not rely on old lore notes for slot mapping.

For Pixellab generation, use:

- transparent background
- `view: side`
- medium or high detail
- selective outline or lineless depending on the guild silhouette
- a canvas that matches the intended size tier

Prompt for readable combat silhouettes first, not painterly flourish.

## Step 5 - Name assets by effect, not by slot alone

Prefer filenames that describe the rendered effect:

- `plague_vomit_burst.png`
- `diseased_claw_impact.png`
- `necrotic_embrace_drain.png`

This makes it easier to reuse a single effect across multiple future hook variants.

## Step 6 - Document blocked effects

If an ability is missing a hook, record:

- what the gameplay fantasy is
- what hook is missing
- which file path or subsystem should emit it

Do this before moving on to the next guild.

## Step 7 - Integrate after the pack exists

Once the effect pack exists, make sure the runtime contract is complete:

- `public/vfx/<guildId>/metadata.json` includes frame count, timing, anchor, and scale per asset
- `packages/shared/src/simulation/simulation.ts` maps the ability hook to `assetKey`
- `src/game/view/VfxRegistry.ts` loads the new guild folder
- `src/game/view/ParticleFX.ts` falls back procedurally if an asset is missing

Current runtime behavior:

- if a `VFXEvent` carries `guildId` and `assetKey`, Phaser will prefer the sprite strip
- if the asset is missing or unloaded, the old procedural effect still renders

## First live packs

Knight and Leper already have first-pass packs wired into the runtime. Use them as templates for:

- naming
- anchor placement
- scale tuning
- metadata structure

For Leper, the immediate batch is:

- `Plague Vomit`
- `Diseased Claw`
- `Necrotic Embrace`
- `Rotting Tide` release burst

The likely blocked batch is:

- `Contagion`
- `Rotting Tide` sustained channel
- `Miasma`
