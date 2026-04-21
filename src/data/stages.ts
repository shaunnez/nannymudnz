export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';

export interface StageMeta {
  id: StageId;
  name: string;
  hue: number;
  blurb: string;
  enabled: boolean;
}

export const STAGES: StageMeta[] = [
  {
    id: 'assembly',
    name: 'Assembly Hall',
    hue: 210,
    blurb: 'Flagstones under torchlight. The Knights swore here — mind the pillars.',
    enabled: true,
  },
  {
    id: 'market',
    name: 'Night Market',
    hue: 40,
    blurb: 'Paper lanterns and slick cobbles. The stalls are open. The knives, also.',
    enabled: false,
  },
  {
    id: 'kitchen',
    name: 'Rot-Kitchen',
    hue: 95,
    blurb: 'The Lepers took the stoves. The stew is old and moves on its own.',
    enabled: false,
  },
  {
    id: 'tower',
    name: 'Mage Tower',
    hue: 260,
    blurb: 'Levitating glass floors. Do not step where the runes are singing.',
    enabled: false,
  },
  {
    id: 'grove',
    name: 'Moonwake Grove',
    hue: 140,
    blurb: 'The old trees listen. Tread polite. The Druids are watching.',
    enabled: false,
  },
  {
    id: 'catacombs',
    name: 'Drowned Catacombs',
    hue: 300,
    blurb: 'Stalactites, saltwater, and names written in a dead vowel.',
    enabled: false,
  },
  {
    id: 'throne',
    name: 'Red Throne',
    hue: 15,
    blurb: 'The throne counts. Every retreat is a step into the pit.',
    enabled: false,
  },
  {
    id: 'docks',
    name: 'Vampire Docks',
    hue: 330,
    blurb: 'Fog off the pier. Nothing docks here that returns.',
    enabled: false,
  },
  {
    id: 'rooftops',
    name: 'Monastery Rooftops',
    hue: 185,
    blurb: 'Slate tiles, thin air, one misstep to the courtyard below.',
    enabled: false,
  },
];

export const STAGES_BY_ID: Record<StageId, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageMeta>;
