import Phaser from 'phaser';
import type { ActorKind, AnimationId } from '@nannymud/shared/simulation/types';
import { readUseNewVfx } from '../../state/useDevSettings';

/**
 * Per-actor sprite metadata as emitted by scripts/composite-pixellab-sprites.py.
 * Each PNG next to metadata.json is a horizontal strip of `frames` tiles,
 * each `frameSize.w × frameSize.h`. Frame 0 faces `facing` (right/left),
 * the ActorView flips the whole sprite via scaleX when the actor faces the
 * other way.
 *
 * The `guildId` field in the JSON is kept for backwards compatibility with
 * existing guild metadata.json files, but the registry indexes by ActorKind
 * so both player guilds and enemies share a single sprite pipeline.
 */
interface ActorSpriteMetadata {
  guildId: ActorKind;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  animations: Partial<Record<AnimationId, ActorAnimationMetadata>>;
}

interface SpriteOpaqueBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ActorAnimationMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  opaqueBounds?: SpriteOpaqueBounds;
}

interface AnimationLayout {
  anchor: { x: number; y: number };
  opaqueBounds: SpriteOpaqueBounds;
}

const SPRITE_ACTORS: ActorKind[] = [
  // Player guilds
  'adventurer', 'champion', 'chef', 'cultist', 'darkmage',
  'druid', 'hunter', 'knight', 'leper', 'mage', 'master',
  'monk', 'prophet', 'vampire', 'viking',
  // Enemies + summons — entries added as sprite bundles land in public/sprites/
  'plains_bandit',
  'wolf',
  'bandit_archer',
  'bandit_king',
  'drowned_spawn',
  'rotting_husk',
  'wolf_pet',
  'bandit_brute',
];

// Populated as metadata loads complete. ActorView reads from here to pick an
// anchor offset and to check whether an actor kind has sprite coverage.
const loadedMetadata = new Map<ActorKind, ActorSpriteMetadata>();
const measuredLayouts = new Map<string, AnimationLayout>();
const referenceBodyHeights = new Map<ActorKind, number>();

export function getActorMetadata(actorId: ActorKind): ActorSpriteMetadata | undefined {
  return loadedMetadata.get(actorId);
}

export function hasSprites(actorId: ActorKind): boolean {
  return loadedMetadata.has(actorId);
}

export function animationKey(actorId: ActorKind, animId: AnimationId): string {
  return `${actorId}:${animId}`;
}

export function textureKey(actorId: ActorKind, animId: AnimationId): string {
  return `tex:${actorId}:${animId}`;
}

function metadataKey(actorId: ActorKind): string {
  return `meta:${actorId}`;
}

/**
 * Queues guild metadata JSON during BootScene.preload. When each JSON file
 * finishes loading we synchronously enqueue its per-animation spritesheet
 * files using the frameSize declared in that metadata — Phaser's loader
 * supports adding work from within a filecomplete event handler during
 * preload, so the progress bar keeps ticking and the loader's `complete`
 * event fires after everything has finished.
 */
// When the New VFX toggle is on, Hunter uses the ranger chibi sprites instead.
const SPRITE_OVERRIDES: Partial<Record<ActorKind, string>> = { hunter: 'ranger' };

export function queueActorSprites(scene: Phaser.Scene): void {
  measuredLayouts.clear();
  referenceBodyHeights.clear();
  const newVfx = readUseNewVfx();
  const spriteDirs = new Map<ActorKind, string>();
  for (const actorId of SPRITE_ACTORS) {
    const dir = (newVfx ? SPRITE_OVERRIDES[actorId] : undefined) ?? actorId;
    spriteDirs.set(actorId, dir);
    scene.load.json(metadataKey(actorId), `sprites/${dir}/metadata.json`);
  }

  for (const actorId of SPRITE_ACTORS) {
    const dir = spriteDirs.get(actorId)!;
    const key = metadataKey(actorId);
    scene.load.on(`filecomplete-json-${key}`, () => {
      const meta = scene.cache.json.get(key) as ActorSpriteMetadata | undefined;
      if (!meta) return;
      loadedMetadata.set(actorId, meta);
      for (const animId of Object.keys(meta.animations) as AnimationId[]) {
        scene.load.spritesheet(
          textureKey(actorId, animId),
          `sprites/${dir}/${animId}.png`,
          { frameWidth: meta.frameSize.w, frameHeight: meta.frameSize.h },
        );
      }
    });
  }
}

