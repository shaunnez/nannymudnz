import Phaser from 'phaser';
import type { Room } from 'colyseus.js';
import type { GuildId, SimMode } from '@nannymud/shared/simulation/types';
import type { MatchState } from '@nannymud/shared';
import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT } from './constants';
import { BootScene } from './scenes/BootScene';
import { GameplayScene } from './scenes/GameplayScene';
import { HudScene } from './scenes/HudScene';

export type NetMode = 'sp' | 'mp';

export interface GameCallbacks {
  onVictory: (score: number) => void;
  onDefeat: () => void;
  onQuit: () => void;
  toggleFullscreen: () => void;
  getIsFullscreen: () => boolean;
}

export interface GameBootConfig {
  guildId: GuildId;
  mode: SimMode;
  p2?: GuildId;
  stageId: string;
  seed?: number;
  callbacks: GameCallbacks;
  /** 'sp' (default) runs local simulation. 'mp' mirrors `matchRoom.state.sim`. */
  netMode?: NetMode;
  /** Required when `netMode === 'mp'`. */
  matchRoom?: Room<MatchState>;
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
    input: { keyboard: true },
    render: { antialias: false },
  });

  game.registry.set('guildId', boot.guildId);
  game.registry.set('mode', boot.mode);
  game.registry.set('p2', boot.p2 ?? null);
  game.registry.set('stageId', boot.stageId);
  game.registry.set('seed', boot.seed ?? null);
  game.registry.set('callbacks', boot.callbacks);
  game.registry.set('netMode', boot.netMode ?? 'sp');
  game.registry.set('matchRoom', boot.matchRoom ?? null);

  return game;
}
