/**
 * MatchRoom phase transition tests.
 *
 * NOTE: @colyseus/testing's `boot()` requires a real WebSocket transport and
 * a live HTTP port, which conflicts with Vitest's node environment (no free port
 * guarantee, EADDRINUSE on parallel runs). Instead we drive MatchRoom directly
 * via its internal `_onMessage` and `onJoin`/`onLeave` hooks, without the
 * network stack. This is the "simpler direct-instantiation" fallback described
 * in the task spec.
 *
 * `@colyseus/testing` integration tests (full boot + WS) will be added in a
 * follow-up once the CI environment is confirmed to support it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchRoom } from '../MatchRoom.js';
import { MatchState } from '@nannymud/shared';

// ---------------------------------------------------------------------------
// Minimal stubs so we can drive MatchRoom without a real Colyseus server.
// ---------------------------------------------------------------------------

type StubClient = { sessionId: string };

function makeClient(sessionId: string): StubClient {
  return { sessionId };
}

type MsgHandler = (client: StubClient, msg: unknown) => void;
type MsgStore = { events: Record<string, MsgHandler[]> };

/** Invoke a registered onMessage handler on the room by type. */
function sendMsg(room: MatchRoom, client: StubClient, type: string, msg: unknown = {}) {
  // @colyseus/core stores handlers in room['onMessageEvents'].events[type]
  const store = room['onMessageEvents'] as MsgStore | undefined;
  const handlers: MsgHandler[] = store?.events?.[type] ?? [];
  for (const h of handlers) h(client, msg);
}

/** Bootstrap a fresh MatchRoom in lobby state with no clients. */
function createRoom(opts: { name?: string; rounds?: number; visibility?: 'public' | 'private'; gameMode?: 'versus' | 'battle'; uniqueGuilds?: boolean } = {}) {
  const room = new MatchRoom();
  // Provide minimal state before calling onCreate
  room['state'] = new MatchState();
  const store: MsgStore = { events: {} };
  room['onMessageEvents'] = store;
  // Patch onMessage to capture handlers
  (room['onMessage'] as unknown) = function(type: string, handler: MsgHandler) {
    if (!store.events[type]) store.events[type] = [];
    store.events[type].push(handler);
  };
  // Stub setMetadata so tests don't crash without a real Colyseus server
  room['setMetadata'] = vi.fn().mockResolvedValue(undefined);
  room.onCreate(opts);
  return room;
}

/** Simulate a client joining the room. */
function joinRoom(room: MatchRoom, client: StubClient, opts: { name?: string } = {}) {
  room.onJoin(client as import('@colyseus/core').Client, opts);
}

