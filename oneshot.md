# Nannymud — One-Shot Build Prompt (LF2-Style Beat-'Em-Up)

> Paste everything below the line into a code-generating AI (ChatGPT / Claude / Cursor / Copilot / Bolt / v0 / Lovable). It is self-contained — no external files, no references to a repo. The receiving AI must deliver a runnable browser project that implements the MVP described here. If any detail is ambiguous, the AI should pick a sensible default and note the choice; do not request clarification.

---

## PROMPT — BEGIN

Build **Nannymud**, a **browser-based, single-player, 2.5D side-scrolling beat-'em-up** in the style of **Little Fighter 2 (1999)**. Deliver a runnable browser project that lets the player pick one of **15 guild-locked characters** and fight through **one stage** of enemies ending in a **boss battle**. No install, no account, no backend.

## 1. Scope & constraints

**Fixed (non-negotiable):**
- **Browser-native.** Runs in a modern web browser (Chrome, Firefox, Safari, Edge). No install, no download.
- **Single-player.** One keyboard, one character. No network play.
- **Client-only.** No server, no database, no authentication. Persistence (settings, high scores) via browser `localStorage` (or equivalent).
- **All 15 guilds playable** on one stage ending in one boss fight (detailed in §5–§7).

**Open to the implementer:** rendering framework (Phaser, PixiJS, Three.js, PlayCanvas, raw Canvas / WebGL, etc.), programming language (TypeScript, JavaScript, etc.), build tool, project structure, and package manager. Pick whatever you think will best deliver the gameplay. Include a short README explaining how to install, run, and build.

**Architectural principle (required regardless of framework):**
Keep the **simulation layer** — combat resolution, ability execution, AI state machines, status effects, HP/MP accounting, stage-wave progression — cleanly separated from the **rendering** and **input** layers. The simulation must be a pure, deterministic function of its inputs, with no dependencies on DOM APIs or the chosen rendering framework. This is the single decision that keeps a door open for future server-authoritative multiplayer: the same simulation code should be movable to a server runtime later without rewriting game logic. The rendering layer reads simulation state and draws it; the input layer translates browser events into simulation inputs; the simulation never reaches back into either.

## 2. Controls (Player 1 default, key-rebinding in settings)

| Action | Key |
|---|---|
| Move left / right | **← →** |
| Move up / down (depth plane) | **↑ ↓** |
| Jump | **Space** |
| Attack (A) | **J** |
| Defend / block (D) | **K** |
| Grab / pickup | **L** |
| Pause | **Esc** |

**Run:** double-tap **→** or **←** to enter run state (faster move speed). Exits on direction change or stop.

## 3. Combat mechanics

### 3.1 2.5D plane ("fake-Z")

Each actor has three coordinates:

- `x` — horizontal world position (scroll axis). Stage is ~4000 world-units wide.
- `y` — vertical on-screen position, **representing depth into the screen**. World plane is ~400 world-units tall.
- `z` — elevation off the ground. 0 = on ground. Space jumps `z` up; gravity pulls down.

**Rendering:** sort actors by `y` ascending (lower y = further back, drawn first). Screen position: `screenX = x - cameraX`, `screenY = y - z` (jumping moves the sprite up visually).

**Attack connection rule:** an attack hits only if `|targetX - attackerX| ≤ attackRange` AND `|targetY - attackerY| ≤ 25` (Z-tolerance). This is the LF2 signature — players dodge by stepping up/down in depth, not just left/right.

### 3.2 Basic combat vocabulary

- **`J` tap** → basic attack. Auto-chains into a **3-hit combo** on repeat taps within 800 ms.
- **`J` while running** → running attack (higher damage + knockback).
- **`J` while airborne** → jump attack.
- **Hold `K`** → block. Reduces incoming damage by 80%, negates knockback, drains 5 stamina/s.
- **`K` + `J` pressed within 200 ms** → **parry**. Cancels block into counter; perfect parry fully refunds block cost and stuns attacker 0.5 s.
- **`K` + `→` / `←`** → dodge roll. 0.4 s invulnerability frames, ~80 units horizontal.
- **`L` near pickup** → pick up; **`L` again** → throw.
- **`L` near downed enemy** → grab; follow-up `J` = throw, `↓J` = slam.

### 3.3 Knockdown & getup

Attacks with `damage ≥ 50` or `knockdown: true` flag knock the target down. Target flies backward with `vx = -knockbackForce × facingSign`, lands after ~500 ms, lies 800 ms, plays 300 ms getup animation with **invulnerability frames**. Tapping `J` during getup triggers a small-AoE getup attack.

