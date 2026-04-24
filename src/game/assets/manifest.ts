// Asset manifest for Phaser BootScene.
// Populated incrementally: atlases in Task 9, procedural VFX needs nothing loaded,
// image-based VFX (public/vfx/<guild>/*.png) in Task 9.

import type { GuildId } from '@nannymud/shared/simulation/types';

export interface AtlasDecl {
  key: string;
  imageUrl: string;
  metadataUrl: string;
}

export interface VfxImageDecl {
  key: string;
  url: string;
}

export interface StageImageDecl {
  key: string;
  url: string;
}

export interface AssetManifest {
  atlases: Partial<Record<GuildId, AtlasDecl[]>>;
  vfxImages: Partial<Record<GuildId, VfxImageDecl[]>>;
  stageImages: Record<string, StageImageDecl[]>;
}

export const MANIFEST: AssetManifest = {
  atlases: {},
  vfxImages: {},
  stageImages: {
    assembly: [
      { key: 'stage:assembly:backdrop', url: '/world/assembly/backdrop.png' },
      { key: 'stage:assembly:horizon',  url: '/world/assembly/horizon.png' },
      { key: 'stage:assembly:pillar',   url: '/world/assembly/raw/pillar_stone_knight_hall.png' },
    ],
    market: [
      { key: 'stage:market:backdrop', url: '/world/market/backdrop.png' },
      { key: 'stage:market:horizon',  url: '/world/market/horizon.png' },
    ],
    kitchen: [
      { key: 'stage:kitchen:backdrop', url: '/world/kitchen/backdrop.png' },
      { key: 'stage:kitchen:horizon',  url: '/world/kitchen/horizon.png' },
    ],
    tower: [
      { key: 'stage:tower:backdrop', url: '/world/tower/backdrop.png' },
      { key: 'stage:tower:horizon',  url: '/world/tower/horizon.png' },
    ],
    grove: [
      { key: 'stage:grove:backdrop', url: '/world/grove/backdrop.png' },
      { key: 'stage:grove:horizon',  url: '/world/grove/horizon.png' },
    ],
    catacombs: [
      { key: 'stage:catacombs:backdrop', url: '/world/catacombs/backdrop.png' },
      { key: 'stage:catacombs:horizon',  url: '/world/catacombs/horizon.png' },
    ],
    throne: [
      { key: 'stage:throne:backdrop', url: '/world/throne/backdrop.png' },
      { key: 'stage:throne:horizon',  url: '/world/throne/horizon.png' },
    ],
    docks: [
      { key: 'stage:docks:backdrop', url: '/world/docks/backdrop.png' },
      { key: 'stage:docks:horizon',  url: '/world/docks/horizon.png' },
    ],
    rooftops: [
      { key: 'stage:rooftops:backdrop', url: '/world/rooftops/backdrop.png' },
      { key: 'stage:rooftops:horizon',  url: '/world/rooftops/horizon.png' },
    ],
  },
};