/** Simulate a client leaving the room. */
function leaveRoom(room: MatchRoom, client: StubClient) {
  room.onLeave(client as import('@colyseus/core').Client);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MatchRoom phase transitions (direct instantiation)', () => {
  let room: MatchRoom;
  let client1: StubClient;
  let client2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'Test Room' });
    client1 = makeClient('session-alice');
    client2 = makeClient('session-bob');
  });

  // -------------------------------------------------------------------------
  // Lobby basics
  // -------------------------------------------------------------------------

  it('starts in lobby phase', () => {
    expect(room.state.phase).toBe('lobby');
  });

  it('generates a 6-character room code', () => {
    expect(room.state.code).toHaveLength(6);
  });

  it('sets hostSessionId to the first client that joins', () => {
    expect(room.state.hostSessionId).toBe('');
    joinRoom(room, client1, { name: 'Alice' });
    expect(room.state.hostSessionId).toBe('session-alice');
  });

  it('does not change hostSessionId when a second client joins', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });
    expect(room.state.hostSessionId).toBe('session-alice');
  });

  it('populates two player slots when two clients join', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });
    expect(room.state.players.size).toBe(2);
    expect(room.state.players.get('session-alice')?.name).toBe('Alice');
    expect(room.state.players.get('session-bob')?.name).toBe('Bob');
  });

  // -------------------------------------------------------------------------
  // lobby → char_select
  // -------------------------------------------------------------------------

  it('ignores launch_battle from a non-host client even when both are ready', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });

    sendMsg(room, client1, 'ready_toggle', { ready: true });
    sendMsg(room, client2, 'ready_toggle', { ready: true });

    // Non-host tries to launch
    sendMsg(room, client2, 'launch_battle', {});
    expect(room.state.phase).toBe('lobby');
  });

  it('ignores launch_battle when not all clients are ready', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });

    // Only host is ready
    sendMsg(room, client1, 'ready_toggle', { ready: true });

    sendMsg(room, client1, 'launch_battle', {});
    expect(room.state.phase).toBe('lobby');
  });

  it('advances lobby → char_select when host launches with both players ready', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });

    sendMsg(room, client1, 'ready_toggle', { ready: true });
    sendMsg(room, client2, 'ready_toggle', { ready: true });
    sendMsg(room, client1, 'launch_battle', {});

    expect(room.state.phase).toBe('char_select');
  });

  it('resets guildId and locked on all slots when entering char_select', () => {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });

    sendMsg(room, client1, 'ready_toggle', { ready: true });
    sendMsg(room, client2, 'ready_toggle', { ready: true });
    sendMsg(room, client1, 'launch_battle', {});

    for (const slot of room.state.players.values()) {
      expect(slot.locked).toBe(false);
      expect(slot.guildId).toBe('');
    }
  });

  // -------------------------------------------------------------------------
  // char_select → stage_select
  // -------------------------------------------------------------------------

  function advanceToCharSelect() {
    joinRoom(room, client1, { name: 'Alice' });
    joinRoom(room, client2, { name: 'Bob' });
    sendMsg(room, client1, 'ready_toggle', { ready: true });
    sendMsg(room, client2, 'ready_toggle', { ready: true });
    sendMsg(room, client1, 'launch_battle', {});
  }

  it('stays in char_select after only one player locks', () => {
    advanceToCharSelect();
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    expect(room.state.phase).toBe('char_select');
  });

  it('advances char_select → stage_select when both players lock their guild', () => {
    advanceToCharSelect();
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    sendMsg(room, client2, 'lock_guild', { guildId: 'leper' });
    expect(room.state.phase).toBe('stage_select');
  });

  it('records guildId and locked=true for both slots after both lock', () => {
    advanceToCharSelect();
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    sendMsg(room, client2, 'lock_guild', { guildId: 'leper' });

    expect(room.state.players.get('session-alice')?.guildId).toBe('vampire');
    expect(room.state.players.get('session-alice')?.locked).toBe(true);
    expect(room.state.players.get('session-bob')?.guildId).toBe('leper');
    expect(room.state.players.get('session-bob')?.locked).toBe(true);
  });

  it('ignores lock_guild when not in char_select phase', () => {
    joinRoom(room, client1, { name: 'Alice' });
    // Still in lobby
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    expect(room.state.players.get('session-alice')?.locked).toBe(false);
  });

  it('ignores a double lock_guild from the same client', () => {
    advanceToCharSelect();
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    // Second attempt should be ignored (slot.locked is already true)
    sendMsg(room, client1, 'lock_guild', { guildId: 'leper' });
    expect(room.state.players.get('session-alice')?.guildId).toBe('vampire');
    expect(room.state.phase).toBe('char_select'); // bob hasn't locked yet
  });

  // -------------------------------------------------------------------------
  // stage_select → loading
  // -------------------------------------------------------------------------

  function advanceToStageSelect() {
    advanceToCharSelect();
    sendMsg(room, client1, 'lock_guild', { guildId: 'vampire' });
    sendMsg(room, client2, 'lock_guild', { guildId: 'leper' });
  }

  it('ignores pick_stage from non-host in stage_select', () => {
    advanceToStageSelect();
    sendMsg(room, client2, 'pick_stage', { stageId: 'forest' });
    expect(room.state.phase).toBe('stage_select');
  });

  it('ignores pick_stage from host when not in stage_select phase', () => {
    joinRoom(room, client1, { name: 'Alice' });
    // Still in lobby
    sendMsg(room, client1, 'pick_stage', { stageId: 'castle' });
    expect(room.state.phase).toBe('lobby');
  });

  it('advances stage_select → loading when host picks a stage', () => {
    advanceToStageSelect();
    sendMsg(room, client1, 'pick_stage', { stageId: 'castle' });
    expect(room.state.phase).toBe('loading');
    expect(room.state.stageId).toBe('castle');
  });

  // -------------------------------------------------------------------------
  // onLeave
  // -------------------------------------------------------------------------

  it('marks slot as disconnected when a client leaves', () => {
    joinRoom(room, client1, { name: 'Alice' });
    leaveRoom(room, client1);
    expect(room.state.players.get('session-alice')?.connected).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  it('sets metadata on create with correct fields', () => {
    const r = createRoom({ name: 'Arena', rounds: 5, visibility: 'public' });
    expect(r['setMetadata']).toHaveBeenCalledOnce();
    expect(r['setMetadata']).toHaveBeenCalledWith({
      name: 'Arena',
      rounds: 5,
      visibility: 'public',
      hostName: '',
      gameMode: 'versus',
    });
  });

  it('updates metadata with hostName when first client joins', () => {
    const r = createRoom({ name: 'Pit', rounds: 3, visibility: 'public' });
    const c = makeClient('session-alice');
    joinRoom(r, c, { name: 'Alice' });
    expect(r['setMetadata']).toHaveBeenCalledTimes(2);
    const secondCall = (r['setMetadata'] as ReturnType<typeof vi.fn>).mock.calls[1][0];
    expect(secondCall.hostName).toBe('Alice');
  });

  // -------------------------------------------------------------------------
  // Task 3: Battle mode init
  // -------------------------------------------------------------------------

  it('Battle room sets maxClients to 8', () => {
    const room = createRoom({ gameMode: 'battle', name: 'TestBattle', rounds: 3, visibility: 'public' });
    expect(room.maxClients).toBe(8);
    expect(room.state.gameMode).toBe('battle');
    expect(room.state.uniqueGuilds).toBe(false);
  });

  it('Versus room keeps maxClients at 2', () => {
    const room = createRoom({ name: 'TestVersus', rounds: 3, visibility: 'public' });
    expect(room.maxClients).toBe(2);
    expect(room.state.gameMode).toBe('versus');
  });

  // -------------------------------------------------------------------------
  // Task 4: launch_battle → battle_config
  // -------------------------------------------------------------------------

  it('launch_battle in battle mode transitions to battle_config and initialises 8 battleSlots', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const c1 = makeClient('host');
    const c2 = makeClient('p2');
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });

    room.state.players.get('host')!.ready = true;
    room.state.players.get('p2')!.ready = true;

    sendMsg(room, c1, 'launch_battle', {});

    expect(room.state.phase).toBe('battle_config');
    expect(room.state.battleSlots.length).toBe(8);

    const humanSlots = [...room.state.battleSlots].filter(s => s.slotType === 'human');
    expect(humanSlots).toHaveLength(2);

    const offSlots = [...room.state.battleSlots].filter(s => s.slotType === 'off');
    expect(offSlots).toHaveLength(6);
  });

  // -------------------------------------------------------------------------
  // Task 5: set_battle_slot, set_my_guild, launch_from_config
  // -------------------------------------------------------------------------

  function reachBattleConfig(room: ReturnType<typeof createRoom>, host: StubClient, p2: StubClient) {
    joinRoom(room, host, { name: 'Alice' });
    joinRoom(room, p2, { name: 'Bob' });
    room.state.players.get(host.sessionId)!.ready = true;
    room.state.players.get(p2.sessionId)!.ready = true;
    sendMsg(room, host, 'launch_battle', {});
  }

  it('host can set a cpu slot guild and team', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, host, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'knight', team: 'B' });

    const s = room.state.battleSlots[2];
    expect(s.slotType).toBe('cpu');
    expect(s.guildId).toBe('knight');
    expect(s.team).toBe('B');
  });

  it('non-host cannot call set_battle_slot', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, p2, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'knight', team: 'A' });
    expect(room.state.battleSlots[2].slotType).toBe('off');
  });

  it('set_my_guild updates the calling player own slot', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, p2, 'set_my_guild', { guildId: 'mage' });
    const ownSlot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
    expect(ownSlot.guildId).toBe('mage');
  });

  it('unique guilds: rejects duplicate guildId', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public', uniqueGuilds: true });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
    sendMsg(room, p2,   'set_my_guild', { guildId: 'adventurer' });
    const p2Slot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
    expect(p2Slot.guildId).toBe(''); // rejected — unchanged
  });

  it('unique guilds off: allows duplicate guildId', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public', uniqueGuilds: false });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
    sendMsg(room, p2,   'set_my_guild', { guildId: 'adventurer' });
    const p2Slot = [...room.state.battleSlots].find(s => s.ownerSessionId === 'p2')!;
    expect(p2Slot.guildId).toBe('adventurer');
  });

  it('launch_from_config transitions to stage_select when >=2 active slots', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
    sendMsg(room, p2,   'set_my_guild', { guildId: 'knight' });
    sendMsg(room, host, 'launch_from_config', {});

    expect(room.state.phase).toBe('stage_select');
  });

  it('launch_from_config is ignored by non-host', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, p2, 'launch_from_config', {});
    expect(room.state.phase).toBe('battle_config');
  });

  it('set_battle_slot with uniqueGuilds rejects duplicate guildId from host', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public', uniqueGuilds: true });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    sendMsg(room, host, 'set_battle_slot', { index: 2, slotType: 'cpu', guildId: 'adventurer', team: 'A' });
    // host's human slot already has ownerSessionId=host; give host's human slot 'adventurer' via set_my_guild first
    sendMsg(room, host, 'set_my_guild', { guildId: 'adventurer' });
    // Now try to set slot 3 to the same guild — should be rejected
    sendMsg(room, host, 'set_battle_slot', { index: 3, slotType: 'cpu', guildId: 'adventurer', team: 'B' });
    expect(room.state.battleSlots[3].slotType).toBe('off'); // rejected, no change
  });

  it('launch_from_config is ignored when fewer than 2 active slots', () => {
    const room = createRoom({ gameMode: 'battle', name: 'B', rounds: 3, visibility: 'public' });
    const host = makeClient('host');
    const p2   = makeClient('p2');
    reachBattleConfig(room, host, p2);

    // Turn all slots off except one (the host's human slot)
    for (let i = 1; i < 8; i++) {
      sendMsg(room, host, 'set_battle_slot', { index: i, slotType: 'off', guildId: '', team: '' });
    }
    sendMsg(room, host, 'launch_from_config', {});
    expect(room.state.phase).toBe('battle_config'); // not advanced
  });
});
