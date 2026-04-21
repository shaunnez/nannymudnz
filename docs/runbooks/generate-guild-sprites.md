# Runbook - Generate Guild Sprite Sheets

## Purpose

Use this runbook whenever we add or regenerate a guild character sheet.

This runbook assumes:

- `src/simulation/guildData.ts` is the gameplay source of truth
- `scripts/composite-pixellab-sprites.py` is the compositing source of truth
- normalized character output should be `124x124` unless a newer plan says otherwise

## Inputs

For each guild, gather the entry from `src/simulation/guildData.ts`:

- `id`
- `name`
- `color`
- `description`
- `damageType`
- `resource.name`
- `abilities[0..4].name`
- `abilities[0..4].description`
- `rmb.name`
- `rmb.description`

## Prompt-authoring rules

- Treat `guildData.ts` as authoritative for slot mapping and move identity.
- `ability_1` through `ability_5` map directly to `abilities[0]` through `abilities[4]`.
- Use the guild description, damage type, and color as the base silhouette and palette cues.
- Use the ability names and descriptions as the motion and VFX cues for animation prompts.
- RMB utilities can influence posing or supporting notes, but they do not require a dedicated sheet slot.

## Character output contract

Every guild sheet should contain:

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

Output folder:

`public/sprites/<guildId>/`

## Step 1 - Build the prompt pack

Create a markdown plan or prompt pack for the guild before generating assets.

Include:

- base character prompt
- animation intent for all 15 slots
- direct mapping back to `guildData.ts`

## Step 2 - Generate or collect raw frames

If using PixelLab or another generator:

- generate a base character aligned to the prompt pack
- generate the full animation set
- export or download the raw frame bundle into:

`public/sprites/<guildId>/raw/`

The raw export must contain the extracted per-frame images and the raw `metadata.json`.

## Step 3 - Composite and normalize

Run the composite script from the repo root:

```powershell
python scripts/composite-pixellab-sprites.py <guildId> --target-size 124
```

This step should:

- classify the raw animation folders
- build horizontal strips
- normalize each frame to `124x124`
- write `public/sprites/<guildId>/metadata.json`

## Step 4 - Validate metadata

Check that:

- `guildId` matches the folder
- `frameSize` is `124x124`
- `facing` is `"right"`
- the animation keys match the expected 15-slot contract
- frame counts match the actual strip widths

## Step 5 - Review against code

Cross-check the output against `guildData.ts`:

- `ability_1` matches `abilities[0]`
- `ability_2` matches `abilities[1]`
- `ability_3` matches `abilities[2]`
- `ability_4` matches `abilities[3]`
- `ability_5` matches `abilities[4]`

If an animation reads like the wrong move, fix the prompt pack or raw export before moving on.

## Step 6 - In-game verification

Run:

```powershell
npm run dev
```

Then enable sprites in the browser:

```js
localStorage.setItem('nannymud:sprites', '1')
```

Verify:

- loops feel correct for `idle`, `walk`, `run`, and `block`
- attacks and abilities play once and hold appropriately
- left/right facing flips cleanly
- the HP bar still sits correctly relative to the sprite

## Step 7 - Commit the guild baseline

Commit the normalized outputs and the markdown plan together so the asset provenance stays clear.