### 3.4 HP + MP system (LF2-faithful)

Each actor has:

- `hp`, `hpMax` — current/max health.
- `hpDark` — "dark red" recovery pool. On damage, `hp` drops immediately; `hpDark` drops slower. `hp` regenerates toward `hpDark` at ~5 HP/s. Out of combat, `hpDark` regenerates toward `hpMax` at ~1 HP/s.
- `mp`, `mpMax` — per-guild resource. See each guild in §5 for regen rules.

Render HP as a two-layer bar: a lighter red fills `hp`, a darker red fills `hpDark`. Damage flashes bright before settling.

### 3.5 Damage formula (exact)

```
final_damage = (ability.base + ability.scale × stat)
             × (1 − target.armor / (target.armor + 100))             // if physical
             × (1 − target.magicResist / (target.magicResist + 100))  // if magical
             × (crit ? 1.5 : 1)
             × random(0.95, 1.05)
```

Crit checked first, ±5% variance last. Base crit 5% (class/gear modifies later, out of scope for MVP).

### 3.6 Status effects

Implement each effect as a struct of shape `{ type, magnitude, durationMs, source }` attached to the target actor; the simulation ticks and expires them.

Effect types: `slow`, `root`, `stun`, `silence`, `knockback`, `blind`, `taunt`, `shield`, `hot`, `dot` (with damage-type tag: physical / magical / nature / holy / shadow / necrotic / psychic), `lifesteal`, `armor_shred`, `magic_shred`, `untargetable`, `stealth`.

## 4. Combo grammar (unified across all 15 guilds)

All 15 guilds map their 5 signature abilities onto the **same 5 input combos**, so players learn the grammar once and apply it across the whole roster. Combos are detected by a **combo buffer** in the simulation that records recent directional keys and the attack key, matching sequences within a **400 ms per-key window**:

| Slot | Combo | Archetype |
|---|---|---|
| 1 | `↓↓J` | Ground burst / point-blank AoE |
| 2 | `→→J` | Dash strike / forward engage |
| 3 | `↓↑J` | Anti-air / heavy single-target |
| 4 | `←→J` | Sweep / horizontal line attack |
| 5 | `↓↑↓↑J` | **Ultimate** (long cooldown) |

Additional universal input:

| Input | Effect |
|---|---|
| `K + J` | Guild RMB utility (per §5) |

If a combo is entered but the guild lacks resources, emit an "insufficient" event (red flash on MP bar, SFX blip) and clear the combo buffer.

## 5. The 15 guilds (full roster — implement all for MVP)

All guilds share: stats (STR, DEX, CON, INT, WIS, CHA — fixed per guild, no leveling in MVP), armor, magic resist, move speed, jump power, HP. Each has a unique resource (MP) with its own regen rules. Each has 5 abilities and 1 RMB utility. All numbers below are authoritative — use them exactly.

Legend for ability rows: `Slot | Combo | Name | Damage base+scale×stat | CD (s) | Cost | Effect`

### 5.1 Adventurer (Adventurers Guild) — generalist bruiser

- Resource: **Stamina** (100 max, +5/s idle, +2/s in combat)
- Stats: STR 14, DEX 12, CON 14, INT 8, WIS 10, CHA 10. HP 120. Armor 10. MR 5. Move 140.
- Damage type: physical

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Rallying Cry | 0 | 15 | 30 | +15% speed, +10% damage to self and allies in 100u for 4s |
| 2 | `→→J` | Slash | 30 + 0.7×STR | 2 | 10 | Short-range cone melee, 80u |
| 3 | `↓↑J` | Bandage | Heal 50+0.5×CON | 20 | 25 | Self-heal channel (1.5s), interruptible |
| 4 | `←→J` | Quickshot | 35 + 0.6×DEX | 4 | 15 | Ranged projectile, 350u |
| 5 | `↓↑↓↑J` | Adrenaline Rush | 0 | 75 | 40 | 6s: +40% attack speed, +25% dmg, slow/root immune |
| RMB (`K+J`) | | Second Wind | | 20 | 0 | Instantly restore 30% stamina |

### 5.2 Knight (Assembly of Knights) — tank

