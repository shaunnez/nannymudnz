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

import { describe, it, expect, beforeEach } from 'vitest';
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
function createRoom(opts: { name?: string; rounds?: number } = {}) {
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
});
