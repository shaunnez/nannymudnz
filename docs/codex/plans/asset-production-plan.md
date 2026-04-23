# Asset Production Plan

## Goal

Ship a repeatable asset-production pipeline for guild character sprites and guild VFX, starting with a normalized `124x124` Leper baseline and then extending that contract through fresh PixelLab generation for the remaining guilds.

This plan is the durable source of truth for the production rollout in this repo.

## Source Of Truth

- Gameplay and class identity: `src/simulation/guildData.ts`
- Character composite pipeline: `scripts/composite-pixellab-sprites.py`
- Runtime sprite contract: `public/sprites/<guildId>/metadata.json`
- Renderer behavior: `src/rendering/sprite/`

If any older doc conflicts with `guildData.ts`, trust `guildData.ts`.

## Locked Decisions

### Character sprite size

- Normalize all new guild character outputs to `124x124` per frame.
- Regenerate Leper to establish the baseline at that size.
- Future guilds should match the Leper baseline unless we explicitly revise the contract.

### Character sheet scope

Each guild character sheet includes exactly these 15 animations:

- `idle`
- `walk`
- `run`
- `jump`
- `attack_1`
- `attack_2`
- `attack_3`
- `ability_1`
- `ability_2`
- `ability_3`
- `ability_4`
- `ability_5`
- `block`
- `hurt`
- `death`

### Ability slot mapping

Slot mapping is code-driven and must follow `guildData.ts` exactly:

- `ability_1 = abilities[0]`
- `ability_2 = abilities[1]`
- `ability_3 = abilities[2]`
- `ability_4 = abilities[3]`
- `ability_5 = abilities[4]`

RMB utilities are documented in the prompt pack, but they do not require a dedicated base-sheet slot.

### Prompt-authoring rule

Base prompts and animation prompts must be derived from the guild entry in `guildData.ts`:

- `name`
- `description`
- `color`
- `damageType`
- `resource`
- `abilities[].name`
- `abilities[].description`
- `rmb.name`
- `rmb.description`

Older flavor docs can be consulted for optional art direction, but not for slot mapping or mechanical truth.

## Production Lanes

We track two separate production lanes:

- character sheets in `public/sprites/<guildId>/`
- VFX sheets in `public/vfx/<guildId>/`

Character and VFX production can share prompt packs, but they should not share sheet contracts.

## Production Artifacts

For each guild we maintain:

- a markdown prompt pack / baseline plan
- extracted raw PixelLab output if available
- composited normalized strips in `public/sprites/<guildId>/`
- `metadata.json` matching the runtime contract
- a VFX plan that maps abilities to current runtime hooks
- generated VFX assets in `public/vfx/<guildId>/` when that lane is active

## Current Rollout Status

- `public/sprites/leper/` is the current approved character baseline and contract reference.
- `public/vfx/leper/` is the current approved first-pass VFX baseline.
- `public/vfx/knight/` exists as a first-pass Knight VFX pack and should be preserved unless tuning is needed.
- `public/sprites/knight/` exists, including raw exports, but the Knight character baseline still needs a fresh PixelLab-led review/regeneration before it should be considered signed off.

## Batch Strategy

### Phase 1: Planning

- Write or refresh the markdown plan for the batch.
- Write the concrete baseline plan for the target guild.
- Confirm the plan references `guildData.ts` for slot mapping and ability prompts.

### Phase 2: Baseline generation

- Generate or refresh the raw character export from PixelLab.
- Composite to normalized `124x124`.
- Write metadata using measured frame counts.

### Phase 3: Leper VFX pass

- Map Leper abilities to the current `VFXEvent` hooks in simulation.
- Define the Leper VFX prompt pack and asset contract.
- Identify any missing runtime hooks before asset generation.

### Phase 4: Validation

- Verify metadata shape.
- Verify frame size normalization.
- Verify the guild renders correctly in-game.

### Phase 5: Scale-out

- Reuse the same prompt and composite contract for the next guild batch.

## Initial Batch Order

- Leper
- Leper VFX
- Knight
- Mage
- Vampire

Leper is the reference batch because it is already partially present in the repo and is a strong readability test.

## Review Gates

Before a guild is considered complete:

- the prompt pack references `guildData.ts`
- slot mapping matches the code
- exported sheets are normalized to `124x124`
- `metadata.json` reflects the actual frame count and anchor contract
- the guild renders correctly with the existing sprite renderer
- the VFX plan identifies which abilities already have hooks and which need runtime support

## Definition Of Done

A guild baseline is done when:

- the markdown plan exists
- the prompt pack is grounded in `guildData.ts`
- the character sheets exist in `public/sprites/<guildId>/`
- `metadata.json` uses the normalized frame size
- the runtime can consume the result without code changes

A guild VFX baseline is done when:

- the Leper-style VFX plan exists
- each ability is mapped to a current or planned runtime hook
- the VFX asset folder exists
- any required runtime hook gaps are documented before generation begins

## Immediate Next Step

1. Regenerate Knight from fresh PixelLab prompts grounded in `guildData.ts`, using Leper as the quality and contract baseline.
2. Save and preserve the Knight raw export under `public/sprites/knight/raw/`, then composite and normalize the approved output to the `124x124` runtime contract.
3. Validate Knight sprites together with the existing Knight VFX pack in-game against the Leper baseline, tuning anchors and timing only where needed.
4. Move to Mage next once Knight passes visual review, then continue guild scale-out from that cleaner baseline.
