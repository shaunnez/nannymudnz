import Phaser from 'phaser';
import type { Actor, AnimationId, GuildId } from '../../simulation/types';
import { GUILDS } from '../../simulation/guildData';
import { ENEMY_DEFS } from '../../simulation/enemyData';
import { worldYToScreenY } from '../constants';
import { VIRTUAL_HEIGHT } from '../constants';
import {
  animationKey,
  getGuildMetadata,
  guildHasSprites,
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

const DISPLAY_SCALE = 1.5;

function colorAndInitial(actor: Actor): { color: string; initial: string } {
  if (actor.isPlayer && actor.guildId) {
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

  private container: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Graphics;
  private body: Phaser.GameObjects.Graphics;
  private nose: Phaser.GameObjects.Graphics;
  private initial: Phaser.GameObjects.Text;
  private hpBg: Phaser.GameObjects.Graphics;
  private hpFg: Phaser.GameObjects.Graphics;
  private sprite?: Phaser.GameObjects.Sprite;
  private currentAnim?: string;

  private readonly width: number;
  private readonly height: number;
  private readonly fillColor: number;
  private readonly outlineColor: number;
  private readonly initialChar: string;
  private readonly initialColor: string;
  private readonly guildId?: GuildId;
  private readonly hasSprites: boolean;

  constructor(scene: Phaser.Scene, actor: Actor) {
    this.actorId = actor.id;
    this.width = actor.width;
    this.height = actor.height;
    this.guildId = actor.isPlayer && actor.guildId ? actor.guildId : undefined;
    this.hasSprites = !!this.guildId && guildHasSprites(this.guildId);

    const { color, initial } = colorAndInitial(actor);
    this.fillColor = hexToInt(color);
    this.outlineColor = darkenInt(this.fillColor, 50);
    this.initialChar = initial;
    this.initialColor = color === '#ffffff' ? '#888888' : '#ffffff';

    this.shadow = scene.add.graphics();
    this.body = scene.add.graphics();
    this.nose = scene.add.graphics();
    this.initial = scene.add.text(0, 0, this.initialChar, {
      fontFamily: 'monospace',
      fontStyle: 'bold',
      fontSize: `${Math.min(16, Math.floor(this.width * 0.4))}px`,
      color: this.initialColor,
    }).setOrigin(0.5);
    this.hpBg = scene.add.graphics();
    this.hpFg = scene.add.graphics();

    const children: Phaser.GameObjects.GameObject[] = [
      this.shadow,
      this.body,
      this.nose,
      this.initial,
    ];

    if (this.hasSprites && this.guildId) {
      const idleTex = textureKey(this.guildId, 'idle');
      if (scene.textures.exists(idleTex)) {
        const meta = getGuildMetadata(this.guildId);
        const idleMeta = meta?.animations.idle;
        this.sprite = scene.add.sprite(0, 0, idleTex, 0).setScale(DISPLAY_SCALE);
        if (meta && idleMeta) {
          const ox = idleMeta.anchor.x / meta.frameSize.w;
          const oy = idleMeta.anchor.y / meta.frameSize.h;
          this.sprite.setOrigin(ox, oy);
        } else {
          this.sprite.setOrigin(0.5, 1);
        }
        children.push(this.sprite);
      }
    }

    children.push(this.hpBg, this.hpFg);

    this.container = scene.add.container(0, 0, children);

    this.drawBody();
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
    if (!this.sprite || !this.guildId) return;
    const resolved = resolveAnimation(this.guildId, animId);
    if (!resolved) return;
    const key = animationKey(this.guildId, resolved);
    if (this.currentAnim === key) return;
    this.currentAnim = key;
    this.sprite.play(key, true);
  }

  syncFrom(actor: Actor): void {
    const groundScreenY = worldYToScreenY(actor.y, VIRTUAL_HEIGHT);
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

    this.shadow.setVisible(true);

    // Facing flip via container scaleX. Avoid scaling the shadow.
    this.container.scaleX = actor.facing === -1 ? -1 : 1;

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

    // Shadow when grounded only.
    this.shadow.clear();
    if (actor.z === 0) {
      this.shadow.fillStyle(0x000000, 0.25);
      this.shadow.fillEllipse(0, -2, this.width, 12);
    } else {
      this.shadow.fillStyle(0x000000, 0.3);
      const shrink = Math.min(1, 1 - actor.z / 200);
      this.shadow.fillEllipse(0, -2, this.width * 0.8 * shrink, 10);
    }

    // HP bar above the head when below max.
    const hpRatio = Math.max(0, Math.min(1, actor.hp / actor.hpMax));
    if (actor.hp < actor.hpMax) {
      this.hpBg.setVisible(true);
      this.hpFg.setVisible(true);
      const barW = this.width;
      const barH = 4;
      const barY = -this.height - 10;
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

    // Status alpha overlays.
    let alpha = 1;
    if (actor.statusEffects.some(e => e.type === 'stun')) alpha = Math.min(alpha, 0.7);
    if (actor.statusEffects.some(e => e.type === 'stealth')) alpha = Math.min(alpha, 0.35);
    if (actor.invulnerableMs > 0 && actor.state === 'getup') {
      alpha = Math.min(alpha, 0.5 + Math.sin(performance.now() * 0.02) * 0.3);
    }
    this.container.setAlpha(alpha);

    // Damage flash on placeholder body only (sprite tinting is noisier — skip
    // for now, can add as Sprite.setTintFill in a follow-up if wanted).
    if (!this.sprite && actor.invulnerableMs > 0 && actor.state !== 'getup') {
      this.body.fillStyle(0xffffff, 1);
      this.body.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
