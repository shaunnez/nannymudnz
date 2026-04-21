import type { GuildId } from '../../simulation/types';

export interface VfxAssetMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  scale?: number;
}

export interface VfxSpriteSheet {
  image: HTMLImageElement;
  meta: VfxAssetMetadata;
}

export interface GuildVfxSet {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  assets: Record<string, VfxSpriteSheet>;
}

export interface GuildVfxMetadataFile {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  assets: Record<string, VfxAssetMetadata>;
}