- Resource: **Resolve** (100 max, +1 per 10 HP lost, −1/s decay)
- Stats: STR 14, DEX 8, CON 18, INT 8, WIS 12, CHA 10. HP 180. Armor 25. MR 10. Move 120.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Holy Rebuke | 60 + 1.0×STR | 14 | 35 | PB AoE 120u, stun 1s |
| 2 | `→→J` | Valorous Strike | 40 + 0.8×STR | 3 | 15 | Melee, +10 resolve on hit |
| 3 | `↓↑J` | Taunt | 0 | 8 | 20 | 120u cone, enemies forced to attack knight 3s, +20 armor |
| 4 | `←→J` | Shield Wall | 0 | 20 | 30 | 100u radius, 30% dmg reduction to allies 3s |
| 5 | `↓↑↓↑J` | Last Stand | 0 | 90 | 50 | 8s: cannot drop below 1 HP; +50% dmg; ends with 25% self-heal |
| RMB | | Shield Block | | 15 | 0 | 50% dmg reduction for 2s |

### 5.3 Mage (Mages Guild) — ranged burst

- Resource: **Mana** (200 max, +5/s idle, +2/s combat)
- Stats: STR 6, DEX 10, CON 8, INT 20, WIS 14, CHA 10. HP 80. Armor 3. MR 15. Move 130.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Ice Nova | 80 + 1.5×INT | 14 | 50 | PB AoE 120u, root 1.5s |
| 2 | `→→J` | Frostbolt | 40 + 0.8×INT | 3 | 20 | Projectile 400u, 30% slow 2s |
| 3 | `↓↑J` | Blink | 0 | 10 | 40 | Teleport 240u in facing dir, breaks roots/slows |
| 4 | `←→J` | Arcane Shard | 60 + 1.2×INT | 5 | 30 | Piercing projectile 500u, hits all in line |
| 5 | `↓↑↓↑J` | Meteor | 200 + 3.0×INT | 90 | 100 | Ground-target (cursor), 1.2s delay, 160u AoE |
| RMB | | Short Teleport | | 8 | 20 | 120u step toward cursor |

### 5.4 Druid (Druids) — healer-shifter

- Resource: **Essence** (100 max, +4/s idle, +2/s combat)
- Stats: STR 8, DEX 10, CON 14, INT 14, WIS 18, CHA 12. HP 110. Armor 8. MR 12. Move 130.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Wild Growth | Heal 15+0.4×WIS/s | 12 | 35 | PB 100u heal circle 5s |
| 2 | `→→J` | Entangle | 20 + 0.5×INT | 10 | 25 | Projectile, root 2s |
| 3 | `↓↑J` | Rejuvenate | Heal 30+0.8×WIS + HoT 40+0.5×WIS/6s | 4 | 20 | Targets nearest ally (or self if alone) |
| 4 | `←→J` | Cleanse | Heal 40+0.6×WIS | 8 | 20 | Nearest ally, removes 2 debuffs |
| 5 | `↓↑↓↑J` | Tranquility | Heal 50+0.8×WIS/s | 120 | 80 | Channel 4s, 200u heal all allies |
| RMB | | Shapeshift | | 5 | 20 | Toggle bear form (+melee, +armor) / wolf form (+speed, +crit). See §5.4.1 |

**§5.4.1 Druid shapeshift details:** While in bear or wolf form, the 5 ability slots are replaced:
- **Bear:** `↓↓J` Roar (PB stun 1s, CD 8), `→→J` Swipe (melee 50+1.0×STR), `↓↑J` Thick Hide (+30 armor 6s, CD 15), `←→J` —, `↓↑↓↑J` —.
- **Wolf:** `↓↓J` — , `→→J` Pounce (leap 150u + 50+0.7×DEX, CD 6), `↓↑J` —, `←→J` Bite (melee 40+0.8×DEX, CD 2), `↓↑↓↑J` Bleed (DoT 10+0.2×DEX/s for 5s, CD 8).

### 5.5 Hunter (Hunters Guild) — marksman + pet

- Resource: **Focus** (100 max, +3/s, +5 per basic attack)
- Stats: STR 10, DEX 18, CON 12, INT 8, WIS 10, CHA 10. HP 100. Armor 6. MR 5. Move 140.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Disengage | 0 | 10 | 20 | Leap 150u back, blind 1s smoke cloud |
| 2 | `→→J` | Piercing Volley | 25+0.4×DEX × 3 | 6 | 25 | 3-arrow line, 450u |
| 3 | `↓↑J` | Aimed Shot | 50+1.0×DEX | 3 | 15 | 0.5s draw, 500u range, +15% crit |
| 4 | `←→J` | Bear Trap | 40+0.5×DEX | 12 | 20 | Ground-target, 30s armed, root 1.5s on trigger |
| 5 | `↓↑↓↑J` | Rain of Arrows | 40+0.4×DEX/s × 3s | 80 | 50 | Ground-target channel, 150u radius, +30% slow in zone |
| RMB | | Pet Command | | 0 | 0 | Move pet to cursor / cycle aggressive/defensive/passive |

