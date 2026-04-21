import Phaser from 'phaser';
import type { Actor } from '../../simulation/types';
import { GUILDS } from '../../simulation/guildData';
import { ENEMY_DEFS } from '../../simulation/enemyData';
import { worldYToScreenY } from '../constants';
import { VIRTUAL_HEIGHT } from '../constants';

const GUILD_LOOKUP: Record<string, { color: string; initial: string }> = {};
for (const g of GUILDS) GUILD_LOOKUP[g.id] = { color: g.color, initial: g.initial };

const ENEMY_LOOKUP: Record<string, { color: string; initial: string }> = {};
for (const [kind, def] of Object.entries(ENEMY_DEFS)) {
  ENEMY_LOOKUP[kind] = { color: def.color, initial: def.initial };
}

const ALLY_COLOR = '#a3e635';
const ALLY_INITIAL = 'A';

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
 * Per-actor visual: shadow + body rect + facing nose + initial letter +
 * HP bar. Mirrors PlaceholderRenderer.ts at the level of "what's on screen
 * when you stand still." The animation flourishes (squish, leg-wiggle,
 * arm extension) are deferred to Task 9 along with sprite atlases.
 *
 * Each frame the GameplayScene calls syncFrom(actor); the view applies
 * world-space x and projected screen-y, sets depth = actor.y for 2.5D
 * sort, flips on facing, dims for stealth/stun, and pulses on getup.
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

  private readonly width: number;
  private readonly height: number;
  private readonly fillColor: number;
  private readonly outlineColor: number;
  private readonly initialChar: string;
  private readonly initialColor: string;

  constructor(scene: Phaser.Scene, actor: Actor) {
    this.actorId = actor.id;
    this.width = actor.width;
    this.height = actor.height;

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

    this.container = scene.add.container(0, 0, [
      this.shadow,
      this.body,
      this.nose,
      this.initial,
      this.hpBg,
      this.hpFg,
    ]);

    this.drawBody();
  }

  private drawBody(): void {
    // Body rectangle is local to the body graphics, centered on (0, 0).
    this.body.clear();
    this.body.lineStyle(2, this.outlineColor, 1);
    this.body.fillStyle(this.fillColor, 1);
    this.body.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    this.body.strokeRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
  }

  syncFrom(actor: Actor): void {
    const groundScreenY = worldYToScreenY(actor.y, VIRTUAL_HEIGHT);
    const screenY = groundScreenY - actor.z * 0.6;

    // Container origin sits at the actor's feet on screen; body, nose, and
    // initial render relative to that anchor.
    this.container.setPosition(actor.x, screenY);
    this.container.setDepth(actor.y);

    if (!actor.isAlive) {
      this.body.setVisible(true);
      this.body.setAlpha(0.3);
      this.body.clear();
      this.body.fillStyle(this.fillColor, 1);
      this.body.fillRect(-this.width / 2, -this.height * 0.2, this.width, this.height * 0.2);
      this.nose.setVisible(false);
      this.initial.setVisible(false);
      this.shadow.setVisible(false);
      this.hpBg.setVisible(false);
      this.hpFg.setVisible(false);
      return;
    }

    this.body.setAlpha(1);
    this.nose.setVisible(true);
    this.initial.setVisible(true);
    this.shadow.setVisible(true);
    if (this.body.alpha !== 1) this.body.setAlpha(1);
    this.drawBody();

    // Body sits one body-height above the feet.
    this.body.y = -this.height / 2;
    this.initial.y = -this.height / 2;

    // Facing flip via container scaleX. Avoid scaling the shadow.
    this.container.scaleX = actor.facing === -1 ? -1 : 1;

    // Nose triangle, drawn in body-local space (origin at feet).
    this.nose.clear();
    this.nose.fillStyle(this.initialColor === '#ffffff' ? 0xffffff : 0x888888, 1);
    const noseDirX = 1; // container is flipped already
    const noseTipX = noseDirX * (this.width / 2);
    const noseY = -this.height / 2 - this.height / 4;
    this.nose.beginPath();
    this.nose.moveTo(noseTipX, noseY - 5);
    this.nose.lineTo(noseTipX + noseDirX * 8, noseY);
    this.nose.lineTo(noseTipX, noseY + 5);
    this.nose.closePath();
    this.nose.fillPath();

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
      // Tick-driven flicker via simulation timeMs would be deterministic but
      // this is purely a visual hint — using runtime time is acceptable for
      // a flicker effect.
      alpha = Math.min(alpha, 0.5 + Math.sin(performance.now() * 0.02) * 0.3);
    }
    this.container.setAlpha(alpha);

    // Damage flash via tint-on-fill for invulnerability frames triggered by
    // a recent hit (signal: invulnerableMs > 0 but state !== 'getup').
    if (actor.invulnerableMs > 0 && actor.state !== 'getup') {
      this.body.fillStyle(0xffffff, 1);
      this.body.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
