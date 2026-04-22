import Phaser from 'phaser';
import type { Projectile } from '@nannymud/shared/simulation/types';
import { VIRTUAL_HEIGHT, worldYToScreenY } from '../constants';

function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

function isArrowLike(type: string): boolean {
  return type === 'arrow' || type.includes('shot') || type.includes('bolt') || type.includes('volley');
}

/**
 * Per-projectile view. Mirrors renderProjectiles in gameRenderer.ts:
 * - arrow/shot/bolt/volley → oriented rectangle
 * - throw → circle with outline, slightly inflated
 * - everything else → radial-glow orb
 * Rebuilt each sync to handle orientation changes cheaply.
 */
export class ProjectileView {
  readonly projectileId: string;

  private graphics: Phaser.GameObjects.Graphics;
  private fillColor: number;
  private readonly shape: 'arrow' | 'throw' | 'orb';
  private readonly rawColor: string;
  private readonly radius: number;

  constructor(scene: Phaser.Scene, proj: Projectile) {
    this.projectileId = proj.id;
    this.rawColor = proj.color;
    this.fillColor = hexToInt(proj.color);
    this.radius = proj.radius;
    this.shape = isArrowLike(proj.type) ? 'arrow' : proj.type.includes('throw') ? 'throw' : 'orb';

    this.graphics = scene.add.graphics();
  }

  syncFrom(proj: Projectile): void {
    const screenY = worldYToScreenY(proj.y, VIRTUAL_HEIGHT) - proj.z * 0.5;
    this.graphics.setPosition(proj.x, screenY);
    this.graphics.setDepth(proj.y + 0.5); // draw above same-plane actors (matches canvas order)
    this.redraw(proj);
  }

  private redraw(proj: Projectile): void {
    const g = this.graphics;
    g.clear();

    if (this.shape === 'arrow') {
      const angle = Math.atan2(proj.vy, proj.vx);
      g.rotation = angle;
      g.fillStyle(this.fillColor, 1);
      g.fillRect(-8, -2, 16, 4);
      return;
    }

    g.rotation = 0;
    if (this.shape === 'throw') {
      g.lineStyle(1, 0x000000, 0.5);
      g.fillStyle(this.fillColor, 1);
      g.fillCircle(0, 0, this.radius + 2);
      g.strokeCircle(0, 0, this.radius + 2);
      return;
    }

    // orb + radial glow
    g.fillStyle(this.fillColor, 1);
    g.fillCircle(0, 0, this.radius);

    const glowColor = hexToInt(this.rawColor);
    g.fillStyle(glowColor, 0.25);
    g.fillCircle(0, 0, this.radius * 2);
    g.fillStyle(glowColor, 0.12);
    g.fillCircle(0, 0, this.radius * 2.5);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
