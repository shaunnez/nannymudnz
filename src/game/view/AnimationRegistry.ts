import Phaser from 'phaser';
import type { ActorKind, AnimationId } from '@nannymud/shared/simulation/types';

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
  animations: Partial<Record<AnimationId, {
    frames: number;
    frameDurationMs: number;
    loop: boolean;
    anchor: { x: number; y: number };
  }>>;
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
export function queueActorSprites(scene: Phaser.Scene): void {
  for (const actorId of SPRITE_ACTORS) {
    scene.load.json(metadataKey(actorId), `sprites/${actorId}/metadata.json`);
  }

  for (const actorId of SPRITE_ACTORS) {
    const key = metadataKey(actorId);
    scene.load.on(`filecomplete-json-${key}`, () => {
      const meta = scene.cache.json.get(key) as ActorSpriteMetadata | undefined;
      if (!meta) return;
      loadedMetadata.set(actorId, meta);
      for (const animId of Object.keys(meta.animations) as AnimationId[]) {
        scene.load.spritesheet(
          textureKey(actorId, animId),
          `sprites/${actorId}/${animId}.png`,
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
