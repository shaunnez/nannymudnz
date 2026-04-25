import Phaser from 'phaser';
import { MANIFEST } from '../assets/manifest';
import { queueActorSprites, registerActorAnimations } from '../view/AnimationRegistry';
import { queueGuildVfx, registerGuildVfx } from '../view/VfxRegistry';
import { queueEffectsVfx, registerEffectsVfx } from '../view/EffectsRegistry';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    queueActorSprites(this);
    queueGuildVfx(this);
    queueEffectsVfx(this);
    for (const images of Object.values(MANIFEST.stageImages)) {
      for (const image of images) {
        if (!this.textures.exists(image.key)) {
          this.load.image(image.key, image.url);
        }
      }
    }

    this.load.on('progress', (value: number) => {
      this.game.events.emit('preload-progress', value);
    });
  }

  create(): void {
    registerActorAnimations(this);
    registerGuildVfx(this);
    registerEffectsVfx(this);
    // Tell any React overlay that preload + animation registration is done.
    // Sticky flag on the registry lets late-mounting listeners (HMR, slow
    // React commit) resolve without hanging on a missed event.
    this.game.registry.set('preloadDone', true);
    this.game.events.emit('preload-done');
    this.scene.start('Gameplay');
  }
}
