# Knight 124 Baseline Plan

## Goal

Bring Knight onto the normalized `124x124` guild sprite baseline established by Leper, using `src/simulation/guildData.ts` as the gameplay source of truth.

## Current Repo Constraint

Knight already has a checked-in sprite sheet set in `public/sprites/knight/`, but it is still on the older `68x68` contract and there is no `raw/` PixelLab export in the repo.

That makes this an interim normalization pass:

- preserve the existing Knight animation strips
- rebuild them onto the `124x124` baseline from the original `68x68` sheets
- keep the original pixels readable by anchoring them into a larger canvas instead of stretching them to fill it
- rewrite `metadata.json` to the normalized contract

If a raw Knight export is added later, we should regenerate from source instead of treating the upscaled strips as final.

## Guild Source

Knight data comes from the `knight` entry in `src/simulation/guildData.ts`.

### Core identity from code

- Name: `Knight`
- Color: `#a8dadc`
- Damage type: `physical`
- Description: `Heavy tank with taunts and crowd control`
- Resource: `Resolve`

### Ability slot mapping from code

- `ability_1`: `Holy Rebuke`
  Description: `PB AoE 120u, stun 1s`
- `ability_2`: `Valorous Strike`
  Description: `Melee, +10 resolve on hit`
- `ability_3`: `Taunt`
  Description: `120u cone, force enemies to attack knight 3s`
- `ability_4`: `Shield Wall`
  Description: `100u radius, 30% dmg reduction to allies 3s`
- `ability_5`: `Last Stand`
  Description: `8s: cannot drop below 1HP; +50% dmg; ends with 25% self-heal`
- RMB utility: `Shield Block`
  Description: `50% dmg reduction 2s`

## Prompt Pack

### Base character prompt

Use a broad, readable defensive silhouette grounded in the code identity:

`knight guild fighter, heavy tank with taunts and crowd control, plated front-line warrior, large kite shield, longsword, pale steel and sky-blue heraldic palette, disciplined stance, side-view pixel art, readable combat sprite, right-facing, plain background, 124x124`

### Animation prompt intent

- `idle`: planted guarded breathing stance with shield forward
- `walk`: deliberate armored march
- `run`: shield-leading charge
- `jump`: heavy crouch, leap, airborne shield tuck, land
- `attack_1`: disciplined sword jab
- `attack_2`: heavier shield-and-sword follow-up
- `attack_3`: committed armored finisher
- `ability_1`: holy ground burst / shield slam release pose
- `ability_2`: forceful valorous melee strike
- `ability_3`: taunting shout or commanding challenge pose
- `ability_4`: defensive shield-wall projection pose
- `ability_5`: heroic last-stand rally stance
- `block`: full guard with shield coverage
- `hurt`: armored recoil from impact
- `death`: heavy collapse in armor

### Concrete prompt references from code

When refining prompts, anchor them to the mechanics in `guildData.ts`:

- holy stun language for `ability_1`
- resolve-building weapon impact for `ability_2`
- command / taunt readability for `ability_3`
- ally-protecting barrier language for `ability_4`
- invulnerable rally / heroic survival language for `ability_5`
- shielded defense language for RMB, without adding a new sheet slot

## Output Contract

Knight output lives in `public/sprites/knight/` and must contain:

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
- the existing measured frame counts from the legacy strips
- normalized anchors derived from the `124x124` contract

## Normalization Plan

1. Use the original checked-in `68x68` Knight strip sheets as the baseline source.
2. Rebuild each frame into a `124x124` canvas using the normalized anchor contract.
3. Allow only a mild anchored upscale when needed for readability, instead of scaling all the way to fill `124x124`.
4. Rewrite `public/sprites/knight/metadata.json` to match the normalized output.
5. Keep the slot mapping aligned with the Knight ability order in `guildData.ts`.
6. Treat this as an interim baseline until a raw Knight export is checked in.

## Acceptance

Knight baseline normalization is complete when:

- every sheet in `public/sprites/knight/` uses `124x124` frames
- `metadata.json` reports `124x124`
- animation names and slot mapping match `guildData.ts`
- Knight renders through the existing sprite runtime on the same contract as Leper
