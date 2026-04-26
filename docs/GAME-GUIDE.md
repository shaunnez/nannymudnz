# Nannymud — Game Guide

> A browser-native 2.5D beat-'em-up in the spirit of Little Fighter 2. Fifteen guilds, nine stages, six modes, one deterministic engine, zero audio files.

---

## Table of Contents

1. [What Is Nannymud?](#what-is-nannymud)
2. [Modes](#modes)
3. [Controls](#controls)
4. [The Guilds](#the-guilds)
5. [Abilities & Combo Grammar](#abilities--combo-grammar)
6. [Move List by Guild](#move-list-by-guild)
7. [The Nine Stages](#the-nine-stages)
8. [Story Mode](#story-mode)
9. [VS & Multiplayer](#vs--multiplayer)
10. [Items & Crates](#items--crates)
11. [Settings](#settings)
12. [Mobile & PWA](#mobile--pwa)
13. [The HUD](#the-hud)
14. [Stats & Resources](#stats--resources)
15. [Audio System](#audio-system)
16. [Balance Tooling](#balance-tooling)
17. [Autonomous Build Agents](#autonomous-build-agents)
18. [Tech Stack](#tech-stack)

---

## What Is Nannymud?

Nannymud is a browser-native 2.5D side-scrolling beat-'em-up built over a sustained AI-assisted development sprint. It draws directly from Little Fighter 2 for its movement model — depth-plane dodging, jump arcs, directional combos, grab-and-throw — and layers on fifteen fully differentiated guild fighters, nine stylised stages, procedural audio, and server-authoritative online multiplayer.

Everything in the game was built from scratch with no external game assets:

- **UI** — designed with Claude's frontend skill
- **Lore** — written to fit the world of Nannymud
- **Game design** — adapted from the Little Fighter 2 model
- **Sprites** — AI-generated via PixelLab Pro (80px, displayed at ×1.5 scale)
- **Audio** — 100% procedurally synthesised via the Web Audio API
- **Multiplayer** — server-authoritative via Colyseus, WebSocket state sync
- **Simulation** — deterministic pure-TypeScript engine, shared client/server

---

## Modes

### Story Mode
Single-player progression through the nine stages. Each stage has its own hand-crafted wave composition of guild enemies running the full vsAI pipeline, with per-level stat scaling. Every stage ends in a multi-phase boss fight — health thresholds trigger new move sets, summons, and stat buffs. Clear a stage to unlock the next; locked stages show a padlock on the map.

Die once and the run ends.

### VS (1v1 vs CPU)
Pick any two guilds, pick a stage, fight. Best-of-three rounds. The AI opponent runs the same simulation logic as the authoritative server, at the difficulty set in Settings. Guild matchups matter — there is a complete win-rate matrix to prove it.

### Survival
Endless waves on a single stage. Waves escalate in difficulty without limit. Your score is tracked and displayed as a wave-count leaderboard at the end of the run.

### Battle (4v4)
Configurable team fight with up to 8 slots. In the Battle Config screen you assign guilds to Team A and Team B (up to 4 each), lock each slot, then advance to stage select. The 8-slot HUD shows all fighters' HP bars in two rows. Last team with a standing fighter wins.

### Championship
A bracketed single-elimination tournament. Up to 15 guilds enter (CPU-controlled unless you take a slot). Wins advance you through the bracket; a post-round reveal shows your next opponent. The Championship bracket screen shows the full bracket tree at all times.

### Multiplayer (Online)
Server-authoritative match via Colyseus. Host creates a room (public or private), shares the code; guests join. Supports 1v1 and Battle mode (up to 8 players). A public room browser lists open lobbies — no code needed. Both players run through character select and stage select before the match starts. The server owns all simulation state; clients send inputs only.

---

## Controls

| Action | Default Key |
|---|---|
| Move left / right | ← → |
| Move up / down (depth plane) | ↑ ↓ |
| Jump | Space |
| Run | Double-tap ← or → |
| Attack | J |
| Block | K |
| Grab / Throw | L |
| Pause | P |
| Fullscreen | F |

### Combo Grammar

Abilities are executed through directional input sequences followed by the attack button — no separate ability buttons.

| Notation | Input |
|---|---|
| `↓↓J` | Down, down, attack |
| `→→J` | Right, right, attack |
| `↓↑J` | Down, up, attack |
| `←→J` | Left, right, attack |
| `↓↑↓↑J` | Down, up, down, up, attack (ultimate) |
| `K+J` | Hold block, press attack (RMB utility) |

All keybinds are remappable in Settings and persist via localStorage.

### Mobile Controls

On touch devices the game renders an on-screen control layer:

| Control | Position | Action |
|---|---|---|
| Virtual joystick | Bottom-right | Movement (all 4 directions + diagonals) |
| J button | Bottom-left of joystick | Attack |
| K button | Left of J | Block |
| Pause button | Top-right | Pause / resume |

Run is triggered by double-tapping the left or right edge of the joystick. Abilities use the same combo inputs — hold a direction then tap J. Keybind remapping is keyboard-only (use a physical keyboard or remap before switching to touch).

---

## The Guilds

Fifteen playable guilds, each with a distinct resource system, stat profile, and ability set covering every combat archetype in the game.

### Stat Profiles

| Guild | HP | Speed | STR | DEX | CON | INT | WIS | Armor | MR | Resource |
|---|---|---|---|---|---|---|---|---|---|---|
| Adventurer | 520 | 140 | 14 | 12 | 14 | 8 | 10 | 10 | 5 | Stamina |
| Knight | 580 | 120 | 14 | 8 | 18 | 8 | 12 | 12 | 10 | Resolve |
| Mage | 490 | 130 | 6 | 10 | 8 | 20 | 14 | 10 | 20 | Mana |
| Druid | 440 | 130 | 8 | 10 | 14 | 14 | 18 | 8 | 12 | Essence |
| Hunter | 450 | 140 | 10 | 18 | 12 | 8 | 10 | 6 | 5 | Focus |
| Monk | 460 | 160 | 10 | 18 | 12 | 8 | 14 | 7 | 10 | Chi |
| Viking | 460 | 125 | 18 | 10 | 16 | 6 | 8 | 8 | 5 | Rage |
| Prophet | 500 | 125 | 8 | 10 | 12 | 12 | 18 | 6 | 20 | Faith |
| Vampire | 530 | 145 | 10 | 16 | 12 | 10 | 8 | 8 | 10 | Bloodpool |
| Cultist | 300 | 125 | 6 | 10 | 10 | 18 | 10 | 4 | 12 | Sanity |
| Champion | 460 | 135 | 18 | 12 | 14 | 6 | 6 | 12 | 5 | Bloodtally |
| Darkmage | 300 | 125 | 6 | 10 | 10 | 18 | 14 | 4 | 14 | Mana |
| Chef | 540 | 130 | 10 | 10 | 12 | 14 | 10 | 6 | 6 | Stamina |
| Leper | 480 | 120 | 14 | 10 | 18 | 8 | 8 | 7 | 10 | Rot |
| Master | 620 | 135 | 12 | 12 | 14 | 14 | 14 | 10 | 10 | Mastery |

### Guild Lore

**Adventurers Guild** — "The first guild a recruit walks into. No creed, no god — just iron in the hand and road in the boots. Adventurers fill every gap in every line."

**Assembly of Knights** — "Oath-sworn, plate-clad, sanctified. The Assembly holds the line when the line should not hold."

**Mages Guild** — "The tower accepts no half-measures. Frost, arcane, annihilation — cast clean or burn out."

**Druids** — "Keeper of the old groves. Shape becomes thought becomes shape again — wolf on the press, wolf on the hunt."

**Hunters Guild** — "Patient, precise, paired. The bow speaks, the wolf answers."

**Holy Monks Order** — "Breath before blow. Blow before breath. The Order teaches both; the student learns neither until they are the same."

**Vikings Guild** — "Raise the horn, make the tide red. The Vikings guild prefers its arguments concluded."

**Prophets** — "Reads the wind for signs. Paints the battle with blessings and the enemy with curses."

**Vampires** — "Coven of the long night. Moves where the lamps do not. Feeds, forgets, feeds again."

**Cult of the Drowned** — "They say the deep has eyes, and the eyes have names, and the names are vowels you should not make."

**Champions of the Red Throne** — "Blood for the throne. Never retreat — the throne counts your steps, and the wrong ones bleed."

**Dark Guild** — "The Dark Guild turned the lamps down and the books dark. What is learned here is not unlearned."

**Chefs Guild** — "An army marches on its stomach. The Chefs Guild argues this is in fact the only way anything marches."

**Lepers** — "Cast from the cities, kept from the temples, welcomed only by the rot. The Lepers return the favor."

**Masters of Nannymud** — "Few earn the title. Fewer keep it. The Masters don't choose a class — they rotate through yours."

---

## Abilities & Combo Grammar

### Ability Archetypes in Nannymud

The game contains one of the widest ability type spreads in a game of this scope:

| Type | Guilds |
|---|---|
| **Melee Specials** | Adventurer, Knight, Monk, Viking, Champion, Leper, Druid (Wolf) |
| **Ranged Projectiles** | Mage, Hunter, Prophet, Vampire, Cultist, Darkmage, Adventurer, Viking |
| **AoE Zones** | Mage (Meteor), Druid (Wild Growth), Hunter (Rain of Arrows), Darkmage (Eternal Night), Leper (Rotting Tide), Cultist (Open the Gate) |
| **Traps** | Hunter (Bear Trap — root on trigger), Cultist (Tendril Grasp — ground root + DoT), Darkmage (Darkness — vision zone) |
| **Summons / Pets** | Hunter (Wolf companion, commandable AI), Cultist (Drowned Spawn, 150 HP), Leper (Rotting Husks from kills, 5 s) |
| **Shapeshift** | Druid (toggles Wolf form — fully separate ability set) |
| **Ability Steal / Rotation** | Master (Eclipse cycles all five primed-class ability variants; Class Swap RMB changes primed class) |
| **Lifesteal** | Vampire (Fang Strike heals 60% of damage; Blood Drain heals full damage; Hemorrhage overflows to heal), Viking (Whirlwind 10% lifesteal; Bloodlust 10% lifesteal) |
| **DoT / Infection** | Cultist (Whispers, Madness, Tendril), Leper (Diseased Claw, Contagion, Miasma aura), Darkmage (Shadow Bolt stacking chill), Vampire (Hemorrhage) |
| **Crowd Control** | Root: Hunter, Druid, Mage, Cultist, Darkmage; Stun: Knight, Mage, Monk, Prophet; Knockup: Viking (Harpoon), Champion (Berserker Charge); Pull: Viking (Harpoon), Cultist (Open the Gate); Silence: Cultist, Darkmage; Fear: Vampire (Nocturne) |
| **Healing / Support** | Druid (Wild Growth, Rejuvenate, Tranquility), Prophet (Bless, Divine Intervention — full HP restore), Chef (Hot Soup, Feast dish buffs), Vampire (lifesteal chain) |
| **Stealth** | Vampire (Shadow Step — teleport + 1 s stealth; Nocturne — 6 s invisibility + amplified opener; Mist Step — 180u reposition + stealth), Darkmage (Shadow Cloak — untargetable by ranged) |
| **Execute Mechanics** | Champion (Execute doubles damage below 30% HP; Skullsplitter halves CD on kill + 3 bloodtally) |
| **Class Cycling** | Master primed classes: Knight, Mage, Monk, Hunter, Druid |

### Status Effects (26 total)

`slow` · `root` · `stun` · `silence` · `knockback` · `blind` · `taunt` · `shield` · `hot` · `dot` · `lifesteal` · `armor_shred` · `magic_shred` · `untargetable` · `stealth` · `speed_boost` · `damage_boost` · `damage_reduction` · `attack_speed_boost` · `bless` · `curse` · `infected` · `chilled` · `revealed` · `fear` · `daze`

---

## Move List by Guild

The full interactive Move List and Guild Dossier are accessible in-game from the main menu. Each dossier shows:

- Full biography
- Stat breakdown (STR / DEX / CON / INT / WIS / CHA each on a 0–20 scale)
- HP, Armor, MR, Move Speed
- Resource name, max, regen rates
- All 6 abilities with combo inputs, damage formulae, cooldowns, and costs
- For Druid: toggle between base and Wolf form ability sets

Below is the complete ability reference for every guild.

---

### Adventurer *(Generalist Bruiser)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Rallying Cry | `↓↓J` | 100u AoE +15% speed/damage to self and allies, 4 s |
| 2 | Slash | `→→J` | 80u melee cone, 30 + 0.7×STR |
| 3 | Bandage | `↓↑J` | 1.5 s channel self-heal, 50 + 0.5×CON |
| 4 | Quickshot | `←→J` | 350u projectile, 35 + 0.6×DEX |
| 5 | Adrenaline Rush | `↓↑↓↑J` | 6 s: +40% attack speed, +25% damage, immune to slow/root |
| RMB | Second Wind | `K+J` | Restore 30% Stamina |

---

### Knight *(Holy Tank)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Holy Rebuke | `↓↓J` | 120u PB AoE, 60 + 1.0×STR holy, stun 1 s |
| 2 | Valorous Strike | `→→J` | 60u melee, 40 + 0.8×STR, +10 Resolve on hit |
| 3 | Taunt | `↓↑J` | 120u cone, forces enemies to target Knight 3 s |
| 4 | Shield Wall | `←→J` | 100u radius, 30% damage reduction to allies 3 s |
| 5 | Last Stand | `↓↑↓↑J` | 5 s: cannot drop below 1 HP, +15% damage; ends with 25% self-heal |
| RMB | Shield Block | `K+J` | 30% damage reduction 2 s |

---

### Mage *(Ranged Burst)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Ice Nova | `↓↓J` | 120u PB AoE, 110 + 1.5×INT magical, root 1.5 s |
| 2 | Frostbolt | `→→J` | 400u projectile, 80 + 0.8×INT, 30% slow 2 s |
| 3 | Blink | `↓↑J` | Teleport 240u, breaks roots and slows |
| 4 | Arcane Shard | `←→J` | Piercing projectile 500u, 90 + 1.2×INT |
| 5 | Meteor | `↓↑↓↑J` | 1.2 s cast, 160u AoE, 200 + 3.0×INT, knockdown |
| RMB | Short Teleport | `K+J` | 120u step, 20 Mana |

---

### Druid *(Healer-Shifter)*

**Base Form**

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Wild Growth | `↓↓J` | 100u PB heal circle 5 s HoT, 15 + 0.4×WIS |
| 2 | Entangle | `→→J` | 350u projectile, root 2 s |
| 3 | Rejuvenate | `↓↑J` | Heal nearest ally 150u + HoT, 30 + 0.8×WIS |
| 4 | Cleanse | `←→J` | Heal + remove 2 debuffs from ally 150u |
| 5 | Tranquility | `↓↑↓↑J` | Channel 4 s, 200u AoE heal all allies |
| RMB | Shapeshift | `K+J` | Toggle Wolf form (5 s CD) |

**Wolf Form**

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Maul | `↓↓J` | 70u melee, 55 + 0.9×STR, knockdown |
| 2 | Charge | `→→J` | Rush 180u, knockup |
| 3 | Roar | `↓↑J` | 150u AoE, 40% slow + fear 1 s |
| 4 | Rend | `←→J` | 75u melee + stacking bleed DoT 3 s |
| 5 | Primal Fury | `↓↑↓↑J` | 6 s: +40% damage +20% speed |
| RMB | Revert | `K+J` | Exit Wolf form |

---

### Hunter *(Marksman + Pet)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Disengage | `↓↓J` | Leap back 150u, blind smoke 1 s |
| 2 | Piercing Volley | `→→J` | 3-arrow line 450u, 50 + 0.4×DEX |
| 3 | Aimed Shot | `↓↑J` | 500u range, 0.2 s draw, +15% crit chance, 65 + 1.0×DEX |
| 4 | Bear Trap | `←→J` | Ground trap: root 1.5 s + damage on trigger |
| 5 | Rain of Arrows | `↓↑↓↑J` | Channel 3 s, 200u ahead, 6 pulses of 20 + 0.3×DEX |
| RMB | Pet Command | `K+J` | Move Wolf pet / cycle its AI mode |

**Wolf Pet:** 200 HP, chaser AI, independently attacks enemies.

---

### Monk *(Melee Assassin)*

Chi is generated by Jab and consumed by other abilities.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Serenity | `↓↓J` | 1 s untargetable, cleanse CC, +30% speed 3 s — costs 2 Chi |
| 2 | Flying Kick | `→→J` | Dash 150u, knockup 0.5 s, 40 + 0.8×DEX — costs 1 Chi |
| 3 | Jab | `↓↑J` | 50u melee, 25 + 0.6×DEX — **generates 1 Chi** |
| 4 | Five-Point Palm | `←→J` | 60u melee + detonation after 4 s (+40 dmg), 110 + 1.2×DEX — costs 3 Chi |
| 5 | Dragon's Fury | `↓↑↓↑J` | Channel 2 s, 5 strikes, final stun 1.5 s — costs 5 Chi |
| RMB | Parry | `K+J` | 0.3 s parry window; success = stun |

---

### Viking *(Berserker)*

Rage builds from melee combat and decays out of combat.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Whirlwind | `↓↓J` | Channel 2 s, 100u PB, 25 + 0.5×STR, 10% lifesteal |
| 2 | Harpoon | `→→J` | 400u projectile, pulls target 120u, 40 + 0.7×STR |
| 3 | Bloodlust | `↓↑J` | 5 s: +25% attack speed, 10% lifesteal |
| 4 | Axe Swing | `←→J` | 60u melee cone, 35 + 0.8×STR, builds Rage |
| 5 | Undying Rage | `↓↑↓↑J` | 3 s: cannot die; damage taken converts to 30% heal on expiry |
| RMB | Shield Bash | `K+J` | Knockback 150u, 40 + 0.5×STR |

---

### Prophet *(Cleric / Buffer)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Prophetic Shield | `↓↓J` | Shield 120 + 1.2×WIS; on break, heals 30 + 0.5×WIS |
| 2 | Smite | `→→J` | 450u holy projectile, 70 + 0.9×WIS, reveals target 3 s |
| 3 | Bless | `↓↑J` | Ally 200u: +15% damage +10% speed 8 s |
| 4 | Curse | `←→J` | Target 300u: +20% damage taken, -15% damage dealt 6 s |
| 5 | Divine Intervention | `↓↑↓↑J` | Target 200u: invulnerable 3 s, heals to full on expiry |
| RMB | Divine Insight | `K+J` | Reveal all enemies in 360u for 4 s |

---

### Vampire *(Stalker Lifesteal)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Hemorrhage | `↓↓J` | 300u projectile, 5 s DoT; overflow heals Vampire |
| 2 | Shadow Step | `→→J` | Teleport behind nearest enemy + 1 s stealth |
| 3 | Blood Drain | `↓↑J` | Channel 2 s, 70 + 1.0×DEX, heals full damage dealt |
| 4 | Fang Strike | `←→J` | 60u melee, 30 + 0.7×DEX, heals 60% of damage |
| 5 | Nocturne | `↓↑↓↑J` | 6 s: invisible, +50% speed; next ability from stealth +100% damage + fear |
| RMB | Mist Step | `K+J` | 180u reposition + 1 s stealth |

---

### Cultist *(DoT Caster)*

Sanity is inverse: abilities have *negative* cost (casting gains Sanity). Sanity decays over time, creating a pressure loop.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Summon Spawn | `↓↓J` | Summon Drowned Spawn (150 HP, 20 s) |
| 2 | Whispers | `→→J` | 400u psychic projectile, silence 1 s, 30 + 0.8×INT |
| 3 | Madness | `↓↑J` | 120u AoE, 0.8 s confusion + DoT, 30 + 0.6×INT |
| 4 | Tendril Grasp | `←→J` | Ground tendril 100u, root + DoT 4 s |
| 5 | Open the Gate | `↓↑↓↑J` | Channel 3 s, 240u AoE, pulls all to center, 150 + 2.0×INT |
| RMB | Gaze into Abyss | `K+J` | Next ability: 0 Sanity cost + 30% damage |

---

### Champion *(Forward-Only Bruiser)*

Bloodtally stacks from kills and certain abilities. Execute doubles vs targets below 30% HP.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Tithe of Blood | `↓↓J` | Consume 3 stacks: +30% attack speed 5 s + self-heal |
| 2 | Berserker Charge | `→→J` | Dash 240u, knockup 0.5 s, +1 Bloodtally, 35 + 0.6×STR |
| 3 | Execute | `↓↑J` | 60u melee; ×2 damage if target <30% HP |
| 4 | Cleaver | `←→J` | 60u melee arc, 40 + 0.9×STR |
| 5 | Skullsplitter | `↓↑↓↑J` | Heavy melee; on kill: halve CD + 3 Bloodtally |
| RMB | Challenge | `K+J` | Target 300u takes +20% damage from Champion 5 s |

---

### Darkmage *(Shadow Controller)*

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Darkness | `↓↓J` | 90u vision-reduction zone 4 s |
| 2 | Grasping Shadow | `→→J` | 400u projectile, root 1.5 s, 30 + 0.6×INT |
| 3 | Soul Leech | `↓↑J` | 360u target, 60 + 1.0×INT, restores 50% damage as Mana |
| 4 | Shadow Bolt | `←→J` | 400u projectile, stacking chill −5% speed (max 5 stacks), 45 + 0.9×INT |
| 5 | Eternal Night | `↓↑↓↑J` | 240u silence zone + shadow DoT 6 s |
| RMB | Shadow Cloak | `K+J` | 2 s: +60% speed, untargetable by ranged |

---

### Chef *(Utility Support)*

Dishes are consumable buffs. Feast distributes them to allies. Signature Dish combines them.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Feast | `↓↓J` | Apply dish buff to all allies in 180u |
| 2 | Ladle Bash | `→→J` | 60u melee, daze 0.5 s, 40 + 0.5×STR |
| 3 | Hot Soup | `↓↑J` | Heal + regen 20/s × 4 s to ally 240u |
| 4 | Spice Toss | `←→J` | 300u projectile, blind 3 s + DoT, 45 + 0.2×INT |
| 5 | Signature Dish | `↓↑↓↑J` | Channel 2 s; combined dish effects on all allies 300u for 20 s |
| RMB | Pocket Dish | `K+J` | Consume a dish for its buff (self) |

---

### Leper *(Diseased Bruiser)*

Rot builds over time. Miasma toggles an aura that constantly damages nearby enemies.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Plague Vomit | `↓↓J` | 80u cone, infected DoT + 30% slow 2 s, 40 + 0.6×STR |
| 2 | Diseased Claw | `→→J` | 60u melee + necrotic DoT 3 s, 18 + 0.7×STR |
| 3 | Necrotic Embrace | `↓↑J` | Grab: heals 50% of damage dealt, 40 + 0.8×STR |
| 4 | Contagion | `←→J` | Infect target 300u for 4 s |
| 5 | Rotting Tide | `↓↑↓↑J` | Channel 3 s, 180u PB; enemies killed revive as Rotting Husks (5 s) |
| RMB | Miasma | `K+J` | Toggle aura: (2 + 0.1×CON) necrotic DPS in 90u radius |

---

### Master *(Prestige Hybrid)*

Primed classes: Knight · Mage · Monk · Hunter · Druid. Class Swap (RMB) cycles them. Eclipse rotates abilities through all five variants for 5 s.

| # | Name | Input | Effect |
|---|---|---|---|
| 1 | Chosen Strike | `↓↓J` | Ranged or melee depending on primed class, 40 + 1.0×STR |
| 2 | Chosen Utility | `→→J` | Utility from primed class (default: teleport) |
| 3 | Chosen Nuke | `↓↑J` | Burst from primed class +10%, 120 + 1.1×INT |
| 4 | Eclipse | `←→J` | 5 s: ability slots cycle through all five primed-class versions |
| 5 | Apotheosis | `↓↑↓↑J` | 10 s: all CDs halved, +20% damage, +2% HP/s |
| RMB | Class Swap | `K+J` | Cycle primed class (1 s CD) |

---

## The Nine Stages

Each stage has its own colour theme, atmospheric flavour text, and background treatment. All nine are selectable in VS and Multiplayer modes.

| Stage | Colour | Flavour |
|---|---|---|
| Assembly Hall | Blue (hue 210) | "Flagstones under torchlight. The Knights swore here — mind the pillars." |
| Night Market | Amber (hue 40) | "Paper lanterns and slick cobbles. The stalls are open. The knives, also." |
| Rot-Kitchen | Green (hue 95) | "The Lepers took the stoves. The stew is old and moves on its own." |
| Mage Tower | Purple (hue 260) | "Levitating glass floors. Do not step where the runes are singing." |
| Moonwake Grove | Teal (hue 140) | "The old trees listen. Tread polite. The Druids are watching." |
| Drowned Catacombs | Magenta (hue 300) | "Stalactites, saltwater, and names written in a dead vowel." |
| Red Throne | Red (hue 15) | "The throne counts. Every retreat is a step into the pit." |
| Vampire Docks | Rose (hue 330) | "Fog off the pier. Nothing docks here that returns." |
| Monastery Rooftops | Cyan (hue 185) | "Slate tiles, thin air, one misstep to the courtyard below." |

---

## Story Mode

A single-player left-to-right progression through the nine stages. Each stage has its own wave set of guild-themed enemies running the full vsAI pipeline. Waves spawn ahead of you as you advance; die once and the run ends. Beat a stage to unlock the next — locked stages show a padlock on the stage-select map.

### Stage Progression & Scaling

Enemy HP and damage scale per stage level. The difficulty curve is gradual across the first eight stages; the ninth is the hardest. Each stage's final wave is a multi-phase boss fight.

### Per-Stage Wave Compositions

Each stage runs a hand-crafted wave set mixing standard enemies, guild-specific enemies, and a boss:

- **Waves 1–5** — Standard enemies plus guild-type fighters running the vsAI combat pipeline
- **Wave 6 (Boss)** — A multi-phase boss with health-gated phase transitions

### Boss Phase System

Each stage boss has multiple phases keyed to HP thresholds. When a threshold is crossed:

- Move sets change (new abilities activate, old ones deactivate)
- Stat multipliers apply (increased speed/damage in later phases)
- Summons may spawn (additional enemies join mid-fight)

Eight boss variants are in the roster, each tied to its stage's guild theme.

### Summons (player guild abilities)

| Summon | HP | Source |
|---|---|---|
| Wolf Pet | 200 | Hunter |
| Drowned Spawn | 150 | Cultist |
| Rotting Husk | 200 | Leper (Rotting Tide on-kill) |

---

## VS & Multiplayer

### Match Flow

```
lobby → char_select → stage_select → loading → in_game → results
```

- **Rounds:** Best-of-3 (win 2 rounds to claim the match)
- **Round win condition:** Last player standing
- **Multiplayer:** Server authoritative — clients send inputs only, receive state
- **Room system:** Private by default; share room code to invite. Rooms can be set public.
- **Lobby features:** Ready toggle (R), in-lobby chat (100 message history), room code display
- **Rematch:** Available from results screen (Enter)

### Results Screen

After each match the game displays a full breakdown for both players:

| Stat | Description |
|---|---|
| Damage Dealt | Total damage output |
| Damage Taken | Total damage received |
| Abilities Cast | Number of ability activations |
| Max Combo | Highest consecutive hit streak |
| Crit % | Percentage of hits that were critical strikes |
| Healing | Total healing done |

Winner side is highlighted; loser is greyed. Guild tags are displayed for both players (e.g., `HOLY TANK`, `STALKER LIFESTEAL`).

---

## Items & Crates

Items spawn as pickups on the stage floor. Walk over a pickup to collect it — gems and consumables activate automatically on contact; weapons are held until thrown or dropped.

### Pickup Categories

| Category | Examples | Effect on pickup |
|---|---|---|
| **Weapon** | Sword, Torch, Bomb, Smoke Bomb, Throwing Star | Overrides your attack with the weapon's range/damage/hitEffect; throw with the Grab key for elemental VFX |
| **Gem** | Ruby, Sapphire, Emerald, Topaz… | Applies a passive status effect (damage boost, speed boost, armor, etc.) while held; removing it cancels the effect |
| **Consumable** | Health Potion, Mana Potion, Elixir… | Auto-used on contact — instant heal, resource restore, or cleanse |
| **Crate** | Wooden Crate | Destructible object; attack it to break it and spawn 1–3 random loot items from the crate's loot table |

### Weapon Throws

Holding a weapon and pressing Grab launches it as a projectile with elemental VFX:

| Weapon | VFX |
|---|---|
| Torch | Fire trail + burn impact |
| Bomb | Explosion AoE |
| Smoke Bomb | Smoke cloud on impact |
| Throwing Star | Piercing spin impact |

Other weapons throw as generic projectiles.

### Gem Passive Buffs

Gems apply status effects via the same engine as ability buffs:

- **Ruby** — damage boost
- **Sapphire** — speed boost
- **Emerald** — regen / healing over time
- **Topaz** — armor boost

The buff lasts as long as you hold the gem. If an enemy knocks the gem away and picks it up, they get the buff instead.

---

## Settings

Open Settings from the main menu. All settings persist to localStorage.

### Controls

Remap every key action individually. Default layout is shown in the Controls table above.

### Video

| Setting | Description |
|---|---|
| New VFX | Enables craftpix AI-generated slash and explosion sprites overlaying procedural effects. Also swaps the Hunter to its chibi sprite variant. |
| Fullscreen | Toggle fullscreen (also bound to F in-game) |

### Audio

Independent sliders for Master Volume, Music, and SFX. Changes take effect immediately.

### Difficulty

| Setting | Scope |
|---|---|
| VS CPU Difficulty | Easy / Medium / Hard / Max — applies to the AI opponent in VS mode |
| Battle CPU Difficulty | Same scale — applies to CPU-controlled slots in Battle mode |
| Championship CPU Difficulty | Applies to all CPU brackets in Championship |
| Story Enemy HP Scale | 10%–100% — scales all enemy HP in Story mode (useful for tuning challenge) |

---

## Mobile & PWA

### Installing as a PWA

Nannymud is a Progressive Web App. To install:

- **iOS (Safari):** Tap the Share button → **Add to Home Screen**
- **Android (Chrome):** Tap the three-dot menu → **Add to Home Screen** (or accept the install prompt)

Once installed it launches in fullscreen standalone mode with no browser chrome. A Workbox service worker caches all game assets at install time — the game runs offline after the first load.

### Portrait Orientation

The game blocks portrait orientation on mobile and shows an instruction overlay asking you to rotate the device. All game screens require landscape.

### Touch Controls Layout

See the [Mobile Controls](#mobile-controls) section under Controls above for the full joystick/button layout.

### Viewport Tuning

- **iOS:** width fixed at 900 CSS px via a UA-script to work around Safari's dynamic viewport behaviour
- **Android:** device-width viewport for correct pixel mapping on high-DPI displays

---

## The HUD

### Top Bar

- **Player 1 slot:** Guild monogram · health bar (red) · resource bar (guild colour) · resource label
- **Centre:** Stage name · round timer (VS/MP only)
- **Player 2 / Boss slot:** Mirror of P1 (VS), or Boss name + oversized health bar (Story)

### Ability Strip

Six cards along the bottom — five combo abilities plus the RMB utility. Each card shows:

- Emoji icon
- Ability name
- Cooldown timer overlay (if on cooldown)
- Keybind label (1–5, RMB)

Druid shapeshifted into Wolf form updates all six cards to Wolf abilities. Master updates cards when the primed class changes.

### Combat Log

Scrolling message history (100-message cap) showing hits, abilities, status effects, and kills in real time.

### Round Indicators

Dots or pip icons tracking round wins (0–3) per player, visible below the health bars.

---

## Stats & Resources

### The Six Attributes

Each guild has scores in STR / DEX / CON / INT / WIS / CHA (scale 0–20). These scale ability damage via formulae like `35 + 0.8×STR` or `80 + 0.8×INT`.

### Defences

- **Armor** — reduces incoming physical damage. Range: 4 (Cultist, Darkmage) to 12 (Knight, Champion).
- **Magic Resist** — reduces incoming magical/holy/shadow damage. Range: 5 (Adventurer, Hunter, Viking, Champion) to 20 (Mage, Prophet).

### Resource Systems

Every guild runs a unique resource that shapes its playstyle:

| Resource | Guild | Max | Behaviour |
|---|---|---|---|
| Stamina | Adventurer, Chef | 100 | +5 idle / +2 in combat |
| Resolve | Knight | 100 | No regen; -1 decay; built by Valorous Strike |
| Mana | Mage, Darkmage | 200 | +5 idle / +2 in combat (Darkmage +4 idle) |
| Essence | Druid | 100 | +4 idle / +2 in combat |
| Focus | Hunter | 100 | +3 idle / +3 in combat |
| Chi | Monk | 5 | No regen; generated by Jab; consumed by abilities |
| Rage | Viking | 100 | Starts at 0; built by Axe Swing; -2 decay |
| Faith | Prophet | 100 | +3 idle / +2 in combat |
| Bloodpool | Vampire | 100 | Starts at 50; -1 decay |
| Sanity | Cultist | 100 | Starts at 0; -2 decay; abilities have negative cost (casting gains Sanity) |
| Bloodtally | Champion | 10 | Stacks from kills and specific abilities; no decay |
| Rot | Leper | 100 | Starts at 0; +3 idle / +3 in combat |
| Mastery | Master | 200 | +5 idle / +3 in combat |

---

## Audio System

No audio files exist in this project. Everything you hear is synthesised in real time via the **Web Audio API** (`src/audio/audioManager.ts`).

### Sound Effects

| Event | Synthesis |
|---|---|
| Attack | Sawtooth + square (220 Hz + 180 Hz) |
| Critical Hit | Twin square tones (440 Hz + 660 Hz) |
| Heal | Rising sine chord (523 · 659 · 784 Hz) |
| Block | Deep square (150 Hz) |
| Parry | Sharp twin square (880 Hz + 1100 Hz) |
| Jump | Frequency sweep 200→400 Hz |
| Land | Low square thump (100 Hz) |
| Knockdown | Deep square drop (80 Hz) |
| Death | Descending sawtooth 440→55 Hz over 0.5 s |
| Ability Cast | Sine chord (660 Hz + 880 Hz) |
| Impact | Sawtooth punch (120 Hz) |
| Insufficient Resource | Descending double tone (200 Hz + 150 Hz) |
| Victory | Rising arpeggio (523 · 659 · 784 · 1047 Hz, 120 ms apart) |
| Defeat | Falling arpeggio (523 · 494 · 440 · 392 · 349 Hz, 200 ms apart) |

### Music

- **Stage music:** 12-note square wave loop at 350 ms/note
- **Boss music:** Darker 12-note sawtooth loop at 350 ms/note, lower register
- Music fades in/out on phase transitions
- Master volume, music gain, and SFX gain are all independently adjustable and persisted to localStorage

---

## Balance Tooling

One of the most unusual features of Nannymud is a fully automated headless balance runner.

### What It Does

`scripts/balance-runner.ts` runs **4,500 bot-vs-bot matches** — every possible guild pairing (225), 20 matches each — and produces a 15×15 win-rate matrix.

```bash
npx tsx scripts/balance-runner.ts
# runs ~3–5 minutes
# prints matrix to stdout
# writes scripts/balance-output.csv
```

### How It Works

- Ticks at 16 ms (real-time equivalent)
- CPU difficulty: maximum
- Stage: fixed (Assembly Hall)
- Alternates sides each iteration to cancel spawn-position bias
- Each match has a 120 s timeout
- Seeded RNG per match (deterministic runs)

### Tuning Levers

All changes are made in `packages/shared/src/simulation/guildData.ts`:

1. **Strategy block** — `priority`, `useAtCloseRange`, `useAtLongRange`, `retreatBelowHpPct`, `blockOnReaction`, `preferRange` — adjusts AI behaviour only, no effect on human play
2. **Stats** — `hpMax`, `armor`, `magicResist`, `moveSpeed`
3. **Ability params** — `baseDamage`, `cost`, `cooldownMs`

**Target:** all 15 guilds within 40–60% win rate across all matchups. The current committed baseline is at `scripts/balance-output.csv`.

---

## Autonomous Build Agents

Nannymud is also a platform for an autonomous multi-agent development system. Agents run continuously from a GitHub Issues queue and build the game while you sleep.

### Agent Roles

| Agent | File | Role |
|---|---|---|
| **Orchestrator** | `agents/orchestrator.md` | Reads open issues, assigns lanes, dispatches sub-agents, moves labels (todo → in-progress → qa → done), posts results |
| **Dev** | `agents/dev.md` | Executes one bounded task per git worktree; runs typecheck + build + tests; posts completion to issue |
| **QA** | `agents/qa.md` | Verifies dev work, runs manual test scope per task, posts pass/fail |
| **Reviewer** | `agents/reviewer.md` | Code review and feel-sensitive feedback on design/balance; gates merge decisions |
| **Asset** | `agents/asset.md` | Generates pixel art, animations, and tilesets via PixelLab |

### Label Taxonomy

Issues flow through state via GitHub labels:

```
todo → in-progress → qa → done
                  ↘ todo (on QA fail, with rejection comment)
```

Lane labels: `lane:dev` · `lane:asset` · `lane:design` · `lane:qa` · `lane:reviewer`

### Running the Orchestrator

```
orchestrator run
```

This starts a self-paced `/loop`. The orchestrator reads open `todo`-labelled issues, dispatches at most 1 dev + 1 design + 1 asset agent simultaneously (disjoint file scopes), and advances labels as work completes. GitHub token must be set via `GITHUB_TOKEN`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Dev server & bundler | Vite 5 |
| UI / menus | React 18 |
| Game engine | Phaser 3 |
| Language | TypeScript (strict) — client, shared, server |
| Multiplayer | Colyseus (server-authoritative, @colyseus/schema state sync) |
| Audio | Web Audio API — 100% procedural, no audio files |
| Sprites | PixelLab AI (80 px, displayed at ×1.5 via DISPLAY_SCALE) |
| Monorepo | npm workspaces (`packages/shared`, `packages/server`) |
| Tests | Vitest + a golden determinism snapshot for MP correctness |
| Linting | ESLint flat config with custom rule: no browser APIs in simulation |
| Simulation | Pure TypeScript, deterministic, shared client/server |
| PWA | vite-plugin-pwa / Workbox — service worker, offline cache, manifest |

### Architecture Principle

The simulation layer (`packages/shared/src/simulation/**`) is pure — no Phaser, no DOM, no `Math.random()`, no `Date.now()`. This is enforced by ESLint and gated by the golden determinism test. The same simulation runs identically in the browser (single-player) and on the Colyseus server (multiplayer authority).

---

*Built with Vite · React · Phaser 3 · Colyseus · Web Audio API · PixelLab · TypeScript · vite-plugin-pwa*
