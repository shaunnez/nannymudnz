import Phaser from 'phaser';
import type { GuildId, SimState } from '../../simulation/types';
import {
  createInitialState,
  tickSimulation,
  resetController,
} from '../../simulation/simulation';
import { PhaserInputAdapter } from '../input/PhaserInputAdapter';
import { BackgroundView } from '../view/BackgroundView';
import type { GameCallbacks } from '../PhaserGame';

export class GameplayScene extends Phaser.Scene {
  private simState!: SimState;
  private inputAdapter!: PhaserInputAdapter;
  private callbacks!: GameCallbacks;
  private background!: BackgroundView;
  private debugText?: Phaser.GameObjects.Text;
  private phaseHandoffFired = false;

  constructor() {
    super({ key: 'Gameplay' });
  }

  create(): void {
    const guildId = this.game.registry.get('guildId') as GuildId;
    this.callbacks = this.game.registry.get('callbacks') as GameCallbacks;

    const seed = Date.now();
    this.simState = createInitialState(guildId, seed);
    this.inputAdapter = new PhaserInputAdapter(this);
    this.phaseHandoffFired = false;

    resetController(this.simState, 'player');

    this.background = new BackgroundView(this);

    this.scene.launch('Hud');

    this.debugText = this.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffff88',
        backgroundColor: '#000000a0',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(10000);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    if (this.phaseHandoffFired) return;

    const dtMs = Math.min(50, delta);
    const nowMs = this.simState.timeMs + dtMs;
    const inputState = this.inputAdapter.getInputState(nowMs);

    const prevPhase = this.simState.phase;
    this.simState = tickSimulation(this.simState, inputState, dtMs);
    this.inputAdapter.clearJustPressed();

    this.cameras.main.scrollX = this.simState.cameraX;
    this.background.update(this.simState.cameraX);

    if (this.debugText) {
      const p = this.simState.player;
      this.debugText.setText([
        `phase: ${this.simState.phase}`,
        `wave:  ${this.simState.currentWave + 1}/${this.simState.waves.length}`,
        `score: ${this.simState.score}`,
        `hp/mp: ${Math.round(p.hp)}/${Math.round(p.mp)}`,
        `x/y/z: ${Math.round(p.x)}/${Math.round(p.y)}/${Math.round(p.z)}`,
      ].join('\n'));
    }

    if (prevPhase === 'playing') {
      if (this.simState.phase === 'victory') {
        this.phaseHandoffFired = true;
        const score = this.simState.score;
        this.time.delayedCall(1500, () => this.callbacks.onVictory(score));
        return;
      }
      if (this.simState.phase === 'defeat') {
        this.phaseHandoffFired = true;
        this.time.delayedCall(1500, () => this.callbacks.onDefeat());
        return;
      }
    }
  }

  private onShutdown = (): void => {
    if (this.simState) resetController(this.simState, 'player');
    if (this.inputAdapter) this.inputAdapter.dispose();
    if (this.background) this.background.destroy();
    this.debugText?.destroy();
    this.debugText = undefined;
  };
}
