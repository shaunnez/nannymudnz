# Assembly Stage World Kit

## Goal

Produce one authored `assembly` stage kit strong enough to become the first world-art vertical slice for story, VS, and multiplayer.

This is a world-art and stage-dressing plan, not the full gameplay integration spec.

## Current Runtime Context

- Stage id: `assembly`
- Display name: `Assembly Hall`
- Current blurb in `src/data/stages.ts`:
  `Flagstones under torchlight. The Knights swore here - mind the pillars.`
- Current implementation is still largely generic:
  - `src/game/view/BackgroundView.ts` draws a procedural outdoor/parallax scene
  - there is no dedicated authored `assembly` environment kit yet

## Visual Direction

Target read:

- knightly assembly chamber
- heavy stone architecture
- warm torchlight against cold teal rune accents
- readable side-view silhouettes for beat-em-up combat
- enough debris and interactables to make the room feel lived-in and fightable

Tone goals:

- grounded medieval stone
- ceremonial but worn
- strong foreground readability
- not too visually busy for combat

## First PixelLab Batch

These were generated as side-view transparent-background objects for the first `assembly` kit pass.

### 1. Stone pillar

- Purpose: major landmark / parallax prop / collision silhouette
- Intended placement:
  - backline architectural rhythm
  - foreground occlusion sparingly
  - stage readability anchor for the phrase "mind the pillars"
- PixelLab object id: `aa5a4b5f-c2dd-40fe-88f9-3711098d0ae7`
- Requested size: `144x256`

### 2. Wall brazier

- Purpose: light source / warm accent / repeated set dressing
- Intended placement:
  - wall rhythm between pillars
  - matchup readability through warm pools of light
- PixelLab object id: `69330392-39bf-4fd5-bd69-b5515a360438`
- Requested size: `112x160`

### 3. Hanging war banner

- Purpose: heraldic vertical accent / faction identity / soft silhouette break
- Intended placement:
  - behind combat plane
  - between pillars or behind raised platform areas
- PixelLab object id: `ac7b306b-14e0-47ff-9407-8f0c4f56500f`
- Requested size: `96x192`

### 4. Broken wooden bench

- Purpose: damage aftermath / throwable-stage flavor / low prop clutter
- Intended placement:
  - lower foreground edge
  - side pockets of the arena
- PixelLab object id: `3440108f-90ca-4931-bcb2-102f079bc850`
- Requested size: `160x96`

### 5. Ceremonial throwing dagger

- Purpose: pickup / throwable / prototype item loop
- Intended placement:
  - drop/pickup prototype
  - can help reconnect the old item loop to the new world slice
- PixelLab object id: `b29c2942-838c-4291-8741-1a7996f3cecf`
- Requested size: `64x64`

## Tileset Status

I attempted to generate a dedicated sidescroller tileset for the `assembly` floor/wall contract first.

Result:

- `mcp__pixellab__create_sidescroller_tileset` failed with a tool-side validation error related to `color_image`
- This appears to be a tool/path issue, not a rejected art direction

Implication:

- the reliable current lane is to build the first pass from authored side-view props and objects
- tileset generation should be revisited once the PixelLab tileset path is stable

## Recommended Next Batch

After reviewing the first five objects, generate:

1. assembly archway
2. rune-lit stained glass window
3. raised dais / oath platform
4. cracked flagstone floor chunk
5. weapon rack or shield stand
6. alternate pickup set:
   - bottle
   - chair leg
   - short spear

## Second PixelLab Batch

These were queued as the next `assembly` environment pass.

### 6. Grand stone archway

- Purpose: strong architectural frame / rear-stage landmark
- Intended placement:
  - center-rear or side-rear composition anchor
  - helps define the hall as an enclosed ceremonial space
- PixelLab object id: `81b92f5e-3186-4b6e-b58a-93919bcbf905`
- Requested size: `192x224`
- Downloaded to: `public/world/assembly/raw/archway_grand_stone.png`

### 7. Stained-glass window

- Purpose: color accent / heraldic backdrop / vertical depth break
- Intended placement:
  - upper wall backdrop
  - rear composition layer behind banners or pillars
- PixelLab object id: `a2672fb4-7321-43e1-bfcc-1e495fd7ab07`
- Requested size: `128x192`
- Downloaded to: `public/world/assembly/raw/window_stained_glass.png`

### 8. Raised stone dais

- Purpose: ceremonial oath platform / focal landmark
- Intended placement:
  - center-back or boss-fight composition anchor
  - can define a special combat pocket without changing the gameplay lane yet
- PixelLab object id: `a9a1ede1-5739-4837-b6b8-0143cf6a0055`
- Requested size: `224x128`
- Downloaded to: `public/world/assembly/raw/dais_raised_stone.png`

### 9. Cracked flagstone floor chunk

- Purpose: floor dressing / stage transition accent / combat-plane texture prop
- Intended placement:
  - low foreground and near the combat line
  - helps replace the current generic ground treatment
- PixelLab object id: `0dcfe3e1-26c9-467e-ba92-987f8b202e16`
- Requested size: `192x96`
- Downloaded to: `public/world/assembly/raw/floor_chunk_flagstone_cracked.png`

### 10. Weapon rack

- Purpose: hall dressing / prop clutter / implied interactable set piece
- Intended placement:
  - side pockets of the arena
  - near bench / debris clusters
- PixelLab object id: `7fd54fea-45c9-49ca-a52b-61d184a18223`
- Requested size: `160x128`
- Downloaded to: `public/world/assembly/raw/weapon_rack_shields_spears.png`

## Integration Notes

The first integration target should be a handcrafted `assembly` scene that replaces or overrides the current generic background path for that stage only.

Suggested layering:

1. deep wall / hall backdrop
2. pillars and banners
3. combat plane
4. low clutter props
5. pickups / throwables

## Review Questions

When reviewing the generated objects, ask:

1. does the silhouette read instantly in side view?
2. does it feel like the same world as Knight/Leper combat assets?
3. is the prop too noisy for combat readability?
4. does the palette support torchlight plus teal rune contrast?
5. would the object still read at in-game scale?
