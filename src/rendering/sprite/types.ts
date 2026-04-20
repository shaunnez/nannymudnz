import type { AnimationId, GuildId } from '../../simulation/types';

export interface AnimationMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
}

export interface SpriteSheet {
  image: HTMLImageElement;
  meta: AnimationMetadata;
}

export interface GuildSpriteSet {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  sheets: Partial<Record<AnimationId, SpriteSheet>>;
}

export interface GuildSpriteMetadataFile {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  animations: Partial<Record<AnimationId, AnimationMetadata>>;
}
