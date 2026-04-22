import { Room, Client } from 'colyseus';
import { MatchState, PlayerSlot, SimStateSchema } from '@nannymud/shared';
import type { InputMsg, InputEvent } from '@nannymud/shared';
import type { InputState, SimState, GuildId } from '@nannymud/shared/simulation/types';
import { tickSimulation, makeEmptyInputState } from '@nannymud/shared/simulation/simulation';
import { createMpVsState } from '@nannymud/shared/simulation/vsSimulation';
import { generateCode } from '../util/roomCode.js';

interface CreateOpts {
  name?: string;
  rounds?: number;
  visibility?: 'public' | 'private';
}

export class MatchRoom extends Room<MatchState> {
  maxClients = 2;

  /**
   * Last-known InputState per session (the snapshot held flags at send time).
   * `coalesceInput` combines this with the buffered edge events below to
   * produce a per-tick InputState. Declared as a property so tests can
   * inspect/clear it and so multiple ticks consume the same snapshot until a
   * new message arrives.
   */
  private lastInput = new Map<string, InputState>();

  /** Edge-trigger events accumulated between ticks; consumed by coalesceInput. */
  private pendingEvents = new Map<string, InputEvent[]>();

  /** Session IDs that signalled `ready_to_start`. Cleared when the match starts. */
  private readyToStart = new Set<string>();

  /**
   * Session ID of the player who sent `rematch_offer`, or null.
   * Only valid while phase === 'results'. Cleared whenever we leave results.
   */
  private pendingRematchOffer: string | null = null;

  onCreate(opts: CreateOpts) {
    this.setState(new MatchState());
    this.state.code = generateCode();
    this.state.name = opts.name ?? 'Room';
    this.state.rounds = opts.rounds ?? 3;
    this.state.visibility = opts.visibility ?? 'private';
    this.state.createdAtMs = Date.now();
    this.roomId = this.state.code;

    this.onMessage('ready_toggle', (client: Client, msg: { ready: boolean }) => {
      const slot = this.state.players.get(client.sessionId);
      if (slot) slot.ready = msg.ready;
    });

    this.onMessage('launch_battle', (client: Client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      const slots = [...this.state.players.values()];
      if (slots.length !== 2 || !slots.every(s => s.ready)) return;
      this.state.phase = 'char_select';
      slots.forEach(s => { s.locked = false; s.guildId = ''; });
    });

    this.onMessage('lock_guild', (client: Client, msg: { guildId: string }) => {
      if (this.state.phase !== 'char_select') return;
      const slot = this.state.players.get(client.sessionId);
      if (!slot || slot.locked) return;
      slot.guildId = msg.guildId;
      slot.locked = true;
      if ([...this.state.players.values()].every(s => s.locked)) {
        this.state.phase = 'stage_select';
      }
    });

    this.onMessage('pick_stage', (client: Client, msg: { stageId: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'stage_select') return;
      this.state.stageId = msg.stageId;
      this.state.phase = 'loading';
    });

    this.onMessage('ready_to_start', (client: Client) => {
      if (this.state.phase !== 'loading') return;
      this.readyToStart.add(client.sessionId);
      if (this.readyToStart.size < 2) return;
      this.startMatch();
    });

    this.onMessage('input', (client: Client, msg: InputMsg) => {
      if (!msg || !msg.state) return;
      this.lastInput.set(client.sessionId, msg.state);
      const prior = this.pendingEvents.get(client.sessionId) ?? [];
      if (msg.events && msg.events.length > 0) {
        prior.push(...msg.events);
      }
      this.pendingEvents.set(client.sessionId, prior);
    });

    this.onMessage('rematch_offer', (client: Client) => {
      if (this.state.phase !== 'results') return;
      // Only a known slot may offer
      if (!this.state.players.has(client.sessionId)) return;
      this.pendingRematchOffer = client.sessionId;
    });

    this.onMessage('rematch_accept', (client: Client, msg: { accept: boolean }) => {
      if (this.state.phase !== 'results') return;
      if (!this.state.players.has(client.sessionId)) return;
      // Must have a pending offer from the OTHER player
      if (!this.pendingRematchOffer || this.pendingRematchOffer === client.sessionId) return;
      if (!msg.accept) return; // decline — stay in results, no state change

      // Both agree — reset for a new char_select round
      this.pendingRematchOffer = null;
      this.state.matchWinnerSessionId = '';
      this.state.stageId = '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.state as any).sim = undefined;
      for (const slot of this.state.players.values()) {
        slot.ready = false;
        slot.locked = false;
        slot.guildId = '';
      }
      this.state.phase = 'char_select';
    });
  }

