import type { AnimationId, GuildId } from '../../simulation/types';
import type {
  GuildSpriteSet,
  GuildSpriteMetadataFile,
  SpriteSheet,
} from './types';

const cache = new Map<GuildId, GuildSpriteSet>();

export async function loadGuildSpriteSet(
  guildId: GuildId,
): Promise<GuildSpriteSet | null> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const metaUrl = `/sprites/${guildId}/metadata.json`;

  let meta: GuildSpriteMetadataFile;
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) {
      console.warn(`[spriteLoader] ${metaUrl} -> ${res.status}; falling back to placeholder`);
      return null;
    }
    meta = (await res.json()) as GuildSpriteMetadataFile;
  } catch (err) {
    console.warn(`[spriteLoader] failed to fetch metadata for ${guildId}:`, err);
    return null;
  }

  const animationEntries = Object.entries(meta.animations) as [
    AnimationId,
    GuildSpriteMetadataFile['animations'][AnimationId],
  ][];

  const sheets: Partial<Record<AnimationId, SpriteSheet>> = {};

  try {
    await Promise.all(
      animationEntries.map(async ([animId, animMeta]) => {
        if (!animMeta) return;
        const img = await loadImage(`/sprites/${guildId}/${animId}.png`);
        sheets[animId] = { image: img, meta: animMeta };
      }),
    );
  } catch (err) {
    console.warn(`[spriteLoader] failed to load PNGs for ${guildId}:`, err);
    return null;
  }

  if (!sheets.idle) {
    console.warn(`[spriteLoader] ${guildId} is missing required 'idle' animation; falling back to placeholder`);
    return null;
  }

  const set: GuildSpriteSet = {
    guildId,
    frameSize: meta.frameSize,
    facing: meta.facing,
    sheets,
  };
  cache.set(guildId, set);
  return set;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
}
