import Phaser from 'phaser';
import type { Pickup } from '@nannymud/shared/simulation/types';

const PICKUP_SCALE = 2;
import { worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';

/**
 * Per-pickup view: rock or club shape with a yellow 'L' hint letter above.
 * Mirrors renderPickups in gameRenderer.ts. Pickups held by an actor hide
 * (held ones are rendered as part of the actor in the Canvas build; for
 * now the Phaser build keeps parity by hiding the world-floor copy).
 */
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

    if (pickup.type === 'rock') {
      g.fillStyle(0x9ca3af, 1);
      g.fillEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
      g.strokeEllipse(0, 0, 16 * PICKUP_SCALE, 12 * PICKUP_SCALE);
    } else {
      // club: wood shaft + darker head.
      g.fillStyle(0x92400e, 1);
      g.fillRect(-4 * PICKUP_SCALE, -14 * PICKUP_SCALE, 8 * PICKUP_SCALE, 14 * PICKUP_SCALE);
      g.strokeRect(-4 * PICKUP_SCALE, -14 * PICKUP_SCALE, 8 * PICKUP_SCALE, 14 * PICKUP_SCALE);
      g.fillStyle(0x6b4226, 1);
      g.fillRect(-6 * PICKUP_SCALE, -16 * PICKUP_SCALE, 12 * PICKUP_SCALE, 4 * PICKUP_SCALE);
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