**Pet (wolf-type):** 50 HP, 25+0.3×hunter.DEX melee auto-attacks hunter's target. Dies → respawn in 5s channel.

### 5.6 Monk (Holy Monks Order) — melee assassin

- Resource: **Chi orbs** (5 max, +1 per basic attack)
- Stats: STR 10, DEX 18, CON 12, INT 8, WIS 14, CHA 10. HP 100. Armor 7. MR 10. Move 160.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Serenity | 0 | 14 | 2 chi | Untargetable 1s, cleanse CC, +30% speed 3s |
| 2 | `→→J` | Flying Kick | 40+0.8×DEX | 5 | 1 chi | Dash 150u, knockup 0.5s at end |
| 3 | `↓↑J` | Jab | 25+0.6×DEX | 1 | 0 | Basic melee, generates 1 chi (bypasses combo) |
| 4 | `←→J` | Five-Point Palm | 80+1.2×DEX + 40 delayed | 8 | 3 chi | Melee hit + detonation after 4s |
| 5 | `↓↑↓↑J` | Dragon's Fury | 5× (40+0.5×DEX) | 90 | 5 chi | 2s channel, 5 strikes, final stun 1.5s |
| RMB | | Parry | | 10 | 0 | 0.3s parry window, on success refund 1 chi + stun 1s |

### 5.7 Viking (Vikings Guild) — berserker

- Resource: **Rage** (100 max, starts at 0, +1 per 5 dmg dealt/taken, −2/s out of combat)
- Stats: STR 18, DEX 10, CON 16, INT 6, WIS 8, CHA 8. HP 160. Armor 15. MR 5. Move 125.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Whirlwind | 25+0.5×STR / 0.5s | 10 | 25 | PB channel 2s, 100u radius, 20% lifesteal |
| 2 | `→→J` | Harpoon | 40+0.7×STR | 12 | 20 | Projectile, pulls target 120u toward viking |
| 3 | `↓↑J` | Bloodlust | 0 | 20 | 30 | 8s: +25% attack speed, 15% lifesteal |
| 4 | `←→J` | Axe Swing | 35+0.8×STR | 2 | 0 | Melee cone 60u, builds rage |
| 5 | `↓↑↓↑J` | Undying Rage | 0 | 120 | 60 | 6s: cannot die (HP clamps 1); damage taken → 30% heal on expiry |
| RMB | | Shield Bash | 40+0.5×STR | 12 | 0 | Melee + knockback |

### 5.8 Prophet (Prophets) — cleric / buffer

- Resource: **Faith** (100 max, +3/s, +2 on successful prayer resolve)
- Stats: STR 8, DEX 10, CON 12, INT 12, WIS 18, CHA 16. HP 100. Armor 6. MR 14. Move 125.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Prophetic Shield | 0 | 15 | 40 | Shield absorbs 80+1.2×WIS; on break, heal target 30+0.5×WIS |
| 2 | `→→J` | Smite | 40+0.9×WIS | 3 | 15 | Target enemy 450u, holy, reveals 3s |
| 3 | `↓↑J` | Bless | 0 | 8 | 25 | Target ally +15% dmg, +10% speed 8s |
| 4 | `←→J` | Curse | 0 | 12 | 30 | Target enemy +20% dmg taken, -15% dmg dealt 6s |
| 5 | `↓↑↓↑J` | Divine Intervention | 0 | 150 | 80 | Target ally invulnerable 3s; on expiry heal to 100% |
| RMB | | Divine Insight | | 30 | 0 | Reveal all enemies in 360u for 4s |

### 5.9 Vampire (Vampires) — stalker lifesteal

- Resource: **Bloodpool** (100 max, starts 50, +1 per 2 dmg dealt, −1/s in daylight zones)
- Stats: STR 10, DEX 16, CON 12, INT 10, WIS 8, CHA 14. HP 110. Armor 8. MR 10. Move 145.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Hemorrhage | 15+0.3×DEX/s × 5s | 14 | 30 | Target 300u, DoT, heal vampire 10% overflow |
| 2 | `→→J` | Shadow Step | 0 | 12 | 25 | Teleport 240u behind nearest enemy, 1s stealth |
| 3 | `↓↑J` | Blood Drain | 50+1.0×DEX over 2s | 10 | 20 | Target channel 180u, heals full damage |
| 4 | `←→J` | Fang Strike | 30+0.7×DEX | 2 | 0 | Melee + heal 40% of damage |
| 5 | `↓↑↓↑J` | Nocturne | 0 | 100 | 60 | 6s: invisible, +50% speed; next ability from stealth +100% dmg + fear 2s |
| RMB | | Mist Step | | 12 | 20 | 180u instant reposition + 1s stealth |

