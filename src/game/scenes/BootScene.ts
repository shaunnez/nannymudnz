import Phaser from 'phaser';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../constants';
import { queueGuildSprites, registerGuildAnimations } from '../view/AnimationRegistry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    queueGuildSprites(this);

    const barBgWidth = Math.floor(VIRTUAL_WIDTH * 0.5);
    const barBgHeight = 16;
    const cx = VIRTUAL_WIDTH / 2;
    const cy = VIRTUAL_HEIGHT / 2;

    const barBg = this.add
      .rectangle(cx, cy, barBgWidth, barBgHeight, 0x222222)
      .setStrokeStyle(1, 0x555555);
    const bar = this.add
      .rectangle(cx - barBgWidth / 2, cy, 0, barBgHeight - 4, 0xffffff)
      .setOrigin(0, 0.5);
    const label = this.add
      .text(cx, cy - 24, 'Loading…', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.width = (barBgWidth - 4) * value;
    });
    this.load.on('complete', () => {
      barBg.destroy();
      bar.destroy();
      label.destroy();
    });
  }

  create(): void {
    registerGuildAnimations(this);
    this.scene.start('Gameplay');
  }
}
