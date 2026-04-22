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

export interface AssetManifest {
  atlases: Partial<Record<GuildId, AtlasDecl[]>>;
  vfxImages: Partial<Record<GuildId, VfxImageDecl[]>>;
}

export const MANIFEST: AssetManifest = {
  atlases: {},
  vfxImages: {},
};