### 5.10 Cultist (Cult of the Drowned) — DoT caster (sanity-inverse)

- Resource: **Sanity-inverse** (0–100, starts 0, **rises** with each cast, decays 2/s when not casting, **hurts self at ≥80**, at 100 self-stun 2s + 20% HP self-dmg)
- Stats: STR 6, DEX 10, CON 10, INT 18, WIS 10, CHA 14. HP 90. Armor 4. MR 12. Move 125.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Summon Spawn | — | 20 | +30 sanity | Summon deep-spawn 150 HP, 25+0.3×INT melee, 20s |
| 2 | `→→J` | Whispers | 30+0.8×INT | 2 | +10 sanity | Projectile psychic, silence 1s |
| 3 | `↓↑J` | Madness | 30+0.6×INT/s | 14 | +25 sanity | Target 360u, 2s random movement, DoT |
| 4 | `←→J` | Tendril Grasp | 20+0.4×INT/s × 4s | 10 | +20 sanity | Ground-target 100u, root on touch 1s |
| 5 | `↓↑↓↑J` | Open the Gate | 150+2.0×INT | 120 | +50 sanity | 3s channel, 240u AoE, pulls to center |
| RMB | | Gaze into Abyss | | 25 | 0 | Next ability costs 0 sanity + 30% dmg |

### 5.11 Champion (Champions of the Red Throne) — forward-only bruiser

- Resource: **Bloodtally** (0–10 stacks, +1 on assist, +3 on kill, −1 per 15s, +3% dmg per stack)
- Stats: STR 18, DEX 12, CON 14, INT 6, WIS 6, CHA 8. HP 150. Armor 12. MR 5. Move 135.
- **Passive: Forward Only** — lose 1 HP/s while moving away from the nearest enemy within 450u while in combat.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Tithe of Blood | Heal 50+0.6×STR | 15 | 3 bloodtally | Consume stacks: +30% AS 5s, self-heal |
| 2 | `→→J` | Berserker Charge | 35+0.6×STR | 10 | 0 | Dash 240u, knockup 0.5s, +1 bloodtally |
| 3 | `↓↑J` | Execute | 60+0.8×STR (×2 if <30% HP) | 6 | 0 | Melee single-target |
| 4 | `←→J` | Cleaver | 40+0.9×STR | 2 | 0 | Melee arc 60u |
| 5 | `↓↑↓↑J` | Skullsplitter | 120+2.0×STR | 90 | 0 | Melee; on kill: halve CD + 3 bloodtally |
| RMB | | Challenge | | 18 | 0 | Target takes +20% dmg from champion 5s |

### 5.12 Darkmage (Dark Guild) — shadow controller

- Resource: **Mana** (200 max, +4/s idle, +2/s combat)
- Stats: STR 6, DEX 10, CON 10, INT 18, WIS 14, CHA 8. HP 90. Armor 4. MR 14. Move 125.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Darkness | 0 | 12 | 35 | Ground-target 150u, enemies inside have vision reduced 90u, 4s |
| 2 | `→→J` | Grasping Shadow | 30+0.6×INT | 10 | 30 | Projectile, root 1.5s on first hit |
| 3 | `↓↑J` | Soul Leech | 60+1.0×INT | 14 | 40 | Target 360u, restore 50% dmg as mana |
| 4 | `←→J` | Shadow Bolt | 45+0.9×INT | 3 | 20 | Projectile; applies stacking `chilled` (max 5, −5% speed each) |
| 5 | `↓↑↓↑J` | Eternal Night | 25+0.4×INT/s × 6s | 120 | 90 | Ground-target 240u, silence + shadow DoT |
| RMB | | Shadow Cloak | | 20 | 0 | 2s: 60% speed, untargetable by ranged |

### 5.13 Chef (Chefs Guild) — utility support

