import Phaser from 'phaser';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../constants';

interface HillLayer {
  parallax: number;
  yBase: number;
  amplitude: number;
  period: number;
  offset: number;
  color: number;
}

/**
 * 2.5D parallax background: sky gradient + 3 sine-hill layers + ground gradient
 * with diagonal perspective stripes. Camera-space redraw each frame mirrors
 * gameRenderer.ts's renderBackground exactly (same colors, periods, offsets).
 *
 * The Phaser-idiomatic route would be TileSprites per layer; the sine hills
 * aren't tileable at arbitrary widths, so we redraw with Graphics.clear each
 * tick. Cost is trivial and the port stays 1:1 with the Canvas behavior.
 */
export class BackgroundView {
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private ground: Phaser.GameObjects.Graphics;

  private readonly width: number;
  private readonly height: number;
  private readonly groundTopScreen: number;

  private readonly hillLayers: HillLayer[];

  constructor(scene: Phaser.Scene, viewportHeight: number = VIRTUAL_HEIGHT) {
    this.width = VIRTUAL_WIDTH;
    this.height = viewportHeight;
    this.groundTopScreen = this.height * 0.45;

    this.sky = scene.add.graphics().setScrollFactor(0).setDepth(-1000);
    this.hills = scene.add.graphics().setScrollFactor(0).setDepth(-900);
    this.ground = scene.add.graphics().setScrollFactor(0).setDepth(-800);

    this.hillLayers = [
      { parallax: 0.15, yBase: this.groundTopScreen - 30, amplitude: 55, period: 600, offset: 0,   color: 0x6b7c4a },
      { parallax: 0.25, yBase: this.groundTopScreen - 15, amplitude: 40, period: 400, offset: 200, color: 0x7a8f55 },
      { parallax: 0.35, yBase: this.groundTopScreen,      amplitude: 25, period: 300, offset: 100, color: 0x8fa366 },
    ];

    this.drawSky();
  }

  private drawSky(): void {
    const g = this.sky;
    g.clear();
    const skyHeight = this.height * 0.55;
    // 3-stop vertical gradient approximated as two filled rects of average
    // color — close enough to the Canvas build's visual feel. A true gradient
    // would require an offscreen texture; we can upgrade in Phase 3.
    g.fillGradientStyle(0x5b8fc4, 0x5b8fc4, 0xc4d9e8, 0xc4d9e8, 1);
    g.fillRect(0, 0, this.width, skyHeight);
  }

  update(cameraX: number): void {
    const cx = -cameraX;
    this.drawHills(cx);
    this.drawGround(cx);
  }

  private drawHills(cx: number): void {
    const g = this.hills;
    g.clear();

    for (const hd of this.hillLayers) {
      const scrollX = cx * hd.parallax;
      g.fillStyle(hd.color, 1);
      g.beginPath();
      g.moveTo(-50, this.height);

      for (let px = -50; px <= this.width + 50; px += 10) {
        const wx = px - scrollX + hd.offset;
        const hy = hd.yBase - Math.abs(Math.sin((wx / hd.period) * Math.PI)) * hd.amplitude;
        g.lineTo(px, hy);
      }
      g.lineTo(this.width + 50, this.height);
      g.closePath();
      g.fillPath();
    }
  }

  private drawGround(cx: number): void {
    const g = this.ground;
    g.clear();

    const top = this.groundTopScreen;
    const h = this.height - top;

    // 5-stop gradient approximated with a vertical linear gradient between
    // the two dominant stops (top green, bottom dirt).
    g.fillGradientStyle(0x8ea85e, 0x8ea85e, 0xa08050, 0xa08050, 1);
    g.fillRect(0, top, this.width, h);

    // Darker stripe at the horizon edge.
    g.lineStyle(2, 0x6b8042, 1);
    g.lineBetween(0, top, this.width, top);

    // Diagonal perspective stripes that slide at 0.8 × camera.
    g.lineStyle(1, 0x000000, 0.08);
    const stripeSpacing = 40;
    const startX = (cx * 0.8) % stripeSpacing;
    for (let px = startX; px < this.width + stripeSpacing; px += stripeSpacing) {
      g.lineBetween(px, top, px - 20, this.height);
    }
  }

  destroy(): void {
    this.sky.destroy();
    this.hills.destroy();
    this.ground.destroy();
  }
}
