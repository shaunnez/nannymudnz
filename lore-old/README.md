# Nannymud Lore & Asset Index

Structured, reusable JSON files extracted from the Nannymud source material and adapted for our isometric action RPG.

## Files

| File | Contents | MVP Items | Total Items |
|------|----------|-----------|-------------|
| `guilds.json` | 15 playable-class candidates, mapped to MOBA/RPG roles | 6 | 15 |
| `zones.json` | World zones with PvP category rules | 4 | 13 |
| `npcs.json` | Named NPCs (merchants, bankers, trainers, royals, guards) | 16 | 16 |
| `items.json` | Equipment, consumables, materials, currencies | 13 | 17 |
| `monsters.json` | Enemies with behaviors, abilities, and loot tables | 7 | 7 |
| `quests.json` | Quest definitions with objectives and rewards | 4 | 9 |
| `sources.md` | Source attribution and IP sanitization notes | — | — |

## Design rules baked into this index

1. **IP-safe.** Every guild or zone borrowed from a real IP (Khorne, Cthulhu, Krynn, etc.) is flagged with an `ipNote` and a rename suggestion. Before shipping publicly we ship only the renames.
2. **MVP-tagged.** Every entity has an `mvp: true|false` field. The first playable milestone uses only `mvp: true` entities, a strict subset of the universe.
3. **Art-agnostic.** These files describe gameplay, lore, and stats — nothing about rendering. They survive any art-direction pivot.
4. **Role-balanced.** The 6 MVP guilds span tank / melee-DPS / ranged-DPS / support / generalist to cover every MOBA role.

## Canonical MVP scope

- **Classes:** Adventurer, Knight, Mage, Druid, Hunter, Monk
- **Zones:** Ghan-Toth (hub), Plains of Nan (PvE), Arena of Trials (PvP), Dragonspine Foothills (Outlands/PvP)
- **Core NPCs:** Padrone, Titleist, Vulcan, Beldin, Astrodeath, King Darion, Queen Yalenor, 5 guild trainers, Captain Hargrim, Fletcher Merrow, Alchemist Yves, Rook
- **Quests:** Tutorial (Arrival in Ghan-Toth), Story (Thieves in the Wheat), Bounty (Rook), Daily (Arena Challenge)
- **Monsters:** Plains Bandit, Bandit Bowman, Wild Pegasus, Dragonspine Wolf, Young Dragon, Rook, Training Dummy

## How to use these files

- **Designers:** Edit JSON directly. All fields are human-readable.
- **Client:** Load via `fetch('/lore/*.json')`. Use `mvp: true` filter for initial release.
- **Server:** Treat as read-only authoritative gameplay data. Never compute damage from client-side fields.
- **Tooling:** A future `tools/validate.ts` should verify cross-references (e.g., `quest.giver` must match an NPC id).

## Gaps

- `quests.json` has 9 entries; the original Nannymud has 136. The Scribd quest book is the canonical source but was inaccessible. Once we have it, quest count scales up ~15x without schema changes.
- `monsters.json` is thin (7); the real mudlib has hundreds. Extend incrementally from loot needs.
- No `abilities.json` yet — abilities live in the GDD as tuned prose and will be migrated to JSON as part of combat balance pass.
