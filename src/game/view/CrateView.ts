import Phaser from 'phaser';
import type { Crate } from '@nannymud/shared/simulation/types';
import { worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';

export class CrateView {
  readonly crateId: string;
  private container: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Graphics;
  private readonly band: ScreenYBand;
  private lastHpRatio = 1;

  constructor(scene: Phaser.Scene, crate: Crate) {
    this.crateId = crate.id;
    this.band = getScreenYBand(scene);
    this.body = scene.add.graphics();
    this.container = scene.add.container(0, 0, [this.body]);
    this.drawBody(crate.hp / crate.hpMax);
  }

  private drawBody(hpRatio: number): void {
    const g = this.body;
    g.clear();

    g.fillStyle(0x8B6914, 1);
    g.fillRect(-22, -22, 44, 44);
    g.lineStyle(2, 0x5a4010, 1);
    g.strokeRect(-22, -22, 44, 44);

    g.lineStyle(1, 0x5a4010, 0.8);
    g.lineBetween(-22, -22, 22, 22);
    g.lineBetween(22, -22, -22, 22);

    if (hpRatio < 0.5) {
      g.lineStyle(1, 0x2d1a00, 1);
      g.lineBetween(-10, -22, 5, 0);
      g.lineBetween(5, 0, -5, 22);
      g.lineBetween(8, -22, 20, 10);
    }
  }

  syncFrom(crate: Crate): void {
    if (!crate.isAlive) {
      this.container.setVisible(false);
      return;
    }
    this.container.setVisible(true);
    const hpRatio = crate.hp / crate.hpMax;
    if (Math.abs(hpRatio - this.lastHpRatio) > 0.01) {
      this.drawBody(hpRatio);
      this.lastHpRatio = hpRatio;
    }
    const screenY = worldYToScreenY(crate.y, this.band.min, this.band.max);
    this.container.setPosition(crate.x, screenY);
    this.container.setDepth(crate.y - 1);
  }

  shake(scene: Phaser.Scene): void {
    const origX = this.container.x;
    scene.tweens.add({
      targets: this.container,
      x: origX + 4,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => { this.container.setVisible(false); },
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
