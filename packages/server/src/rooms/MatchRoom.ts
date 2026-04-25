import { Room, Client } from 'colyseus';
import { MatchState, PlayerSlot, BattleSlotSchema } from '@nannymud/shared';
import type { InputMsg, InputEvent } from '@nannymud/shared';
import type { InputState, SimState, GuildId, BattleTeam } from '@nannymud/shared/simulation/types';
import { tickSimulation, makeEmptyInputState } from '@nannymud/shared/simulation/simulation';
import { createMpVsState } from '@nannymud/shared/simulation/vsSimulation';
import { createMpBattleState } from '@nannymud/shared/simulation/battleSimulation';
import { generateCode } from '../util/roomCode.js';
import { createSimSchema, mirrorSimToSchema } from './simMirror.js';

interface CreateOpts {
  name?: string;
  rounds?: number;
  visibility?: 'public' | 'private';
  gameMode?: 'versus' | 'battle';
  uniqueGuilds?: boolean;
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
   * Authoritative simulation state. Kept as a plain object so the simulation
   * can mutate it freely (push to arrays, assign fields). We mirror the
   * relevant parts into `this.state.sim` each tick for wire-sync — schema v4
   * enforces instanceof setters at runtime, so we can't feed plain objects
   * to the schema directly.
   */
  private plainSim: SimState | null = null;

  /** Maps actor ID → session ID for MP Battle multi-input routing. Built in startMatch. */
  private actorToSession = new Map<string, string>();

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
    this.state.gameMode = opts.gameMode ?? 'versus';
    this.state.uniqueGuilds = opts.uniqueGuilds ?? false;
    this.maxClients = this.state.gameMode === 'battle' ? 8 : 2;
    this.roomId = this.state.code;
    console.log(`[MatchRoom] created code=${this.state.code} name="${this.state.name}" rounds=${this.state.rounds}`);
    void this.setMetadata({
      name: this.state.name,
      rounds: this.state.rounds,
      visibility: this.state.visibility,
      hostName: '',
      gameMode: this.state.gameMode,
    });

    this.onMessage('ready_toggle', (client: Client, msg: { ready: boolean }) => {
      const slot = this.state.players.get(client.sessionId);
      if (slot) slot.ready = msg.ready;
    });

    this.onMessage('chat', (client: Client, msg: { text: string }) => {
      const slot = this.state.players.get(client.sessionId);
      if (!slot) return;
      const text = String(msg.text ?? '').slice(0, 200).trim();
      if (!text) return;
      this.broadcast('chat', { name: slot.name, text });
    });

    this.onMessage('kick', (client: Client, msg: { sessionId: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'lobby') return;
      const target = this.clients.find((c) => c.sessionId === msg.sessionId);
      target?.leave(4000, 'kicked');
    });

    this.onMessage('launch_battle', (client: Client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      const slots = [...this.state.players.values()];
      const allReady = slots.length >= 2 && slots.every(s => s.ready);
      if (!allReady) return;

      if (this.state.gameMode === 'battle') {
        this.state.battleSlots.clear();
        const connectedSessions = [...this.state.players.keys()];
        for (let i = 0; i < 8; i++) {
          const slot = new BattleSlotSchema();
          if (i < connectedSessions.length) {
            slot.slotType = 'human';
            slot.ownerSessionId = connectedSessions[i];
          } else {
            slot.slotType = 'off';
          }
          this.state.battleSlots.push(slot);
        }
        this.state.phase = 'battle_config';
      } else {
        if (slots.length !== 2) return;
        this.state.phase = 'char_select';
        slots.forEach(s => { s.locked = false; s.guildId = ''; });
      }
    });

