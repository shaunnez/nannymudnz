import Phaser from 'phaser';
import type { Projectile } from '@nannymud/shared/simulation/types';
import { DEPTH_SCALE, worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';

function hexToInt(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return 0xffffff;
  return (parseInt(m[1], 16) << 16) | (parseInt(m[2], 16) << 8) | parseInt(m[3], 16);
}

function isArrowLike(type: string): boolean {
  return type === 'arrow' || type.includes('shot') || type.includes('bolt') || type.includes('volley');
}

function isHarpoon(type: string): boolean {
  return type === 'harpoon';
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
  private readonly shape: 'arrow' | 'harpoon' | 'throw' | 'orb';
  private readonly rawColor: string;
  private readonly radius: number;
  private readonly band: ScreenYBand;

  constructor(scene: Phaser.Scene, proj: Projectile) {
    this.projectileId = proj.id;
    this.rawColor = proj.color;
    this.fillColor = hexToInt(proj.color);
    this.radius = proj.radius;
    this.shape = isHarpoon(proj.type)
      ? 'harpoon'
      : isArrowLike(proj.type)
        ? 'arrow'
        : proj.type.includes('throw')
          ? 'throw'
          : 'orb';
    this.band = getScreenYBand(scene);

    this.graphics = scene.add.graphics();
  }

  syncFrom(proj: Projectile): void {
    const screenY = worldYToScreenY(proj.y, this.band.min, this.band.max) - proj.z * DEPTH_SCALE;
    this.graphics.setPosition(proj.x, screenY);
    this.graphics.setDepth(proj.y + 0.5); // draw above same-plane actors (matches canvas order)
    this.redraw(proj);
  }

  private redraw(proj: Projectile): void {
    const g = this.graphics;
    g.clear();

    if (this.shape === 'harpoon') {
      const angle = Math.atan2(proj.vy, proj.vx);
      g.rotation = angle;
      g.lineStyle(3, 0x5b3a29, 1);
      g.lineBetween(-24, 0, 13, 0);
      g.fillStyle(0xcbd5e1, 1);
      g.fillTriangle(13, 0, 1, -7, 1, 7);
      g.lineStyle(3, 0xcbd5e1, 1);
      g.lineBetween(-2, -6, 6, 0);
      g.lineBetween(-2, 6, 6, 0);
      g.lineStyle(2, 0x7f1d1d, 0.85);
      g.lineBetween(-18, -5, -24, 0);
      g.lineBetween(-18, 5, -24, 0);
      return;
    }

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