- Resource: **Stamina** (100 max, +4/s); carries up to 5 prepared dishes (MVP: starts each run with 3 Hearty Stews + 2 Fiery Chili)
- Stats: STR 10, DEX 10, CON 12, INT 14, WIS 10, CHA 16. HP 110. Armor 6. MR 6. Move 130.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Feast | 0 | 30 | 40 stam + 1 dish | 180u, apply dish buff to all allies (see dish list below) |
| 2 | `→→J` | Ladle Bash | 25+0.5×STR | 3 | 10 | Melee, daze 0.5s |
| 3 | `↓↑J` | Hot Soup | Heal 40+0.5×INT + regen 20/s × 4s | 10 | 20 | 240u ally-target |
| 4 | `←→J` | Spice Toss | 10+0.2×INT/s × 3s | 8 | 15 | Projectile, blind 2s + DoT |
| 5 | `↓↑↓↑J` | Signature Dish | 0 | 180 | 60 stam + 2 dishes | 2s channel, combine dish effects to all allies 300u for 20s |
| RMB | | Pocket Dish | | 3 | 1 dish | Consume a dish for its buff (self only) |

**Dish buffs (applied by Feast, Pocket Dish, Signature Dish):**
- **Hearty Stew:** +50 max HP, +2 HP/s for 30s.
- **Fiery Chili:** +15% dmg, +10% AS for 20s.
- **Crystal Tea:** +30% resource regen for 30s.
- **Dragon's Broth:** 20% dmg reduction for 15s.
- **Arcane Pastry:** +25% ability power (INT scaling) for 25s.

### 5.14 Leper (Lepers) — diseased bruiser

- Resource: **Rot** (100 max, +3/s, enemies killed by rot-DoT grant +10)
- Stats: STR 14, DEX 10, CON 18, INT 8, WIS 8, CHA 6. HP 160. Armor 12. MR 10. Move 120.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Plague Vomit | 40+0.6×STR | 8 | 15 | Cone 150u, infected DoT + slow 30% 3s |
| 2 | `→→J` | Diseased Claw | 30+0.7×STR + infected DoT (10+0.2×CON/s × 5s) | 2 | 5 | Melee |
| 3 | `↓↑J` | Necrotic Embrace | 50+0.8×STR | 14 | 25 | Melee grab, heal for damage dealt |
| 4 | `←→J` | Contagion | 0 | 12 | 20 | Target infection; on target death/hit, jumps to nearest within 150u |
| 5 | `↓↑↓↑J` | Rotting Tide | 30+0.4×CON/s × 3s | 120 | 50 | 3s channel PB 180u; enemies killed revive as friendly rotting husks (50 HP, 5s) |
| RMB | | Miasma | | 2 | 2 rot/s | Toggle 90u aura, 5+0.2×CON necrotic DPS |

### 5.15 Master (Masters of Nannymud) — prestige hybrid

- Resource: **Mastery** (200 max, +5/s)
- Stats: STR 12, DEX 12, CON 14, INT 14, WIS 14, CHA 12. HP 140. Armor 10. MR 10. Move 135.
- **Mechanic:** On spawn, pick one of 5 primed classes (Knight / Mage / Monk / Hunter / Druid). RMB cycles primed class. Abilities adapt to the primed class.

| Slot | Combo | Name | Dmg | CD | Cost | Effect |
|---|---|---|---|---|---|---|
| 1 | `↓↓J` | Chosen Strike | 40+1.0×primary | 3 | 15 | Ranged or melee depending on primed class |
| 2 | `→→J` | Chosen Utility | — | 8 | 25 | Blink / Taunt / Dash / Stealth / Cleanse (by primed class) |
| 3 | `↓↑J` | Chosen Nuke | base +10% over primed class's equivalent | 12 | 40 | Burst from primed class |
| 4 | `←→J` | Eclipse | — | 20 | 40 | 5s: all slots cycle through all primed-class versions sequentially |
| 5 | `↓↑↓↑J` | Apotheosis | 0 | 240 | 100 | 10s: all CDs halved, +20% dmg, 2% max HP/s heal |
| RMB | | Class Swap | | 1 | 0 | Cycle primed class |

## 6. Enemies (all implement for MVP)

### 6.1 Plains Bandit — common mob

HP 40, Armor 5, MR 0, Move 100, Damage 8 melee.
AI (`chaser`): approach target, attack when in melee range, retreat briefly when HP < 25%.
Drops: 5–15 copper, 10% club.

### 6.2 Bandit Archer — ranged kiter

HP 30, Armor 0, MR 0, Move 90, Damage 12 ranged (300u projectile).
AI (`archer`): maintain 250–350u from target, fire arrow every 2s, retreat when target closes within 200u.
Drops: 5–15 copper, 20% rock.

### 6.3 Wolf — fast pack hunter

