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
  private scene: Phaser.Scene;
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private ground: Phaser.GameObjects.Graphics;
  private assemblyProps: Phaser.GameObjects.Image[] = [];
  private readonly stageId: string;

  private readonly width: number;
  private readonly height: number;
  private readonly groundTopScreen: number;

  private readonly hillLayers: HillLayer[];

  constructor(scene: Phaser.Scene, viewportHeight: number = VIRTUAL_HEIGHT, stageId: string = 'generic') {
    this.scene = scene;
    this.stageId = stageId;
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

    if (this.stageId === 'assembly') {
      this.drawAssemblyBackdrop();
      this.createAssemblyProps();
      this.updateAssemblyProps(0);
    } else {
      this.drawSky();
    }
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
    if (this.stageId === 'assembly') {
      this.drawAssemblyBackdrop();
      this.updateAssemblyProps(cameraX);
      return;
    }
    this.drawHills(cx);
    this.drawGround(cx);
  }

  private drawAssemblyBackdrop(): void {
    const sky = this.sky;
    const hills = this.hills;
    const ground = this.ground;
    const wallTop = 10;
    const wallBottom = this.groundTopScreen + 6;
    const roofTop = wallTop;
    const roofBottom = wallTop + 8;

    sky.clear();
    hills.clear();
    ground.clear();

    sky.fillGradientStyle(0x233f71, 0x233f71, 0x9f7aa8, 0x9f7aa8, 1);
    sky.fillRect(0, 0, this.width, wallBottom);
    sky.fillStyle(0xf6bf6a, 0.08);
    sky.fillEllipse(this.width * 0.5, wallTop + 46, this.width * 0.72, 46);
    sky.fillStyle(0xc8d7ff, 0.08);
    sky.fillEllipse(this.width * 0.22, wallTop + 76, 180, 30);
    sky.fillEllipse(this.width * 0.78, wallTop + 84, 220, 34);

    hills.fillStyle(0x6f7682, 0.98);
    hills.fillRect(0, roofTop, this.width, roofBottom - roofTop);
    hills.fillStyle(0x505660, 0.98);
    hills.fillRect(0, roofTop - 6, this.width, 6);
    hills.fillRect(0, roofBottom, this.width, 6);
    hills.lineStyle(1, 0x8f97a3, 0.45);
    for (let x = 0; x < this.width + 90; x += 84) {
      hills.lineBetween(x, roofTop, x + 18, roofBottom);
    }
    hills.lineStyle(2, 0x353a43, 0.75);
    hills.lineBetween(0, roofBottom + 6, this.width, roofBottom + 6);

    hills.fillStyle(0x7b8290, 0.95);
    hills.fillRect(0, wallBottom - 34, this.width, 22);
    hills.fillStyle(0x5b6270, 0.98);
    hills.fillRect(0, wallBottom - 12, this.width, 12);
    hills.lineStyle(1, 0xa5afbf, 0.3);
    hills.lineBetween(0, wallBottom - 24, this.width, wallBottom - 24);
    hills.lineStyle(1, 0x5e6776, 0.3);
    for (let x = 0; x < this.width + 80; x += 88) {
      hills.lineBetween(x, wallBottom - 34, x + 16, wallBottom - 12);
    }

    const floorTop = this.groundTopScreen;
    const floorHeight = this.height - floorTop;
    ground.fillGradientStyle(0x7a746d, 0x7a746d, 0x544d47, 0x544d47, 1);
    ground.fillRect(0, floorTop, this.width, floorHeight);
    ground.lineStyle(3, 0x2d2622, 1);
    ground.lineBetween(0, floorTop, this.width, floorTop);

    ground.lineStyle(1, 0x4e4741, 0.55);
    for (let y = floorTop + 24; y < this.height; y += 30) {
      ground.lineBetween(0, y, this.width, y);
    }
    ground.lineStyle(1, 0x3f3933, 0.4);
    let row = 0;
    for (let y = floorTop; y < this.height; y += 30) {
      const offset = row % 2 === 0 ? 0 : 48;
      for (let x = -offset; x < this.width + 96; x += 96) {
        ground.lineBetween(x, y, x + 10, Math.min(this.height, y + 30));
      }
      row += 1;
    }

    const rugX = 0;
    const rugY = floorTop + 10;
    const rugW = this.width;
    const rugH = floorHeight - 24;
    ground.fillStyle(0xb01f2f, 0.96);
    ground.fillRect(rugX, rugY, rugW, rugH);
    ground.fillStyle(0x7d1723, 0.35);
    ground.fillRect(rugX, rugY + 18, rugW, rugH - 36);

    ground.lineStyle(4, 0xe5c15a, 1);
    ground.lineBetween(rugX, rugY, rugX + rugW, rugY);
    ground.lineBetween(rugX, rugY + rugH, rugX + rugW, rugY + rugH);
    ground.lineStyle(2, 0xf2d987, 0.92);
    ground.lineBetween(rugX, rugY + 8, rugX + rugW, rugY + 8);
    ground.lineBetween(rugX, rugY + rugH - 8, rugX + rugW, rugY + rugH - 8);
    ground.lineStyle(2, 0xd8b04b, 0.9);
    for (let x = 10; x < this.width - 16; x += 36) {
      ground.lineBetween(x, rugY + 4, x + 10, rugY + 4);
      ground.lineBetween(x + 6, rugY + rugH - 4, x + 16, rugY + rugH - 4);
    }
    ground.fillStyle(0xf2d987, 0.9);
    for (let x = 24; x < this.width - 24; x += 52) {
      ground.fillCircle(x, rugY + 4, 1.6);
      ground.fillCircle(x, rugY + rugH - 4, 1.6);
    }
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

  private createAssemblyProps(): void {
    this.assemblyProps = [
      this.createAssemblyProp('stage:assembly:pillar', -300, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 0, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 300, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 600, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 900, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 1200, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 1500, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 1800, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 2100, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 2400, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 2700, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:pillar', 3000, this.groundTopScreen + 14, 0.6, -600, 0.62, 0.98),
      
      this.createAssemblyProp('stage:assembly:banner', -150, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 150, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 450, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 750, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 1050, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 1350, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 1650, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 1950, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 2250, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 2550, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      this.createAssemblyProp('stage:assembly:banner', 2850, this.groundTopScreen - 12, 0.6, -600, 0.62, 0.98),
      
      this.createAssemblyProp('stage:assembly:brazier', -300, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 300, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 900, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 1200, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 1500, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 1800, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 2100, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 2400, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
      this.createAssemblyProp('stage:assembly:brazier', 2700, this.groundTopScreen - 30, 0.6, -600, 0.4, 0.90),
    ];
  }

  private createAssemblyProp(
    textureKey: string,
    worldX: number,
    y: number,
    parallax: number,
    depth: number,
    scale: number,
    alpha: number = 1,
  ): Phaser.GameObjects.Image {
    const prop = this.scene.add.image(0, y, textureKey)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(depth)
      .setScale(scale)
      .setAlpha(alpha);

    prop.setDataEnabled();
    prop.data.set('worldX', worldX);
    prop.data.set('parallax', parallax);
    return prop;
  }

  private updateAssemblyProps(cameraX: number): void {
    for (const prop of this.assemblyProps) {
      const worldX = prop.getData('worldX') as number;
      const parallax = prop.getData('parallax') as number;
      prop.x = worldX - cameraX * parallax + this.width * 0.5;
    }
  }

  destroy(): void {
    for (const prop of this.assemblyProps) {
      prop.destroy();
    }
    this.sky.destroy();
    this.hills.destroy();
    this.ground.destroy();
  }
}
