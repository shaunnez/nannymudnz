import Phaser from 'phaser';
import type { GuildId, SimState } from '../../simulation/types';
import {
  createInitialState,
  tickSimulation,
  resetController,
  forcePause,
  forceResume,
} from '../../simulation/simulation';
import { createVsState } from '../../simulation/vsSimulation';
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
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH, HUD_TOP_PX, HUD_BOTTOM_PX } from '../constants';

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
    if (!this.simState) return;
    const prev = this.simState.phase;
    this.simState = forcePause(this.simState);
    if (prev !== this.simState.phase) {
      this.game.events.emit('phase-change', this.simState.phase);
    }
  };

  constructor() {
    super({ key: 'Gameplay' });
  }

  create(): void {
    const guildId = this.game.registry.get('guildId') as GuildId;
    const mode = (this.game.registry.get('mode') as 'story' | 'vs' | null) ?? 'story';
    const p2 = this.game.registry.get('p2') as GuildId | null;
    const stageId = (this.game.registry.get('stageId') as string | null) ?? 'assembly';
    const seedOverride = this.game.registry.get('seed') as number | null;
    this.callbacks = this.game.registry.get('callbacks') as GameCallbacks;

    const seed = seedOverride ?? Date.now();
    if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      this.simState = createVsState(guildId, p2, stageId, seed);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
    this.inputAdapter = new PhaserInputAdapter(this);
    this.phaseHandoffFired = false;

    resetController(this.simState, 'player');

    this.audio = new AudioManager();
    this.bossMusicStarted = false;
    this.audio.startStageMusic();

    this.background = new BackgroundView(this);

    if (mode === 'story') {
      this.scene.launch('Hud');
    } else {
      // VS: React HUD overlays the canvas; shrink camera viewport to the un-covered band.
      this.cameras.main.setViewport(
        0,
        HUD_TOP_PX,
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX,
      );
    }

    if (import.meta.env.DEV) {
      this.debugText = this.add
        .text(12, VIRTUAL_HEIGHT - 80, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffff88',
          backgroundColor: '#000000a0',
          padding: { x: 4, y: 2 },
        })
        .setScrollFactor(0)
        .setDepth(10000);
    }

    window.addEventListener(FULLSCREEN_EXIT_EVENT, this.onFullscreenExit);

    this.events.on('pause-requested', () => {
      if (!this.simState) return;
      const prev = this.simState.phase;
      this.simState = forcePause(this.simState);
      if (prev !== this.simState.phase) {
        this.game.events.emit('phase-change', this.simState.phase);
      }
    });
    this.events.on('resume-requested', () => {
      if (!this.simState) return;
      const prev = this.simState.phase;
      this.simState = forceResume(this.simState);
      if (prev !== this.simState.phase) {
        this.game.events.emit('phase-change', this.simState.phase);
      }
    });
    this.events.on('restart-requested', () => {
      const currentGuild = this.game.registry.get('guildId') as GuildId;
      resetController(this.simState, 'player');
      this.simState = createInitialState(currentGuild, Date.now());
      resetController(this.simState, 'player');
      this.phaseHandoffFired = false;
      this.bossMusicStarted = false;
      this.audio.stopMusic();
      this.audio.startStageMusic();
      this.game.events.emit('phase-change', this.simState.phase);
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

    if (prevPhase !== this.simState.phase) {
      this.game.events.emit('phase-change', this.simState.phase);
    }

    this.dispatchAudio(prevPhase, inputState);

    this.cameras.main.scrollX = this.simState.cameraX;
    this.background.update(this.simState.cameraX);
    this.reconcileActors();
    this.reconcileProjectiles();
    this.reconcilePickups();
    consumeVfxEvents(this, this.simState.vfxEvents);
    this.game.registry.set('simState', this.simState);
    if (this.simState.mode === 'vs') {
      this.events.emit('sim-tick', this.simState);
    }

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
