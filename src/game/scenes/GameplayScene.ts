import Phaser from 'phaser';
import type { Room } from '@colyseus/sdk';
import type { GuildId, SimState } from '@nannymud/shared/simulation/types';
import type { MatchState } from '@nannymud/shared';
import {
  createInitialState,
  tickSimulation,
  resetController,
  forcePause,
  forceResume,
} from '@nannymud/shared/simulation/simulation';
import { createVsState } from '@nannymud/shared/simulation/vsSimulation';
import { FULLSCREEN_EXIT_EVENT } from '../../layout/fullscreenConstants';
import { PhaserInputAdapter } from '../input/PhaserInputAdapter';
import { BackgroundView } from '../view/BackgroundView';
import { ActorView } from '../view/ActorView';
import { ProjectileView } from '../view/ProjectileView';
import { PickupView } from '../view/PickupView';
import { consumeVfxEvents } from '../view/ParticleFX';
import type { Actor, Projectile, Pickup, InputState } from '@nannymud/shared/simulation/types';
import { WORLD_WIDTH } from '@nannymud/shared/simulation/constants';
import type { GameCallbacks, NetMode } from '../PhaserGame';
import { InputSender } from '../net/InputSender';
import { StateSync, type ActorSnapshot } from '../net/StateSync';
import { AudioManager } from '../../audio/audioManager';
import {
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  HUD_TOP_PX,
  HUD_BOTTOM_PX,
  SCREEN_Y_BAND_KEY,
  SCREEN_Y_BAND_STORY,
  SCREEN_Y_BAND_VS,
} from '../constants';

