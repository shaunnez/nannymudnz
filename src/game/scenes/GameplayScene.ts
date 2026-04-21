import Phaser from 'phaser';
import type { GuildId, SimState } from '../../simulation/types';
import {
  createInitialState,
  tickSimulation,
  resetController,
  forcePause,
} from '../../simulation/simulation';
import { FULLSCREEN_EXIT_EVENT } from '../../layout/fullscreenConstants';
import { PhaserInputAdapter } from '../input/PhaserInputAdapter';
import { BackgroundView } from '../view/BackgroundView';
import { ActorView } from '../view/ActorView';
import { ProjectileView } from '../view/ProjectileView';
import { PickupView } from '../view/PickupView';
import { consumeVfxEvents } from '../view/ParticleFX';
import type { Actor, Projectile, Pickup, InputState } from '../../simulation/types';
import type { GameCallbacks } from '../PhaserGame';
import { AudioManager } from '../../audio/audioManager';

export class GameplayScene extends Phaser.Scene {
  private simState!: SimState;
  private inputAdapter!: PhaserInputAdapter;
  private callbacks!: GameCallbacks;
  private background!: BackgroundView;
  private actorViews = new Map<string, ActorView>();
  private projectileViews = new Map<string, ProjectileView>();
  private pickupViews = new Map<string, PickupView>();
  private debugText?: Phaser.GameObjects.Text;
  private phaseHandoffFired = false;
  private audio!: AudioManager;
  private bossMusicStarted = false;
  private onFullscreenExit = (): void => {
    if (this.simState) this.simState = forcePause(this.simState);
  };

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

    this.audio = new AudioManager();
    this.bossMusicStarted = false;
    this.audio.startStageMusic();

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

    window.addEventListener(FULLSCREEN_EXIT_EVENT, this.onFullscreenExit);

    this.events.on('pause-requested', () => {
      if (this.simState) this.simState = forcePause(this.simState);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    if (this.phaseHandoffFired) return;

    const dtMs = Math.min(50, delta);
    const nowMs = this.simState.timeMs + dtMs;
    const inputState = this.inputAdapter.getInputState(nowMs);

    if (inputState.fullscreenToggleJustPressed) {
      this.callbacks.toggleFullscreen();
    }

    const prevPhase = this.simState.phase;
    this.simState = tickSimulation(this.simState, inputState, dtMs);
    this.inputAdapter.clearJustPressed();

    this.dispatchAudio(prevPhase, inputState);

    this.cameras.main.scrollX = this.simState.cameraX;
    this.background.update(this.simState.cameraX);
    this.reconcileActors();
    this.reconcileProjectiles();
    this.reconcilePickups();
    consumeVfxEvents(this, this.simState.vfxEvents);
    this.game.registry.set('simState', this.simState);

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
        this.audio.stopMusic();
        this.audio.playVictory();
        this.time.delayedCall(1500, () => this.callbacks.onVictory(score));
        return;
      }
      if (this.simState.phase === 'defeat') {
        this.phaseHandoffFired = true;
        this.audio.stopMusic();
        this.audio.playDefeat();
        this.time.delayedCall(1500, () => this.callbacks.onDefeat());
        return;
      }
    }
  }

  private dispatchAudio(prevPhase: SimState['phase'], inputState: InputState): void {
    const state = this.simState;

    if (!this.bossMusicStarted && state.bossSpawned) {
      this.bossMusicStarted = true;
      this.audio.startBossMusic();
    }

    const vfx = state.vfxEvents;
    if (vfx.some(e => e.type === 'hit_spark')) this.audio.playAttack();
    if (vfx.some(e => e.type === 'heal_glow')) this.audio.playHeal();
    if (state.player.state === 'blocking') this.audio.playBlock();
    if (
      state.player.state === 'jumping' &&
      state.player.z < 10 &&
      inputState.jumpJustPressed
    ) {
      this.audio.playJump();
    }

    // Suppress unused-warning when future use arrives.
    void prevPhase;
  }

  private reconcileActors(): void {
    const live: Actor[] = [
      this.simState.player,
      ...this.simState.allies,
      ...this.simState.enemies,
    ];
    const seen = new Set<string>();

    for (const actor of live) {
      seen.add(actor.id);
      let view = this.actorViews.get(actor.id);
      if (!view) {
        view = new ActorView(this, actor);
        this.actorViews.set(actor.id, view);
      }
      view.syncFrom(actor);
    }

    for (const [id, view] of this.actorViews) {
      if (!seen.has(id)) {
        view.destroy();
        this.actorViews.delete(id);
      }
    }
  }

  private reconcileProjectiles(): void {
    const live: Projectile[] = this.simState.projectiles;
    const seen = new Set<string>();
    for (const proj of live) {
      seen.add(proj.id);
      let view = this.projectileViews.get(proj.id);
      if (!view) {
        view = new ProjectileView(this, proj);
        this.projectileViews.set(proj.id, view);
      }
      view.syncFrom(proj);
    }
    for (const [id, view] of this.projectileViews) {
      if (!seen.has(id)) {
        view.destroy();
        this.projectileViews.delete(id);
      }
    }
  }

  private reconcilePickups(): void {
    const live: Pickup[] = this.simState.pickups;
    const seen = new Set<string>();
    for (const pickup of live) {
      seen.add(pickup.id);
      let view = this.pickupViews.get(pickup.id);
      if (!view) {
        view = new PickupView(this, pickup);
        this.pickupViews.set(pickup.id, view);
      }
      view.syncFrom(pickup);
    }
    for (const [id, view] of this.pickupViews) {
      if (!seen.has(id)) {
        view.destroy();
        this.pickupViews.delete(id);
      }
    }
  }

  private onShutdown = (): void => {
    if (this.simState) resetController(this.simState, 'player');
    if (this.inputAdapter) this.inputAdapter.dispose();
    if (this.background) this.background.destroy();
    for (const view of this.actorViews.values()) view.destroy();
    this.actorViews.clear();
    for (const view of this.projectileViews.values()) view.destroy();
    this.projectileViews.clear();
    for (const view of this.pickupViews.values()) view.destroy();
    this.pickupViews.clear();
    this.debugText?.destroy();
    this.debugText = undefined;
    if (this.audio) this.audio.dispose();
    window.removeEventListener(FULLSCREEN_EXIT_EVENT, this.onFullscreenExit);
  };
}