HP 30, Armor 0, MR 0, Move 160, Damage 10 leap-bite.
AI (`packer`): spawn in 2+; one leaps 200u while others circle; leap hit = knockdown. Stagger leaps 1.5s apart.
Drops: none (cosmetic pelt).

### 6.4 Bandit Brute — heavy

HP 80, Armor 15, MR 0, Move 70, Damage 18 heavy swing.
AI (`brute`): slow approach; telegraphed overhead swing (1.2s wind-up, 60u range, high knockback).
Drops: 20–40 copper, club (100%).

### 6.5 Boss: Bandit King of the Plains

HP 800, Armor 20, MR 10, Move 90.

**Phase 1 (100%–50% HP):** Basic melee + wide cleave every 4s (120u cone, 40+0.9×STR). Roars every 10s → summon 1 Plains Bandit.

**Phase 2 (50%–25% HP):** Adds **Charge** (telegraphed dash across arena, 35+1.0×STR, heavy knockdown). On entry to phase, summon 2 Wolves.

**Phase 3 (25%–0% HP):** Enrage: +30% attack speed, +20% damage. **AoE Stomp** every 6s (180u shockwave, 30+0.5×STR, stun 0.8s).

## 7. Stage: Plains of Nan

World dimensions: 4000u wide × 400u tall (depth plane).
Palette: sky gradient (warm blue → cream), hills (layered olive/tan polygons), ground (striped green/brown).
Scroll camera follows player horizontally until a wave trigger locks the camera. Scroll resumes when all enemies in the wave are dead.

| Wave | Trigger x | Enemies |
|---|---|---|
| 1 | 400  | 2× Plains Bandit |
| 2 | 900  | 3× Plains Bandit, 1× Bandit Archer |
| 3 | 1600 | 2× Wolf |
| 4 | 2400 | 2× Plains Bandit, 2× Bandit Archer |
| 5 | 3200 | 1× Bandit Brute, 2× Wolf |
| Boss | 3800 | **Bandit King of the Plains** |

Boss kill → GameOver screen with "Victory" title + "Retry" button.
Player death → GameOver screen with "Defeated" + "Retry".

## 8. Environmental weapons

On enemy death with a drop roll, spawn a pickup at corpse position. `L` near a pickup grabs it into one hand; holding a weapon replaces basic attack damage. Second `L` throws it forward (projectile, 8+STR dmg, arc trajectory).

- **Rock:** throwable only, 8 dmg, stuns 0.3s on hit.
- **Club:** melee weapon, +10 damage to basics, breaks after 8 hits.

## 9. HUD

