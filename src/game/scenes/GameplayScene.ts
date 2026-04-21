import Phaser from 'phaser';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from '../constants';

export class GameplayScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Gameplay' });
  }

  create(): void {
    this.add
      .text(VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, 'Gameplay (Phase 2 WIP)', {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.scene.launch('Hud');
  }
}
