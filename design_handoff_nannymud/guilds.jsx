// guilds.jsx — 15-guild roster for Nannymud fighting game
// Distinct accent hue per guild; monogram glyph; full stat & ability blocks.

const GUILDS = [
  {
    id: 'adventurer', name: 'Adventurer', sub: 'Adventurers Guild',
    tag: 'Generalist Bruiser', glyph: 'Av', hue: 28,
    resource: { name: 'Stamina', max: 100, color: 'amber' },
    stats: { STR: 14, DEX: 12, CON: 14, INT: 8, WIS: 10, CHA: 10 },
    vitals: { HP: 120, Armor: 10, MR: 5, Move: 140 },
    bio: 'The first guild a recruit walks into. No creed, no god — just iron in the hand and road in the boots. Adventurers fill every gap in every line.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Rallying Cry', dmg: '—', cd: 15, cost: 30, fx: '+15% spd, +10% dmg to allies in 100u, 4s' },
      { slot: 2, combo: '→→J', name: 'Slash', dmg: '30 + 0.7·STR', cd: 2, cost: 10, fx: 'Short-range cone melee, 80u' },
      { slot: 3, combo: '↓↑J', name: 'Bandage', dmg: 'heal 50+0.5·CON', cd: 20, cost: 25, fx: 'Self-heal channel 1.5s' },
      { slot: 4, combo: '←→J', name: 'Quickshot', dmg: '35 + 0.6·DEX', cd: 4, cost: 15, fx: 'Ranged projectile, 350u' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Adrenaline Rush', dmg: '—', cd: 75, cost: 40, fx: '6s: +40% AS, +25% dmg, CC-immune' },
    ],
    rmb: { name: 'Second Wind', fx: 'Restore 30% stamina' },
  },
  {
    id: 'knight', name: 'Knight', sub: 'Assembly of Knights',
    tag: 'Holy Tank', glyph: 'Kn', hue: 210,
    resource: { name: 'Resolve', max: 100, color: 'sky' },
    stats: { STR: 14, DEX: 8, CON: 18, INT: 8, WIS: 12, CHA: 10 },
    vitals: { HP: 180, Armor: 25, MR: 10, Move: 120 },
    bio: 'Oath-sworn, plate-clad, sanctified. The Assembly holds the line when the line should not hold.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Holy Rebuke', dmg: '60 + 1.0·STR', cd: 14, cost: 35, fx: 'PB AoE 120u, stun 1s' },
      { slot: 2, combo: '→→J', name: 'Valorous Strike', dmg: '40 + 0.8·STR', cd: 3, cost: 15, fx: 'Melee, +10 resolve on hit' },
      { slot: 3, combo: '↓↑J', name: 'Taunt', dmg: '—', cd: 8, cost: 20, fx: '120u cone, force attack 3s, +20 armor' },
      { slot: 4, combo: '←→J', name: 'Shield Wall', dmg: '—', cd: 20, cost: 30, fx: '100u, 30% DR to allies 3s' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Last Stand', dmg: '—', cd: 90, cost: 50, fx: '8s: cannot drop <1 HP; +50% dmg; heal 25% on end' },
    ],
    rmb: { name: 'Shield Block', fx: '50% DR for 2s' },
  },
  {
    id: 'mage', name: 'Mage', sub: 'Mages Guild',
    tag: 'Ranged Burst', glyph: 'Mg', hue: 260,
    resource: { name: 'Mana', max: 200, color: 'violet' },
    stats: { STR: 6, DEX: 10, CON: 8, INT: 20, WIS: 14, CHA: 10 },
    vitals: { HP: 80, Armor: 3, MR: 15, Move: 130 },
    bio: 'The tower accepts no half-measures. Frost, arcane, annihilation — cast clean or burn out.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Ice Nova', dmg: '80 + 1.5·INT', cd: 14, cost: 50, fx: 'PB AoE 120u, root 1.5s' },
      { slot: 2, combo: '→→J', name: 'Frostbolt', dmg: '40 + 0.8·INT', cd: 3, cost: 20, fx: 'Projectile 400u, 30% slow 2s' },
      { slot: 3, combo: '↓↑J', name: 'Blink', dmg: '—', cd: 10, cost: 40, fx: 'Teleport 240u, break roots/slows' },
      { slot: 4, combo: '←→J', name: 'Arcane Shard', dmg: '60 + 1.2·INT', cd: 5, cost: 30, fx: 'Piercing line, 500u' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Meteor', dmg: '200 + 3.0·INT', cd: 90, cost: 100, fx: 'Ground target, 1.2s delay, 160u AoE' },
    ],
    rmb: { name: 'Short Teleport', fx: '120u step toward cursor' },
  },
  {
    id: 'druid', name: 'Druid', sub: 'Druids', tag: 'Healer-Shifter',
    glyph: 'Dr', hue: 140,
    resource: { name: 'Essence', max: 100, color: 'emerald' },
    stats: { STR: 8, DEX: 10, CON: 14, INT: 14, WIS: 18, CHA: 12 },
    vitals: { HP: 110, Armor: 8, MR: 12, Move: 130 },
    bio: 'Keeper of the old groves. Shape becomes thought becomes shape again — bear on the press, wolf on the chase.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Wild Growth', dmg: 'heal 15+0.4·WIS/s', cd: 12, cost: 35, fx: 'PB 100u heal circle 5s' },
      { slot: 2, combo: '→→J', name: 'Entangle', dmg: '20 + 0.5·INT', cd: 10, cost: 25, fx: 'Projectile, root 2s' },
      { slot: 3, combo: '↓↑J', name: 'Rejuvenate', dmg: 'heal 30+0.8·WIS + HoT', cd: 4, cost: 20, fx: 'Nearest ally' },
      { slot: 4, combo: '←→J', name: 'Cleanse', dmg: 'heal 40+0.6·WIS', cd: 8, cost: 20, fx: 'Nearest ally, -2 debuffs' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Tranquility', dmg: 'heal 50+0.8·WIS/s', cd: 120, cost: 80, fx: 'Channel 4s, 200u all allies' },
    ],
    rmb: { name: 'Shapeshift', fx: 'Toggle bear / wolf form' },
  },
  {
    id: 'hunter', name: 'Hunter', sub: 'Hunters Guild', tag: 'Marksman + Pet',
    glyph: 'Hn', hue: 75,
    resource: { name: 'Focus', max: 100, color: 'lime' },
    stats: { STR: 10, DEX: 18, CON: 12, INT: 8, WIS: 10, CHA: 10 },
    vitals: { HP: 100, Armor: 6, MR: 5, Move: 140 },
    bio: 'Patient, precise, paired. The bow speaks, the wolf answers.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Disengage', dmg: '—', cd: 10, cost: 20, fx: 'Leap 150u back, smoke blind 1s' },
      { slot: 2, combo: '→→J', name: 'Piercing Volley', dmg: '(25+0.4·DEX) ×3', cd: 6, cost: 25, fx: '3-arrow line, 450u' },
      { slot: 3, combo: '↓↑J', name: 'Aimed Shot', dmg: '50 + 1.0·DEX', cd: 3, cost: 15, fx: '0.5s draw, 500u, +15% crit' },
      { slot: 4, combo: '←→J', name: 'Bear Trap', dmg: '40 + 0.5·DEX', cd: 12, cost: 20, fx: 'Ground trap, 30s armed, root 1.5s' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Rain of Arrows', dmg: '40+0.4·DEX/s ×3s', cd: 80, cost: 50, fx: 'Channel, 150u, +30% slow' },
    ],
    rmb: { name: 'Pet Command', fx: 'Move pet / cycle stance' },
  },
  {
    id: 'monk', name: 'Monk', sub: 'Holy Monks Order', tag: 'Melee Assassin',
    glyph: 'Mo', hue: 40,
    resource: { name: 'Chi', max: 5, color: 'amber' },
    stats: { STR: 10, DEX: 18, CON: 12, INT: 8, WIS: 14, CHA: 10 },
    vitals: { HP: 100, Armor: 7, MR: 10, Move: 160 },
    bio: 'Breath before blow. Blow before breath. The Order teaches both, the student learns neither until they are the same.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Serenity', dmg: '—', cd: 14, cost: '2 chi', fx: 'Untargetable 1s, cleanse, +30% spd 3s' },
      { slot: 2, combo: '→→J', name: 'Flying Kick', dmg: '40 + 0.8·DEX', cd: 5, cost: '1 chi', fx: 'Dash 150u, knockup 0.5s' },
      { slot: 3, combo: '↓↑J', name: 'Jab', dmg: '25 + 0.6·DEX', cd: 1, cost: 0, fx: 'Basic melee, +1 chi' },
      { slot: 4, combo: '←→J', name: 'Five-Point Palm', dmg: '80 + 1.2·DEX + 40 delayed', cd: 8, cost: '3 chi', fx: 'Melee + detonation 4s' },
      { slot: 5, combo: '↓↑↓↑J', name: "Dragon's Fury", dmg: '5× (40+0.5·DEX)', cd: 90, cost: '5 chi', fx: '2s channel, stun 1.5s on final' },
    ],
    rmb: { name: 'Parry', fx: '0.3s window; on success +1 chi + stun 1s' },
  },
  {
    id: 'viking', name: 'Viking', sub: 'Vikings Guild', tag: 'Berserker',
    glyph: 'Vk', hue: 0,
    resource: { name: 'Rage', max: 100, color: 'rose' },
    stats: { STR: 18, DEX: 10, CON: 16, INT: 6, WIS: 8, CHA: 8 },
    vitals: { HP: 160, Armor: 15, MR: 5, Move: 125 },
    bio: 'Raise the horn, make the tide red. The Vikings guild prefers its arguments concluded.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Whirlwind', dmg: '25+0.5·STR / 0.5s', cd: 10, cost: 25, fx: 'PB channel 2s, 100u, 20% lifesteal' },
      { slot: 2, combo: '→→J', name: 'Harpoon', dmg: '40 + 0.7·STR', cd: 12, cost: 20, fx: 'Pulls target 120u' },
      { slot: 3, combo: '↓↑J', name: 'Bloodlust', dmg: '—', cd: 20, cost: 30, fx: '8s: +25% AS, 15% lifesteal' },
      { slot: 4, combo: '←→J', name: 'Axe Swing', dmg: '35 + 0.8·STR', cd: 2, cost: 0, fx: 'Melee cone 60u, builds rage' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Undying Rage', dmg: '—', cd: 120, cost: 60, fx: '6s: cannot die; 30% heal on end' },
    ],
    rmb: { name: 'Shield Bash', fx: '40+0.5·STR + knockback' },
  },
  {
    id: 'prophet', name: 'Prophet', sub: 'Prophets', tag: 'Cleric / Buffer',
    glyph: 'Pp', hue: 185,
    resource: { name: 'Faith', max: 100, color: 'cyan' },
    stats: { STR: 8, DEX: 10, CON: 12, INT: 12, WIS: 18, CHA: 16 },
    vitals: { HP: 100, Armor: 6, MR: 14, Move: 125 },
    bio: 'Reads the wind for signs. Paints the battle with blessings and the enemy with curses.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Prophetic Shield', dmg: '—', cd: 15, cost: 40, fx: 'Shield 80+1.2·WIS; heals on break' },
      { slot: 2, combo: '→→J', name: 'Smite', dmg: '40 + 0.9·WIS', cd: 3, cost: 15, fx: 'Holy, 450u, reveals 3s' },
      { slot: 3, combo: '↓↑J', name: 'Bless', dmg: '—', cd: 8, cost: 25, fx: 'Ally +15% dmg, +10% spd, 8s' },
      { slot: 4, combo: '←→J', name: 'Curse', dmg: '—', cd: 12, cost: 30, fx: 'Enemy +20% dmg taken, -15% dealt, 6s' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Divine Intervention', dmg: '—', cd: 150, cost: 80, fx: 'Ally invuln 3s; heal 100% on end' },
    ],
    rmb: { name: 'Divine Insight', fx: 'Reveal enemies in 360u, 4s' },
  },
  {
    id: 'vampire', name: 'Vampire', sub: 'Vampires', tag: 'Stalker Lifesteal',
    glyph: 'Vp', hue: 330,
    resource: { name: 'Bloodpool', max: 100, color: 'fuchsia' },
    stats: { STR: 10, DEX: 16, CON: 12, INT: 10, WIS: 8, CHA: 14 },
    vitals: { HP: 110, Armor: 8, MR: 10, Move: 145 },
    bio: 'Coven of the long night. Moves where the lamps do not. Feeds, forgets, feeds again.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Hemorrhage', dmg: '15+0.3·DEX/s ×5s', cd: 14, cost: 30, fx: 'DoT, 10% overflow to heal' },
      { slot: 2, combo: '→→J', name: 'Shadow Step', dmg: '—', cd: 12, cost: 25, fx: '240u teleport behind, 1s stealth' },
      { slot: 3, combo: '↓↑J', name: 'Blood Drain', dmg: '50+1.0·DEX / 2s', cd: 10, cost: 20, fx: 'Channel 180u, full heal' },
      { slot: 4, combo: '←→J', name: 'Fang Strike', dmg: '30 + 0.7·DEX', cd: 2, cost: 0, fx: 'Melee + 40% lifesteal' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Nocturne', dmg: '—', cd: 100, cost: 60, fx: '6s invis; next from stealth +100% + fear' },
    ],
    rmb: { name: 'Mist Step', fx: '180u reposition + 1s stealth' },
  },
  {
    id: 'cultist', name: 'Cultist', sub: 'Cult of the Drowned', tag: 'DoT Caster',
    glyph: 'Cu', hue: 300,
    resource: { name: 'Sanity⁻¹', max: 100, color: 'purple' },
    stats: { STR: 6, DEX: 10, CON: 10, INT: 18, WIS: 10, CHA: 14 },
    vitals: { HP: 90, Armor: 4, MR: 12, Move: 125 },
    bio: 'They say the deep has eyes, and the eyes have names, and the names are vowels you should not make.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Summon Spawn', dmg: '—', cd: 20, cost: '+30 sanity', fx: 'Spawn 150 HP, 20s' },
      { slot: 2, combo: '→→J', name: 'Whispers', dmg: '30 + 0.8·INT', cd: 2, cost: '+10 sanity', fx: 'Psychic, silence 1s' },
      { slot: 3, combo: '↓↑J', name: 'Madness', dmg: '30+0.6·INT/s', cd: 14, cost: '+25 sanity', fx: '360u, 2s random move' },
      { slot: 4, combo: '←→J', name: 'Tendril Grasp', dmg: '20+0.4·INT/s ×4s', cd: 10, cost: '+20 sanity', fx: 'Ground 100u, root 1s' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Open the Gate', dmg: '150 + 2.0·INT', cd: 120, cost: '+50 sanity', fx: '3s channel, 240u pull' },
    ],
    rmb: { name: 'Gaze into Abyss', fx: 'Next cast: 0 sanity + 30% dmg' },
  },
  {
    id: 'champion', name: 'Champion', sub: 'Champions of the Red Throne', tag: 'Forward-Only Bruiser',
    glyph: 'Ch', hue: 15,
    resource: { name: 'Bloodtally', max: 10, color: 'orange' },
    stats: { STR: 18, DEX: 12, CON: 14, INT: 6, WIS: 6, CHA: 8 },
    vitals: { HP: 150, Armor: 12, MR: 5, Move: 135 },
    bio: 'Blood for the throne. Never retreat — the throne counts your steps, and the wrong ones bleed.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Tithe of Blood', dmg: 'heal 50+0.6·STR', cd: 15, cost: '3 tally', fx: '+30% AS 5s, self-heal' },
      { slot: 2, combo: '→→J', name: 'Berserker Charge', dmg: '35 + 0.6·STR', cd: 10, cost: 0, fx: 'Dash 240u, knockup' },
      { slot: 3, combo: '↓↑J', name: 'Execute', dmg: '60+0.8·STR (×2 <30%)', cd: 6, cost: 0, fx: 'Melee single-target' },
      { slot: 4, combo: '←→J', name: 'Cleaver', dmg: '40 + 0.9·STR', cd: 2, cost: 0, fx: 'Melee arc 60u' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Skullsplitter', dmg: '120 + 2.0·STR', cd: 90, cost: 0, fx: 'On kill: halve CD + 3 tally' },
    ],
    rmb: { name: 'Challenge', fx: '+20% dmg from champ, 5s' },
  },
  {
    id: 'darkmage', name: 'Darkmage', sub: 'Dark Guild', tag: 'Shadow Controller',
    glyph: 'Dk', hue: 275,
    resource: { name: 'Mana', max: 200, color: 'indigo' },
    stats: { STR: 6, DEX: 10, CON: 10, INT: 18, WIS: 14, CHA: 8 },
    vitals: { HP: 90, Armor: 4, MR: 14, Move: 125 },
    bio: 'The Dark Guild turned the lamps down and the books dark. What is learned here is not unlearned.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Darkness', dmg: '—', cd: 12, cost: 35, fx: '150u, vision 90u, 4s' },
      { slot: 2, combo: '→→J', name: 'Grasping Shadow', dmg: '30 + 0.6·INT', cd: 10, cost: 30, fx: 'Projectile, root 1.5s' },
      { slot: 3, combo: '↓↑J', name: 'Soul Leech', dmg: '60 + 1.0·INT', cd: 14, cost: 40, fx: '50% dmg → mana' },
      { slot: 4, combo: '←→J', name: 'Shadow Bolt', dmg: '45 + 0.9·INT', cd: 3, cost: 20, fx: 'Chilled stacks −5% spd' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Eternal Night', dmg: '25+0.4·INT/s ×6s', cd: 120, cost: 90, fx: '240u silence + DoT' },
    ],
    rmb: { name: 'Shadow Cloak', fx: '2s: 60% spd, ranged untargetable' },
  },
  {
    id: 'chef', name: 'Chef', sub: 'Chefs Guild', tag: 'Utility Support',
    glyph: 'Cf', hue: 50,
    resource: { name: 'Stamina', max: 100, color: 'yellow' },
    stats: { STR: 10, DEX: 10, CON: 12, INT: 14, WIS: 10, CHA: 16 },
    vitals: { HP: 110, Armor: 6, MR: 6, Move: 130 },
    bio: "An army marches on its stomach. The Chefs Guild argues this is in fact the only way anything marches.",
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Feast', dmg: '—', cd: 30, cost: '40 + 1 dish', fx: '180u, dish buff all allies' },
      { slot: 2, combo: '→→J', name: 'Ladle Bash', dmg: '25 + 0.5·STR', cd: 3, cost: 10, fx: 'Melee, daze 0.5s' },
      { slot: 3, combo: '↓↑J', name: 'Hot Soup', dmg: 'heal 40+0.5·INT + regen', cd: 10, cost: 20, fx: '240u ally-target' },
      { slot: 4, combo: '←→J', name: 'Spice Toss', dmg: '10+0.2·INT/s ×3s', cd: 8, cost: 15, fx: 'Projectile, blind 2s' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Signature Dish', dmg: '—', cd: 180, cost: '60 + 2 dishes', fx: 'Combined buffs 300u 20s' },
    ],
    rmb: { name: 'Pocket Dish', fx: 'Consume dish for self-buff' },
  },
  {
    id: 'leper', name: 'Leper', sub: 'Lepers', tag: 'Diseased Bruiser',
    glyph: 'Lp', hue: 95,
    resource: { name: 'Rot', max: 100, color: 'olive' },
    stats: { STR: 14, DEX: 10, CON: 18, INT: 8, WIS: 8, CHA: 6 },
    vitals: { HP: 160, Armor: 12, MR: 10, Move: 120 },
    bio: 'Cast from the cities, kept from the temples, welcomed only by the rot. The Lepers return the favor.',
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Plague Vomit', dmg: '40 + 0.6·STR', cd: 8, cost: 15, fx: 'Cone 150u, DoT + 30% slow' },
      { slot: 2, combo: '→→J', name: 'Diseased Claw', dmg: '30+0.7·STR + DoT', cd: 2, cost: 5, fx: 'Melee, infects' },
      { slot: 3, combo: '↓↑J', name: 'Necrotic Embrace', dmg: '50 + 0.8·STR', cd: 14, cost: 25, fx: 'Grab, heals for damage' },
      { slot: 4, combo: '←→J', name: 'Contagion', dmg: '—', cd: 12, cost: 20, fx: 'Spreads on hit/death, 150u' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Rotting Tide', dmg: '30+0.4·CON/s ×3s', cd: 120, cost: 50, fx: 'Kills revive as husks 5s' },
    ],
    rmb: { name: 'Miasma', fx: 'Toggle 90u necrotic aura' },
  },
  {
    id: 'master', name: 'Master', sub: 'Masters of Nannymud', tag: 'Prestige Hybrid',
    glyph: 'Ms', hue: 170,
    resource: { name: 'Mastery', max: 200, color: 'teal' },
    stats: { STR: 12, DEX: 12, CON: 14, INT: 14, WIS: 14, CHA: 12 },
    vitals: { HP: 140, Armor: 10, MR: 10, Move: 135 },
    bio: "Few earn the title. Fewer keep it. The Masters don't choose a class — they rotate through yours.",
    abilities: [
      { slot: 1, combo: '↓↓J', name: 'Chosen Strike', dmg: '40 + 1.0·primary', cd: 3, cost: 15, fx: 'Adapts to primed class' },
      { slot: 2, combo: '→→J', name: 'Chosen Utility', dmg: '—', cd: 8, cost: 25, fx: 'Blink / Taunt / Dash / …' },
      { slot: 3, combo: '↓↑J', name: 'Chosen Nuke', dmg: 'primed +10%', cd: 12, cost: 40, fx: 'Burst, class-dependent' },
      { slot: 4, combo: '←→J', name: 'Eclipse', dmg: '—', cd: 20, cost: 40, fx: '5s: cycle through all primed versions' },
      { slot: 5, combo: '↓↑↓↑J', name: 'Apotheosis', dmg: '—', cd: 240, cost: 100, fx: '10s: CDs halved, +20% dmg' },
    ],
    rmb: { name: 'Class Swap', fx: 'Cycle primed class' },
  },
];

// Helpers for accent color (grimoire/warm and terminal/cool variants)
function guildAccent(g, theme = 'grimoire') {
  if (theme === 'grimoire') {
    // parchment-warm palette: medium chroma, mid lightness
    return `oklch(0.62 0.16 ${g.hue})`;
  }
  // terminal: brighter, cooler saturation
  return `oklch(0.72 0.19 ${g.hue})`;
}
function guildAccentSoft(g, theme = 'grimoire') {
  if (theme === 'grimoire') return `oklch(0.62 0.16 ${g.hue} / 0.14)`;
  return `oklch(0.72 0.19 ${g.hue} / 0.18)`;
}
function guildAccentDim(g, theme = 'grimoire') {
  if (theme === 'grimoire') return `oklch(0.45 0.12 ${g.hue})`;
  return `oklch(0.55 0.14 ${g.hue})`;
}

Object.assign(window, { GUILDS, guildAccent, guildAccentSoft, guildAccentDim });