/**
 * Registers Phaser animations for every actor whose metadata finished loading.
 * Called once from BootScene.create after preload completes. Safe to call
 * multiple times — skips animations that already exist on scene.anims.
 */
export function registerActorAnimations(scene: Phaser.Scene): void {
  for (const [actorId, meta] of loadedMetadata) {
    for (const [animIdRaw, animMeta] of Object.entries(meta.animations)) {
      if (!animMeta) continue;
      const animId = animIdRaw as AnimationId;
      const key = animationKey(actorId, animId);
      if (scene.anims.exists(key)) continue;
      const texKey = textureKey(actorId, animId);
      if (!scene.textures.exists(texKey)) continue;
      const frameRate = 1000 / Math.max(1, animMeta.frameDurationMs);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(texKey, {
          start: 0,
          end: animMeta.frames - 1,
        }),
        frameRate,
        repeat: animMeta.loop ? -1 : 0,
      });
    }
  }
}

function fullFrameBounds(frameSize: { w: number; h: number }): SpriteOpaqueBounds {
  return {
    left: 0,
    top: 0,
    right: frameSize.w - 1,
    bottom: frameSize.h - 1,
  };
}

function trimVerticalBounds(
  rowCounts: number[],
  rawTop: number,
  rawBottom: number,
): { top: number; bottom: number } {
  const maxRowPixels = rowCounts.reduce((max, count) => Math.max(max, count), 0);
  if (maxRowPixels <= 0) return { top: rawTop, bottom: rawBottom };
  const threshold = Math.max(2, Math.ceil(maxRowPixels * 0.15));
  let top = rawTop;
  while (top <= rawBottom && rowCounts[top] < threshold) top += 1;
  let bottom = rawBottom;
  while (bottom >= top && rowCounts[bottom] < threshold) bottom -= 1;
  return {
    top: Math.min(top, rawBottom),
    bottom: Math.max(bottom, top),
  };
}

function measureAnimationLayout(
  scene: Phaser.Scene,
  actorId: ActorKind,
  animId: AnimationId,
  meta: ActorSpriteMetadata,
  animMeta: ActorAnimationMetadata,
): AnimationLayout | null {
  const texKey = textureKey(actorId, animId);
  if (!scene.textures.exists(texKey)) return null;
  const texture = scene.textures.get(texKey);
  const source = texture.getSourceImage() as CanvasImageSource | null;
  if (!source || typeof document === 'undefined') return null;

  const { w, h } = meta.frameSize;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  let minLeft = w;
  let minTop = h;
  let maxRight = -1;
  let maxBottom = -1;
  const rowCounts = new Array<number>(h).fill(0);

  for (let frame = 0; frame < animMeta.frames; frame += 1) {
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(source, frame * w, 0, w, h, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y += 1) {
      const rowOffset = y * w * 4;
      for (let x = 0; x < w; x += 1) {
        if (pixels[rowOffset + x * 4 + 3] === 0) continue;
        rowCounts[y] += 1;
        if (x < minLeft) minLeft = x;
        if (y < minTop) minTop = y;
        if (x > maxRight) maxRight = x;
        if (y > maxBottom) maxBottom = y;
      }
    }
  }

  if (maxRight < minLeft || maxBottom < minTop) {
    return {
      anchor: {
        x: animMeta.anchor?.x ?? Math.floor(w / 2),
        y: animMeta.anchor?.y ?? h - 1,
      },
      opaqueBounds: fullFrameBounds(meta.frameSize),
    };
  }

  const trimmed = trimVerticalBounds(rowCounts, minTop, maxBottom);
  return {
    anchor: {
      x: animMeta.anchor?.x ?? Math.floor(w / 2),
      y: trimmed.bottom + 1,
    },
    opaqueBounds: {
      left: minLeft,
      top: trimmed.top,
      right: maxRight,
      bottom: trimmed.bottom,
    },
  };
}

