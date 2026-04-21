import type { GuildId } from '../../simulation/types';
import type {
  GuildVfxMetadataFile,
  GuildVfxSet,
  VfxSpriteSheet,
} from './types';

const cache = new Map<GuildId, GuildVfxSet>();

export async function loadGuildVfxSet(
  guildId: GuildId,
): Promise<GuildVfxSet | null> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const metaUrl = `/vfx/${guildId}/metadata.json`;

  let meta: GuildVfxMetadataFile;
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) {
      console.warn(`[vfxLoader] ${metaUrl} -> ${res.status}; falling back to procedural VFX`);
      return null;
    }
    meta = (await res.json()) as GuildVfxMetadataFile;
  } catch (err) {
    console.warn(`[vfxLoader] failed to fetch metadata for ${guildId}:`, err);
    return null;
  }

  const assets: Record<string, VfxSpriteSheet> = {};
  const entries = Object.entries(meta.assets);

  try {
    await Promise.all(entries.map(async ([assetKey, assetMeta]) => {
      const image = await loadImage(`/vfx/${guildId}/${assetKey}.png`);
      assets[assetKey] = { image, meta: assetMeta };
    }));
  } catch (err) {
    console.warn(`[vfxLoader] failed to load PNGs for ${guildId}:`, err);
    return null;
  }

  const set: GuildVfxSet = {
    guildId,
    frameSize: meta.frameSize,
    assets,
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
