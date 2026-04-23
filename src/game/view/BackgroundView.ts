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

export class BackgroundView {
  private scene: Phaser.Scene;
  private sky: Phaser.GameObjects.Graphics;
  private hills: Phaser.GameObjects.Graphics;
  private ground: Phaser.GameObjects.Graphics;
  private stageProps: Phaser.GameObjects.Image[] = [];
  private readonly stageId: string;
  private readonly width: number;
  private readonly height: number;
  private readonly groundTopScreen: number;
  private readonly hillLayers: HillLayer[];

  private static readonly NAMED_STAGES = new Set([
    'assembly', 'market', 'kitchen', 'tower', 'grove',
    'catacombs', 'throne', 'docks', 'rooftops',
  ]);

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

    if (BackgroundView.NAMED_STAGES.has(this.stageId)) {
      this.drawBackdrop();
      this.createStageProps();
      this.updateStageProps(0);
    } else {
      this.drawSky();
    }
  }

  update(cameraX: number): void {
    if (BackgroundView.NAMED_STAGES.has(this.stageId)) {
      this.drawBackdrop();
      this.updateStageProps(cameraX);
      return;
    }
    const cx = -cameraX;
    this.drawHills(cx);
    this.drawGround(cx);
  }

  // ── Dispatch ─────────────────────────────────────────────────────────────

  private drawBackdrop(): void {
    switch (this.stageId) {
      case 'assembly':  this.drawAssemblyBackdrop();  break;
      case 'market':    this.drawMarketBackdrop();    break;
      case 'kitchen':   this.drawKitchenBackdrop();   break;
      case 'tower':     this.drawTowerBackdrop();     break;
      case 'grove':     this.drawGroveBackdrop();     break;
      case 'catacombs': this.drawCatacombsBackdrop(); break;
      case 'throne':    this.drawThroneBackdrop();    break;
      case 'docks':     this.drawDocksBackdrop();     break;
      case 'rooftops':  this.drawRooftopsBackdrop();  break;
    }
  }

  private createStageProps(): void {
    switch (this.stageId) {
      case 'assembly':  this.createAssemblyProps();  break;
      case 'market':    this.createMarketProps();    break;
      case 'kitchen':   this.createKitchenProps();   break;
      case 'tower':     this.createTowerProps();     break;
      case 'grove':     this.createGroveProps();     break;
      case 'catacombs': this.createCatacombsProps(); break;
      case 'throne':    this.createThroneProps();    break;
      case 'docks':     this.createDocksProps();     break;
      case 'rooftops':  this.createRooftopsProps();  break;
    }
  }

  // ── Assembly Hall ─────────────────────────────────────────────────────────

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
    for (let x = 0; x < this.width + 90; x += 84) hills.lineBetween(x, roofTop, x + 18, roofBottom);
    hills.lineStyle(2, 0x353a43, 0.75);
    hills.lineBetween(0, roofBottom + 6, this.width, roofBottom + 6);

    hills.fillStyle(0x7b8290, 0.95);
    hills.fillRect(0, wallBottom - 34, this.width, 22);
    hills.fillStyle(0x5b6270, 0.98);
    hills.fillRect(0, wallBottom - 12, this.width, 12);
    hills.lineStyle(1, 0xa5afbf, 0.3);
    hills.lineBetween(0, wallBottom - 24, this.width, wallBottom - 24);
    hills.lineStyle(1, 0x5e6776, 0.3);
    for (let x = 0; x < this.width + 80; x += 88) hills.lineBetween(x, wallBottom - 34, x + 16, wallBottom - 12);

    const floorTop = this.groundTopScreen;
    const floorHeight = this.height - floorTop;
    ground.fillGradientStyle(0x7a746d, 0x7a746d, 0x544d47, 0x544d47, 1);
    ground.fillRect(0, floorTop, this.width, floorHeight);
    ground.lineStyle(3, 0x2d2622, 1);
    ground.lineBetween(0, floorTop, this.width, floorTop);
    ground.lineStyle(1, 0x4e4741, 0.55);
    for (let y = floorTop + 24; y < this.height; y += 30) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x3f3933, 0.4);
    let asmRow = 0;
    for (let y = floorTop; y < this.height; y += 30) {
      const offset = asmRow % 2 === 0 ? 0 : 48;
      for (let x = -offset; x < this.width + 96; x += 96) ground.lineBetween(x, y, x + 10, Math.min(this.height, y + 30));
      asmRow += 1;
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

  private createAssemblyProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -300; wx <= 3000; wx += 300) this.sp('stage:assembly:pillar', wx, g + 14, 0.6, -600, 0.62, 0.98);
    for (let wx = -150; wx <= 2850; wx += 300) this.sp('stage:assembly:banner', wx, g - 12, 0.6, -600, 0.62, 0.98);
    for (let wx = -300; wx <= 2700; wx += 300) this.sp('stage:assembly:brazier', wx, g - 30, 0.6, -600, 0.40, 0.90);
  }

  // ── Night Market ─────────────────────────────────────────────────────────

  private drawMarketBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x080618, 0x080618, 0x2a1808, 0x2a1808, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0xfff5cc, 0.75);
    sky.fillCircle(this.width * 0.78, 28, 11);
    sky.fillStyle(0xf07828, 0.07);
    sky.fillEllipse(this.width * 0.28, skyH - 8, 220, 64);
    sky.fillEllipse(this.width * 0.65, skyH - 12, 180, 52);

    hills.fillStyle(0x120e0a, 1);
    hills.fillRect(0, skyH - 36, this.width * 0.28, 36);
    hills.fillRect(this.width * 0.30, skyH - 22, this.width * 0.18, 22);
    hills.fillRect(this.width * 0.52, skyH - 44, this.width * 0.22, 44);
    hills.fillRect(this.width * 0.78, skyH - 28, this.width * 0.28, 28);
    hills.fillStyle(0xf09840, 0.3);
    for (let x = 14; x < this.width; x += 46) hills.fillRect(x, skyH - 32, 7, 10);

    ground.fillGradientStyle(0x201818, 0x201818, 0x110f0f, 0x110f0f, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x100c0c, 1);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x181010, 0.3);
    for (let y = fTop + 18; y < this.height; y += 20) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x181010, 0.2);
    for (let x = 0; x < this.width; x += 30) ground.lineBetween(x, fTop, x, this.height);
  }

  private createMarketProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -280; wx <= 3920; wx += 280) this.sp('stage:market:lantern', wx, g + 14, 0.55, -600, 0.72);
    for (let wx = -140; wx <= 3780; wx += 280) this.sp('stage:market:stall',   wx, g + 14, 0.48, -620, 0.52, 0.90);
    for (let wx =  -70; wx <= 3850; wx += 280) this.sp('stage:market:crates',  wx, g + 18, 0.62, -580, 0.46);
    for (let wx =  -80; wx <= 3840; wx += 280) this.sp('stage:market:sign',    wx, g - 18, 0.50, -610, 0.42, 0.85);
  }

  // ── Rot-Kitchen ───────────────────────────────────────────────────────────

  private drawKitchenBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x1c1810, 0x1c1810, 0x252018, 0x252018, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0x0a0a08, 0.4);
    sky.fillEllipse(this.width * 0.4, 20, this.width * 0.6, 40);
    sky.fillStyle(0xc04010, 0.06);
    sky.fillEllipse(this.width * 0.5, skyH - 10, this.width * 0.8, 50);

    hills.fillStyle(0x2a2218, 1);
    hills.fillRect(0, 0, this.width, skyH);
    hills.lineStyle(1, 0x1c1610, 0.5);
    for (let y = 0; y < skyH; y += 14) hills.lineBetween(0, y, this.width, y);
    hills.lineStyle(1, 0x1c1610, 0.35);
    let kitRow = 0;
    for (let y = 0; y < skyH; y += 14) {
      const off = (kitRow % 2) * 28;
      for (let x = -off; x < this.width; x += 56) hills.lineBetween(x, y, x, y + 14);
      kitRow++;
    }
    hills.fillStyle(0x0f0e0a, 0.6);
    hills.fillRect(this.width * 0.15, skyH - 30, 36, 24);
    hills.fillRect(this.width * 0.55, skyH - 26, 36, 20);
    hills.fillRect(this.width * 0.82, skyH - 34, 36, 28);

    ground.fillGradientStyle(0x2a2218, 0x2a2218, 0x181410, 0x181410, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x0f0c08, 1);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x1a1410, 0.35);
    for (let y = fTop + 22; y < this.height; y += 24) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x1a1410, 0.25);
    for (let x = 0; x < this.width; x += 40) ground.lineBetween(x, fTop, x, this.height);
    ground.fillStyle(0x0d0a06, 0.3);
    ground.fillEllipse(this.width * 0.3, fTop + 20, 80, 30);
    ground.fillEllipse(this.width * 0.7, fTop + 30, 60, 20);
  }

  private createKitchenProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -400; wx <= 3600; wx += 400) this.sp('stage:kitchen:cauldron', wx, g + 10, 0.55, -590, 0.62);
    for (let wx = -200; wx <= 3800; wx += 400) this.sp('stage:kitchen:stove',    wx, g + 14, 0.48, -620, 0.55, 0.92);
    for (let wx = -350; wx <= 3850; wx += 350) this.sp('stage:kitchen:hooks',    wx, g - 28, 0.42, -610, 0.50, 0.88);
    for (let wx = -140; wx <= 3860; wx += 350) this.sp('stage:kitchen:barrel',   wx, g + 18, 0.65, -580, 0.48);
  }

  // ── Mage Tower ────────────────────────────────────────────────────────────

  private drawTowerBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x080520, 0x080520, 0x150a38, 0x150a38, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0x5020c0, 0.07);
    sky.fillEllipse(this.width * 0.3, skyH * 0.4, 300, 80);
    sky.fillEllipse(this.width * 0.7, skyH * 0.6, 250, 60);
    sky.fillStyle(0x2040e0, 0.05);
    sky.fillEllipse(this.width * 0.55, skyH * 0.25, 200, 50);

    hills.fillStyle(0x0e0828, 0.95);
    hills.fillRect(0, 0, this.width, skyH);
    hills.lineStyle(1, 0x3020a0, 0.18);
    for (let y = 20; y < skyH; y += 60) hills.lineBetween(0, y, this.width, y);
    hills.lineStyle(1, 0x2030c0, 0.12);
    for (let x = 40; x < this.width; x += 80) hills.lineBetween(x, 0, x, skyH);
    hills.lineStyle(1, 0x5040d0, 0.30);
    hills.strokeCircle(this.width * 0.25, skyH * 0.5, 40);
    hills.strokeCircle(this.width * 0.75, skyH * 0.4, 30);
    hills.strokeCircle(this.width * 0.5,  skyH * 0.7, 50);

    ground.fillGradientStyle(0x080f20, 0x080f20, 0x040810, 0x040810, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x1828a0, 0.6);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x1020a0, 0.20);
    for (let y = fTop + 20; y < this.height; y += 24) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x1020a0, 0.15);
    for (let x = 0; x < this.width; x += 36) ground.lineBetween(x, fTop, x, this.height);
    ground.fillStyle(0x1030c0, 0.08);
    ground.fillEllipse(this.width * 0.35, fTop + 25, 120, 40);
    ground.fillEllipse(this.width * 0.72, fTop + 20, 100, 35);
  }

  private createTowerProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -320; wx <= 3840; wx += 320) this.sp('stage:tower:pillar',   wx, g + 14, 0.62, -600, 0.68);
    for (let wx = -160; wx <= 3680; wx += 320) this.sp('stage:tower:crystals', wx, g + 12, 0.52, -610, 0.55, 0.92);
    for (let wx =  -80; wx <= 3760; wx += 320) this.sp('stage:tower:tomes',    wx, g + 18, 0.66, -580, 0.44);
    for (let wx = -240; wx <= 3600; wx += 320) this.sp('stage:tower:brazier',  wx, g + 12, 0.58, -590, 0.50);
  }

  // ── Moonwake Grove ────────────────────────────────────────────────────────

  private drawGroveBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x040c18, 0x040c18, 0x0a1508, 0x0a1508, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0xeef8ff, 0.9);
    sky.fillCircle(this.width * 0.6, 32, 18);
    sky.fillStyle(0xaaccee, 0.2);
    sky.fillCircle(this.width * 0.6, 32, 28);
    sky.fillStyle(0xeeeeff, 0.6);
    for (const star of [[80, 15], [200, 40], [350, 20], [480, 55], [700, 10], [820, 35], [120, 60], [630, 45]]) {
      sky.fillCircle(star[0], star[1], 1.2);
    }
    sky.fillStyle(0x1a3020, 0.15);
    sky.fillRect(0, skyH - 30, this.width, 30);

    hills.fillStyle(0x060e04, 1);
    for (let x = -30; x < this.width + 30; x += 60) {
      const h = 60 + (Math.sin(x * 0.03) * 0.5 + 0.5) * 40;
      hills.fillTriangle(x, skyH, x - 30, skyH - h, x + 30, skyH - h);
      hills.fillRect(x - 6, skyH - h, 12, h * 0.3);
    }

    ground.fillGradientStyle(0x0f1a08, 0x0f1a08, 0x080f05, 0x080f05, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x0a1206, 1);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x0c1208, 0.4);
    for (let y = fTop + 15; y < this.height; y += 18) ground.lineBetween(0, y, this.width, y);
    ground.fillStyle(0x203a10, 0.2);
    ground.fillEllipse(this.width * 0.2, fTop + 18, 100, 30);
    ground.fillEllipse(this.width * 0.65, fTop + 22, 80, 24);
  }

  private createGroveProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -380; wx <= 3800; wx += 380) this.sp('stage:grove:tree',      wx, g + 14, 0.52, -600, 0.75);
    for (let wx = -190; wx <= 3610; wx += 380) this.sp('stage:grove:stone',     wx, g + 14, 0.46, -610, 0.62, 0.90);
    for (let wx = -100; wx <= 3800; wx += 300) this.sp('stage:grove:mushrooms', wx, g + 18, 0.65, -580, 0.50);
    for (let wx = -280; wx <= 3640; wx += 500) this.sp('stage:grove:altar',     wx, g + 18, 0.56, -590, 0.55, 0.92);
  }

  // ── Drowned Catacombs ─────────────────────────────────────────────────────

  private drawCatacombsBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x07070f, 0x07070f, 0x0e1018, 0x0e1018, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0x040408, 0.5);
    sky.fillRect(0, 0, this.width, 20);
    sky.fillStyle(0x0a1828, 0.1);
    sky.fillEllipse(this.width * 0.45, skyH - 15, this.width * 0.7, 50);

    hills.fillStyle(0x0d0f14, 1);
    hills.fillRect(0, 0, this.width, skyH);
    hills.lineStyle(1, 0x070810, 0.5);
    for (let y = 10; y < skyH; y += 28) hills.lineBetween(0, y, this.width, y);
    hills.lineStyle(1, 0x070810, 0.3);
    for (let x = 20; x < this.width; x += 50) hills.lineBetween(x, 0, x, skyH);
    hills.lineStyle(1, 0x182030, 0.25);
    for (let x = 30; x < this.width; x += 70) hills.lineBetween(x, 0, x - 5, skyH);
    hills.lineStyle(2, 0x181a22, 0.6);
    hills.strokeEllipse(this.width * 0.35, skyH, this.width * 0.25, 60);
    hills.strokeEllipse(this.width * 0.72, skyH, this.width * 0.22, 50);

    ground.fillGradientStyle(0x12161e, 0x12161e, 0x090c12, 0x090c12, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x182030, 0.7);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x1a2838, 0.3);
    for (let y = fTop + 12; y < this.height; y += 16) ground.lineBetween(0, y, this.width, y);
    ground.fillStyle(0x0f1e30, 0.15);
    ground.fillRect(0, fTop, this.width, 30);
  }

  private createCatacombsProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -320; wx <= 3840; wx += 320) this.sp('stage:catacombs:pillar',      wx, g + 14, 0.62, -600, 0.68);
    for (let wx = -160; wx <= 3680; wx += 320) this.sp('stage:catacombs:stalactites', wx, g - 45, 0.42, -610, 0.55, 0.85);
    for (let wx = -100; wx <= 3800; wx += 300) this.sp('stage:catacombs:bones',       wx, g + 18, 0.66, -580, 0.50);
    for (let wx = -240; wx <= 3600; wx += 320) this.sp('stage:catacombs:torch',       wx, g +  8, 0.58, -590, 0.48);
  }

  // ── Red Throne ────────────────────────────────────────────────────────────

  private drawThroneBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x130505, 0x130505, 0x280808, 0x280808, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0xc01010, 0.06);
    sky.fillEllipse(this.width * 0.5, skyH - 10, this.width * 0.9, 60);
    sky.fillStyle(0xe03010, 0.04);
    sky.fillEllipse(this.width * 0.2, skyH - 20, 200, 60);
    sky.fillEllipse(this.width * 0.8, skyH - 20, 200, 60);

    hills.fillStyle(0x1e1010, 1);
    hills.fillRect(0, 0, this.width, skyH);
    hills.lineStyle(1, 0x150a0a, 0.5);
    for (let y = 0; y < skyH; y += 22) hills.lineBetween(0, y, this.width, y);
    hills.lineStyle(1, 0x150a0a, 0.3);
    for (let x = 0; x < this.width; x += 44) hills.lineBetween(x, 0, x, skyH);
    hills.fillStyle(0xb01010, 0.12);
    hills.fillEllipse(this.width * 0.25, skyH * 0.6, 70, 100);
    hills.fillEllipse(this.width * 0.50, skyH * 0.5, 70, 100);
    hills.fillEllipse(this.width * 0.75, skyH * 0.6, 70, 100);
    hills.lineStyle(2, 0x400808, 0.5);
    hills.strokeEllipse(this.width * 0.25, skyH * 0.6, 70, 100);
    hills.strokeEllipse(this.width * 0.50, skyH * 0.5, 70, 100);
    hills.strokeEllipse(this.width * 0.75, skyH * 0.6, 70, 100);

    ground.fillGradientStyle(0x201010, 0x201010, 0x130808, 0x130808, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(3, 0x400808, 0.8);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x180808, 0.35);
    for (let y = fTop + 24; y < this.height; y += 26) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x180808, 0.25);
    for (let x = 0; x < this.width; x += 48) ground.lineBetween(x, fTop, x, this.height);
    ground.lineStyle(1, 0xc01010, 0.10);
    ground.lineBetween(0, fTop + 10, this.width * 0.4, this.height);
    ground.lineBetween(this.width * 0.6, fTop + 8, this.width, this.height * 0.7);
  }

  private createThroneProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -320; wx <= 3840; wx += 320) this.sp('stage:throne:banner', wx, g + 14, 0.62, -600, 0.65);
    this.sp('stage:throne:throne', 1800, g + 14, 0.35, -650, 0.72);
    for (let wx = -400; wx <= 3600; wx += 500) this.sp('stage:throne:cage',   wx, g + 14, 0.65, -585, 0.55, 0.92);
    for (let wx = -240; wx <= 3600; wx += 600) this.sp('stage:throne:block',  wx, g + 20, 0.66, -578, 0.48);
  }

  // ── Vampire Docks ─────────────────────────────────────────────────────────

  private drawDocksBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x060810, 0x060810, 0x0e1218, 0x0e1218, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0x141e28, 0.2);
    sky.fillRect(0, skyH - 50, this.width, 50);
    sky.fillStyle(0x101820, 0.3);
    sky.fillRect(0, skyH - 25, this.width, 25);
    sky.fillStyle(0xb0c8e0, 0.15);
    sky.fillCircle(this.width * 0.35, 40, 24);

    hills.fillStyle(0x080c10, 1);
    hills.fillRect(0, skyH - 18, this.width, 18);
    hills.lineStyle(2, 0x080c10, 1);
    for (const mx of [this.width * 0.15, this.width * 0.45, this.width * 0.7, this.width * 0.88]) {
      hills.lineBetween(mx, skyH - 80, mx, skyH - 14);
      hills.lineBetween(mx - 30, skyH - 55, mx + 30, skyH - 55);
    }
    hills.fillStyle(0x0c1420, 0.25);
    hills.fillRect(0, skyH - 60, this.width, 60);

    ground.fillGradientStyle(0x181210, 0x181210, 0x0f0a08, 0x0f0a08, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x100c0a, 1);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x120e0c, 0.45);
    for (let y = fTop + 16; y < this.height; y += 20) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x100c0a, 0.2);
    for (let x = 0; x < this.width; x += 48) ground.lineBetween(x, fTop, x, this.height);
    ground.fillStyle(0x1a2030, 0.12);
    ground.fillRect(0, fTop, this.width, 20);
  }

  private createDocksProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -280; wx <= 3920; wx += 280) this.sp('stage:docks:post',   wx, g + 14, 0.62, -600, 0.68);
    for (let wx = -140; wx <= 3780; wx += 280) this.sp('stage:docks:lamp',   wx, g + 14, 0.56, -605, 0.65, 0.88);
    for (let wx = -200; wx <= 3800; wx += 400) this.sp('stage:docks:anchor', wx, g + 14, 0.66, -582, 0.55);
    for (let wx = -100; wx <= 3750; wx += 350) this.sp('stage:docks:crates', wx, g + 18, 0.64, -585, 0.50, 0.92);
  }

  // ── Monastery Rooftops ────────────────────────────────────────────────────

  private drawRooftopsBackdrop(): void {
    const { sky, hills, ground } = this;
    const skyH = this.height * 0.55;
    const fTop = this.groundTopScreen;
    sky.clear(); hills.clear(); ground.clear();

    sky.fillGradientStyle(0x2858a0, 0x2858a0, 0x6080b8, 0x6080b8, 1);
    sky.fillRect(0, 0, this.width, skyH);
    sky.fillStyle(0xffffff, 0.12);
    sky.fillEllipse(this.width * 0.2, 30, 200, 30);
    sky.fillEllipse(this.width * 0.6, 50, 160, 24);
    sky.fillEllipse(this.width * 0.85, 20, 140, 20);
    sky.fillStyle(0xd0e0f8, 0.1);
    sky.fillRect(0, skyH - 30, this.width, 30);

    hills.fillStyle(0x485868, 1);
    hills.fillRect(0,              skyH - 30, this.width * 0.22, 30);
    hills.fillRect(this.width * 0.24, skyH - 44, this.width * 0.15, 44);
    hills.fillRect(this.width * 0.42, skyH - 20, this.width * 0.18, 20);
    hills.fillRect(this.width * 0.65, skyH - 50, this.width * 0.12, 50);
    hills.fillRect(this.width * 0.82, skyH - 34, this.width * 0.24, 34);
    hills.lineStyle(1, 0x384858, 0.6);
    hills.lineBetween(0, skyH - 30, this.width * 0.22, skyH - 30);
    hills.lineBetween(this.width * 0.24, skyH - 44, this.width * 0.39, skyH - 44);

    ground.fillGradientStyle(0x585858, 0x585858, 0x3a3a3a, 0x3a3a3a, 1);
    ground.fillRect(0, fTop, this.width, this.height - fTop);
    ground.lineStyle(2, 0x2a2a2a, 1);
    ground.lineBetween(0, fTop, this.width, fTop);
    ground.lineStyle(1, 0x484848, 0.5);
    for (let y = fTop + 16; y < this.height; y += 18) ground.lineBetween(0, y, this.width, y);
    ground.lineStyle(1, 0x484848, 0.3);
    let rtRow = 0;
    for (let y = fTop; y < this.height; y += 18) {
      const off = (rtRow % 2) * 24;
      for (let x = -off; x < this.width; x += 48) ground.lineBetween(x, y, x, Math.min(this.height, y + 18));
      rtRow++;
    }
    ground.fillStyle(0x404848, 0.25);
    ground.fillEllipse(this.width * 0.3, fTop + 18, 90, 25);
    ground.fillEllipse(this.width * 0.75, fTop + 22, 70, 20);
  }

  private createRooftopsProps(): void {
    const g = this.groundTopScreen;
    for (let wx = -350; wx <= 3850; wx += 350) this.sp('stage:rooftops:chimney',  wx, g + 14, 0.58, -600, 0.65);
    for (let wx = -175; wx <= 3675; wx += 700) this.sp('stage:rooftops:bell',     wx, g + 14, 0.50, -610, 0.62, 0.92);
    for (let wx = -175; wx <= 3675; wx += 350) this.sp('stage:rooftops:flags',    wx, g - 22, 0.44, -615, 0.55, 0.85);
    for (let wx = -350; wx <= 3500; wx += 500) this.sp('stage:rooftops:gargoyle', wx, g + 12, 0.62, -595, 0.50, 0.90);
  }

  // ── Generic fallback (non-named stages) ───────────────────────────────────

  private drawSky(): void {
    const g = this.sky;
    g.clear();
    g.fillGradientStyle(0x5b8fc4, 0x5b8fc4, 0xc4d9e8, 0xc4d9e8, 1);
    g.fillRect(0, 0, this.width, this.height * 0.55);
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
    g.fillGradientStyle(0x8ea85e, 0x8ea85e, 0xa08050, 0xa08050, 1);
    g.fillRect(0, top, this.width, h);
    g.lineStyle(2, 0x6b8042, 1);
    g.lineBetween(0, top, this.width, top);
    g.lineStyle(1, 0x000000, 0.08);
    const stripeSpacing = 40;
    const startX = (cx * 0.8) % stripeSpacing;
    for (let px = startX; px < this.width + stripeSpacing; px += stripeSpacing) {
      g.lineBetween(px, top, px - 20, this.height);
    }
  }

  // ── Shared prop helpers ───────────────────────────────────────────────────

  private sp(key: string, wx: number, y: number, parallax: number, depth: number, scale: number, alpha = 1): void {
    const prop = this.scene.add.image(0, y, key)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(depth)
      .setScale(scale)
      .setAlpha(alpha);
    prop.setDataEnabled();
    prop.data.set('worldX', wx);
    prop.data.set('parallax', parallax);
    this.stageProps.push(prop);
  }

  private updateStageProps(cameraX: number): void {
    for (const prop of this.stageProps) {
      const wx = prop.getData('worldX') as number;
      const par = prop.getData('parallax') as number;
      prop.x = wx - cameraX * par + this.width * 0.5;
    }
  }

  destroy(): void {
    for (const prop of this.stageProps) prop.destroy();
    this.sky.destroy();
    this.hills.destroy();
    this.ground.destroy();
  }
}
