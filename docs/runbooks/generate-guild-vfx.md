# Runbook - Generate Guild VFX

## Purpose

Use this runbook when producing guild VFX sheets after the character baseline exists.

This runbook is VFX-first, not character-first. It assumes the guild already has a prompt pack and a gameplay definition in `src/simulation/guildData.ts`.

## Source Of Truth

- ability identity: `src/simulation/guildData.ts`
- current runtime hooks: `src/simulation/simulation.ts` and `src/simulation/combat.ts`
- current renderer behavior: `src/rendering/particles.ts` and `src/rendering/gameRenderer.ts`

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

Keep generated sheets and any per-guild notes there.

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

Only after the effect pack exists should we wire up:

- VFX metadata loading
- sprite VFX rendering
- event-to-asset routing

## Leper-first note

For Leper, the likely immediate batch is:

- `Plague Vomit`
- `Diseased Claw`
- `Necrotic Embrace`
- `Rotting Tide` release burst

The likely blocked batch is:

- `Contagion`
- `Rotting Tide` sustained channel
- `Miasma`
