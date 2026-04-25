import type { StageId } from '@nannymud/shared/simulation/types';
export type { StageId };

export interface StageMeta {
  id: StageId;
  name: string;
  hue: number;
  blurb: string;
  /** Path under /public to a 16:9 preview image, or null if no art yet. */
  preview: string | null;
}

export const STAGES: StageMeta[] = [
  {
    id: 'assembly',
    name: 'Assembly Hall',
    hue: 210,
    blurb: 'Flagstones under torchlight. The Knights swore here — mind the pillars.',
    preview: '/world/assembly/preview.png',
  },
  {
    id: 'market',
    name: 'Night Market',
    hue: 40,
    blurb: 'Paper lanterns and slick cobbles. The stalls are open. The knives, also.',
    preview: '/world/market/preview.png',
  },
  {
    id: 'kitchen',
    name: 'Rot-Kitchen',
    hue: 95,
    blurb: 'The Lepers took the stoves. The stew is old and moves on its own.',
    preview: '/world/kitchen/preview.png',
  },
  {
    id: 'tower',
    name: 'Mage Tower',
    hue: 260,
    blurb: 'Levitating glass floors. Do not step where the runes are singing.',
    preview: '/world/tower/preview.png',
  },
  {
    id: 'grove',
    name: 'Moonwake Grove',
    hue: 140,
    blurb: 'The old trees listen. Tread polite. The Druids are watching.',
    preview: '/world/grove/preview.png',
  },
  {
    id: 'catacombs',
    name: 'Drowned Catacombs',
    hue: 300,
    blurb: 'Stalactites, saltwater, and names written in a dead vowel.',
    preview: '/world/catacombs/preview.png',
  },
  {
    id: 'throne',
    name: 'Red Throne',
    hue: 15,
    blurb: 'The throne counts. Every retreat is a step into the pit.',
    preview: '/world/throne/preview.png',
  },
  {
    id: 'docks',
    name: 'Vampire Docks',
    hue: 330,
    blurb: 'Fog off the pier. Nothing docks here that returns.',
    preview: '/world/docks/preview.png',
  },
  {
    id: 'rooftops',
    name: 'Monastery Rooftops',
    hue: 185,
    blurb: 'Slate tiles, thin air, one misstep to the courtyard below.',
    preview: '/world/rooftops/preview.png',
  },
];

export const STAGES_BY_ID: Record<StageId, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageMeta>;
