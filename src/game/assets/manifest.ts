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
      { key: 'stage:assembly:pillar',      url: '/world/assembly/raw/pillar_stone_knight_hall.png' },
      { key: 'stage:assembly:brazier',     url: '/world/assembly/raw/brazier_wall_torch.png' },
      { key: 'stage:assembly:banner',      url: '/world/assembly/raw/banner_war_hanging.png' },
      { key: 'stage:assembly:bench',       url: '/world/assembly/raw/bench_broken.png' },
      { key: 'stage:assembly:dagger',      url: '/world/assembly/raw/dagger_ceremonial_pickup.png' },
      { key: 'stage:assembly:archway',     url: '/world/assembly/raw/archway_grand_stone.png' },
      { key: 'stage:assembly:window',      url: '/world/assembly/raw/window_stained_glass.png' },
      { key: 'stage:assembly:dais',        url: '/world/assembly/raw/dais_raised_stone.png' },
      { key: 'stage:assembly:floor_chunk', url: '/world/assembly/raw/floor_chunk_flagstone_cracked.png' },
      { key: 'stage:assembly:weapon_rack', url: '/world/assembly/raw/weapon_rack_shields_spears.png' },
    ],
    market: [
      { key: 'stage:market:backdrop', url: '/world/market/backdrop.png' },
      { key: 'stage:market:horizon',  url: '/world/market/horizon.png' },
    ],
    kitchen: [
      { key: 'stage:kitchen:cauldron', url: '/world/kitchen/raw/cauldron_iron_bubbling.png' },
      { key: 'stage:kitchen:stove',    url: '/world/kitchen/raw/stove_brick_ruined.png' },
      { key: 'stage:kitchen:hooks',    url: '/world/kitchen/raw/meat_hooks_hanging.png' },
      { key: 'stage:kitchen:barrel',   url: '/world/kitchen/raw/barrel_rotten_leaking.png' },
    ],
    tower: [
      { key: 'stage:tower:pillar',   url: '/world/tower/raw/pillar_arcane_rune.png' },
      { key: 'stage:tower:crystals', url: '/world/tower/raw/crystal_cluster_arcane.png' },
      { key: 'stage:tower:tomes',    url: '/world/tower/raw/tome_pile_floating.png' },
      { key: 'stage:tower:brazier',  url: '/world/tower/raw/brazier_arcane_violet.png' },
    ],
    grove: [
      { key: 'stage:grove:tree',      url: '/world/grove/raw/tree_ancient_gnarled.png' },
      { key: 'stage:grove:stone',     url: '/world/grove/raw/stone_standing_runic.png' },
      { key: 'stage:grove:mushrooms', url: '/world/grove/raw/mushroom_bioluminescent.png' },
      { key: 'stage:grove:altar',     url: '/world/grove/raw/altar_mossy_druid.png' },
    ],
    catacombs: [
      { key: 'stage:catacombs:stalactites', url: '/world/catacombs/raw/stalactite_cluster.png' },
      { key: 'stage:catacombs:bones',       url: '/world/catacombs/raw/bone_pile_ancient.png' },
      { key: 'stage:catacombs:torch',       url: '/world/catacombs/raw/torch_sconce_skull.png' },
      { key: 'stage:catacombs:pillar',      url: '/world/catacombs/raw/pillar_cracked_flooded.png' },
    ],
    throne: [
      { key: 'stage:throne:throne', url: '/world/throne/raw/throne_crimson_ornate.png' },
      { key: 'stage:throne:block',  url: '/world/throne/raw/block_execution_wood.png' },
      { key: 'stage:throne:banner', url: '/world/throne/raw/pillar_crimson_banner.png' },
      { key: 'stage:throne:cage',   url: '/world/throne/raw/cage_iron_floor.png' },
    ],
    docks: [
      { key: 'stage:docks:post',   url: '/world/docks/raw/post_mooring_dock.png' },
      { key: 'stage:docks:lamp',   url: '/world/docks/raw/lamp_fog_iron.png' },
      { key: 'stage:docks:anchor', url: '/world/docks/raw/anchor_rusted_large.png' },
      { key: 'stage:docks:crates', url: '/world/docks/raw/crate_stack_dock.png' },
    ],
    rooftops: [
      { key: 'stage:rooftops:chimney',  url: '/world/rooftops/raw/chimney_stone_smoke.png' },
      { key: 'stage:rooftops:bell',     url: '/world/rooftops/raw/bell_post_brass.png' },
      { key: 'stage:rooftops:flags',    url: '/world/rooftops/raw/flags_prayer_string.png' },
      { key: 'stage:rooftops:gargoyle', url: '/world/rooftops/raw/gargoyle_stone_roof.png' },
    ],
  },
};