/** Client-side render delay for two-snapshot linear interpolation (ms). */
const MP_INTERP_DELAY_MS = 50;

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

  // MP-only net state
  private netMode: NetMode = 'sp';
  private room: Room<MatchState> | null = null;
  private inputSender: InputSender | null = null;
  private stateSync: StateSync | null = null;
  private onMpStateChange: (() => void) | null = null;
  /**
   * Per-client camera. In MP, `sim.cameraX` tracks whichever actor the server
   * calls `state.player` (always the host), so reading it on the joiner would
   * lock the camera to the host. We run the same lerp/clamp locally against
   * whichever actor belongs to this session.
   */
  private localCameraX = 0;
  private localCameraInitialized = false;

  private onFullscreenExit = (): void => {
    if (!this.simState || this.netMode === 'mp') return;
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
    const mode = (this.game.registry.get('mode') as 'story' | 'vs' | 'mp' | null) ?? 'story';
    const p2 = this.game.registry.get('p2') as GuildId | null;
    const stageId = (this.game.registry.get('stageId') as string | null) ?? 'assembly';
    const seedOverride = this.game.registry.get('seed') as number | null;
    this.callbacks = this.game.registry.get('callbacks') as GameCallbacks;
    this.netMode = (this.game.registry.get('netMode') as NetMode | null) ?? 'sp';
    this.room = this.game.registry.get('matchRoom') as Room<MatchState> | null;

    const seed = seedOverride ?? Date.now();
    if (this.netMode === 'mp') {
      if (!this.room) throw new Error('MP mode requires matchRoom in registry');
      const sim = this.room.state.sim;
      if (!sim) throw new Error('MP mode requires room.state.sim to be populated');
      // ActorSchema/SimStateSchema implement the Actor/SimState shapes structurally,
      // so a direct alias lets the existing render path work unchanged.
      this.simState = sim as unknown as SimState;
      this.inputSender = new InputSender(this.room);
      this.stateSync = new StateSync();

      // onStateChange fires on every server tick. Two jobs:
      //  1) push a position snapshot into StateSync for per-frame interp;
      //  2) consume vfxEvents here (not in update()) so particle/audio effects
      //     fire once per server tick rather than once per render frame.
      this.onMpStateChange = () => {
        if (!this.room || !this.stateSync) return;
        const s = this.room.state.sim;
        if (!s) return;
        const sAsSim = s as unknown as SimState;
        this.stateSync.onSnapshot({
          tMs: performance.now(),
          actors: collectActorSnapshots(sAsSim),
        });
        if (sAsSim.vfxEvents && sAsSim.vfxEvents.length > 0) {
          consumeVfxEvents(this, sAsSim.vfxEvents);
        }
      };
      this.room.onStateChange(this.onMpStateChange);
    } else if (mode === 'vs') {
      if (!p2) throw new Error('VS mode requires a p2 guild');
      const difficulty = (this.game.registry.get('difficulty') as number | null) ?? 2;
      this.simState = createVsState(guildId, p2, stageId, seed, false, difficulty);
    } else {
      this.simState = createInitialState(guildId, seed);
    }
    this.inputAdapter = new PhaserInputAdapter(this);
    this.phaseHandoffFired = false;
    this.localCameraInitialized = false;

    if (this.netMode !== 'mp') {
      resetController(this.simState, 'player');
    }

    this.audio = new AudioManager();
    this.bossMusicStarted = false;
    this.audio.startStageMusic();

    if (mode === 'story') {
      this.background = new BackgroundView(this);
      this.scene.launch('Hud');
      this.game.registry.set(SCREEN_Y_BAND_KEY, SCREEN_Y_BAND_STORY);
    } else {
      // VS / MP: React HUD overlays the canvas; shrink camera viewport to the
      // un-covered band. The camera's local (0,0) is the top of the visible
      // strip, so the sprite projection band is relative to that strip, not
      // the full canvas — publish SCREEN_Y_BAND_VS so views project correctly.
      const vsViewportHeight = VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX;
      this.background = new BackgroundView(this, vsViewportHeight);
      this.cameras.main.setViewport(0, HUD_TOP_PX, VIRTUAL_WIDTH, vsViewportHeight);
      this.game.registry.set(SCREEN_Y_BAND_KEY, SCREEN_Y_BAND_VS);
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

    // Pause/resume/restart only apply in SP. MP pause is server-authoritative
    // and is not wired in F1.
    if (this.netMode !== 'mp') {
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
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    if (this.phaseHandoffFired) return;
    if (this.netMode === 'mp') {
      this.updateMp(delta);
      return;
    }
    this.updateSp(delta);
  }

  private updateSp(delta: number): void {
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
    this.reconcileActors(null);
    this.reconcileProjectiles();
    this.reconcilePickups();
    consumeVfxEvents(this, this.simState.vfxEvents);
    this.game.registry.set('simState', this.simState);
    if (this.simState.mode === 'vs') {
      this.events.emit('sim-tick', this.simState);
      this.game.events.emit('sim-tick', this.simState);
    }

    this.updateDebugText();

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

  private updateMp(delta: number): void {
    if (!this.room || !this.inputSender || !this.stateSync) return;
    const sim = this.room.state.sim as unknown as SimState | undefined;
    if (!sim) return;
    this.simState = sim;

    // Local input capture + diff-based event emission. Server owns the sim.
    const dtMs = Math.min(50, delta);
    const nowMs = performance.now();
    const inputState = this.inputAdapter.getInputState(sim.timeMs + dtMs);

    if (inputState.fullscreenToggleJustPressed) {
      this.callbacks.toggleFullscreen();
    }

    this.inputSender.update(inputState, nowMs);
    this.inputSender.send(inputState);
    this.inputAdapter.clearJustPressed();

    // Sample interpolated positions 50ms behind real time so the two-snapshot
    // buffer always has something to lerp between.
    const sampled = this.stateSync.sample(nowMs - MP_INTERP_DELAY_MS);
    const interp = new Map<string, ActorSnapshot>();
    for (const s of sampled) interp.set(s.id, s);

    const localCamX = this.computeLocalCameraX(sim, interp);
    this.cameras.main.scrollX = localCamX;
    this.background.update(localCamX);
    this.reconcileActors(interp);
    this.reconcileProjectiles();
    this.reconcilePickups();
    // VFX consumption moved to onMpStateChange so it fires per server tick,
    // not per render frame — otherwise the same hit_spark would replay until
    // the next state sync arrived.
    this.game.registry.set('simState', sim);
    this.events.emit('sim-tick', sim);
    this.game.events.emit('sim-tick', sim);

    this.updateDebugText();

    // Victory/defeat is driven by match phase, not sim phase. App.tsx owns
    // the screen transition via PHASE_TO_SCREEN; we just stop updating.
    if (this.room.state.phase === 'results') {
      this.phaseHandoffFired = true;
      this.audio.stopMusic();
    }
  }

  /**
   * MP camera tracks whichever actor belongs to this client (host → player,
   * joiner → opponent). Mirrors the server's lerp/clamp in physics.ts so
   * movement feels consistent. Prefers interpolated x when available so the
   * camera rides the smoothed position, not the 50ms-late raw server x.
   */
  private computeLocalCameraX(sim: SimState, interp: Map<string, ActorSnapshot>): number {
    if (!this.room) return this.localCameraX;
    const isHost = this.room.sessionId === this.room.state.hostSessionId;
    const localActor: Actor | null = isHost ? sim.player : (sim.opponent ?? null);
    if (!localActor) return this.localCameraX;

    const lx = interp.get(localActor.id)?.x ?? localActor.x;
    const targetCamX = lx - 300;
    if (!this.localCameraInitialized) {
      this.localCameraX = targetCamX;
      this.localCameraInitialized = true;
    } else {
      this.localCameraX += (targetCamX - this.localCameraX) * 0.08;
    }
    this.localCameraX = Math.max(0, Math.min(WORLD_WIDTH - 900, this.localCameraX));
    return this.localCameraX;
  }

  private updateDebugText(): void {
    if (!this.debugText) return;
    const p = this.simState.player;
    this.debugText.setText([
      `phase: ${this.simState.phase}`,
      this.netMode === 'mp' ? `match: ${this.room?.state.phase ?? '?'}` : `wave:  ${this.simState.currentWave + 1}/${this.simState.waves.length}`,
      `score: ${this.simState.score}`,
      `hp/mp: ${Math.round(p.hp)}/${Math.round(p.mp)}`,
      `x/y/z: ${Math.round(p.x)}/${Math.round(p.y)}/${Math.round(p.z)}`,
    ].join('\n'));
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

  private reconcileActors(interp: Map<string, ActorSnapshot> | null): void {
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
      const snap = interp?.get(actor.id);
      // In MP, override transform fields with the interpolated sample so
      // motion stays smooth between 20Hz server snapshots. Everything else
      // (hp, animationId, facing, status) reads live from the schema.
      // Clone via spread rather than mutating the schema object.
      if (snap) {
        view.syncFrom({ ...actor, x: snap.x, y: snap.y, z: snap.z } as Actor);
      } else {
        view.syncFrom(actor);
      }
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
    if (this.simState && this.netMode !== 'mp') resetController(this.simState, 'player');
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
    if (this.room && this.onMpStateChange) {
      this.room.onStateChange.remove(this.onMpStateChange);
    }
    this.onMpStateChange = null;
    this.room = null;
    this.inputSender = null;
    this.stateSync = null;
  };
}

function collectActorSnapshots(sim: SimState): ActorSnapshot[] {
  const out: ActorSnapshot[] = [];
  const push = (a: Actor): void => {
    out.push({ id: a.id, x: a.x, y: a.y, z: a.z, facing: a.facing });
  };
  push(sim.player);
  for (const a of sim.allies) push(a);
  for (const a of sim.enemies) push(a);
  return out;
}
