import Phaser from 'phaser';
import type { GuildId } from '../simulation/types';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameplayScene } from './scenes/GameplayScene';
import { HudScene } from './scenes/HudScene';

export interface GameCallbacks {
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
  toggleFullscreen: () => void;
  getIsFullscreen: () => boolean;
}

export interface GameBootConfig {
  guildId: GuildId;
  callbacks: GameCallbacks;
}

export function makePhaserGame(parent: HTMLElement, boot: GameBootConfig): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    backgroundColor: '#000000',
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, GameplayScene, HudScene],
    disableContextMenu: true,
    input: {
      keyboard: true,
    },
    render: {
      antialias: false,
    },
  });

  game.registry.set('guildId', boot.guildId);
  game.registry.set('callbacks', boot.callbacks);

  return game;
}
