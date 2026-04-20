# Nannymud — Full Build Prompt for a Code AI

> Paste the content below this line into a code-generating AI. It is a self-contained brief to build the complete game (not an MVP slice). Stack is left open; the receiving AI should choose a proven browser-native stack (e.g. Phaser/Pixi/Three + Colyseus/socket.io + Node + Postgres).

---

## PROMPT — BEGIN

Build a browser-based, real-time multiplayer **isometric action RPG** called **Nannymud**. Implement the full design below end-to-end (client + server + persistence). Server-authoritative simulation is non-negotiable; the client is a renderer + input sender. Ship a runnable repo with a README covering local setup.

# 1. Concept

A **MOBA-style combat loop grafted onto a Guild Wars 1-style world**. Persistent social hubs (towns with banks, merchants, quest NPCs) plus instanced combat zones (PvE adventures, consensual ranked arenas, and open-PvP "Outlands" with corpse looting). Camera is 3/4 top-down at ~30° elevation. Fast, skillshot-driven combat with 5 abilities on cooldowns, positional play, dodges, and status effects.

## Design pillars (priority order — higher wins conflicts)

1. **Combat first.** Every other system serves the 5-ability + movement loop.
2. **Meaningful PvP with consequences.** Safe zones are truly safe; PvP zones are truly dangerous.
3. **MUD soul.** Named NPCs, lived-in towns, small stories, 15 guilds with distinct identities.
4. **Browser-native.** Ships as a URL, runs in a Chrome tab on a mid-range laptop.
5. **Data-driven.** All class stats, ability definitions, zone data, monster stats, and item definitions must be external JSON (or equivalent) — not hardcoded.

# 2. Art direction

- **Isometric pixel art**, 2:1 projection. Iso mapping:
  ```
  isoX = (worldX − worldY) + centerX
  isoY = (worldX + worldY) / 2 + centerY
  ```
- **Character sprites: 92×92 pixels, 8-direction** walk cycles (NE, E, SE, S, SW, W, NW, N). Minimum per class: walk (4 frames × 8 dir = 32), idle, 5 ability animations, hit-reaction, death.
- **Environment tiles: 64×32 iso tiles.**
- **Saturated per-zone palette.** Each zone has a distinct 4-color palette (hub = warm browns/creams, Foothills = cold greys/blues, Bamboo Forest = jade/cream, etc.).
- **Readable silhouettes.** A player should identify class and current ability from across the screen. Soft 1px outlines on characters.
- **Reference stack (feel, not copy):** Don't Starve Together (silhouettes/UI), Eastward (mood/lighting), classic 2.5D iso JRPGs (proportions).

# 3. World model (four zone types, strict rules)

| Category | PvP | Instancing | Purpose |
|---|---|---|---|
| **Hub** | Disabled. Guards insta-kill flagged players. | One shared instance per shard (~50 players). | Social, banking, shopping, quests. |
| **PvE instance** | Disabled. Friendly fire off. | Per player/party (1–4). | Solo/coop story content. |
| **Arena** | Consensual. | Matchmade per match. | Ranked competitive (3v3 primary, 1v1 and 5v5 queues). |
| **Outlands** | Open PvP. Killer gets PK-flagged. | Per party shard (4–12). | Risk/reward endgame farming. |

Zones are selected by talking to gate NPCs in hubs; entering creates/joins the appropriate server room. Leaving returns to the hub.

### Zones to build (full list, not a slice)