    this.onMessage('set_battle_slot', (client: Client, msg: { index: number; slotType: 'human' | 'cpu' | 'off'; guildId: string; team: string }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'battle_config') return;
      const slot = this.state.battleSlots[msg.index];
      if (!slot) return;
      if (slot.ownerSessionId) return; // cannot overwrite a claimed human slot
      if (this.state.uniqueGuilds && msg.guildId) {
        const taken = [...this.state.battleSlots].some(
          (s, i) => i !== msg.index && s.slotType !== 'off' && s.guildId === msg.guildId,
        );
        if (taken) return;
      }
      slot.slotType = msg.slotType;
      slot.guildId = msg.guildId;
      slot.team = msg.team;
      slot.locked = false; // changing content resets lock
      if (msg.slotType !== 'human') slot.ownerSessionId = '';
    });

    this.onMessage('set_my_guild', (client: Client, msg: { guildId: string }) => {
      if (this.state.phase !== 'battle_config') return;
      const slot = [...this.state.battleSlots].find(s => s.ownerSessionId === client.sessionId);
      if (!slot) return;
      if (this.state.uniqueGuilds && msg.guildId) {
        const taken = [...this.state.battleSlots].some(
          s => s !== slot && s.slotType !== 'off' && s.guildId === msg.guildId,
        );
        if (taken) return;
      }
      slot.guildId = msg.guildId;
      slot.locked = false; // changing guild resets lock
    });

    this.onMessage('lock_battle_slot', (client: Client, msg: { index: number }) => {
      if (this.state.phase !== 'battle_config') return;
      const slot = this.state.battleSlots[msg.index];
      if (!slot || slot.slotType === 'off') return;
      if (!slot.guildId) return; // must have a guild before locking
      // Human slot: only the owner can lock it
      if (slot.slotType === 'human' && slot.ownerSessionId !== client.sessionId) return;
      // CPU slot: only the host can lock it
      if (slot.slotType === 'cpu' && client.sessionId !== this.state.hostSessionId) return;
      slot.locked = !slot.locked; // toggle
    });

    this.onMessage('launch_from_config', (client: Client) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'battle_config') return;
      const activeSlots = [...this.state.battleSlots].filter(s => s.slotType !== 'off');
      if (activeSlots.length < 2) return;
      if (!activeSlots.every(s => s.locked)) return; // all active slots must be locked
      // Copy guildId into PlayerSlot so existing MP results screen can read each player's guild
      for (const bSlot of this.state.battleSlots) {
        if (bSlot.slotType === 'human' && bSlot.ownerSessionId) {
          const ps = this.state.players.get(bSlot.ownerSessionId);
          if (ps) ps.guildId = bSlot.guildId;
        }
      }
      this.state.phase = 'stage_select';
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

    this.onMessage('hover_stage', (client: Client, msg: { idx: number }) => {
      if (client.sessionId !== this.state.hostSessionId) return;
      if (this.state.phase !== 'stage_select') return;
      this.state.hoveredStageIdx = Math.max(0, Math.min(8, msg.idx));
    });

    this.onMessage('ready_to_start', (client: Client) => {
      if (this.state.phase !== 'loading') return;
      this.readyToStart.add(client.sessionId);
      const requiredCount = this.state.gameMode === 'battle'
        ? [...this.state.battleSlots].filter(s => s.slotType === 'human').length
        : 2;
      if (this.readyToStart.size < requiredCount) return;
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
      this.state.hoveredStageIdx = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.state as any).sim = undefined;
      this.plainSim = null;
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
    const isFirstJoin = !this.state.hostSessionId;
    if (isFirstJoin) this.state.hostSessionId = client.sessionId;
    const isHost = this.state.hostSessionId === client.sessionId;
    console.log(`[MatchRoom ${this.state.code}] join sid=${client.sessionId} name="${slot.name}" host=${isHost} (${this.state.players.size}/${this.maxClients})`);
    if (isFirstJoin) {
      void this.setMetadata({
        name: this.state.name,
        rounds: this.state.rounds,
        visibility: this.state.visibility,
        hostName: slot.name,
      });
    }
  }

  onLeave(client: Client) {
    const slot = this.state.players.get(client.sessionId);
    if (slot) slot.connected = false;

    const phase = this.state.phase;
    console.log(`[MatchRoom ${this.state.code}] leave sid=${client.sessionId} phase=${phase}`);

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
    } else if (phase === 'battle_config') {
      // Flip the departing player's battle slot to off
      for (const bSlot of this.state.battleSlots) {
        if (bSlot.ownerSessionId === client.sessionId) {
          bSlot.slotType = 'off';
          bSlot.ownerSessionId = '';
          bSlot.guildId = '';
          break;
        }
      }
      this.state.players.delete(client.sessionId);
      // Promote host if needed
      if (this.state.hostSessionId === client.sessionId) {
        const next = [...this.state.players.keys()][0];
        if (next) this.state.hostSessionId = next;
      }
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
    // Seed is chosen once here (before the tick loop) so determinism is
    // preserved inside the match. Clients never produce a seed.
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.state.seed = seed;

    if (this.state.gameMode === 'battle') {
      const slots = [...this.state.battleSlots].map(s => ({
        guildId: (s.guildId || 'adventurer') as GuildId,
        type: s.slotType as 'human' | 'cpu' | 'off',
        team: (s.team as BattleTeam) || null,
      }));
      const { state: sim, actorIdBySlotIndex } = createMpBattleState(slots, this.state.stageId, seed);
      this.plainSim = sim;
      this.state.sim = createSimSchema(this.plainSim);

      // Build reverse map: actorId → ownerSessionId for input routing
      this.actorToSession.clear();
      for (const [slotIdx, actorId] of Object.entries(actorIdBySlotIndex)) {
        const bSlot = this.state.battleSlots[Number(slotIdx)];
        if (bSlot?.ownerSessionId) {
          this.actorToSession.set(actorId, bSlot.ownerSessionId);
        }
      }

      this.state.phase = 'in_game';
      this.setSimulationInterval((dt) => this.tick(dt), 1000 / 60);
      this.setPatchRate(50);
      return;
    }

    // Versus (existing logic — unchanged below this point)
    const hostSlot = this.state.players.get(this.state.hostSessionId);
    const joinerId = this.getJoinerId();
    const joinerSlot = joinerId ? this.state.players.get(joinerId) : undefined;
    if (!hostSlot || !joinerSlot) return;
    if (!hostSlot.guildId || !joinerSlot.guildId) return;

    this.plainSim = createMpVsState(
      hostSlot.guildId as GuildId,
      joinerSlot.guildId as GuildId,
      seed,
      this.state.stageId,
    );

    // Build a fresh schema snapshot of the plain sim for wire-sync. The
    // simulation keeps mutating `plainSim` each tick; we mirror into
    // `this.state.sim` after the tick returns so Colyseus sees a schema
    // instance it can diff-encode.
    this.state.sim = createSimSchema(this.plainSim);

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
    if (!this.plainSim || !this.state.sim) return;
    if (this.state.phase !== 'in_game') return;

    const p1 = this.coalesceInput(this.state.hostSessionId);

    if (this.state.gameMode === 'battle') {
      const extraInputs: Record<string, InputState> = {};
      for (const [actorId, sessionId] of this.actorToSession) {
        if (sessionId !== this.state.hostSessionId) {
          extraInputs[actorId] = this.coalesceInput(sessionId);
        }
      }
      tickSimulation(this.plainSim, p1, dtMs, undefined, extraInputs);
    } else {
      const joinerId = this.getJoinerId();
      const p2 = joinerId ? this.coalesceInput(joinerId) : makeEmptyInputState();
      tickSimulation(this.plainSim, p1, dtMs, p2);
    }

    mirrorSimToSchema(this.plainSim, this.state.sim);
    if (this.plainSim.vfxEvents.length > 0) {
      this.broadcast('vfx', this.plainSim.vfxEvents);
    }

    // Propagate sim match-end into MatchState.phase. The sim flips
    // `round.phase` to 'matchOver' after the best-of resolves; until we mirror
    // that into 'results' here, clients stay stuck on the battle screen.
    if (this.plainSim.round?.phase === 'matchOver') {
      const winner = this.plainSim.round.matchWinner;
      const joinerId2 = this.getJoinerId();
      if (winner === 'p1') this.state.matchWinnerSessionId = this.state.hostSessionId;
      else if (winner === 'p2') this.state.matchWinnerSessionId = joinerId2;
      else this.state.matchWinnerSessionId = ''; // draw
      this.state.phase = 'results';
      this.broadcast('match_result', { matchStats: this.plainSim.matchStats });
    }
  }
}
