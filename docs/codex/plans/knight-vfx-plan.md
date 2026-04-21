# Knight VFX Plan

## Goal

Define the first Knight guild VFX pack using the runtime hooks already present in simulation and rendering, plus the smallest Knight-specific hook additions needed to make the tank kit readable.

## Source Of Truth

- Guild identity and ability definitions: `src/simulation/guildData.ts`
- Current emitted VFX hooks: `src/simulation/simulation.ts`
- Current procedural renderer: `src/rendering/particles.ts`
- Sprite VFX loader/runtime: `src/rendering/vfx/`

If prompt flavor conflicts with `guildData.ts`, trust `guildData.ts`.

## Knight Ability Map

From `src/simulation/guildData.ts`:

- `ability_1`: `Holy Rebuke`
- `ability_2`: `Valorous Strike`
- `ability_3`: `Taunt`
- `ability_4`: `Shield Wall`
- `ability_5`: `Last Stand`
- RMB: `Shield Block`

## Current Runtime Hook Inventory

The current system can render these VFX lanes:

- `aoe_pop`
- `hit_spark`
- `heal_glow`
- `status_mark`
- `channel_pulse`
- `aura_pulse`

For Knight, the first-pass pack should lean on `aoe_pop`, `hit_spark`, and `aura_pulse`.

## Knight Hook Matrix

### `Holy Rebuke`

- Code identity: point-blank holy shockwave with stun
- Runtime hook: `aoe_pop`
- Assetizable now: yes
- First-pass VFX target:
  - bright holy crest burst
  - gold and pale-blue radial shock
  - target size tier `160x160`

### `Valorous Strike`

- Code identity: melee strike that builds resolve
- Runtime hook: `hit_spark`
- Assetizable now: yes
- First-pass VFX target:
  - steel-blue slash impact
  - short-range shield-and-sword spark
  - target size tier `96x96`

### `Taunt`

- Code identity: commanding shout that forces enemy focus
- Runtime hook: `aoe_pop`
- Assetizable now: yes
- First-pass VFX target:
  - heraldic shout ring / command crest
  - warm gold pulse distinct from `Holy Rebuke`
  - target size tier `124x124`

### `Shield Wall`

- Code identity: defensive ally barrier around the Knight
- Runtime hook: `aura_pulse`
- Assetizable now: yes
- First-pass VFX target:
  - blue-white protective barrier pulse
  - shield-emblem silhouette
  - target size tier `124x124`

### `Last Stand`

- Code identity: heroic survival aura with damage boost
- Runtime hook: `aura_pulse`
- Assetizable now: partially
- First-pass VFX target:
  - golden rally aura
  - larger persistent-feeling defensive halo
  - target size tier `160x160`

Note:

The current gameplay path does not expose a dedicated expiry-heal VFX event for `Last Stand`, so the first pack focuses on the activation aura rather than the end-of-effect self-heal.

### `Shield Block`

- Code identity: short defensive utility
- Runtime hook: none dedicated
- Assetizable now: optional only
- First-pass choice: skip dedicated RMB art for now

## Knight VFX Pack Scope

### Batch 1: Generate immediately

- `holy_rebuke_burst`
- `valorous_strike_impact`
- `taunt_shout`
- `shield_wall_barrier`
- `last_stand_aura`

### Batch 2: Generate after extra gameplay hooks if needed

- `last_stand_expiry_heal`
- `shield_block_guard`

## Folder Contract

Knight VFX assets should live in:

`public/vfx/knight/`

First-pass file names:

- `holy_rebuke_burst.png`
- `valorous_strike_impact.png`
- `taunt_shout.png`
- `shield_wall_barrier.png`
- `last_stand_aura.png`

## Prompt Direction

### Palette

Use the Knight color language from code:

- guild color: `#a8dadc`
- holy accent: `#fde68a`
- command accent: `#fbbf24`
- barrier accent: `#93c5fd`
- rally accent: `#f59e0b`

### Style

- side-view readable pixel-art VFX
- transparent background
- heraldic, armored shapes rather than magical wisps
- high contrast edges
- no UI text baked into the frames

## Implementation Notes

The first Knight pass should:

- reuse the generic `aoe_pop` path for `Holy Rebuke` and `Taunt`
- use `hit_spark` for `Valorous Strike`
- emit `aura_pulse` for `Shield Wall`
- emit `aura_pulse` on `Last Stand` activation

## Definition Of Done

The Knight VFX lane is ready when:

- `public/vfx/knight/` exists
- the first-pass asset batch exists
- Knight ability routing maps to those asset keys
- the first-pass pack renders in-game without breaking fallback procedural VFX