- **Top-left:** guild portrait (placeholder rect with guild initial) + HP bar (two-layer: bright hp + dark hpDark) + MP bar (colored per guild's resource).
- **Top-right:** "Plains of Nan — Wave 3 / 6" text.
- **Bottom-left:** rolling **combo hint** — when a partial combo is detected (e.g. player pressed `↓`), show the continuations that would complete an ability, with cost and name. Fade after 1s of no input.
- **Bottom-right:** score (optional, sum of enemy HP killed).
- **Floating damage numbers:** spawn from hit targets, drift up + fade over 800 ms. Yellow = normal, orange = crit, green = heal.
- **Pause menu (`Esc`):** "Resume / Retry / Abandon Run / Settings (volume, key rebind)".

## 10. Placeholder art specs

No sprite assets for MVP. Every actor is drawn as a simple primitive:

- **Body:** filled rectangle, guild/enemy-specific color, 40u wide × 60u tall (bosses 80×120).
- **Outline:** 1-unit darker shade of body color.
- **Label:** guild/enemy initial in white in the rect's center (e.g. "K" for Knight, "W" for Wolf).
- **Facing indicator:** small triangle "nose" on the leading edge in accent color.
- **Airborne:** when `z > 0`, draw a small ellipse shadow on the ground below the body.

Guild colors (tweak for contrast as needed):

Adventurer #c9a961, Knight #a8dadc, Mage #8e6dc8, Druid #4caf50, Hunter #8d6e63, Monk #d9a441, Viking #b74c2a, Prophet #f7e8a4, Vampire #7a1935, Cultist #2e4c3a, Champion #a71d2a, Darkmage #4a1458, Chef #f48fb1, Leper #738d3f, Master #e0e0e0.

Enemy colors: Plains Bandit #6b4f2a, Bandit Archer #8b6b3a, Wolf #6e6e6e, Bandit Brute #3e2a14, Bandit King #8a0f0f.

### 10.1 Swap-friendly rendering architecture (required)

Expose the rendering of actors through a **single abstraction** (interface, class, or module — whichever idiom your framework prefers) with the following contract:

```
renderActor(
  actorKind:    string,            // e.g. "knight", "wolf", "bandit_king"
  animationId:  string,            // "idle" | "walk" | "run" | "jump" | "attack_1" | "ability_1" | ...
  direction:    -1 | 1,            // -1 = facing left, +1 = facing right
  frameIndex:   number,            // current frame within the animation
  x, y, z:      number             // world coordinates (see §3.1)
) → a drawable handle
```

Provide a **Placeholder** implementation for MVP that draws primitives as above. A future **Atlas** implementation will load sprite sheets and frame metadata and draw them via the same call. Consumers (stage renderer, HUD, debug tooling) only know the abstraction; swapping implementations must not require changes in the simulation or the HUD.

**Hitboxes must be defined in data — per animation, per frame, in logical world coordinates — never derived from sprite pixel geometry.** For MVP, use default per-kind hitboxes (e.g. every guild basic = 30×40 hitbox offset forward 20u from actor center, active on frames 1–2 of its attack animation). When real art arrives, hitbox data and sprite pixels remain independent, so combat timing and reach stay intact across the art swap.

## 11. Particles & VFX

The simulation emits typed VFX events on ability execution. The rendering layer subscribes and maps each event to a visual. Example event shapes:

```
{ type: "projectile_spawn",  color: "#9bdcf5", x, y, vx, vy }
{ type: "aoe_pop",           color: "#8e6dc8", x, y, radius }
{ type: "hit_spark",                           x, y }
{ type: "heal_glow",                           x, y }
{ type: "blink_trail",                         x1, y1, x2, y2 }
```

For MVP, the renderer draws these as simple shapes — circles, lines, fading rectangles. Real VFX sheets can replace the renderer later without the simulation changing.

## 12. Audio

- **1 stage music track** (loop).
- **1 boss music track** (loop; triggers at boss spawn).
- **SFX per category:** cast, impact, heal, block, parry, jump, land, knockdown, death. Generic synth placeholders or freesound.org clips are fine.
- Volume setting persists in `localStorage`.

## 13. Success criteria (what "done" looks like)

1. The game launches in a modern browser with no errors.
2. Title screen → "Start" → Guild Select → pick any of 15 guilds → stage scene.
3. Player spawns at left of Plains of Nan. Moves with arrows. Runs with double-tap. Jumps with Space.
4. Camera follows, scrolls right, locks at wave 1 until 2 bandits die.
5. All 5 abilities per guild fire via their combos and deal the documented damage. Damage numbers pop.
6. Block, parry, knockdown, getup-with-iframes all work.
7. Environmental weapons (rock, club) can be picked up and thrown.
8. Reach the boss. Bandit King transitions through 3 phases correctly. Beat him → Victory screen.
9. Die → Defeated screen → Retry returns to Guild Select.
10. 60 FPS on mid-range hardware, no stutters during a full stage clear.
11. The simulation layer (combat, abilities, AI, status effects, HP/MP, stage progression) has **no dependencies on the rendering framework or the DOM**. Moving the simulation to a server-side runtime later should require no changes to its game logic.
12. README explains how to install, run, and build. No server, no secrets, no backend config.

## 14. Explicit non-goals (do NOT build these)

- ❌ Multiplayer (single-player only)
- ❌ Any backend / server / WebSocket
- ❌ Database / persistence beyond browser-local storage
- ❌ Account system / login / registration
- ❌ Character appearance customisation (one visual per guild)
- ❌ Leveling / XP / stat points (stats fixed per guild)
- ❌ 2nd stage, 2nd boss
- ❌ Banking, merchants, quests, NPCs beyond the boss
- ❌ PK flag, Outlands, PvP
- ❌ Real sprite art (placeholders only)
- ❌ Mobile / touch UI
- ❌ Localization

## 15. Deliverables

- Runnable project with a short `README.md` covering: what the game is, key bindings, install / run / build commands, known limitations.
- All 15 guilds playable with the stats and abilities in §5 — numbers used exactly.
- Plains of Nan stage with all waves + boss per §7.
- All mechanics in §3 working (run, jump, block, parry, knockdown, getup, 2.5D plane, hp/hpDark/mp).
- HUD per §9.
- Placeholder rendering per §10, behind a swap-friendly abstraction per §10.1.
- Particle/VFX system per §11.
- Audio loaded (even if placeholder SFX).
- Project builds and runs without errors.

Ship it.

## PROMPT — END
