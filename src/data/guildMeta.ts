import type { GuildId } from '../simulation/types';

export interface GuildMeta {
  id: GuildId;
  sub: string;
  tag: string;
  glyph: string;
  hue: number;
  bio: string;
  // UI-only vitals. TODO: promote to simulation once Armor/MR/Move are real mechanics.
  uiVitals: {
    Armor: number;
    MR: number;
    Move: number;
  };
}

export const GUILD_META: Record<GuildId, GuildMeta> = {
  adventurer: {
    id: 'adventurer',
    sub: 'Adventurers Guild',
    tag: 'Generalist Bruiser',
    glyph: 'Av',
    hue: 28,
    bio: 'The first guild a recruit walks into. No creed, no god — just iron in the hand and road in the boots. Adventurers fill every gap in every line.',
    uiVitals: { Armor: 10, MR: 5, Move: 140 },
  },
  knight: {
    id: 'knight',
    sub: 'Assembly of Knights',
    tag: 'Holy Tank',
    glyph: 'Kn',
    hue: 210,
    bio: 'Oath-sworn, plate-clad, sanctified. The Assembly holds the line when the line should not hold.',
    uiVitals: { Armor: 25, MR: 10, Move: 120 },
  },
  mage: {
    id: 'mage',
    sub: 'Mages Guild',
    tag: 'Ranged Burst',
    glyph: 'Mg',
    hue: 260,
    bio: 'The tower accepts no half-measures. Frost, arcane, annihilation — cast clean or burn out.',
    uiVitals: { Armor: 3, MR: 15, Move: 130 },
  },
  druid: {
    id: 'druid',
    sub: 'Druids',
    tag: 'Healer-Shifter',
    glyph: 'Dr',
    hue: 140,
    bio: 'Keeper of the old groves. Shape becomes thought becomes shape again — bear on the press, wolf on the chase.',
    uiVitals: { Armor: 8, MR: 12, Move: 130 },
  },
  hunter: {
    id: 'hunter',
    sub: 'Hunters Guild',
    tag: 'Marksman + Pet',
    glyph: 'Hn',
    hue: 75,
    bio: 'Patient, precise, paired. The bow speaks, the wolf answers.',
    uiVitals: { Armor: 6, MR: 5, Move: 140 },
  },
  monk: {
    id: 'monk',
    sub: 'Holy Monks Order',
    tag: 'Melee Assassin',
    glyph: 'Mo',
    hue: 40,
    bio: 'Breath before blow. Blow before breath. The Order teaches both, the student learns neither until they are the same.',
    uiVitals: { Armor: 7, MR: 10, Move: 160 },
  },
  viking: {
    id: 'viking',
    sub: 'Vikings Guild',
    tag: 'Berserker',
    glyph: 'Vk',
    hue: 0,
    bio: 'Raise the horn, make the tide red. The Vikings guild prefers its arguments concluded.',
    uiVitals: { Armor: 15, MR: 5, Move: 125 },
  },
  prophet: {
    id: 'prophet',
    sub: 'Prophets',
    tag: 'Cleric / Buffer',
    glyph: 'Pp',
    hue: 185,
    bio: 'Reads the wind for signs. Paints the battle with blessings and the enemy with curses.',
    uiVitals: { Armor: 6, MR: 14, Move: 125 },
  },
  vampire: {
    id: 'vampire',
    sub: 'Vampires',
    tag: 'Stalker Lifesteal',
    glyph: 'Vp',
    hue: 330,
    bio: 'Coven of the long night. Moves where the lamps do not. Feeds, forgets, feeds again.',
    uiVitals: { Armor: 8, MR: 10, Move: 145 },
  },
  cultist: {
    id: 'cultist',
    sub: 'Cult of the Drowned',
    tag: 'DoT Caster',
    glyph: 'Cu',
    hue: 300,
    bio: 'They say the deep has eyes, and the eyes have names, and the names are vowels you should not make.',
    uiVitals: { Armor: 4, MR: 12, Move: 125 },
  },
  champion: {
    id: 'champion',
    sub: 'Champions of the Red Throne',
    tag: 'Forward-Only Bruiser',
    glyph: 'Ch',
    hue: 15,
    bio: 'Blood for the throne. Never retreat — the throne counts your steps, and the wrong ones bleed.',
    uiVitals: { Armor: 12, MR: 5, Move: 135 },
  },
  darkmage: {
    id: 'darkmage',
    sub: 'Dark Guild',
    tag: 'Shadow Controller',
    glyph: 'Dk',
    hue: 275,
    bio: 'The Dark Guild turned the lamps down and the books dark. What is learned here is not unlearned.',
    uiVitals: { Armor: 4, MR: 14, Move: 125 },
  },
  chef: {
    id: 'chef',
    sub: 'Chefs Guild',
    tag: 'Utility Support',
    glyph: 'Cf',
    hue: 50,
    bio: 'An army marches on its stomach. The Chefs Guild argues this is in fact the only way anything marches.',
    uiVitals: { Armor: 6, MR: 6, Move: 130 },
  },
  leper: {
    id: 'leper',
    sub: 'Lepers',
    tag: 'Diseased Bruiser',
    glyph: 'Lp',
    hue: 95,
    bio: 'Cast from the cities, kept from the temples, welcomed only by the rot. The Lepers return the favor.',
    uiVitals: { Armor: 12, MR: 10, Move: 120 },
  },
  master: {
    id: 'master',
    sub: 'Masters of Nannymud',
    tag: 'Prestige Hybrid',
    glyph: 'Ms',
    hue: 170,
    bio: "Few earn the title. Fewer keep it. The Masters don't choose a class — they rotate through yours.",
    uiVitals: { Armor: 10, MR: 10, Move: 135 },
  },
};