- **Ghan-Toth** — primary hub town (safe). Banks, merchants, quest kiosks, class trainers, arena signup desk, PK-only camp accessible only to flagged players.
- **Plains of Nan** — tutorial PvE zone, levels 1–10. Low-danger monsters, first quests.
- **Old Wood** — mid-level PvE instance, druid-themed. Treants, fey.
- **Bamboo Forest** — mid-level PvE, monk-themed. Bandits, tigers.
- **Dragonspine Foothills** — Outlands entry, levels 15+. Bandits, wolves, PK risk.
- **Cathbad's Abbey** — safe pilgrim zone; home of the monks; Redemption quest giver for PK flag removal.
- **Iceblink's Hold** — frozen coastal hub; viking origin; launches sea raid instances.
- **Ganennon** — island mage college (PvE instance).
- **Rivendell / Mirror Pool** — druid sanctuary (PvE instance). (Mirror Pool is the non-IP rename of the original Laurana's Pool.)
- **Rook's Camp** (Dragonspine) — PK-only micro-hub: basic gear vendor, no bank, no quests.
- **Sea of Claws** — coastal Outlands for viking raids.
- **Arena of Trials** — matchmade arena rooms (3v3, 1v1, 5v5 variants).
- **Deep Sleeper's Shrine** — cultist endgame Outlands.
- **Blood Pact Stronghold** — red-throne endgame Outlands.
- **Masters' Enclave** — endgame prestige hub (unlocked after mastering any class).

# 4. Character system

## 4.1 Creation

- Unique name per shard.
- Appearance: 3 body types × 6 skin tones × 10 hairstyles × 5 colors.
- **Guild choice locks class.** 15 guilds available at launch.

## 4.2 Primary stats

- **Strength (STR)** — melee damage, carry capacity
- **Dexterity (DEX)** — attack speed, crit chance, ranged damage
- **Constitution (CON)** — max HP, HP regen
- **Intelligence (INT)** — spell damage, max mana
- **Wisdom (WIS)** — healing power, mana regen
- **Charisma (CHA)** — merchant prices, faction rep gain, some class effects

## 4.3 Derived stats

HP, Mana/Resource, Armor, Magic Resist, Move Speed, Attack Speed, Crit Chance, Crit Damage.

## 4.4 Leveling

- Level cap **50** (base classes); Masters prestige cap **60**.
- XP curve: `xp_to_next = 100 × level^1.8`.
- Per level: +3 stat points (auto-distributed by class profile), +10 HP, +5 resource, +1 skill point.
- Skill points upgrade abilities (see §5.3).

# 5. Combat

## 5.1 Controls

- **1–5** — ability slots (each class has 5)
- **LMB** — basic attack / move-click
- **RMB** — class-specific utility (varies per class)
- **Space** — universal dodge roll, ~0.4s i-frames, 4s CD
- **Q** — interact (NPC, loot, door)
- **Tab** — cycle targets

## 5.2 Ability structure

Every ability has: cast type (`instant` / `skillshot` / `ground-target` / `point-blank` / `channel` / `self`), cooldown (seconds), resource cost, damage formula scaling off a primary stat, VFX + SFX cues, and optional status effect payload.

## 5.3 Skill points

Each ability has 3 upgrade tiers, purchased with skill points. Each tier adds one of: +damage scaling, −cooldown, added status effect, or size/range increase. A max-level character has ~150 skill points across their kit.

## 5.4 Damage formula (use exactly this)

```
final_damage = (ability.base + ability.scale × stat)
             × (1 − target.armor / (target.armor + 100))            // physical mit
             × (1 − target.magic_resist / (target.magic_resist + 100))  // magical mit
             × (crit ? (1.5 + crit_damage_bonus) : 1)
             × random(0.95, 1.05)
```

Crit is checked first; ±5% variance applied after. Crit chance is class/gear-driven, base 5%.

## 5.5 Status effects to implement

slow, root, stun, silence, knockback, blind, fear, taunt, shield, HoT, DoT (physical / magical / nature / holy / shadow / necrotic / psychic), lifesteal, armor-shred, magic-shred, untargetable, stealth.

## 5.6 Death & respawn

HP ≤ 0 → **downed** (3s window; ally can revive, restoring 25% HP) → **dead**.

- **Hub/PvE/Arena**: respawn at nearest graveyard, no drops.
- **Outlands**: body drops all carried gold (banked gold is safe); attacker opens a corpse UI of equipped items and picks **exactly one**; remaining items return to victim on respawn; corpse decays in 5 minutes.

# 6. The 15 guilds (full kits)

All 15 guilds are playable at launch. Each has a unique resource, a distinct role, and 5 abilities with full stat blocks. Resource regen is `+X per second` out of combat (usually higher) and `+Y per second` in combat (lower), except where the resource has bespoke rules (Rage builds from damage dealt/taken; Bloodtally builds from kills; Sanity-inverse grows from casting).

Abilities listed as `base + scale × stat` for damage. All cooldowns in seconds. Movement is via **LMB-click** for Adventurer/Knight/Druid/Prophet/Chef/Master, **WASD** as alternate. Skillshot abilities are aimed at cursor position.

### Per-class RMB utility (quick reference)

| Class | RMB utility |
|---|---|
| Adventurer | Second wind — instantly restore 30% stamina, 20s CD |
| Knight | Shield block — reduce incoming damage 50% for 2s, 15s CD |
| Mage | Short teleport — 4m step to cursor, 8s CD (shorter than Blink) |
| Druid | Shapeshift — toggle bear/wolf form, costs 20 essence, 5s form lockout |
| Hunter | Pet command — move pet to cursor / set aggressive-defensive-passive, 0s CD |
| Monk | Parry — 0.3s window; on success, refund 1 chi and stun attacker 1s, 10s CD |
| Viking | Shield bash — 40 + 0.5×STR dmg, knockback, 12s CD |
| Prophet | Divine insight — reveal enemies in 12m for 4s, 30s CD |
| Vampire | Mist step — 6m instant reposition + 1s stealth, costs 20 bloodpool, 12s CD |
| Cultist | Gaze into the abyss — next ability cast costs 0 sanity but deals +30% dmg, 25s CD |
| Champion | Challenge — force target to take +20% dmg from you for 5s, 18s CD |
| Darkmage | Shadow cloak — 60% move speed, untargetable by ranged for 2s, 20s CD |
| Chef | Pocket dish — consume a prepared dish for its buff (see §6.13), 3s CD |
| Leper | Miasma — 3m aura, 5 + 0.2×CON necrotic DPS to enemies, toggle, 2 rot/s |
| Master | Class swap — cycle the signature ability pulled from each base class, 1s CD |

---

## 6.1 Adventurers Guild — Adventurer (generalist / bruiser)

- **Resource:** Stamina (100 max, +5/s out of combat, +2/s in combat)
- **Primary stats:** STR, CON, DEX
- **Damage type:** physical
- **Lore:** Welcoming hall for newcomers; fundamentals of combat, exploration, survival.
- **Playstyle:** Jack-of-all-trades; every tool but master of none. Forgiving onboarding class.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Slash | Melee instant | 2s | 10 stam | 30 + 0.7×STR dmg, 1m cone |
| 2 | Rallying Cry | Self/AoE | 15s | 30 stam | +15% move speed and +10% dmg to self and allies in 6m for 4s |
| 3 | Quickshot | Skillshot | 4s | 15 stam | 35 + 0.6×DEX dmg, 10m range |
| 4 | Bandage | Self-channel (1.5s) | 20s | 25 stam | Heal 50 + 0.5×CON over channel; interruptible |
| 5 | Adrenaline Rush (ult) | Self | 75s | 40 stam | For 6s: +40% attack speed, +25% damage, immune to slow/root |

---

## 6.2 The Assembly of Knights — Knight (tank)

- **Resource:** Resolve (100 max, builds from taking damage (+1/10 HP lost), drains +1/s)
- **Primary stats:** CON, STR, WIS
- **Damage type:** physical
- **Lore:** Noble warriors bound by Compassion, Valor, Honor, Honesty. Defenders of Camelot hold highest rank.
- **Playstyle:** Frontline shield-bearer. Soak, taunt, peel. Low burst, high staying power.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Valorous Strike | Melee instant | 3s | 15 resolve | 40 + 0.8×STR dmg, generates 10 resolve |
| 2 | Taunt | 6m cone | 8s | 20 resolve | Forces enemies to attack knight for 3s; +20 armor during |
| 3 | Shield Wall | Self/AoE | 20s | 30 resolve | 4m radius; allies gain 30% dmg reduction for 3s |
| 4 | Holy Rebuke | Point-blank AoE | 14s | 35 resolve | 60 + 1.0×STR dmg in 4m, stun 1s |
| 5 | Last Stand (ult) | Self | 90s | 50 resolve | For 8s: cannot drop below 1 HP; +50% damage; ends with 25% self-heal |

---

## 6.3 Mages Guild — Mage (ranged burst)

- **Resource:** Mana (200 max, +5/s out of combat, +2/s in combat)
- **Primary stats:** INT, WIS
- **Damage type:** magical
- **Lore:** Scholars of the arcane arts. The Simyarin of Ganennon are the most disciplined branch.
- **Playstyle:** Squishy ranged nuker. Skillshot projectiles, AoE control, defensive blink.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Frostbolt | Skillshot | 3s | 20 mana | 40 + 0.8×INT dmg, 30% slow 2s, 12m range |
| 2 | Arcane Shard | Skillshot (pierce) | 5s | 30 mana | 60 + 1.2×INT dmg, pierces all targets in line |
| 3 | Blink | Instant self | 10s | 40 mana | Teleport 8m toward cursor, breaks roots/slows |
| 4 | Ice Nova | Point-blank AoE | 14s | 50 mana | 80 + 1.5×INT dmg in 4m, root 1.5s |
| 5 | Meteor (ult) | Ground-target | 90s | 100 mana | 1.2s delay → 200 + 3.0×INT dmg in 5m |

---

## 6.4 Druids — Druid (healer-shifter)

- **Resource:** Essence (100 max, +4/s out of combat, +2/s in combat)
- **Primary stats:** WIS, INT, CON
- **Damage type:** nature
- **Lore:** Keepers of the Old Wood and Bamboo Forest. Channel life-force; heal and shapechange.
- **Playstyle:** Primary healer. RMB shifts into bear (melee tank) or wolf (melee burst) form.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Rejuvenate | Target ally (12m) | 4s | 20 ess | Heal 30 + 0.8×WIS + 40 + 0.5×WIS HoT over 6s |
| 2 | Wild Growth | AoE ground-target | 12s | 35 ess | 4m circle heals 15 + 0.4×WIS/s for 5s |
| 3 | Entangle | Skillshot | 10s | 25 ess | 20 + 0.5×INT dmg, root 2s |
| 4 | Cleanse | Target ally | 8s | 20 ess | Remove 2 debuffs, heal 40 + 0.6×WIS |
| 5 | Tranquility (ult) | Channel (4s) | 120s | 80 ess | Heal all allies in 8m for 50 + 0.8×WIS/s; knockback immunity while channeling |

**Shapeshift kits (replace abilities while in form; cost 20 essence to enter, 5s cooldown to swap):**

- **Bear form** — Swipe (M1 melee 50+1.0×STR), Roar (PB stun 1s, 8s CD), Thick Hide (+30 armor 6s, 15s CD).
- **Wolf form** — Bite (M1 40+0.8×DEX), Pounce (leap 6m + 50+0.7×DEX, 6s CD), Bleed (DoT 10+0.2×DEX/s for 5s, 8s CD).

---

## 6.5 The Hunters Guild — Hunter (marksman + pet)

- **Resource:** Focus (100 max, +3/s baseline; basic attacks generate +5 focus)
- **Primary stats:** DEX, (Perception), CON
- **Damage type:** physical
- **Lore:** Trackers and rangers of the Dragonspine wilderness. Bow, trap, pet.
- **Playstyle:** Ranged physical DPS with a persistent pet companion (wolf/hawk/spider — chosen at level 5).

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Aimed Shot | Skillshot (0.5s draw) | 3s | 15 focus | 50 + 1.0×DEX dmg, 18m range, crit-chance +15% |
| 2 | Piercing Volley | Skillshot | 6s | 25 focus | Line of 3 arrows, each 25 + 0.4×DEX dmg |
| 3 | Bear Trap | Ground-target | 12s | 20 focus | Armed trap, triggers on enemy entry: 40 + 0.5×DEX dmg + root 1.5s, lasts 30s |
| 4 | Disengage | Self | 10s | 20 focus | Leap 6m backward, drop a smoke cloud (blind 1s) |
| 5 | Rain of Arrows (ult) | Ground-target channel (3s) | 80s | 50 focus | 6m radius, 40 + 0.4×DEX dmg/s for 3s + 30% slow in zone |

**Pet (`Pet` is a MonsterState owned by the hunter):** auto-attacks the hunter's target; RMB sets mode. Pet HP ~50% of hunter's. Dies → respawn at 5 focus/s channel.

---

## 6.6 The Holy Monks Order — Monk (melee assassin)

- **Resource:** Chi (5 max, orbs; basic attacks generate 1 chi)
- **Primary stats:** DEX, WIS, STR
- **Damage type:** physical
- **Lore:** Ascetics of Cathbad Abbey. Train body as weapon.
- **Playstyle:** Fast, mobile melee. Dash-in, combo, briefly untargetable.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Jab | Melee instant | 1s | 0 chi | 25 + 0.6×DEX dmg; generates 1 chi |
| 2 | Flying Kick | Dash (6m) | 5s | 1 chi | 40 + 0.8×DEX dmg at end, knock up 0.5s |
| 3 | Five-Point Palm | Melee instant | 8s | 3 chi | 80 + 1.2×DEX dmg + 40 dmg detonation after 4s |
| 4 | Serenity | Self | 14s | 2 chi | Untargetable 1s, cleanse all CC, +30% move speed 3s |
| 5 | Dragon's Fury (ult) | Melee channel (2s) | 90s | 5 chi | 5 strikes over 2s, each 40 + 0.5×DEX dmg; final strike stuns 1.5s |

---

## 6.7 Vikings Guild — Viking (berserker)

- **Resource:** Rage (100 max, starts at 0, builds from damage dealt/taken (1 rage per 5 dmg), decays 2/s out of combat)
- **Primary stats:** STR, CON
- **Damage type:** physical
- **Lore:** Berserkers from the frozen north; sail from Iceblink's hold.
- **Playstyle:** Builds aggression. Sustains via lifesteal. Ultimate grants temporary immortality.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Axe Swing | Melee cone | 2s | 0 | 35 + 0.8×STR dmg in 2m cone; builds rage |
| 2 | Whirlwind | Point-blank channel (2s) | 10s | 25 rage | 3m radius, 25 + 0.5×STR dmg per 0.5s; lifesteal 20% |
| 3 | Harpoon | Skillshot | 12s | 20 rage | 40 + 0.7×STR dmg; pulls target 4m toward viking |
| 4 | Bloodlust | Self | 20s | 30 rage | 8s: +25% attack speed, lifesteal 15% |
| 5 | Undying Rage (ult) | Self | 120s | 60 rage | 6s: cannot die (HP clamps at 1); all damage taken is converted to 30% healing when effect ends |

---

## 6.8 Prophets — Prophet (cleric / off-healer / buffer)

- **Resource:** Faith (100 max, +3/s; increases by 2 when a prayer resolves successfully)
- **Primary stats:** WIS, CHA
- **Damage type:** holy
- **Lore:** Divine seers. Channel foresight and the word of their chosen god.
- **Playstyle:** Off-heal + buff/debuff. Prophetic shields pre-empt damage spikes.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Smite | Target enemy (15m) | 3s | 15 faith | 40 + 0.9×WIS holy dmg; reveals target 3s |
| 2 | Bless | Target ally (15m) | 8s | 25 faith | +15% dmg and +10% move speed 8s |
| 3 | Curse | Target enemy | 12s | 30 faith | Target takes +20% dmg and deals −15% dmg for 6s |
| 4 | Prophetic Shield | Target ally | 15s | 40 faith | Shield absorbs next 80 + 1.2×WIS dmg; if consumed, heals target 30 + 0.5×WIS |
| 5 | Divine Intervention (ult) | Target ally | 150s | 80 faith | Ally becomes invulnerable 3s; when expires, heals to 100% HP |

---

## 6.9 Vampires — Vampire (stalker, lifesteal)

- **Resource:** Bloodpool (100 max; starts at 50; restored by damaging enemies (+1 per 2 dmg dealt), drains +1/s in sunlight zones)
- **Primary stats:** DEX, CHA, CON
- **Damage type:** necrotic
- **Lore:** Ancient secretive bloodline. Feed silently, spread slowly. Sunlight is weakness.
- **Playstyle:** Stealth stalker. Burst combo with lifesteal. Weaker in day zones.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Fang Strike | Melee instant | 2s | 0 | 30 + 0.7×DEX dmg; heals 40% of damage dealt |
| 2 | Blood Drain | Target channel (2s, 6m) | 10s | 20 blood | 50 + 1.0×DEX dmg over channel; heal full amount |
| 3 | Shadow Step | Self | 12s | 25 blood | Teleport 8m behind target, 1s stealth |
| 4 | Hemorrhage | Target (10m) | 14s | 30 blood | DoT 15 + 0.3×DEX/s for 5s; target bleeding enemies heal vampire 10% of overflow |
| 5 | Nocturne (ult) | Self | 100s | 60 blood | 6s: invisible, +50% move speed, next ability from stealth deals +100% dmg and applies 2s fear |

**Sunlight penalty:** in zones tagged `daylight: true`, vampire bloodpool drains +1/s and lifesteal is halved. Encourage night-zone farming.

---

## 6.10 Cult of the Drowned — Cultist (formerly Cult of Cthulhu; renamed for IP)

- **Resource:** Sanity-inverse (0–100; starts at 0; rises with each cast; damages self when ≥80; decays 2/s when not casting; at 100 triggers 2s self-stun + 20% HP self-dmg)
- **Primary stats:** INT, CHA
- **Damage type:** psychic
- **Lore:** Worshippers of the Deep Sleeper. Maddening whispers, tentacled summons, sanity as cost.
- **Playstyle:** DoT-focused caster. Tempo management: cast too fast and you hurt yourself.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Whispers | Skillshot | 2s | +10 sanity | 30 + 0.8×INT psychic dmg; silence 1s |
| 2 | Tendril Grasp | Ground-target | 10s | +20 sanity | Tentacles erupt in 3m for 4s; root enemies that touch for 1s; 20 + 0.4×INT DoT/s |
| 3 | Madness | Target enemy (12m) | 14s | +25 sanity | Target attacks random direction for 2s, takes 30 + 0.6×INT dmg/s |
| 4 | Summon Spawn | Ground-target | 20s | +30 sanity | Summon a deep-spawn (150 HP, melee 25 + 0.3×INT) for 20s |
| 5 | Open the Gate (ult) | Channel (3s) | 120s | +50 sanity | Massive tentacle erupts in 8m for 2s; 150 + 2.0×INT dmg, pulls enemies to center |

---

## 6.11 Champions of the Red Throne — Champion (formerly Champions of Khorne; renamed for IP)

- **Resource:** Bloodtally (stacks 0–10; +1 stack on assist, +3 stacks on kill; decays 1 stack every 15s; +3% damage per stack)
- **Primary stats:** STR, CON
- **Damage type:** physical
- **Lore:** Bloodthirsty warriors who exist only to kill. Hardest guild to play.
- **Playstyle:** Aggressive bruiser punished for retreating. Passive: `Forward Only` — lose 1 HP/s while moving away from nearest enemy in combat (within 15m).

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Cleaver | Melee instant | 2s | 0 | 40 + 0.9×STR dmg in 2m arc |
| 2 | Execute | Melee instant | 6s | 0 | 60 + 0.8×STR dmg; +100% dmg vs targets below 30% HP |
| 3 | Berserker Charge | Dash (8m) | 10s | 0 | 35 + 0.6×STR dmg at end, knock up 0.5s, grants 1 bloodtally |
| 4 | Tithe of Blood | Self | 15s | 0 | Consume 3 bloodtally: +30% attack speed 5s, heal 50 + 0.6×STR |
| 5 | Skullsplitter (ult) | Melee instant | 90s | 0 | Massive overhead: 120 + 2.0×STR dmg; if kills, ult CD is halved and bloodtally +3 |

---

## 6.12 Dark Guild — Darkmage (shadow controller)

- **Resource:** Mana (200 max, +4/s out of combat, +2/s in combat)
- **Primary stats:** INT, WIS
- **Damage type:** shadow (magical)
- **Lore:** Sworn to extinguish all light from the world of Nanny.
- **Playstyle:** Slows, roots, darkness zones that obscure enemy vision.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Shadow Bolt | Skillshot | 3s | 20 mana | 45 + 0.9×INT dmg, applies stacking `chilled` (up to 5, each −5% move speed) |
| 2 | Darkness | Ground-target | 12s | 35 mana | 5m circle; enemies inside have their vision reduced to 3m for 4s |
| 3 | Grasping Shadow | Skillshot | 10s | 30 mana | First enemy hit rooted 1.5s, 30 + 0.6×INT dmg |
| 4 | Soul Leech | Target enemy (12m) | 14s | 40 mana | 60 + 1.0×INT dmg; restore 50% as mana |
| 5 | Eternal Night (ult) | Ground-target | 120s | 90 mana | 8m circle for 6s; enemies inside are silenced and take 25 + 0.4×INT/s shadow dmg |

---

## 6.13 Chefs Guild — Chef (utility support)

- **Resource:** Stamina (100 max, +4/s); recipes are crafted via a `Kitchen` station in hubs. A chef can carry up to 5 prepared dishes.
- **Primary stats:** INT, CHA
- **Damage type:** physical (primarily indirect)
- **Lore:** Knowledge-based guild. Learned recipes let them cook powerful buffs.
- **Playstyle:** Weak solo; potent in groups. Buff the team, debuff via bad ingredients.

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Ladle Bash | Melee instant | 3s | 10 stam | 25 + 0.5×STR dmg; dazes target 0.5s |
| 2 | Hot Soup | AoE ally-target (8m) | 10s | 20 stam | Heal 40 + 0.5×INT + 20 regen/s for 4s |
| 3 | Spice Toss | Skillshot | 8s | 15 stam | Blind 2s + 10 + 0.2×INT/s DoT for 3s |
| 4 | Feast | Self/AoE (6m) | 30s | 40 stam + consume 1 dish | Dish effect applied to all allies in range (buffs below) |
| 5 | Signature Dish (ult) | Self-channel (2s) | 180s | 60 stam + consume 2 dishes | Grants the combined effect of both dishes to allies in 10m for 20s |

**Dish buffs (craft at Kitchen with recipes found in the world):**

- **Hearty Stew** — +50 max HP, +2 HP/s for 30s
- **Fiery Chili** — +15% dmg, +10% attack speed for 20s
- **Crystal Tea** — +30% resource regen for 30s
- **Dragon's Broth** — 20% dmg reduction for 15s
- **Arcane Pastry** — +25% ability power (scales with INT) for 25s

---

## 6.14 Lepers — Leper (diseased bruiser)

- **Resource:** Rot (100 max, +3/s; drained by aura and abilities; many enemies killed by rot-DoT grant +10)
- **Primary stats:** CON, STR
- **Damage type:** necrotic
- **Lore:** Outcasts afflicted with the rotting curse. Always PK-flagged. Framed strictly as fantasy curse.
- **Playstyle:** Extreme high-risk/reward. Permanently PK-flagged → can never enter safe hubs. Instead spawns at Leper Colony (its own micro-hub with all basic services but no bank).

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Diseased Claw | Melee instant | 2s | 5 rot | 30 + 0.7×STR dmg + `infected` DoT (10 + 0.2×CON/s for 5s) |
| 2 | Plague Vomit | Cone (5m) | 8s | 15 rot | 40 + 0.6×STR dmg + infected DoT + 30% slow 3s |
| 3 | Contagion | Target enemy | 12s | 20 rot | Infection spreads: when target dies or is hit by leper, infection jumps to nearest enemy in 5m |
| 4 | Necrotic Embrace | Melee | 14s | 25 rot | Grab target; 50 + 0.8×STR dmg; heal leper for damage dealt |
| 5 | Rotting Tide (ult) | Point-blank channel (3s) | 120s | 50 rot | 6m radius, 30 + 0.4×CON necrotic/s for 3s; enemies killed within revive as friendly rotting husks (50 HP, 5s life) |

---

## 6.15 The Masters of Nannymud — Master (prestige hybrid)

- **Resource:** Mastery (200 max, +5/s; slow-regen pool)
- **Primary stats:** balanced across all
- **Damage type:** mixed
- **Lore:** Elite endgame guild. Unlocked only after completing a "Path of Mastery" questline available once you reach level 50 in any base class. Membership in Masters is one-shot per account.
- **Playstyle:** Hybrid kit — picks one signature ability from each of five base classes at creation. RMB cycles which is currently "primed" (slot effects shift).

| Slot | Name | Cast | CD | Cost | Effect |
|---|---|---|---|---|---|
| 1 | Chosen Strike | Melee/ranged depending on primed class | 3s | 15 mastery | 40 + 1.0×primary dmg |
| 2 | Chosen Utility | Instant | 8s | 25 mastery | Uses utility from primed class (blink / taunt / shield / stealth / cleanse) |
| 3 | Chosen Nuke | Varies | 12s | 40 mastery | Uses a burst ability from primed class; scaled at +10% over base |
| 4 | Eclipse | Self | 20s | 40 mastery | 5s: all 5 slots cycle through every primed-class version sequentially |
| 5 | Apotheosis (ult) | Self | 240s | 100 mastery | 10s: all cooldowns halved; all damage +20%; heal 2% max HP/s |

Masters have access to **Masters' Enclave**, a private prestige hub with unique cosmetics, mounts, and a leaderboard.

---

# 7. PvP rules & PK flagging

## 7.1 Zone rules recap

- **Hub** — PvP disabled; guards kill flagged players.
- **PvE** — PvP disabled, friendly fire off.
- **Arena** — consensual, matchmade; no real-world consequence.
- **Outlands** — open; killer gets flagged.

## 7.2 The PK flag

Triggered when you kill another player in Outlands (not Arena).

- Red skull icon above character.
- Hub guards (Level 60+ elite) attack on sight — usually fatal.
- Game warns at hub borders; entry blocked.
- Flagged players can only use PK-only micro-hubs (Rook's Camp, Leper Colony).
- Regular NPCs refuse quests/trade.
- **Base flag duration:** 24 real-time hours from last PK kill; refreshed by each new kill.
- **Redemption quest** at Cathbad's Abbey: 5 peaceful quests + 10,000 gold donation + 24h cooldown → clears flag.

## 7.3 Outlands corpse looting

On player death in Outlands:

1. Body drops all carried gold (banked gold safe).
2. Attacker opens corpse UI listing equipped items.
3. Attacker picks **exactly one** item.
4. Remaining items return to victim on respawn.
5. Corpse decays after 5 minutes; unclaimed items are lost.

This is the single most important system for PvP weight — design zone content, markets, and gear economy around it.

# 8. Economy

## 8.1 Currencies

- **Copper / Silver / Gold** — standard, 100:1 ratios.
- **Mastery Tokens** — arena wins, daily quests. Spend on cosmetics, prestige unlocks.
- **Blood Shards** — Outlands kill rewards. Spend at Rook's Camp or the Blood Market.

## 8.2 Money sinks

- 1% bank withdrawal fee
- Repair costs (gear degrades)
- Respawn fee (scales with level)
- Consumables (potions, teleport scrolls)
- Cosmetic purchases

## 8.3 Merchants

Each town merchant has a rotating stock pulled from `items.json`. Buy price `value × 0.4`, sell price `value × 1.0`. Max reputation: +20% buy / −10% sell.

## 8.4 Bank

- 80 slots per character
- Unlimited gold storage
- 1% withdrawal fee (silent money sink)
- Items stored are **safe from PK loot** — the reason banking matters

# 9. Quests

**Types:** Tutorial (one-time, forced), Story (level-gated chain, main narrative), Daily (3 rotating per day), Bounty (hunt named NPC or PK-flagged player), Guild (class-specific, unlocks signature variant abilities).

**UI:** **L** opens quest log; active quests in HUD top-right; real-time objective tracker; auto-detect turn-in on NPC proximity.

Implement a quest data schema: `id`, `type`, `level_gate`, `objectives[]`, `rewards{}`, `prereq_quest_ids[]`, `zone_id`.

# 10. Multiplayer & networking (hard requirements)

## 10.1 Authority & tick

- **Server-authoritative** simulation at **20 Hz** (50ms tick). No drift.
- **Client interpolation** ~100ms render lag for smoothness.
- **Client prediction** on own movement only, with reconciliation/snap-back on server disagreement.
- **Sanity checks** on movement speed, ability cooldowns, resource spend, line-of-sight (MVP anti-cheat).

## 10.2 Rooms

- `HubRoom` — shared, up to ~50 players.
- `DungeonRoom` — instanced PvE, 1–4 players.
- `ArenaRoom` — matchmade, 1v1 / 3v3 / 5v5.
- `OutlandsRoom` — semi-persistent, 4–12 players.
- `MastersEnclave` — prestige-only shared room.

## 10.3 Message protocol (client → server)

- `move { vx, vy }` — normalized velocity; server scales by `BASE_MOVE_SPEED`.
- `cast { slot: 1..5, targetX, targetY }`
- `utility { targetX, targetY }` — RMB
- `dodge { dirX, dirY }`
- `interact { targetId }`
- `chat { channel, text }`
- `party { op: 'invite' | 'kick' | 'leave' | 'accept', targetId }`

## 10.4 Server → client

Broadcast delta-state at 20 Hz; events via one-off messages (`damage`, `death`, `flag_applied`, `loot_open`, `match_found`, `chat`, `quest_update`).

## 10.5 Persistence schema (Postgres)

- `Account` — email/OAuth/guest, session tokens
- `Character` — account_id, name, guild_id, level, xp, stats, position, zone_id, pk_flagged_until
- `Inventory` / `Bank` — character_id, slot_index, item_id, stack
- `Reputation` — character_id, faction_id, value
- `Quest_progress` — character_id, quest_id, state, objectives_json
- `Match_history` — arena matches, MMR, rank
- `Outlands_ledger` — kill log, flag events, lootings

# 11. UI / UX

## 11.1 HUD layout

```
┌──────────────────────────────────────────────────────────┐
│ [HP bar]   [Buffs]              [Mini-map]  [Quest log]  │
│                                                          │
│                                                          │
│              GAME WORLD                                  │
│                                                          │
│                                                          │
│ [Portrait]  [1][2][3][4][5]  [LMB][RMB][Space]           │
│ [HP][Res][XP bars]  [Cooldown overlays on slots]         │
└──────────────────────────────────────────────────────────┘
```

## 11.2 Key screens

- **Login / character select** (list of account's characters + "Create new" with guild picker)
- **Inventory** (I) — grid, drag-drop, compare tooltips
- **Character sheet** (C) — stats, equipment, skill points
- **Quest log** (L)
- **Map** (M)
- **Social / party** (O)
- **Settings** (Esc)
- **Arena queue** (accessible from hub kiosk)
- **Bank** (at bank NPC)
- **Merchant** (at merchant NPC)
- **Kitchen** (Chef-only crafting station)

# 12. Audio

- **Music:** 1 theme per zone (~15 tracks), looping, orchestral + tin whistle + percussion.
- **SFX:** every ability has its own cast + impact sound; footsteps vary by terrain.
- **UI:** soft warm click / confirm / error tones.
- **Social:** chat ping, whisper, party-join notifications.

# 13. IP sanitization (renames applied in this brief)

| Original | Rename | Reason |
|---|---|---|
| Champions of Khorne | Champions of the Red Throne | Khorne = Games Workshop IP |
| Cult of Cthulhu | Cult of the Drowned | Cthulhu brand association |
| Krynn | (do not use) | Dragonlance / WotC |
| Laurana's Pool | Mirror Pool | Dragonlance |
| Kefka | Kefrin | Final Fantasy |
| Angmar | Angren | Tolkien |
| Bamboo Forest, Old Wood, Rivendell | (keep: generic) | Public domain |
| Camelot, Round Table, Templars | (keep) | Public domain |

# 14. Scope

Deliver a runnable, shippable build covering:

- 15 playable classes with full 5-ability kits + RMB utility + skill-point upgrade trees
- 15+ zones including all listed in §3
- At least 5 quest chains per base class + main story + tutorial + daily system + bounty system
- ~60 NPCs, ~80 items, ~25 monster types
- Full PK flag + Outlands corpse loot system
- Bank, merchants, kitchen, trainers
- Arena matchmaking (1v1, 3v3, 5v5) with MMR and ranked ladder
- Masters prestige path
- Character creation + account system (anonymous guest → optional email upgrade)

## Explicit non-goals

No mobile touch UI, no voice chat, no pay-to-win, no lootboxes. Cosmetics-only if monetization ever ships.

# 15. Success criteria

- A new player can log in, create a character, and complete the tutorial in ≤ 10 minutes without external help.
- 10 playtesters can identify the core loop in 15 minutes of play.
- A 3v3 arena match completes server-authoritatively with no desyncs under 100ms latency.
- PK flag applies correctly on first Outlands kill and clears after redemption.
- All 15 classes are playable end-to-end at launch.

# 16. Deliverables

- Full runnable client + server repo.
- README with local setup, dev commands, and deploy notes.
- External data files (JSON or equivalent) for all classes, abilities, zones, monsters, items, quests.
- Admin console route for spawning test monsters and tweaking balance live.
- Automated tests for: damage formula, PK flag lifecycle, corpse-loot state machine, arena matchmaking, reconciliation.

## PROMPT — END

---

## Appendix A — Character sprite art spec

The receiving AI should assume sprite assets exist in this format:

- **92×92 pixels per frame**, transparent PNG, pixel-art style (no anti-aliasing).
- **8-direction** (NE, E, SE, S, SW, W, NW, N).
- Required animations per class: `idle`, `walk` (4 frames/dir), ability animations for slots 1–5, `hit`, `death`, `downed`.
- Sprites are centered on a ground anchor (not bottom of sprite) to match iso projection.
- Outline: 1px soft colored outline for silhouette readability in busy fights.

## Appendix B — Data-driven stance

All of the following must be external, not hardcoded:

- Class definitions (`guilds.json`)
- Ability definitions (`abilities.json`)
- Zone configs (`zones.json`)
- Monster templates (`monsters.json`)
- Item catalog (`items.json`)
- Quest chains (`quests.json`)
- NPC dialogue and positions (`npcs.json`)

A content designer with no code access must be able to tune damage numbers, cooldowns, zone layouts, and quest rewards by editing JSON alone.
