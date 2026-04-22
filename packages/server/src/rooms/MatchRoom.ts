import { Room, Client } from 'colyseus';
import { MatchState, PlayerSlot } from '@nannymud/shared';
import { generateCode } from '../util/roomCode.js';

interface CreateOpts {
  name?: string;
  rounds?: number;
  visibility?: 'public' | 'private';
}

export class MatchRoom extends Room<MatchState> {
  maxClients = 2;

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
  }

  onJoin(client: Client, opts: { name?: string }) {
    const slot = new PlayerSlot();
    slot.sessionId = client.sessionId;
    slot.name = opts?.name ?? 'Player';
    this.state.players.set(client.sessionId, slot);
    if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
  }

  onLeave(client: Client) {
    const slot = this.state.players.get(client.sessionId);
    if (slot) slot.connected = false;
    // full disconnect handling lands in C3
  }
}
