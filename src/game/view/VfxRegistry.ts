import Phaser from 'phaser';
import type { GuildId, VFXEvent } from '@nannymud/shared/simulation/types';

interface GuildVfxAssetMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  frameSize?: { w: number; h: number };
  scale: number;
}

interface GuildVfxMetadata {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  assets: Record<string, GuildVfxAssetMetadata>;
}

const VFX_GUILDS: GuildId[] = ['knight', 'leper', 'viking', 'adventurer', 'mage', 'druid', 'monk', 'champion', 'hunter', 'prophet', 'vampire', 'darkmage', 'cultist', 'chef', 'master'];

const loadedMetadata = new Map<GuildId, GuildVfxMetadata>();

function metadataKey(guildId: GuildId): string {
  return `meta:vfx:${guildId}`;
}

function animationKey(guildId: GuildId, assetKey: string): string {
  return `vfx:${guildId}:${assetKey}`;
}

function textureKey(guildId: GuildId, assetKey: string): string {
  return `tex:vfx:${guildId}:${assetKey}`;
}

export function getGuildVfxAsset(
  guildId: GuildId,
  assetKey: string,
): { asset: GuildVfxAssetMetadata; frameSize: GuildVfxMetadata['frameSize'] } | null {
  const meta = loadedMetadata.get(guildId);
  if (!meta) return null;
  const asset = meta.assets[assetKey];
  if (!asset) return null;
  return { asset, frameSize: asset.frameSize ?? meta.frameSize };
}

export function queueGuildVfx(scene: Phaser.Scene): void {
  for (const guildId of VFX_GUILDS) {
    scene.load.json(metadataKey(guildId), `vfx/${guildId}/metadata.json`);
  }

  for (const guildId of VFX_GUILDS) {
    const key = metadataKey(guildId);
    scene.load.on(`filecomplete-json-${key}`, () => {
      const meta = scene.cache.json.get(key) as GuildVfxMetadata | undefined;
      if (!meta) return;
      loadedMetadata.set(guildId, meta);
      for (const assetKey of Object.keys(meta.assets)) {
        const asset = meta.assets[assetKey];
        const frameSize = asset.frameSize ?? meta.frameSize;
        scene.load.spritesheet(
          textureKey(guildId, assetKey),
          `vfx/${guildId}/${assetKey}.png`,
          { frameWidth: frameSize.w, frameHeight: frameSize.h },
        );
      }
    });
  }
}

export function registerGuildVfx(scene: Phaser.Scene): void {
  for (const [guildId, meta] of loadedMetadata) {
    for (const [assetKey, assetMeta] of Object.entries(meta.assets)) {
      const key = animationKey(guildId, assetKey);
      if (scene.anims.exists(key)) continue;
      const texKey = textureKey(guildId, assetKey);
      if (!scene.textures.exists(texKey)) continue;
      const frameRate = 1000 / Math.max(1, assetMeta.frameDurationMs);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texKey, {
          start: 0,
          end: assetMeta.frames - 1,
        }),
        frameRate,
        repeat: assetMeta.loop ? -1 : 0,
      });
    }
  }
}

export function spawnGuildVfx(scene: Phaser.Scene, event: VFXEvent, x: number, y: number): boolean {
  if (!event.guildId || !event.assetKey) return false;
  const entry = getGuildVfxAsset(event.guildId, event.assetKey);
  if (!entry) return false;

  const { asset, frameSize } = entry;
  const texKey = textureKey(event.guildId, event.assetKey);
  const animKey = animationKey(event.guildId, event.assetKey);
  if (!scene.textures.exists(texKey) || !scene.anims.exists(animKey)) return false;

  const originX = asset.anchor.x / frameSize.w;
  const originY = asset.anchor.y / frameSize.h;
  const sprite = scene.add
    .sprite(x, y, texKey, 0)
    .setOrigin(originX, originY)
    .setScale(asset.scale)
    .setDepth(y + 1000);

  if (event.facing === -1) {
    sprite.setFlipX(true);
  }

  const lifetimeMs = Math.max(asset.frames * asset.frameDurationMs, 100);
  if (asset.loop || asset.frames <= 1) {
    scene.time.delayedCall(lifetimeMs, () => sprite.destroy());
  } else {
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  }

  sprite.play(animKey);
  return true;
}
