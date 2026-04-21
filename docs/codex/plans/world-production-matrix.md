# World Production Matrix

This file tracks world-art planning using `lore-old/zones.json` as the source of truth.

## Global Rules

- World art is a separate lane from guild combat assets.
- Prioritize MVP zones first.
- Each zone should eventually have:
  - backdrop prompt
  - landmark prompt
  - prop/environment prompt
  - palette and mood notes

## MVP Batch

| Zone Id | Display Name | Category | Backdrop Prompt | Landmark Prompt | Prop Prompt | Status | Notes |
|---|---|---|---:|---:|---:|---|---|
| ghan-toth | Ghan-Toth, the Crossroads City | hub | [ ] | [ ] | [ ] | not-started | Warm safe city, market, bank, tavern, castle |
| plains-of-nan | The Plains of Nan | pve-instance | [ ] | [ ] | [ ] | not-started | Rolling grassland, ruins, bandit camps, open sky |
| arena-of-trials | The Arena of Trials | pvp-arena | [ ] | [ ] | [ ] | not-started | Colosseum, banners, crowd energy, combat clarity |
| dragonspine-foothills | Dragonspine Foothills | outlands | [ ] | [ ] | [ ] | not-started | Harsh borderland, ore, danger, mountain wind |

## Expansion Batch

| Zone Id | Display Name | Category | Backdrop Prompt | Landmark Prompt | Prop Prompt | Status | Notes |
|---|---|---|---:|---:|---:|---|---|
| old-wood | The Old Wood | pve-instance | [ ] | [ ] | [ ] | not-started | Primeval forest, druid domain |
| bamboo-forest | The Bamboo Forest | pve-instance | [ ] | [ ] | [ ] | not-started | Monastic forest, green shafts, abbey mood |
| the-moors | The Moors | outlands | [ ] | [ ] | [ ] | not-started | Fog, castles, vampire territory |
| swamp-of-silence | The Swamp of Silence | pve-instance | [ ] | [ ] | [ ] | not-started | Undead marsh, drowned cult route |
| sea-of-claws | The Sea of Claws | pve-instance | [ ] | [ ] | [ ] | not-started | Cold sea, longships, islands |
| antharis | Antharis (Continent) | pve-instance | [ ] | [ ] | [ ] | not-started | Endgame magical landmass |
| island-of-ganennon | Ganennon, Isle of the Simyarin | pve-instance | [ ] | [ ] | [ ] | not-started | Mage pilgrimage island |
| gandor-village | Gandor Village | hub | [ ] | [ ] | [ ] | not-started | Quiet roleplay village |
| sandon-village | Sandon Village | hub | [ ] | [ ] | [ ] | not-started | Coastal fishing village |
| trackless-tundral-wastes | Trackless Tundral Wastes | outlands | [ ] | [ ] | [ ] | not-started | Endless frozen wasteland |
| professor-mountains | Professor Mountains | pve-instance | [ ] | [ ] | [ ] | not-started | Rugged cliffs and monastery mood |
| seagland | Seagland | pve-instance | [ ] | [ ] | [ ] | not-started | Marshy coast and sunken ruins |
| najira | Najira | hub | [ ] | [ ] | [ ] | not-started | Desert trade city |
| icoon-andro | Icoon Andro | pve-instance | [ ] | [ ] | [ ] | not-started | Snowbound northern ruins |
| mors | Mors | outlands | [ ] | [ ] | [ ] | not-started | Necropolis and barrows |
| pelin | Pelin | pve-instance | [ ] | [ ] | [ ] | not-started | Farmland and bandit backroads |
| island-of-hope | Isle of Hope | pve-instance | [ ] | [ ] | [ ] | not-started | Bright cliffs and ruined temple |
| island-of-despair | Isle of Despair | outlands | [ ] | [ ] | [ ] | not-started | Black tower, pirates, shipwrecks |

## World Art Direction Notes

### Ghan-Toth

- Category: hub
- Read: safe, bustling, neutral city
- Key landmarks: market square, bank plaza, guild row, Maple Tree Pub, castle
- Palette: warm civic stone, banners, merchant color

### Plains of Nan

- Category: pve-instance
- Read: open grassland, beginner zone, ruins and camps
- Key landmarks: rolling plains, bandit camp, ruin silhouettes
- Palette: windswept green, tan earth, warm sky

### Arena of Trials

- Category: pvp-arena
- Read: combat-first, stone colosseum
- Key landmarks: banners, arches, arena floor, audience energy
- Palette: stone, gold, red banners

### Dragonspine Foothills

- Category: outlands
- Read: danger, ore, wilderness, mountain exposure
- Key landmarks: cliffs, ore veins, ruined encampments, dragon hints
- Palette: cold stone, iron, sparse vegetation

## Implementation Order After Context Reset

1. Keep world work separate until the Leper baseline is validated
2. Start with the four MVP zones only
3. Expand to the rest after combat asset production is stable