export function getAnimationLayout(
  scene: Phaser.Scene,
  actorId: ActorKind,
  animId: AnimationId,
): AnimationLayout | null {
  const key = animationKey(actorId, animId);
  const cached = measuredLayouts.get(key);
  if (cached) return cached;

  const meta = loadedMetadata.get(actorId);
  const animMeta = meta?.animations[animId];
  if (!meta || !animMeta) return null;

  const opaqueBounds = animMeta.opaqueBounds;
  const measured = opaqueBounds
    ? {
        anchor: {
          x: animMeta.anchor?.x ?? Math.floor(meta.frameSize.w / 2),
          y: animMeta.anchor?.y ?? opaqueBounds.bottom + 1,
        },
        opaqueBounds,
      }
    : measureAnimationLayout(scene, actorId, animId, meta, animMeta);

  const layout = measured ?? {
    anchor: {
      x: animMeta.anchor?.x ?? Math.floor(meta.frameSize.w / 2),
      y: animMeta.anchor?.y ?? meta.frameSize.h - 1,
    },
    opaqueBounds: fullFrameBounds(meta.frameSize),
  };
  measuredLayouts.set(key, layout);
  return layout;
}

export function getReferenceBodyHeight(
  scene: Phaser.Scene,
  actorId: ActorKind,
): number | null {
  const cached = referenceBodyHeights.get(actorId);
  if (cached !== undefined) return cached;

  const referenceAnim =
    resolveAnimation(actorId, 'idle')
    ?? resolveAnimation(actorId, 'walk')
    ?? resolveAnimation(actorId, 'run');
  if (!referenceAnim) return null;

  const layout = getAnimationLayout(scene, actorId, referenceAnim);
  if (!layout) return null;
  const bodyHeight = Math.max(1, layout.anchor.y - layout.opaqueBounds.top);
  referenceBodyHeights.set(actorId, bodyHeight);
  return bodyHeight;
}

/**
 * Fallback chain for animations that aren't present in a guild's metadata —
 * mirrors src/rendering/sprite/animationFallback.ts so gameplay hurt/death/
 * dodge states still pick a reasonable sprite.
 */
const FALLBACK: Record<AnimationId, readonly AnimationId[]> = {
  idle:        ['idle'],
  walk:        ['walk', 'idle'],
  run:         ['run', 'walk', 'idle'],
  jump:        ['jump', 'idle'],
  fall:        ['jump', 'idle'],
  land:        ['jump', 'idle'],
  attack_1:    ['attack_1', 'idle'],
  attack_2:    ['attack_2', 'attack_1', 'idle'],
  attack_3:    ['attack_3', 'attack_2', 'attack_1', 'idle'],
  run_attack:  ['attack_1', 'idle'],
  jump_attack: ['attack_1', 'idle'],
  block:       ['block', 'idle'],
  dodge:       ['idle'],
  hurt:        ['hurt', 'idle'],
  knockdown:   ['hurt', 'idle'],
  getup:       ['hurt', 'idle'],
  death:       ['death', 'hurt', 'idle'],
  ability_1:   ['ability_1', 'attack_1', 'idle'],
  ability_2:   ['ability_2', 'attack_2', 'attack_1', 'idle'],
  ability_3:   ['ability_3', 'attack_3', 'attack_1', 'idle'],
  ability_4:   ['ability_4', 'attack_1', 'idle'],
  ability_5:   ['ability_5', 'attack_1', 'idle'],
  channel:     ['ability_5', 'idle'],
  grab:        ['ability_3', 'attack_1', 'idle'],
  throw:       ['attack_3', 'attack_1', 'idle'],
  pickup:      ['idle'],
};

export function resolveAnimation(
  actorId: ActorKind,
  requested: AnimationId,
): AnimationId | null {
  const meta = loadedMetadata.get(actorId);
  if (!meta) return null;
  const chain = FALLBACK[requested] ?? ['idle'];
  for (const id of chain) {
    if (meta.animations[id] !== undefined) return id;
  }
  return null;
}
