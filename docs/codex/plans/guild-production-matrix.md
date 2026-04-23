# Guild Production Matrix

This file tracks guild asset production using `src/simulation/guildData.ts` as the source of truth.

## Status Key

- `not-started`
- `in-progress`
- `review`
- `done`

## Global Rules

- Character sheets use `124x124`.
- Character prompts follow slot mapping from `guildData.ts`.
- VFX are generated separately from character sheets.
- RMB prompts are optional if the utility has weak or no distinct visual identity.

## Batch Order

### Batch 1

- Leper
- Knight
- Mage

### Batch 2

- Monk
- Viking
- Hunter
- Prophet

### Batch 3

- Druid
- Vampire
- Cultist
- Champion

### Batch 4

- Darkmage
- Chef
- Adventurer
- Master

## Matrix

| Guild | Batch | Base Prompt | Character Prompts | Character Assets | VFX Prompts | VFX Assets | RMB VFX | Special Actors | Status | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|---|---|
| leper | 1 | [x] | [x] | [x] | [x] | [x] | [ ] | `rotting_husk` | review | Current character and VFX reference baseline; keep as the contract anchor unless a later cross-guild review finds a systemic issue |
| knight | 1 | [x] | [x] | [x] | [x] | [x] | [ ] | none | in-progress | VFX first pass exists; character baseline still needs fresh PixelLab review/regeneration before sign-off |
| mage | 1 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Strong readability test for projectile/caster poses |
| monk | 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Fast animation readability test |
| viking | 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Rage/brawler silhouette |
| hunter | 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `wolf_pet` | not-started | Separate pet actor lane |
| prophet | 2 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Holy support visuals should still read well solo |
| druid | 3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `bear_form`, `wolf_form` | not-started | Human-form base sheet only |
| vampire | 3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Stealth/lifesteal readability |
| cultist | 3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | `drowned_spawn` | not-started | Separate summon actor lane |
| champion | 3 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Aggressive bruiser readability |
| darkmage | 4 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Zone/control VFX focus |
| chef | 4 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Utility/support visuals, still combat-readable |
| adventurer | 4 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Generalist baseline |
| master | 4 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | none | not-started | Leave until style system is stable |

## Special Actor Checklist

| Actor Kind | Parent Guild | Base Prompt | Animation Prompts | Assets | Status | Notes |
|---|---|---:|---:|---:|---|---|
| rotting_husk | leper | [ ] | [ ] | [ ] | not-started | Revived enemy form |
| wolf_pet | hunter | [ ] | [ ] | [ ] | not-started | Companion actor |
| drowned_spawn | cultist | [ ] | [ ] | [ ] | not-started | Summoned actor |
| bear_form | druid | [ ] | [ ] | [ ] | not-started | Separate player form |
| wolf_form | druid | [ ] | [ ] | [ ] | not-started | Separate player form |

## Implementation Order After Context Reset

1. Keep Leper as the approved character/VFX contract reference
2. Regenerate Knight from fresh PixelLab prompts and validate in-game
3. Move to Mage once Knight is visually approved
4. Resume the remaining guild batches only after Knight and Mage establish the cross-guild quality bar
