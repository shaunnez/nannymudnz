import Phaser from 'phaser';

interface EffectAssetMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  frameSize: { w: number; h: number };
  scale: number;
}

interface EffectsMetadata {
  frameSize: { w: number; h: number };
  assets: Record<string, EffectAssetMetadata>;
}

const META_KEY = 'meta:effects';
let loadedMeta: EffectsMetadata | null = null;

function texKey(assetKey: string): string {
  return `tex:effects:${assetKey}`;
}

function animKey(assetKey: string): string {
  return `anim:effects:${assetKey}`;
}

export function queueEffectsVfx(scene: Phaser.Scene): void {
  scene.load.json(META_KEY, 'vfx/effects/metadata.json');
  scene.load.on(`filecomplete-json-${META_KEY}`, () => {
    const meta = scene.cache.json.get(META_KEY) as EffectsMetadata | undefined;
    if (!meta) return;
    loadedMeta = meta;
    for (const [key, asset] of Object.entries(meta.assets)) {
      const fs = asset.frameSize ?? meta.frameSize;
      scene.load.spritesheet(texKey(key), `vfx/effects/${key}.png`, {
        frameWidth: fs.w,
        frameHeight: fs.h,
      });
    }
  });
}

export function registerEffectsVfx(scene: Phaser.Scene): void {
  if (!loadedMeta) return;
  for (const [key, asset] of Object.entries(loadedMeta.assets)) {
    const ak = animKey(key);
    if (scene.anims.exists(ak)) continue;
    const tk = texKey(key);
    if (!scene.textures.exists(tk)) continue;
    const frameRate = 1000 / Math.max(1, asset.frameDurationMs);
    scene.anims.create({
      key: ak,
      frames: scene.anims.generateFrameNumbers(tk, { start: 0, end: asset.frames - 1 }),
      frameRate,
      repeat: asset.loop ? -1 : 0,
    });
  }
}

export function spawnEffectVfx(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
): boolean {
  if (!loadedMeta) return false;
  const asset = loadedMeta.assets[key];
  if (!asset) return false;
  const tk = texKey(key);
  const ak = animKey(key);
  if (!scene.textures.exists(tk) || !scene.anims.exists(ak)) return false;

  const fs = asset.frameSize ?? loadedMeta.frameSize;
  const sprite = scene.add
    .sprite(x, y, tk, 0)
    .setOrigin(asset.anchor.x / fs.w, asset.anchor.y / fs.h)
    .setScale(asset.scale)
    .setDepth(y + 1000);
  if (facing === -1) sprite.setFlipX(true);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(ak);
  return true;
}