  onJoin(client: Client, opts: { name?: string; playerName?: string }) {
    const slot = new PlayerSlot();
    slot.sessionId = client.sessionId;
    slot.name = opts?.playerName ?? opts?.name ?? 'Player';
    this.state.players.set(client.sessionId, slot);
    if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
  }

  onLeave(client: Client) {
    const slot = this.state.players.get(client.sessionId);
    if (slot) slot.connected = false;

    const phase = this.state.phase;

    if (phase === 'in_game') {
      // Award the win to whoever is still connected
      let winnerId = '';
      for (const [sid, s] of this.state.players) {
        if (sid !== client.sessionId && s.connected) {
          winnerId = sid;
          break;
        }
      }
      this.state.matchWinnerSessionId = winnerId;
      this.state.phase = 'results';
      // pendingRematchOffer is already null at this point (set during results only)
    } else if (phase === 'lobby' || phase === 'char_select' ||
               phase === 'stage_select' || phase === 'loading') {
      this.pendingRematchOffer = null;

      // Find any remaining connected player BEFORE removing the departing slot
      const remainingId = [...this.state.players.keys()]
        .find(sid => sid !== client.sessionId) as string | undefined;

      if (remainingId) {
        // Another player exists — remove the departing slot and reset the room
        this.state.players.delete(client.sessionId);
        const remaining = this.state.players.get(remainingId)!;
        remaining.ready = false;
        remaining.locked = false;
        remaining.guildId = '';
        // Promote to host if needed
        if (this.state.hostSessionId === client.sessionId) {
          this.state.hostSessionId = remainingId;
        }
        this.state.phase = 'lobby';
      }
      // If no remaining player, just leave the (now-disconnected) slot in place
      // so callers can inspect `connected=false`; the room will close below.
    } else if (phase === 'results') {
      // Just remove the slot; don't change phase (match is already decided)
      this.state.players.delete(client.sessionId);
      if (this.pendingRematchOffer === client.sessionId) {
        this.pendingRematchOffer = null;
      }
    }

    // If no connected slots remain, close the room
    const connectedCount = [...this.state.players.values()].filter(s => s.connected).length;
    if (connectedCount === 0) {
      try {
        this.disconnect();
      } catch {
        // Colyseus throws if disconnect() is called before the room is fully
        // initialised (e.g. in tests that don't boot the full server).
        // Safe to ignore — the room has no connected clients at this point.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Match lifecycle
  // -------------------------------------------------------------------------

  /**
   * Build the initial SimState and start ticking. Phase must be 'loading' and
   * both clients must have sent 'ready_to_start'. Host = slot 0 (player),
   * joiner = slot 1 (opponent).
   */
  private startMatch() {
    const hostSlot = this.state.players.get(this.state.hostSessionId);
    const joinerId = this.getJoinerId();
    const joinerSlot = joinerId ? this.state.players.get(joinerId) : undefined;
    if (!hostSlot || !joinerSlot) return;
    if (!hostSlot.guildId || !joinerSlot.guildId) return;

    // Seed is chosen once here (before the tick loop) so determinism is
    // preserved inside the match. Clients never produce a seed.
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.state.seed = seed;

    const sim = createMpVsState(
      hostSlot.guildId as GuildId,
      joinerSlot.guildId as GuildId,
      seed,
      this.state.stageId,
    );

    // Copy the plain SimState into a SimStateSchema instance so Colyseus
    // tracks mutations over the wire. ActorSchema / SimStateSchema are
    // structurally assignable to Actor / SimState (see structural.test.ts),
    // so the simulation code continues to operate on schema instances
    // without casts inside the tick loop.
    this.state.sim = simToSchema(sim);

    this.state.phase = 'in_game';

    this.setSimulationInterval((dt) => this.tick(dt), 1000 / 60);
    this.setPatchRate(50); // ~20Hz wire rate
  }

  /** Returns the session ID of the non-host player, or '' if none. */
  private getJoinerId(): string {
    for (const [sessionId] of this.state.players) {
      if (sessionId !== this.state.hostSessionId) return sessionId;
    }
    return '';
  }

  // -------------------------------------------------------------------------
  // Input coalescing
  // -------------------------------------------------------------------------

  /**
   * Produce a fresh InputState for `sessionId` by layering any pending
   * edge events on top of the latest snapshot. Consumes pendingEvents
   * (edges are one-shot, like `attackJustPressed`).
   */
  private coalesceInput(sessionId: string): InputState {
    const snapshot = this.lastInput.get(sessionId);
    const events = this.pendingEvents.get(sessionId) ?? [];
    // Clear the buffer unconditionally — next tick starts fresh.
    this.pendingEvents.set(sessionId, []);

    // Base on the snapshot's held-keys but rebuild a fresh object so we can
    // recompute edge flags from the buffered events for THIS tick.
    const base: InputState = snapshot ? { ...snapshot } : makeEmptyInputState();
    // Reset edges — they are tick-scoped; only buffered events can set them.
    base.leftJustPressed = false;
    base.rightJustPressed = false;
    base.jumpJustPressed = false;
    base.attackJustPressed = false;
    base.blockJustPressed = false;
    base.grabJustPressed = false;
    base.pauseJustPressed = false;
    base.fullscreenToggleJustPressed = false;

    for (const ev of events) {
      switch (ev.type) {
        case 'attackDown':
          base.attackJustPressed = true;
          base.attack = true;
          break;
        case 'attackUp':
          base.attack = false;
          break;
        case 'jumpDown':
          base.jumpJustPressed = true;
          base.jump = true;
          break;
        case 'blockDown':
          base.blockJustPressed = true;
          base.block = true;
          break;
        case 'grabDown':
          base.grabJustPressed = true;
          base.grab = true;
          break;
        case 'abilityDown':
          // `key` is the slot number ('1'..'5' or 'rmb'). Map to testAbilitySlot.
          if (ev.key === 'rmb') {
            base.testAbilitySlot = 6;
          } else {
            const slot = Number(ev.key);
            if (Number.isFinite(slot) && slot >= 1 && slot <= 5) {
              base.testAbilitySlot = slot;
            }
          }
          break;
      }
    }

    return base;
  }

  /**
   * One simulation tick. Public so tests can drive the room synchronously
   * without relying on Colyseus's setSimulationInterval timer.
   */
  tick(dtMs: number) {
    if (!this.state.sim) return;
    if (this.state.phase !== 'in_game') return;
    const p1 = this.coalesceInput(this.state.hostSessionId);
    const joinerId = this.getJoinerId();
    const p2 = joinerId ? this.coalesceInput(joinerId) : makeEmptyInputState();
    tickSimulation(this.state.sim as unknown as SimState, p1, dtMs, p2);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shallow-copy a plain SimState produced by createMpVsState into a fresh
 * SimStateSchema instance. Only the top-level fields and the two named
 * actors (player, opponent) are required at match-start — arrays of enemies
 * / projectiles / pickups / effects start empty in VS mode.
 *
 * We keep this helper local to MatchRoom to avoid leaking schema classes into
 * the pure simulation layer.
 */
function simToSchema(plain: SimState): SimStateSchema {
  const s = new SimStateSchema();

  s.tick = plain.tick;
  s.timeMs = plain.timeMs;
  s.currentWave = plain.currentWave;
  s.cameraX = plain.cameraX;
  s.cameraLocked = plain.cameraLocked;
  s.phase = plain.phase;
  s.bossSpawned = plain.bossSpawned;
  s.score = plain.score;
  s.rngSeed = plain.rngSeed;
  s.rng = plain.rng;
  s.nextActorId = plain.nextActorId;
  s.nextProjectileId = plain.nextProjectileId;
  s.nextPickupId = plain.nextPickupId;
  s.nextEffectId = plain.nextEffectId;
  s.bloodtallyDecayMs = plain.bloodtallyDecayMs;
  s.mode = plain.mode;
  s.nextLogId = plain.nextLogId;
  s.controllers = plain.controllers;

  // Top-level referenced actors: assign the plain Actor objects through the
  // structural-typing escape hatch. Colyseus Schema will box them on write
  // via their @type decorators; for VS mode we only need enough shape to run
  // the tick — wire-sync granularity is a follow-up concern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).player = plain.player;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).opponent = plain.opponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).round = plain.round;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).enemies = plain.enemies;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).allies = plain.allies;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).pickups = plain.pickups;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).projectiles = plain.projectiles;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).vfxEvents = plain.vfxEvents;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).waves = plain.waves;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (s as any).combatLog = plain.combatLog;

  return s;
}
