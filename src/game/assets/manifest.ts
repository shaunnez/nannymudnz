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
      {
        key: 'stage:assembly:pillar',
        url: '/world/assembly/raw/pillar_stone_knight_hall.png',
      },
      {
        key: 'stage:assembly:brazier',
        url: '/world/assembly/raw/brazier_wall_torch.png',
      },
      {
        key: 'stage:assembly:banner',
        url: '/world/assembly/raw/banner_war_hanging.png',
      },
      {
        key: 'stage:assembly:bench',
        url: '/world/assembly/raw/bench_broken.png',
      },
      {
        key: 'stage:assembly:dagger',
        url: '/world/assembly/raw/dagger_ceremonial_pickup.png',
      },
      {
        key: 'stage:assembly:archway',
        url: '/world/assembly/raw/archway_grand_stone.png',
      },
      {
        key: 'stage:assembly:window',
        url: '/world/assembly/raw/window_stained_glass.png',
      },
      {
        key: 'stage:assembly:dais',
        url: '/world/assembly/raw/dais_raised_stone.png',
      },
      {
        key: 'stage:assembly:floor_chunk',
        url: '/world/assembly/raw/floor_chunk_flagstone_cracked.png',
      },
      {
        key: 'stage:assembly:weapon_rack',
        url: '/world/assembly/raw/weapon_rack_shields_spears.png',
      },
    ],
  },
};
