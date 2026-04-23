import Phaser from 'phaser';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../constants';
import { MANIFEST } from '../assets/manifest';
import { queueActorSprites, registerActorAnimations } from '../view/AnimationRegistry';
import { queueGuildVfx, registerGuildVfx } from '../view/VfxRegistry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    queueActorSprites(this);
    queueGuildVfx(this);
    for (const images of Object.values(MANIFEST.stageImages)) {
      for (const image of images) {
        if (!this.textures.exists(image.key)) {
          this.load.image(image.key, image.url);
        }
      }
    }

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
    registerActorAnimations(this);
    registerGuildVfx(this);
    // Tell any React overlay that preload + animation registration is done.
    // Sticky flag on the registry lets late-mounting listeners (HMR, slow
    // React commit) resolve without hanging on a missed event.
    this.game.registry.set('preloadDone', true);
    this.game.events.emit('preload-done');
    this.scene.start('Gameplay');
  }
}
