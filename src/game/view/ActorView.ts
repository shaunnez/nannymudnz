import Phaser from 'phaser';
import type { Actor, ActorKind, AnimationId } from '@nannymud/shared/simulation/types';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import { ENEMY_DEFS } from '@nannymud/shared/simulation/enemyData';
import { worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';
import {
  animationKey,
  getAnimationLayout,
  getActorMetadata,
  getReferenceBodyHeight,
  hasSprites,
  resolveAnimation,
  textureKey,
} from './AnimationRegistry';

const GUILD_LOOKUP: Record<string, { color: string; initial: string }> = {};
for (const g of GUILDS) GUILD_LOOKUP[g.id] = { color: g.color, initial: g.initial };

const ENEMY_LOOKUP: Record<string, { color: string; initial: string }> = {};
for (const [kind, def] of Object.entries(ENEMY_DEFS)) {
  ENEMY_LOOKUP[kind] = { color: def.color, initial: def.initial };
}

const ALLY_COLOR = '#a3e635';
const ALLY_INITIAL = 'A';

const LEGACY_DISPLAY_SCALE = 1.5;
const SPRITE_BODY_TO_HITBOX_RATIO = 1.5;

function colorAndInitial(actor: Actor): { color: string; initial: string } {
  if (actor.guildId) {
    const g = GUILD_LOOKUP[actor.guildId];
    if (g) return g;
  }
  if (actor.team === 'player') return { color: ALLY_COLOR, initial: ALLY_INITIAL };
  const e = ENEMY_LOOKUP[actor.kind];
  if (e) return e;
  return { color: '#888888', initial: '?' };
}

function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0x888888;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

function darkenInt(int: number, amount: number): number {
  const r = Math.max(0, ((int >> 16) & 0xff) - amount);
  const g = Math.max(0, ((int >> 8) & 0xff) - amount);
  const b = Math.max(0, (int & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

/**
 * Per-actor visual. Two rendering paths share depth sort + shadow + HP bar:
 * - Sprite path (when the actor's guild has pixellab sprites loaded): a
 *   Phaser.Sprite plays animations keyed by guild:animId. Placeholder body
 *   and initial are hidden.
 * - Placeholder path (enemies and unsupplied guilds): shadow + rounded
 *   rectangle body + facing nose + initial letter, matching the Canvas
 *   PlaceholderRenderer.
 *
 * Each frame GameplayScene calls syncFrom(actor); the view applies world-
 * space x and projected screen-y, sets depth = actor.y for 2.5D sort, flips
 * on facing, dims for stealth/stun, pulses on getup, and drives animations
 * from actor.animationId.
 */
export class ActorView {
  readonly actorId: string;

  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Graphics;
  private auraFx: Phaser.GameObjects.Graphics;
  private whirlwindFx: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Graphics;
  private nose: Phaser.GameObjects.Graphics;
  private initial: Phaser.GameObjects.Text;
  private headFx: Phaser.GameObjects.Graphics;
  private attackFx: Phaser.GameObjects.Graphics;
  private hpBg: Phaser.GameObjects.Graphics;
  private hpFg: Phaser.GameObjects.Graphics;
  private sprite?: Phaser.GameObjects.Sprite;
  private currentAnim?: string;
  private spriteScale = LEGACY_DISPLAY_SCALE;
  private spriteBodyHeightPx: number;

  private readonly width: number;
  private readonly height: number;
  private readonly fillColor: number;
  private readonly outlineColor: number;
  private readonly initialChar: string;
  private readonly initialColor: string;
  private spriteId?: ActorKind;
  private readonly hasSprites: boolean;
  private readonly band: ScreenYBand;
  private readonly isLocalPlayerActor: boolean;
  private readonly baseSpriteId: ActorKind | undefined;
  private lastShapeshiftForm: string = 'none';

  constructor(scene: Phaser.Scene, actor: Actor, isLocalPlayerActor: boolean = false) {
    this.isLocalPlayerActor = isLocalPlayerActor;
    this.scene = scene;
    this.band = getScreenYBand(scene);
    this.actorId = actor.id;
    this.width = actor.width;
    this.height = actor.height;
    this.spriteBodyHeightPx = this.height * SPRITE_BODY_TO_HITBOX_RATIO;
    this.spriteId = (actor.guildId ?? actor.kind) as ActorKind | undefined;
    this.baseSpriteId = this.spriteId;
    this.hasSprites = !!this.spriteId && hasSprites(this.spriteId);

    const { color, initial } = colorAndInitial(actor);
    this.fillColor = hexToInt(color);
    this.outlineColor = darkenInt(this.fillColor, 50);
    this.initialChar = initial;
    this.initialColor = color === '#ffffff' ? '#888888' : '#ffffff';

    this.shadow = scene.add.graphics();
    this.auraFx = scene.add.graphics();
    this.whirlwindFx = scene.add.graphics();
    this.body = scene.add.graphics();
    this.nose = scene.add.graphics();
    this.initial = scene.add.text(0, 0, this.initialChar, {
      fontFamily: 'monospace',
      fontStyle: 'bold',
      fontSize: `${Math.min(16, Math.floor(this.width * 0.4))}px`,
      color: this.initialColor,
    }).setOrigin(0.5);
    this.headFx = scene.add.graphics();
    this.attackFx = scene.add.graphics();
    this.hpBg = scene.add.graphics();
    this.hpFg = scene.add.graphics();

    const children: Phaser.GameObjects.GameObject[] = [
      this.shadow,
      this.auraFx,
      this.whirlwindFx,
      this.body,
      this.nose,
      this.initial,
    ];

    if (this.hasSprites && this.spriteId) {
      const idleTex = textureKey(this.spriteId, 'idle');
      if (scene.textures.exists(idleTex)) {
        const referenceBodyHeight = getReferenceBodyHeight(scene, this.spriteId);
        if (referenceBodyHeight) {
          this.spriteScale = (actor.height * SPRITE_BODY_TO_HITBOX_RATIO) / referenceBodyHeight;
        }
        this.sprite = scene.add.sprite(0, 0, idleTex, 0).setScale(this.spriteScale);
        this.applySpriteLayout('idle');
        children.push(this.sprite);
      }
    }

    children.push(this.headFx, this.attackFx);
    children.push(this.hpBg, this.hpFg);

    this.container = scene.add.container(0, 0, children);

    this.drawBody();
  }

  private applySpriteLayout(animId: AnimationId): void {
    if (!this.sprite || !this.spriteId) return;
    const meta = getActorMetadata(this.spriteId);
    if (!meta) {
      this.sprite.setOrigin(0.5, 1);
      this.spriteBodyHeightPx = this.height * SPRITE_BODY_TO_HITBOX_RATIO;
      return;
    }

    const layout = getAnimationLayout(this.scene, this.spriteId, animId);
    if (layout) {
      this.sprite.setOrigin(
        layout.anchor.x / meta.frameSize.w,
        layout.anchor.y / meta.frameSize.h,
      );
      this.spriteBodyHeightPx = Math.max(
        this.height,
        (layout.anchor.y - layout.opaqueBounds.top) * this.spriteScale,
      );
      return;
    }

    const animMeta = meta.animations[animId];
    if (animMeta) {
      this.sprite.setOrigin(
        animMeta.anchor.x / meta.frameSize.w,
        animMeta.anchor.y / meta.frameSize.h,
      );
    } else {
      this.sprite.setOrigin(0.5, 1);
    }
    this.spriteBodyHeightPx = this.height * SPRITE_BODY_TO_HITBOX_RATIO;
  }

  private drawBody(): void {
    this.body.clear();
    if (this.sprite) {
      this.body.setVisible(false);
      return;
    }
    this.body.lineStyle(2, this.outlineColor, 1);
    this.body.fillStyle(this.fillColor, 1);
    this.body.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    this.body.strokeRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
  }

  private playAnim(animId: AnimationId): void {
    if (!this.sprite || !this.spriteId) return;
    const resolved = resolveAnimation(this.spriteId, animId);
    if (!resolved) return;
    this.applySpriteLayout(resolved);
    const key = animationKey(this.spriteId, resolved);
    if (this.currentAnim === key) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  private clearAttachedFx(): void {
    for (const fx of [this.auraFx, this.whirlwindFx, this.headFx, this.attackFx]) {
      fx.clear();
      fx.setVisible(false);
      fx.setRotation(0);
    }
  }

  private drawVikingBuffDots(bodyHeight: number, visualTime: number): void {
    this.headFx.clear();
    this.headFx.fillStyle(0xef4444, 1);
    const headY = -bodyHeight + 12;
    for (let i = 0; i < 3; i++) {
      const angle = visualTime * 5 + i * ((Math.PI * 2) / 3);
      const x = Math.cos(angle) * 9;
      const y = headY + Math.sin(angle) * 4;
      this.headFx.fillCircle(x, y, 2.5);
    }
    this.headFx.fillStyle(0xfca5a5, 0.9);
    this.headFx.fillCircle(0, headY - 2, 1.5);
    this.headFx.setVisible(true);
  }

  private drawVikingUndyingAura(bodyHeight: number): void {
    this.auraFx.clear();
    this.auraFx.fillStyle(0x450a0a, 0.18);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 1.02);
    this.auraFx.lineStyle(3, 0xdc2626, 0.9);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.2, bodyHeight * 0.96);
    this.auraFx.lineStyle(2, 0xfca5a5, 0.6);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.05, bodyHeight * 0.82);
    this.auraFx.setVisible(true);
  }

  private drawVikingWhirlwind(bodyHeight: number, visualTime: number, swingDir: -1 | 1): void {
    this.whirlwindFx.clear();
    const primaryX = swingDir * (this.width * 0.44);
    const secondaryX = -primaryX * 0.82;
    const arcY = -bodyHeight * 0.48;
    this.whirlwindFx.lineStyle(6, 0xf97316, 0.96);
    this.whirlwindFx.beginPath();
    this.whirlwindFx.arc(primaryX, arcY, 28, -1.35, 1.1, swingDir < 0);
    this.whirlwindFx.strokePath();
    this.whirlwindFx.lineStyle(3, 0xfde68a, 0.88);
    this.whirlwindFx.beginPath();
    this.whirlwindFx.arc(primaryX, arcY, 20, -1.1, 0.9, swingDir < 0);
    this.whirlwindFx.strokePath();
    this.whirlwindFx.lineStyle(3, 0xfb923c, 0.45);
    this.whirlwindFx.beginPath();
    this.whirlwindFx.arc(secondaryX, arcY + 4, 22, -1.1, 0.9, swingDir > 0);
    this.whirlwindFx.strokePath();
    this.whirlwindFx.fillStyle(0xfca5a5, 0.95);
    this.whirlwindFx.fillCircle(primaryX + swingDir * 10, arcY - 8, 2.5);
    this.whirlwindFx.fillCircle(primaryX + swingDir * 16, arcY + 2, 2);
    this.whirlwindFx.fillStyle(0xfb923c, 0.75);
    for (let i = 0; i < 3; i++) {
      const t = visualTime * 10 + i * 0.55;
      const x = primaryX + swingDir * (8 + i * 8);
      const y = arcY + Math.sin(t) * (5 + i);
      this.whirlwindFx.fillCircle(x, y, 1.8);
    }
    this.whirlwindFx.setVisible(true);
  }

  private drawVikingAxeSwing(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(6, 0xf97316, 0.92);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.52, 34, -1.15, 0.95, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(3, 0xfde68a, 0.85);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.52, 24, -1.0, 0.75, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfca5a5, 0.95);
    this.attackFx.fillCircle(34, -bodyHeight * 0.56, 3);
    this.attackFx.fillCircle(26, -bodyHeight * 0.73, 2.5);
    this.attackFx.setVisible(true);
  }

  private drawAdventurerRallyingCry(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.6 + Math.sin(visualTime * 4) * 0.25;
    this.auraFx.lineStyle(3, 0xf59e0b, 0.72 + pulse * 0.18);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.38, bodyHeight * 0.98);
    this.auraFx.lineStyle(1.5, 0xfde68a, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.15, bodyHeight * 0.78);
    for (let i = 0; i < 3; i++) {
      const angle = visualTime * 3 + i * ((Math.PI * 2) / 3);
      this.auraFx.fillStyle(0xfbbf24, 0.88);
      this.auraFx.fillCircle(
        Math.cos(angle) * this.width * 0.72,
        -bodyHeight * 0.52 + Math.sin(angle) * bodyHeight * 0.5,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawAdventurerAdrenalineRush(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 8) * 0.3;
    this.auraFx.fillStyle(0xf97316, 0.1 + pulse * 0.08);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.45, bodyHeight * 1.02);
    this.auraFx.lineStyle(4, 0xf97316, 0.82 + pulse * 0.14);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.32, bodyHeight * 0.92);
    this.auraFx.lineStyle(2, 0xfde68a, 0.65);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.72);
    for (let i = 0; i < 4; i++) {
      const angle = visualTime * 5 + i * ((Math.PI * 2) / 4);
      this.auraFx.fillStyle(0xfb923c, 0.82);
      this.auraFx.fillCircle(
        Math.cos(angle) * this.width * 0.68,
        -bodyHeight * 0.52 + Math.sin(angle) * bodyHeight * 0.46,
        2,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawAdventurerBandage(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.5 + Math.sin(visualTime * 6) * 0.3;
    this.auraFx.lineStyle(3, 0x22c55e, 0.7 + pulse * 0.22);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.28, bodyHeight * 0.92);
    for (let i = 0; i < 4; i++) {
      const t = (visualTime * 1.5 + i * 0.35) % 1;
      const x = (i % 2 === 0 ? 1 : -1) * this.width * 0.22;
      const y = -bodyHeight * 0.1 - t * bodyHeight * 0.82;
      this.auraFx.fillStyle(0x4ade80, (1 - t) * 0.88);
      this.auraFx.fillCircle(x, y, 2.5);
    }
    this.auraFx.setVisible(true);
  }

  private drawAdventurerSlash(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(5.5, 0xc9a961, 0.92);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 33, -1.1, 0.9, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(2.5, 0xfde68a, 0.82);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 22, -0.9, 0.72, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfff7ed, 0.92);
    this.attackFx.fillCircle(32, -bodyHeight * 0.56, 3);
    this.attackFx.setVisible(true);
  }

  private drawMageIceNova(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(4, 0x93c5fd, 0.9);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 36);
    this.attackFx.lineStyle(2, 0xe0f2fe, 0.7);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 24);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      this.attackFx.fillStyle(0xbae6fd, 0.9);
      this.attackFx.fillTriangle(
        Math.cos(a) * 28, -bodyHeight * 0.5 + Math.sin(a) * 28,
        Math.cos(a + 0.25) * 38, -bodyHeight * 0.5 + Math.sin(a + 0.25) * 38,
        Math.cos(a - 0.25) * 38, -bodyHeight * 0.5 + Math.sin(a - 0.25) * 38,
      );
    }
    this.attackFx.setVisible(true);
  }

  private drawMageMeteorCast(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.6 + Math.sin(visualTime * 6) * 0.3;
    this.auraFx.lineStyle(4, 0xef4444, 0.8 + pulse * 0.15);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.94);
    this.auraFx.lineStyle(2, 0xfca5a5, 0.6);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.74);
    for (let i = 0; i < 3; i++) {
      const a = visualTime * 4 + i * (Math.PI * 2 / 3);
      this.auraFx.fillStyle(0xf97316, 0.9);
      this.auraFx.fillCircle(Math.cos(a) * this.width * 0.66, -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46, 2.5);
    }
    this.auraFx.setVisible(true);
  }

  private drawDruidWildGrowth(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(4, 0x4caf50, 0.88);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 34);
    this.attackFx.lineStyle(2, 0x86efac, 0.7);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 22);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      this.attackFx.fillStyle(0x4ade80, 0.9);
      this.attackFx.fillCircle(Math.cos(a) * 30, -bodyHeight * 0.5 + Math.sin(a) * 30, 3);
    }
    this.attackFx.setVisible(true);
  }

  private drawDruidChanneling(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 5) * 0.28;
    this.auraFx.lineStyle(3, 0x4caf50, 0.68 + pulse * 0.22);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 0.96);
    this.auraFx.lineStyle(1.5, 0x86efac, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.76);
    for (let i = 0; i < 5; i++) {
      const t = (visualTime * 1.2 + i * 0.28) % 1;
      const x = (i % 2 === 0 ? 1 : -1) * this.width * 0.24;
      this.auraFx.fillStyle(0x4ade80, (1 - t) * 0.85);
      this.auraFx.fillCircle(x, -bodyHeight * 0.08 - t * bodyHeight * 0.78, 2.5);
    }
    this.auraFx.setVisible(true);
  }

  private drawDruidShapeshift(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.6 + Math.sin(visualTime * 3) * 0.25;
    this.auraFx.lineStyle(4, 0x65a30d, 0.7 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.42, bodyHeight * 1.02);
    this.auraFx.lineStyle(2, 0x4caf50, 0.55);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.2, bodyHeight * 0.82);
    this.auraFx.setVisible(true);
    if (this.sprite) this.sprite.setScale(this.spriteScale * 1.08);
  }

  private drawMonkSerenity(bodyHeight: number, visualTime: number, chiOrbs: number): void {
    this.auraFx.clear();
    this.auraFx.lineStyle(2, 0xfcd34d, 0.72);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.92);
    for (let i = 0; i < 5; i++) {
      const a = visualTime * 6 + i * (Math.PI * 2 / 5);
      const filled = i < chiOrbs;
      this.auraFx.fillStyle(filled ? 0xfcd34d : 0x44403c, filled ? 0.9 : 0.35);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.66,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        3,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawMonkDragonsFury(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    this.auraFx.lineStyle(5, 0xf97316, 0.88);
    this.auraFx.beginPath();
    this.auraFx.arc(0, -bodyHeight * 0.52, 32, visualTime * 8, visualTime * 8 + 2.5, false);
    this.auraFx.strokePath();
    for (let i = 0; i < 4; i++) {
      const a = visualTime * 12 + i * (Math.PI / 2);
      this.auraFx.fillStyle(0xfcd34d, 0.9);
      this.auraFx.fillCircle(
        Math.cos(a) * 24,
        -bodyHeight * 0.52 + Math.sin(a) * 24,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawMonkFlyingKick(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(6, 0xf59e0b, 0.92);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.48, 38, -1.2, 1.0, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(3, 0xfde68a, 0.8);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.48, 26, -1.0, 0.8, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfff7ed, 0.95);
    this.attackFx.fillCircle(36, -bodyHeight * 0.52, 3);
    this.attackFx.fillCircle(28, -bodyHeight * 0.7, 2.5);
    this.attackFx.setVisible(true);
  }

  private drawMonkJab(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(4, 0xfcd34d, 0.9);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.5, 20, -0.6, 0.6, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfff7ed, 0.95);
    this.attackFx.fillCircle(24, -bodyHeight * 0.5, 2.5);
    this.attackFx.setVisible(true);
  }

  private drawMonkFivePoint(bodyHeight: number): void {
    this.attackFx.clear();
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
      this.attackFx.fillStyle(0xef4444, 0.88);
      this.attackFx.fillCircle(10 + Math.cos(a) * 18, -bodyHeight * 0.5 + Math.sin(a) * 18, 3);
    }
    this.attackFx.fillStyle(0xfcd34d, 0.9);
    this.attackFx.fillCircle(10, -bodyHeight * 0.5, 4);
    this.attackFx.setVisible(true);
  }

  private drawChampionChargeImpact(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(7, 0xdc2626, 0.92);
    this.attackFx.beginPath();
    this.attackFx.arc(12, -bodyHeight * 0.5, 36, -1.0, 0.8, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(3, 0xfca5a5, 0.7);
    this.attackFx.beginPath();
    this.attackFx.arc(12, -bodyHeight * 0.5, 24, -0.8, 0.6, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfef2f2, 0.9);
    this.attackFx.fillCircle(38, -bodyHeight * 0.56, 3.5);
    this.attackFx.setVisible(true);
  }

  private drawChampionExecute(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(6, 0x7f1d1d, 0.95);
    this.attackFx.beginPath();
    this.attackFx.moveTo(-8, -bodyHeight * 0.8);
    this.attackFx.lineTo(16, -bodyHeight * 0.25);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(3, 0xdc2626, 0.8);
    this.attackFx.beginPath();
    this.attackFx.moveTo(0, -bodyHeight * 0.78);
    this.attackFx.lineTo(20, -bodyHeight * 0.26);
    this.attackFx.strokePath();
    for (let i = 0; i < 3; i++) {
      this.attackFx.fillStyle(0xdc2626, 0.85);
      this.attackFx.fillCircle(8 + i * 6, -bodyHeight * 0.3 + i * 8, 2.5);
    }
    this.attackFx.setVisible(true);
  }

  private drawChampionCleaver(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(5, 0xa71d2a, 0.9);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 30, -1.05, 0.85, false);
    this.attackFx.strokePath();
    for (const [ox, oy] of [[24, -bodyHeight * 0.72], [32, -bodyHeight * 0.52], [26, -bodyHeight * 0.32]] as [number, number][]) {
      this.attackFx.fillStyle(0xfca5a5, 0.88);
      this.attackFx.fillCircle(ox, oy, 2.5);
    }
    this.attackFx.setVisible(true);
  }

  private drawChampionSkullsplitter(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(8, 0x450a0a, 0.95);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.5, 40, -1.15, 0.95, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(4, 0xdc2626, 0.85);
    this.attackFx.beginPath();
    this.attackFx.arc(10, -bodyHeight * 0.5, 28, -1.0, 0.8, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfbbf24, 0.95);
    this.attackFx.fillCircle(38, -bodyHeight * 0.58, 4);
    this.attackFx.fillCircle(28, -bodyHeight * 0.76, 3);
    this.attackFx.setVisible(true);
  }

  private drawChampionTitheFx(bodyHeight: number, visualTime: number, tally: number): void {
    if (tally === 0) return;
    this.auraFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 5) * 0.28;
    this.auraFx.lineStyle(3, 0xdc2626, 0.65 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.32, bodyHeight * 0.94);
    for (let i = 0; i < 10; i++) {
      const a = visualTime * 3 + i * (Math.PI * 2 / 10);
      this.auraFx.fillStyle(i < tally ? 0xdc2626 : 0x44403c, i < tally ? 0.85 : 0.3);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.68,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawHunterDisengage(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.fillStyle(0x78716c, 0.35);
    this.attackFx.fillCircle(0, -bodyHeight * 0.5, 32);
    this.attackFx.lineStyle(3, 0xa3e635, 0.82);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 32);
    this.attackFx.lineStyle(2, 0xd9f99d, 0.65);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 22);
    this.attackFx.setVisible(true);
  }

  private drawHunterRainChannel(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    for (let i = 0; i < 6; i++) {
      const t = (visualTime * 2 + i * 0.22) % 1;
      const x = (i % 3 - 1) * this.width * 0.55;
      const y = -bodyHeight * 0.9 + t * bodyHeight * 1.1;
      this.auraFx.fillStyle(0xa3e635, (1 - t) * 0.82);
      this.auraFx.fillRect(x - 1, y, 2, 8);
    }
    this.auraFx.lineStyle(2, 0xa3e635, 0.55);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.9);
    this.auraFx.setVisible(true);
  }

  private drawHunterBearTrap(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(4, 0x8d6e63, 0.9);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.2, 18);
    this.attackFx.lineStyle(6, 0x44403c, 0.88);
    this.attackFx.beginPath();
    this.attackFx.moveTo(-14, -bodyHeight * 0.2);
    this.attackFx.lineTo(14, -bodyHeight * 0.2);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfbbf24, 0.9);
    this.attackFx.fillCircle(0, -bodyHeight * 0.2, 3);
    this.attackFx.setVisible(true);
  }

  private drawProphetShieldAura(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.65 + Math.sin(visualTime * 3) * 0.22;
    this.auraFx.lineStyle(4, 0xfde68a, 0.78 + pulse * 0.18);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.38, bodyHeight * 0.98);
    this.auraFx.lineStyle(2, 0xffffff, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.16, bodyHeight * 0.76);
    for (let i = 0; i < 4; i++) {
      const a = visualTime * 1.5 + i * (Math.PI / 2);
      this.auraFx.fillStyle(0xfbbf24, 0.9);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.72,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.5,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawProphetBlessAura(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.6 + Math.sin(visualTime * 4) * 0.25;
    this.auraFx.lineStyle(3, 0xf7e8a4, 0.7 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.92);
    this.auraFx.lineStyle(1.5, 0xfde68a, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.72);
    for (let i = 0; i < 3; i++) {
      const a = visualTime * 2.5 + i * (Math.PI * 2 / 3);
      this.auraFx.fillStyle(0xfbbf24, 0.85);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.66,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        2,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawProphetDivineIntervention(bodyHeight: number): void {
    this.auraFx.clear();
    this.auraFx.fillStyle(0xffffff, 0.22);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.5, bodyHeight * 1.1);
    this.auraFx.lineStyle(5, 0xffffff, 0.88);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.42, bodyHeight * 1.02);
    this.auraFx.lineStyle(2.5, 0xfde68a, 0.7);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.2, bodyHeight * 0.82);
    this.auraFx.setVisible(true);
    if (this.sprite) this.sprite.setTint(0xfffde7);
  }

  private drawVampireBloodDrain(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 5) * 0.3;
    this.auraFx.lineStyle(3, 0xdc2626, 0.72 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.28, bodyHeight * 0.92);
    for (let i = 0; i < 6; i++) {
      const t = (visualTime * 1.8 + i * 0.22) % 1;
      const angle = i * (Math.PI * 2 / 6);
      const r = (1 - t) * this.width * 0.72;
      this.auraFx.fillStyle(0xfca5a5, (1 - t) * 0.88);
      this.auraFx.fillCircle(
        Math.cos(angle) * r,
        -bodyHeight * 0.52 + Math.sin(angle) * r * 0.65,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawVampireFangStrike(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(5, 0x7a1935, 0.9);
    this.attackFx.beginPath();
    this.attackFx.moveTo(4, -bodyHeight * 0.62);
    this.attackFx.lineTo(18, -bodyHeight * 0.38);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(5, 0xdc2626, 0.88);
    this.attackFx.beginPath();
    this.attackFx.moveTo(14, -bodyHeight * 0.62);
    this.attackFx.lineTo(28, -bodyHeight * 0.38);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfca5a5, 0.9);
    this.attackFx.fillCircle(18, -bodyHeight * 0.38, 3);
    this.attackFx.fillCircle(28, -bodyHeight * 0.38, 2.5);
    this.attackFx.setVisible(true);
  }

  private drawVampireNocturne(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.5 + Math.sin(visualTime * 3) * 0.3;
    this.auraFx.fillStyle(0x0f0a1e, 0.28 + pulse * 0.1);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.5, bodyHeight * 1.08);
    this.auraFx.lineStyle(4, 0x7a1935, 0.7 + pulse * 0.22);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.4, bodyHeight * 0.98);
    this.auraFx.lineStyle(2, 0xdc2626, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.18, bodyHeight * 0.76);
    this.auraFx.setVisible(true);
    if (this.sprite) this.sprite.setAlpha(0.55);
  }

  private drawVampireShadowStep(bodyHeight: number, visualTime: number): void {
    this.attackFx.clear();
    for (let i = 0; i < 5; i++) {
      const t = (visualTime * 3 + i * 0.25) % 1;
      this.attackFx.fillStyle(0x7a1935, (1 - t) * 0.7);
      this.attackFx.fillEllipse(
        -(i * this.width * 0.18),
        -bodyHeight * 0.5,
        this.width * (0.7 - i * 0.1),
        bodyHeight * (0.6 - i * 0.08),
      );
    }
    this.attackFx.setVisible(true);
  }

  private drawDarkmageEternalNight(bodyHeight: number, visualTime: number): void {
    this.attackFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 4) * 0.28;
    this.attackFx.fillStyle(0x030712, 0.3 + pulse * 0.12);
    this.attackFx.fillCircle(0, -bodyHeight * 0.5, 40);
    this.attackFx.lineStyle(4, 0x6d28d9, 0.78 + pulse * 0.18);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 40);
    this.attackFx.lineStyle(2, 0xa855f7, 0.55);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 28);
    this.attackFx.setVisible(true);
  }

  private drawDarkmageCloak(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.5 + Math.sin(visualTime * 3) * 0.3;
    this.auraFx.fillStyle(0x1e1b4b, 0.22 + pulse * 0.1);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.42, bodyHeight * 1.02);
    this.auraFx.lineStyle(3, 0x4a1458, 0.7 + pulse * 0.22);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 0.96);
    this.auraFx.lineStyle(1.5, 0x6d28d9, 0.45);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.74);
    this.auraFx.setVisible(true);
    if (this.sprite) this.sprite.setAlpha(0.45);
  }

  private drawDarkmageSoulLeech(bodyHeight: number, visualTime: number): void {
    this.attackFx.clear();
    for (let i = 0; i < 5; i++) {
      const t = (visualTime * 1.6 + i * 0.24) % 1;
      const angle = i * (Math.PI * 2 / 5);
      const r = (1 - t) * this.width * 0.68;
      this.attackFx.fillStyle(0xa855f7, (1 - t) * 0.8);
      this.attackFx.fillCircle(
        Math.cos(angle) * r,
        -bodyHeight * 0.52 + Math.sin(angle) * r * 0.6,
        2.5,
      );
    }
    this.attackFx.setVisible(true);
  }

  private drawCultistGateChannel(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.5 + Math.sin(visualTime * 4) * 0.3;
    this.auraFx.fillStyle(0x000000, 0.32 + pulse * 0.12);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.45, bodyHeight * 1.05);
    this.auraFx.lineStyle(4, 0x134e4a, 0.75 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.38, bodyHeight * 0.98);
    this.auraFx.lineStyle(2, 0x065f46, 0.5);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.76);
    for (let i = 0; i < 4; i++) {
      const a = -visualTime * 5 + i * (Math.PI / 2);
      this.auraFx.fillStyle(0x4ade80, 0.72);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.7,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.48,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawCultistGazeAura(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.58 + Math.sin(visualTime * 2.5) * 0.25;
    this.auraFx.lineStyle(3, 0x2e4c3a, 0.7 + pulse * 0.22);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.32, bodyHeight * 0.94);
    this.auraFx.lineStyle(1.5, 0x065f46, 0.45);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.72);
    for (let i = 0; i < 3; i++) {
      const a = visualTime * 2 + i * (Math.PI * 2 / 3);
      this.auraFx.fillStyle(0x4ade80, 0.65);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.68,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        2,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawChefFeast(bodyHeight: number, visualTime: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(4, 0xf48fb1, 0.88);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 34);
    this.attackFx.lineStyle(2, 0xfde68a, 0.7);
    this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 22);
    for (let i = 0; i < 4; i++) {
      const a = visualTime * 3 + i * (Math.PI / 2);
      this.attackFx.fillStyle(0xf9a8d4, 0.88);
      this.attackFx.fillCircle(Math.cos(a) * 30, -bodyHeight * 0.5 + Math.sin(a) * 30, 3);
    }
    this.attackFx.setVisible(true);
  }

  private drawChefSignatureDish(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.58 + Math.sin(visualTime * 5) * 0.28;
    this.auraFx.lineStyle(3, 0xf48fb1, 0.72 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 0.96);
    this.auraFx.lineStyle(2, 0xfde68a, 0.55);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.74);
    for (let i = 0; i < 5; i++) {
      const a = visualTime * 4 + i * (Math.PI * 2 / 5);
      this.auraFx.fillStyle(0xfbbf24, 0.82);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.68,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawChefLadleBash(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(5, 0xf48fb1, 0.9);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 28, -1.0, 0.8, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfde68a, 0.92);
    this.attackFx.fillCircle(26, -bodyHeight * 0.56, 3.5);
    this.attackFx.setVisible(true);
  }

  private drawMasterEclipse(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.58 + Math.sin(visualTime * 4) * 0.25;
    const hueShift = (visualTime * 0.3) % 1;
    const colorCycle = hueShift < 0.33 ? 0xd1d5db : hueShift < 0.66 ? 0xa8dadc : 0xfde68a;
    this.auraFx.lineStyle(3, colorCycle, 0.72 + pulse * 0.2);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 0.96);
    this.auraFx.lineStyle(1.5, 0xf9fafb, 0.45);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.74);
    for (let i = 0; i < 5; i++) {
      const a = visualTime * 3 + i * (Math.PI * 2 / 5);
      this.auraFx.fillStyle(0xe5e7eb, 0.82);
      this.auraFx.fillCircle(
        Math.cos(a) * this.width * 0.68,
        -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46,
        2.5,
      );
    }
    this.auraFx.setVisible(true);
  }

  private drawMasterApotheosis(bodyHeight: number, visualTime: number): void {
    this.auraFx.clear();
    const pulse = 0.55 + Math.sin(visualTime * 3) * 0.3;
    this.auraFx.fillStyle(0xf9fafb, 0.14 + pulse * 0.08);
    this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.48, bodyHeight * 1.06);
    this.auraFx.lineStyle(4, 0xe0e0e0, 0.8 + pulse * 0.16);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.38, bodyHeight * 0.98);
    this.auraFx.lineStyle(2, 0xfde68a, 0.55);
    this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.14, bodyHeight * 0.76);
    for (let i = 0; i < 6; i++) {
      const t = (visualTime * 1.2 + i * 0.22) % 1;
      const x = (i % 2 === 0 ? 1 : -1) * this.width * 0.22;
      this.auraFx.fillStyle(0xfde68a, (1 - t) * 0.88);
      this.auraFx.fillCircle(x, -bodyHeight * 0.08 - t * bodyHeight * 0.82, 2.5);
    }
    this.auraFx.setVisible(true);
    if (this.sprite) this.sprite.setTint(0xf9fafb);
  }

  private drawMasterChosenStrike(bodyHeight: number): void {
    this.attackFx.clear();
    this.attackFx.lineStyle(5, 0x9ca3af, 0.88);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 30, -1.05, 0.85, false);
    this.attackFx.strokePath();
    this.attackFx.lineStyle(2.5, 0xf9fafb, 0.75);
    this.attackFx.beginPath();
    this.attackFx.arc(8, -bodyHeight * 0.52, 20, -0.9, 0.7, false);
    this.attackFx.strokePath();
    this.attackFx.fillStyle(0xfde68a, 0.92);
    this.attackFx.fillCircle(28, -bodyHeight * 0.56, 3);
    this.attackFx.setVisible(true);
  }

  syncFrom(actor: Actor): void {
    const form = actor.shapeshiftForm ?? 'none';
    if (form !== this.lastShapeshiftForm) {
      this.lastShapeshiftForm = form;
      this.spriteId = (form === 'wolf' || form === 'bear') ? 'wolf' : this.baseSpriteId;
      this.currentAnim = undefined; // force anim replay with new spriteId
    }

    const groundScreenY = worldYToScreenY(actor.y, this.band.min, this.band.max);
    const screenY = groundScreenY - actor.z * 0.6;

    this.container.setPosition(actor.x, screenY);
    this.container.setDepth(actor.y);

    if (!actor.isAlive) {
      if (this.sprite) {
        this.playAnim('death');
        this.sprite.setVisible(true);
        this.sprite.setAlpha(0.8);
      } else {
        this.body.setVisible(true);
        this.body.setAlpha(0.3);
        this.body.clear();
        this.body.fillStyle(this.fillColor, 1);
        this.body.fillRect(-this.width / 2, -this.height * 0.2, this.width, this.height * 0.2);
      }
      this.nose.setVisible(false);
      this.initial.setVisible(false);
      this.shadow.setVisible(false);
      this.clearAttachedFx();
      this.hpBg.setVisible(false);
      this.hpFg.setVisible(false);
      return;
    }

    if (this.sprite) {
      this.playAnim(actor.animationId);
      this.sprite.setVisible(true);
      this.sprite.setAlpha(1);
      this.nose.setVisible(false);
      this.initial.setVisible(false);
    } else {
      this.body.setAlpha(1);
      this.nose.setVisible(true);
      this.initial.setVisible(true);
      if (this.body.alpha !== 1) this.body.setAlpha(1);
      this.drawBody();
      this.body.y = -this.height / 2;
      this.initial.y = -this.height / 2;
    }

    // Facing flip via container scaleX. Avoid scaling the shadow.
    this.container.scaleX = actor.facing === -1 ? -1 : 1;
    this.body.setScale(1);
    this.nose.setScale(1);
    this.initial.setScale(1);
    this.body.setAngle(0);
    this.nose.setAngle(0);
    this.initial.setAngle(0);
    this.body.setPosition(0, -this.height / 2);
    this.nose.setPosition(0, 0);
    this.initial.setPosition(0, -this.height / 2);
    if (this.sprite) {
      this.sprite.setScale(this.spriteScale);
      this.sprite.setAngle(0);
      this.sprite.setPosition(0, 0);
    }
    this.clearAttachedFx();

    if (!this.sprite) {
      // Nose triangle, drawn in body-local space (origin at feet).
      this.nose.clear();
      this.nose.fillStyle(this.initialColor === '#ffffff' ? 0xffffff : 0x888888, 1);
      const noseDirX = 1;
      const noseTipX = noseDirX * (this.width / 2);
      const noseY = -this.height / 2 - this.height / 4;
      this.nose.beginPath();
      this.nose.moveTo(noseTipX, noseY - 5);
      this.nose.lineTo(noseTipX + noseDirX * 8, noseY);
      this.nose.lineTo(noseTipX, noseY + 5);
      this.nose.closePath();
      this.nose.fillPath();
    }

    // Shadow for airborne actors only — LF2 convention, matches the pre-port
    // Canvas renderer. The shadow is drawn at ground level (world y) while the
    // sprite has lifted by actor.z * 0.6 upward, so the gap between shadow
    // and feet reads as jump height.
    this.shadow.clear();
    if (actor.z > 0) {
      this.shadow.fillStyle(0x000000, 0.3);
      const shrink = Math.min(1, 1 - actor.z / 200);
      const shadowOffset = actor.z * 0.6;
      this.shadow.fillEllipse(0, shadowOffset - 2, this.width * 0.8 * shrink, 10);
      this.shadow.setVisible(true);
    } else {
      this.shadow.setVisible(false);
    }

    // HP bar above the head when below max.
    const hpRatio = Math.max(0, Math.min(1, actor.hp / actor.hpMax));
    if (actor.hp < actor.hpMax) {
      this.hpBg.setVisible(true);
      this.hpFg.setVisible(true);
      const barW = this.width;
      const barH = 4;
      const barY = -(this.sprite ? this.spriteBodyHeightPx : this.height) - 10;
      this.hpBg.clear();
      this.hpBg.fillStyle(0x1f2937, 1);
      this.hpBg.fillRect(-barW / 2, barY, barW, barH);
      this.hpFg.clear();
      this.hpFg.fillStyle(0xef4444, 1);
      this.hpFg.fillRect(-barW / 2, barY, barW * hpRatio, barH);
    } else {
      this.hpBg.setVisible(false);
      this.hpFg.setVisible(false);
    }

    const visualTime = actor.stateTimeMs / 1000;
    const bodyHeight = this.sprite ? this.spriteBodyHeightPx : this.height;
    const isViking = actor.guildId === 'viking';
    const isBloodlust = isViking && actor.statusEffects.some(e => e.type === 'attack_speed_boost');
    const isUndyingRage = isViking && actor.statusEffects.some(e => e.type === 'shield' && e.magnitude >= 999);
    const isWhirlwind = isViking && actor.state === 'channeling' && actor.animationId === 'channel';
    const isAxeSwing = isViking && actor.state === 'attacking' && actor.animationId === 'ability_4';
    const whirlwindSwingDir = (Math.floor(visualTime * 10) % 2 === 0 ? 1 : -1) as -1 | 1;

    if (isBloodlust) {
      this.drawVikingBuffDots(bodyHeight, visualTime);
    }
    if (isUndyingRage) {
      this.drawVikingUndyingAura(bodyHeight);
      if (this.sprite) {
        this.sprite.setScale(this.spriteScale * 1.12);
      } else {
        this.body.setScale(1.12);
        this.nose.setScale(1.12);
        this.initial.setScale(1.12);
      }
    }
    if (isWhirlwind) {
      this.drawVikingWhirlwind(bodyHeight, visualTime, whirlwindSwingDir);
      if (this.sprite) {
        this.sprite.setPosition(whirlwindSwingDir * 8, 0);
        this.sprite.setAngle(whirlwindSwingDir * 8);
      } else {
        this.body.setPosition(whirlwindSwingDir * 8, -this.height / 2);
        this.nose.setPosition(whirlwindSwingDir * 8, 0);
        this.initial.setPosition(whirlwindSwingDir * 8, -this.height / 2);
        this.body.setAngle(whirlwindSwingDir * 8);
        this.nose.setAngle(whirlwindSwingDir * 8);
        this.initial.setAngle(whirlwindSwingDir * 8);
      }
    }
    if (isAxeSwing) {
      this.drawVikingAxeSwing(bodyHeight);
    }

    const isAdventurer = actor.guildId === 'adventurer';
    const isRallyingCry = isAdventurer && actor.statusEffects.some(
      e => e.type === 'speed_boost' && Math.abs(e.magnitude - 0.15) < 0.01,
    );
    const isAdrenalineRush = isAdventurer && actor.statusEffects.some(
      e => e.type === 'attack_speed_boost' && e.magnitude === 0.4,
    );
    const isAdventurerChanneling = isAdventurer && actor.state === 'channeling';
    const isAdventurerSlash = isAdventurer && actor.state === 'attacking' && actor.animationId === 'ability_2';

    if (isRallyingCry) this.drawAdventurerRallyingCry(bodyHeight, visualTime);
    if (isAdrenalineRush) this.drawAdventurerAdrenalineRush(bodyHeight, visualTime);
    if (isAdventurerChanneling) this.drawAdventurerBandage(bodyHeight, visualTime);
    if (isAdventurerSlash) this.drawAdventurerSlash(bodyHeight);

    const isMage = actor.guildId === 'mage';
    const isMageIcenova = isMage && actor.state === 'attacking' && actor.animationId === 'ability_1';
    const isMageMeteorCast = isMage && actor.state === 'casting';

    if (isMageIcenova) this.drawMageIceNova(bodyHeight);
    if (isMageMeteorCast) this.drawMageMeteorCast(bodyHeight, visualTime);

    const isDruid = actor.guildId === 'druid';
    const isDruidWildGrowth = isDruid && actor.state === 'attacking' && actor.animationId === 'ability_1';
    const isDruidChanneling = isDruid && actor.state === 'channeling';
    const isDruidShapeshift = isDruid && (actor as any).shapeshiftForm != null && (actor as any).shapeshiftForm !== 'none';

    if (isDruidWildGrowth) this.drawDruidWildGrowth(bodyHeight);
    if (isDruidChanneling) this.drawDruidChanneling(bodyHeight, visualTime);
    if (isDruidShapeshift) this.drawDruidShapeshift(bodyHeight, visualTime);

    const isMonk = actor.guildId === 'monk';
    const isMonkSerenity = isMonk && actor.statusEffects.some(e => e.type === 'untargetable');
    const isMonkDragonsFury = isMonk && actor.state === 'channeling';
    const isMonkFlyingKick = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_2';
    const isMonkJab = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_3';
    const isMonkFivePoint = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_4';

    if (isMonkSerenity) this.drawMonkSerenity(bodyHeight, visualTime, actor.chiOrbs ?? 0);
    if (isMonkDragonsFury) this.drawMonkDragonsFury(bodyHeight, visualTime);
    if (isMonkFlyingKick) this.drawMonkFlyingKick(bodyHeight);
    if (isMonkJab) this.drawMonkJab(bodyHeight);
    if (isMonkFivePoint) this.drawMonkFivePoint(bodyHeight);

    const isChampion = actor.guildId === 'champion';
    const isChargeAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_2';
    const isExecuteAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_3';
    const isCleaverAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_4';
    const isSkullsplitter = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_5';
    const isChampionBuff = isChampion && actor.statusEffects.some(e => e.type === 'attack_speed_boost');

    if (isChargeAttack) this.drawChampionChargeImpact(bodyHeight);
    if (isExecuteAttack) this.drawChampionExecute(bodyHeight);
    if (isCleaverAttack) this.drawChampionCleaver(bodyHeight);
    if (isSkullsplitter) this.drawChampionSkullsplitter(bodyHeight);
    if (isChampionBuff) this.drawChampionTitheFx(bodyHeight, visualTime, actor.mp);

    const isHunter = actor.guildId === 'hunter';
    const isHunterDisengage = isHunter && actor.state === 'attacking' && actor.animationId === 'ability_1';
    const isHunterRain = isHunter && actor.state === 'channeling';
    const isHunterTrap = isHunter && actor.state === 'attacking' && actor.animationId === 'ability_4';

    if (isHunterDisengage) this.drawHunterDisengage(bodyHeight);
    if (isHunterRain) this.drawHunterRainChannel(bodyHeight, visualTime);
    if (isHunterTrap) this.drawHunterBearTrap(bodyHeight);

    const isProphet = actor.guildId === 'prophet';
    const isProphetShield = isProphet && actor.statusEffects.some(e => e.type === 'shield' && e.magnitude === 80);
    const isProphetBless = isProphet && actor.statusEffects.some(e => e.type === 'damage_boost' && Math.abs(e.magnitude - 0.15) < 0.01);
    const isProphetDivine = isProphet && actor.statusEffects.some(e => e.type === 'untargetable');

    if (isProphetShield) this.drawProphetShieldAura(bodyHeight, visualTime);
    if (isProphetBless) this.drawProphetBlessAura(bodyHeight, visualTime);
    if (isProphetDivine) this.drawProphetDivineIntervention(bodyHeight);

    const isVampire = actor.guildId === 'vampire';
    const isVampireBloodDrain = isVampire && actor.state === 'channeling';
    const isVampireFangStrike = isVampire && actor.state === 'attacking' && actor.animationId === 'ability_4';
    const isVampireNocturne = isVampire && actor.statusEffects.some((e: { type: string }) => e.type === 'stealth');
    const isVampireShadowStep = isVampire && actor.state === 'attacking' && actor.animationId === 'ability_2';

    if (isVampireBloodDrain) this.drawVampireBloodDrain(bodyHeight, visualTime);
    if (isVampireFangStrike) this.drawVampireFangStrike(bodyHeight);
    if (isVampireNocturne) this.drawVampireNocturne(bodyHeight, visualTime);
    if (isVampireShadowStep) this.drawVampireShadowStep(bodyHeight, visualTime);

    const isDarkmage = actor.guildId === 'darkmage';
    const isDarkmageEternalNight = isDarkmage && actor.state === 'attacking' && actor.animationId === 'ability_5';
    const isDarkmageCloak = isDarkmage && actor.statusEffects.some(e => e.type === 'stealth');
    const isDarkmageSoulLeech = isDarkmage && actor.state === 'attacking' && actor.animationId === 'ability_3';

    if (isDarkmageEternalNight) this.drawDarkmageEternalNight(bodyHeight, visualTime);
    if (isDarkmageCloak) this.drawDarkmageCloak(bodyHeight, visualTime);
    if (isDarkmageSoulLeech) this.drawDarkmageSoulLeech(bodyHeight, visualTime);

    const isCultist = actor.guildId === 'cultist';
    const isCultistGate = isCultist && actor.state === 'channeling';
    const isCultistGaze = isCultist && actor.statusEffects.some(e => e.type === 'damage_boost');

    if (isCultistGate) this.drawCultistGateChannel(bodyHeight, visualTime);
    if (isCultistGaze) this.drawCultistGazeAura(bodyHeight, visualTime);

    const isChef = actor.guildId === 'chef';
    const isChefFeast = isChef && actor.state === 'attacking' && actor.animationId === 'ability_1';
    const isChefSignatureDish = isChef && actor.state === 'channeling';
    const isChefLadle = isChef && actor.state === 'attacking' && actor.animationId === 'ability_2';

    if (isChefFeast) this.drawChefFeast(bodyHeight, visualTime);
    if (isChefSignatureDish) this.drawChefSignatureDish(bodyHeight, visualTime);
    if (isChefLadle) this.drawChefLadleBash(bodyHeight);

    const isMaster = actor.guildId === 'master';
    const isMasterEclipse = isMaster && actor.statusEffects.some(e => e.type === 'speed_boost');
    const isMasterApotheosis = isMaster && actor.statusEffects.some(e => e.type === 'hot' && e.magnitude === 20);
    const isMasterChosenStrike = isMaster && actor.state === 'attacking' && actor.animationId === 'ability_1';

    if (isMasterEclipse) this.drawMasterEclipse(bodyHeight, visualTime);
    if (isMasterApotheosis) this.drawMasterApotheosis(bodyHeight, visualTime);
    if (isMasterChosenStrike) this.drawMasterChosenStrike(bodyHeight);

    // Status alpha overlays.
    let alpha = 1;
    if (actor.statusEffects.some(e => e.type === 'stun')) alpha = Math.min(alpha, 0.7);
    const isStealthed = actor.statusEffects.some((e: { type: string }) => e.type === 'stealth');
    if (isStealthed) alpha = this.isLocalPlayerActor ? 0.3 : 0.0;
    if (actor.invulnerableMs > 0 && actor.state === 'getup') {
      alpha = Math.min(alpha, 0.5 + Math.sin(performance.now() * 0.02) * 0.3);
    }
    this.container.setAlpha(alpha);

    // Damage flash. Fires while invulnerableMs ticks down (except during
    // getup, which has its own alpha pulse above). For placeholder actors
    // we repaint the body white; for sprites we setTintFill which turns
    // every non-alpha pixel white for one frame — reads as a generic hurt
    // reaction even when the sprite has no dedicated hurt animation
    // (critical for wolf/wolf_pet on the quadruped template).
    const isHit = actor.invulnerableMs > 0 && actor.state !== 'getup';
    const buffTint = isUndyingRage ? 0x7f1d1d
      : isBloodlust ? 0xb91c1c
      : isAdrenalineRush ? 0xc2410c
      : isChampionBuff ? 0x991b1b
      : isProphetDivine ? 0xfffde7
      : isVampireNocturne ? 0x1e0a2e
      : isDarkmageCloak ? 0x1e1b4b
      : isMasterApotheosis ? 0xf9fafb
      : null;
    if (this.sprite) {
      if (isHit) {
        this.sprite.setTintFill(0xffffff);
      } else if (buffTint !== null) {
        this.sprite.setTint(buffTint);
      } else {
        this.sprite.clearTint();
      }
    } else if (isHit) {
      this.body.fillStyle(0xffffff, 1);
      this.body.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
