# Leper 124 Baseline Plan

## Goal

Regenerate Leper as the first normalized `124x124` guild sprite baseline, using `src/simulation/guildData.ts` as the gameplay source of truth.

## Guild Source

Leper data comes from the `leper` entry in `src/simulation/guildData.ts`.

### Core identity from code

- Name: `Leper`
- Color: `#738d3f`
- Damage type: `necrotic`
- Description: `Diseased bruiser spreading infection`
- Resource: `Rot`

### Ability slot mapping from code

- `ability_1`: `Plague Vomit`
  Description: `Cone 150u, infected DoT + slow 30% 3s`
- `ability_2`: `Diseased Claw`
  Description: `Melee + infected DoT 5s`
- `ability_3`: `Necrotic Embrace`
  Description: `Grab + heal for damage dealt`
- `ability_4`: `Contagion`
  Description: `Infect target; jumps to nearby on death/spread`
- `ability_5`: `Rotting Tide`
  Description: `Channel 3s PB 180u; killed enemies revive as husks 5s`
- RMB utility: `Miasma`
  Description: `Toggle aura: 5+0.2×CON necrotic DPS 90u`

## Prompt Pack

### Base character prompt

Use a diseased heavy bruiser silhouette that matches the code identity:

`leper guild fighter, diseased bruiser spreading infection, necrotic heavy melee silhouette, ragged hooded robe, torn cloth and bandages, hunched stance, rotting skin accents, olive and blighted green palette, side-view pixel art, readable combat sprite, right-facing, plain background, 124x124`

### Animation prompt intent

- `idle`: heavy breathing, unstable stance, infection-laden sway
- `walk`: dragging diseased gait
- `run`: urgent lurching sprint
- `jump`: heavy crouch, leap, hang, land
- `attack_1`: basic diseased swipe
- `attack_2`: heavier follow-up slash
- `attack_3`: brutal combo finisher
- `ability_1`: vomit cone / plague discharge pose
- `ability_2`: corrupted claw strike
- `ability_3`: grab-and-drain embrace pose
- `ability_4`: targeted infection-casting gesture
- `ability_5`: sustained channel pose for necrotic tide
- `block`: protective hunched guard
- `hurt`: recoil from impact
- `death`: collapse from accumulated rot and damage

### Concrete prompt references from code

When refining prompts, anchor them to the mechanics in `guildData.ts`:

- infection and DoT language for `ability_1`, `ability_2`, and `ability_4`
- self-heal / lifesteal language for `ability_3`
- channel and husk-raising language for `ability_5`
- aura language for RMB, without adding a new sheet slot

## Output Contract

Leper output lives in `public/sprites/leper/` and must contain:

- `idle.png`
- `walk.png`
- `run.png`
- `jump.png`
- `attack_1.png`
- `attack_2.png`
- `attack_3.png`
- `ability_1.png`
- `ability_2.png`
- `ability_3.png`
- `ability_4.png`
- `ability_5.png`
- `block.png`
- `hurt.png`
- `death.png`
- `metadata.json`

`metadata.json` must use:

- `frameSize.w = 124`
- `frameSize.h = 124`
- `facing = "right"`
- measured frame counts from the exported strips
- anchor derived from the normalized frame size

## Regeneration Plan

1. Use the existing Leper raw export as the current baseline input.
2. Composite each animation strip from the east-facing raw frames.
3. Normalize each frame to `124x124` with nearest-neighbor scaling.
4. Rewrite `public/sprites/leper/metadata.json` to match the normalized output.
5. Keep the slot mapping aligned with the Leper ability order in `guildData.ts`.

## Acceptance

Leper baseline regeneration is complete when:

- every sheet in `public/sprites/leper/` is normalized to `124x124`
- `metadata.json` reports `124x124`
- animation names and slot mapping match `guildData.ts`
- Leper is now the reference guild for future batch regeneration
