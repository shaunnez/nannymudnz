import Phaser from 'phaser';
import type { AnimationId, GuildId } from '@nannymud/shared/simulation/types';

/**
 * Per-guild sprite metadata as emitted by scripts/composite-pixellab-sprites.py.
 * Each PNG next to metadata.json is a horizontal strip of `frames` tiles,
 * each `frameSize.w × frameSize.h`. Frame 0 faces `facing` (right/left),
 * the ActorView flips the whole sprite via scaleX when the actor faces the
 * other way.
 */
interface GuildMetadata {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  animations: Partial<Record<AnimationId, {
    frames: number;
    frameDurationMs: number;
    loop: boolean;
    anchor: { x: number; y: number };
  }>>;
}

const SPRITE_GUILDS: GuildId[] = ['knight', 'leper', 'vampire'];

// Populated as metadata loads complete. ActorView reads from here to pick an
// anchor offset and to check whether a guild has sprite coverage.
const loadedMetadata = new Map<GuildId, GuildMetadata>();

export function getGuildMetadata(guildId: GuildId): GuildMetadata | undefined {
  return loadedMetadata.get(guildId);
}

export function guildHasSprites(guildId: GuildId): boolean {
  return loadedMetadata.has(guildId);
}

export function animationKey(guildId: GuildId, animId: AnimationId): string {
  return `${guildId}:${animId}`;
}

export function textureKey(guildId: GuildId, animId: AnimationId): string {
  return `tex:${guildId}:${animId}`;
}

function metadataKey(guildId: GuildId): string {
  return `meta:${guildId}`;
}

/**
 * Queues guild metadata JSON during BootScene.preload. When each JSON file
 * finishes loading we synchronously enqueue its per-animation spritesheet
 * files using the frameSize declared in that metadata — Phaser's loader
 * supports adding work from within a filecomplete event handler during
 * preload, so the progress bar keeps ticking and the loader's `complete`
 * event fires after everything has finished.
 */
export function queueGuildSprites(scene: Phaser.Scene): void {
  for (const guildId of SPRITE_GUILDS) {
    scene.load.json(metadataKey(guildId), `sprites/${guildId}/metadata.json`);
  }

  for (const guildId of SPRITE_GUILDS) {
    const key = metadataKey(guildId);
    scene.load.on(`filecomplete-json-${key}`, () => {
      const meta = scene.cache.json.get(key) as GuildMetadata | undefined;
      if (!meta) return;
      loadedMetadata.set(guildId, meta);
      for (const animId of Object.keys(meta.animations) as AnimationId[]) {
        scene.load.spritesheet(
          textureKey(guildId, animId),
          `sprites/${guildId}/${animId}.png`,
          { frameWidth: meta.frameSize.w, frameHeight: meta.frameSize.h },
        );
      }
    });
  }
}

/**
 * Registers Phaser animations for every guild whose metadata finished loading.
 * Called once from BootScene.create after preload completes. Safe to call
 * multiple times — skips animations that already exist on scene.anims.
 */
export function registerGuildAnimations(scene: Phaser.Scene): void {
  for (const [guildId, meta] of loadedMetadata) {
    for (const [animIdRaw, animMeta] of Object.entries(meta.animations)) {
      if (!animMeta) continue;
      const animId = animIdRaw as AnimationId;
      const key = animationKey(guildId, animId);
      if (scene.anims.exists(key)) continue;
      const texKey = textureKey(guildId, animId);
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
  guildId: GuildId,
  requested: AnimationId,
): AnimationId | null {
  const meta = loadedMetadata.get(guildId);
  if (!meta) return null;
  const chain = FALLBACK[requested] ?? ['idle'];
  for (const id of chain) {
    if (meta.animations[id] !== undefined) return id;
  }
  return null;
}
