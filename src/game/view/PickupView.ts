import Phaser from 'phaser';
import type { Pickup } from '@nannymud/shared/simulation/types';
import { PICKUP_DEFS } from '@nannymud/shared/simulation/pickupData';
import { worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';

const PICKUP_SCALE = 2;

export class PickupView {
  readonly pickupId: string;

  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private hint: Phaser.GameObjects.Text;
  private readonly band: ScreenYBand;

  constructor(scene: Phaser.Scene, pickup: Pickup) {
    this.pickupId = pickup.id;
    this.band = getScreenYBand(scene);

    this.body = scene.add.graphics();
    this.hint = scene.add.text(0, -20, 'L', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#fbbf24',
    }).setOrigin(0.5);

    this.container = scene.add.container(0, 0, [this.body, this.hint]);
    this.drawBody(pickup);
  }

  private drawBody(pickup: Pickup): void {
    const g = this.body;
    g.clear();
    g.lineStyle(1, 0x1f2937, 1);

    const def = PICKUP_DEFS[pickup.type as keyof typeof PICKUP_DEFS];
    if (!def) return;

    const colorHex = parseInt(def.color.replace('#', ''), 16);

    switch (def.category) {
      case 'throwable':
        this.drawThrowable(g, pickup.type, colorHex);
        break;
      case 'weapon':
        this.drawWeapon(g, pickup.type, colorHex, def.attackRange ?? 55);
        break;
      case 'gem':
        g.fillStyle(colorHex, 1);
        g.fillTriangle(-9, 0, 0, -13, 9, 0);
        g.fillTriangle(-9, 0, 0, 13, 9, 0);
        g.lineStyle(1, 0xffffff, 0.4);
        g.strokeTriangle(-9, 0, 0, -13, 9, 0);
        g.strokeTriangle(-9, 0, 0, 13, 9, 0);
        break;
      case 'consumable':
        g.fillStyle(colorHex, 1);
        g.fillRoundedRect(-8, -8, 16, 16, 3);
        g.lineStyle(1, 0xffffff, 0.4);
        g.strokeRoundedRect(-8, -8, 16, 16, 3);
        break;
      default:
        g.fillStyle(0x666666, 1);
        g.fillRect(-8, -8, 16, 16);
    }
  }

  private drawWeapon(g: Phaser.GameObjects.Graphics, type: string, colorHex: number, range: number): void {
    const len = Math.min(range * 0.45, 36);
    g.fillStyle(colorHex, 1);
    if (type === 'torch') {
      g.fillRect(-3, -len + 4, 6, len);
      g.fillStyle(0xff6600, 1);
      g.fillCircle(0, -len + 4, 7);
    } else if (type === 'throwing_star') {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        g.fillRect(
          Math.cos(a) * 2 - 2, Math.sin(a) * 2 - 2,
          Math.cos(a) * 8 + 4, Math.sin(a) * 8 + 4,
        );
      }
    } else if (type === 'chain') {
      for (let i = 0; i < 3; i++) {
        g.strokeCircle(0, -len / 2 + i * (len / 2.5), 4);
      }
    } else {
      g.fillRect(-4, -len, 8, len);
      g.lineStyle(1, 0x1f2937, 1);
      g.strokeRect(-4, -len, 8, len);
    }
  }

  private drawThrowable(g: Phaser.GameObjects.Graphics, type: string, colorHex: number): void {
    g.fillStyle(colorHex, 1);
    if (type === 'rock') {
      g.fillEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
      g.strokeEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
    } else if (type === 'bomb') {
      g.fillCircle(0, 4, 12);
      g.strokeCircle(0, 4, 12);
      g.fillStyle(0x555555, 1);
      g.fillRect(-2, -11, 4, 10);
    } else if (type === 'smoke_bomb') {
      g.fillEllipse(0, 0, 26, 18);
      g.strokeEllipse(0, 0, 26, 18);
    } else if (type === 'bottle') {
      g.fillRect(-5, -2, 10, 14);
      g.strokeRect(-5, -2, 10, 14);
      g.fillRect(-3, -11, 6, 9);
      g.strokeRect(-3, -11, 6, 9);
    } else {
      g.fillRect(-8, -8, 16, 16);
    }
  }

  syncFrom(pickup: Pickup): void {
    if (pickup.heldBy) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const screenY = worldYToScreenY(pickup.y, this.band.min, this.band.max);
    this.container.setPosition(pickup.x, screenY);
    this.container.setDepth(pickup.y - 0.5);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
