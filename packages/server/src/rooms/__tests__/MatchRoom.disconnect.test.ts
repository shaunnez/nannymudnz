/**
 * MatchRoom disconnect handling, rematch offer/accept tests.
 *
 * Uses the same direct-instantiation pattern as MatchRoom.phase.test.ts —
 * no real Colyseus boot, no WebSocket transport.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MatchRoom } from '../MatchRoom.js';
import { MatchState } from '@nannymud/shared';

// ---------------------------------------------------------------------------
// Minimal stubs (copied from MatchRoom.phase.test.ts pattern)
// ---------------------------------------------------------------------------

type StubClient = { sessionId: string };
function makeClient(id: string): StubClient { return { sessionId: id }; }

type MsgHandler = (client: StubClient, msg: unknown) => void;
type MsgStore = { events: Record<string, MsgHandler[]> };

function sendMsg(room: MatchRoom, client: StubClient, type: string, msg: unknown = {}) {
  const store = room['onMessageEvents'] as MsgStore | undefined;
  const handlers: MsgHandler[] = store?.events?.[type] ?? [];
  for (const h of handlers) h(client, msg);
}

function stubTimers(room: MatchRoom) {
  (room as unknown as { setSimulationInterval: () => void }).setSimulationInterval = () => {};
  (room as unknown as { setPatchRate: () => void }).setPatchRate = () => {};
}

function createRoom(opts: { name?: string } = {}) {
  const room = new MatchRoom();
  room['state'] = new MatchState();
  const store: MsgStore = { events: {} };
  room['onMessageEvents'] = store;
  (room['onMessage'] as unknown) = function(type: string, handler: MsgHandler) {
    if (!store.events[type]) store.events[type] = [];
    store.events[type].push(handler);
  };
  stubTimers(room);
  // Stub disconnect so we can spy on it without crashing
  (room as unknown as { disconnect: () => void }).disconnect = vi.fn();
  room.onCreate(opts);
  return room;
}

function joinRoom(room: MatchRoom, client: StubClient, opts: { name?: string } = {}) {
  room.onJoin(client as import('@colyseus/core').Client, opts);
}

function leaveRoom(room: MatchRoom, client: StubClient) {
  room.onLeave(client as import('@colyseus/core').Client);
}

/**
 * Drive room through lobby → char_select → stage_select → loading → in_game.
 * setSimulationInterval is stubbed so no real timer starts; tick must be
 * called manually.
 */
function advanceToInGame(
  room: MatchRoom, c1: StubClient, c2: StubClient,
  opts: { p1Guild?: string; p2Guild?: string; stage?: string } = {},
) {
  joinRoom(room, c1, { name: 'Alice' });
  joinRoom(room, c2, { name: 'Bob' });
  sendMsg(room, c1, 'ready_toggle', { ready: true });
  sendMsg(room, c2, 'ready_toggle', { ready: true });
  sendMsg(room, c1, 'launch_battle', {});
  sendMsg(room, c1, 'lock_guild', { guildId: opts.p1Guild ?? 'knight' });
  sendMsg(room, c2, 'lock_guild', { guildId: opts.p2Guild ?? 'mage' });
  sendMsg(room, c1, 'pick_stage', { stageId: opts.stage ?? 'assembly' });
  sendMsg(room, c1, 'ready_to_start', {});
  sendMsg(room, c2, 'ready_to_start', {});
  // Should now be in_game
}

function advanceToResults(room: MatchRoom, c1: StubClient, c2: StubClient, leavingClient: StubClient) {
  advanceToInGame(room, c1, c2);
  leaveRoom(room, leavingClient);
}

// ---------------------------------------------------------------------------
// A. Disconnect during 'in_game'
// ---------------------------------------------------------------------------

describe('A. Disconnect during in_game', () => {
  let room: MatchRoom;
  let c1: StubClient;
  let c2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'DC Test' });
    c1 = makeClient('session-alice');
    c2 = makeClient('session-bob');
  });

  it('A1: slot2 leaves in_game → phase=results, winner=slot1', () => {
    advanceToInGame(room, c1, c2);
    expect(room.state.phase).toBe('in_game');

    leaveRoom(room, c2);

    expect(room.state.phase).toBe('results');
    expect(room.state.matchWinnerSessionId).toBe('session-alice');
  });

  it('A2: slot2 slot is marked connected=false after leaving in_game', () => {
    advanceToInGame(room, c1, c2);
    leaveRoom(room, c2);

    // Slot should still exist (not deleted) so rematch can use it if needed
    const slot2 = room.state.players.get('session-bob');
    expect(slot2).toBeDefined();
    expect(slot2!.connected).toBe(false);
  });

  it('A3: host (slot1) leaves in_game → phase=results, winner=slot2', () => {
    advanceToInGame(room, c1, c2);
    leaveRoom(room, c1);

    expect(room.state.phase).toBe('results');
    expect(room.state.matchWinnerSessionId).toBe('session-bob');
    // hostSessionId stays as the original host (not promoted in results)
    expect(room.state.hostSessionId).toBe('session-alice');
  });

  it('A4: tick is a no-op after phase leaves in_game', () => {
    advanceToInGame(room, c1, c2);
    const simBefore = room.state.sim;
    leaveRoom(room, c2);
    expect(room.state.phase).toBe('results');

    // tick should early-return because phase !== 'in_game'
    const timeBefore = room.state.sim?.timeMs ?? 0;
    room.tick(100);
    expect(room.state.sim?.timeMs ?? 0).toBe(timeBefore);
    void simBefore; // just to be explicit we're not re-using it
  });
});

// ---------------------------------------------------------------------------
// B. Disconnect during pre-game phases
// ---------------------------------------------------------------------------

describe('B. Disconnect during pre-game phases', () => {
  let room: MatchRoom;
  let c1: StubClient;
  let c2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'Pre-game DC' });
    c1 = makeClient('session-alice');
    c2 = makeClient('session-bob');
  });

  it('B1: slot2 leaves lobby → slot2 removed, slot1 remains, phase stays lobby', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });

    leaveRoom(room, c2);

    expect(room.state.players.has('session-bob')).toBe(false);
    expect(room.state.players.has('session-alice')).toBe(true);
    expect(room.state.phase).toBe('lobby');
  });

  it('B2: slot2 leaves char_select → phase resets to lobby, slot1 ready/locked/guildId reset', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });
    sendMsg(room, c1, 'ready_toggle', { ready: true });
    sendMsg(room, c2, 'ready_toggle', { ready: true });
    sendMsg(room, c1, 'launch_battle', {});
    expect(room.state.phase).toBe('char_select');

    leaveRoom(room, c2);

    expect(room.state.phase).toBe('lobby');
    const slot1 = room.state.players.get('session-alice')!;
    expect(slot1.ready).toBe(false);
    expect(slot1.locked).toBe(false);
    expect(slot1.guildId).toBe('');
  });

  it('B3: host leaves pre-game → remaining slot promoted to host', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });
    expect(room.state.hostSessionId).toBe('session-alice');

    leaveRoom(room, c1);

    expect(room.state.hostSessionId).toBe('session-bob');
    expect(room.state.phase).toBe('lobby');
  });

  it('B4: host leaves char_select → remaining slot promoted to host, phase=lobby', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });
    sendMsg(room, c1, 'ready_toggle', { ready: true });
    sendMsg(room, c2, 'ready_toggle', { ready: true });
    sendMsg(room, c1, 'launch_battle', {});
    expect(room.state.phase).toBe('char_select');

    leaveRoom(room, c1); // host leaves

    expect(room.state.hostSessionId).toBe('session-bob');
    expect(room.state.phase).toBe('lobby');
    const slot2 = room.state.players.get('session-bob')!;
    expect(slot2.ready).toBe(false);
    expect(slot2.locked).toBe(false);
  });

  it('B5: non-host leaves stage_select → phase resets to lobby', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });
    sendMsg(room, c1, 'ready_toggle', { ready: true });
    sendMsg(room, c2, 'ready_toggle', { ready: true });
    sendMsg(room, c1, 'launch_battle', {});
    sendMsg(room, c1, 'lock_guild', { guildId: 'knight' });
    sendMsg(room, c2, 'lock_guild', { guildId: 'mage' });
    expect(room.state.phase).toBe('stage_select');

    leaveRoom(room, c2);

    expect(room.state.phase).toBe('lobby');
    expect(room.state.players.has('session-bob')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C. Rematch messages
// ---------------------------------------------------------------------------

describe('C. Rematch messages', () => {
  let room: MatchRoom;
  let c1: StubClient;
  let c2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'Rematch Test' });
    c1 = makeClient('session-alice');
    c2 = makeClient('session-bob');
  });

  it('C1: rematch_offer outside results is ignored', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });
    expect(room.state.phase).toBe('lobby');

    // Should not throw, and no state change
    sendMsg(room, c1, 'rematch_offer');
    expect(room['pendingRematchOffer']).toBeNull();
  });

  it('C2: rematch_accept with no prior offer is ignored', () => {
    advanceToResults(room, c1, c2, c2); // c2 leaves → results, winner=c1
    expect(room.state.phase).toBe('results');

    sendMsg(room, c1, 'rematch_accept', { accept: true });
    expect(room.state.phase).toBe('results'); // no change
  });

  it('C3: rematch_offer then rematch_accept{true} → phase=char_select, slots reset, winner cleared', () => {
    advanceToResults(room, c1, c2, c2); // c2 leaves → results
    // c2 was marked connected=false; slot still exists in players map

    // c1 offers, c2 accepts
    sendMsg(room, c1, 'rematch_offer');
    sendMsg(room, c2, 'rematch_accept', { accept: true });

    expect(room.state.phase).toBe('char_select');
    expect(room.state.matchWinnerSessionId).toBe('');
    expect(room.state.stageId).toBe('');
    expect(room.state.sim).toBeUndefined();
    // Both slots should have their selection state reset
    for (const slot of room.state.players.values()) {
      expect(slot.ready).toBe(false);
      expect(slot.locked).toBe(false);
      expect(slot.guildId).toBe('');
    }
    // pendingRematchOffer cleared
    expect(room['pendingRematchOffer']).toBeNull();
  });

  it('C4: rematch_offer then rematch_accept{false} → phase stays results', () => {
    advanceToResults(room, c1, c2, c2);

    sendMsg(room, c1, 'rematch_offer');
    sendMsg(room, c2, 'rematch_accept', { accept: false });

    expect(room.state.phase).toBe('results');
    // offer remains pending (the offerer hasn't withdrawn)
    expect(room['pendingRematchOffer']).toBe('session-alice');
  });

  it('C5: same player cannot accept their own offer', () => {
    advanceToResults(room, c1, c2, c2);

    sendMsg(room, c1, 'rematch_offer');
    sendMsg(room, c1, 'rematch_accept', { accept: true }); // same player

    expect(room.state.phase).toBe('results'); // ignored
  });

  it('C6: rematch can be offered from either side', () => {
    advanceToResults(room, c1, c2, c2);

    // c2 offers first this time (winner is c1, c2 is the loser)
    sendMsg(room, c2, 'rematch_offer');
    sendMsg(room, c1, 'rematch_accept', { accept: true });

    expect(room.state.phase).toBe('char_select');
  });
});

// ---------------------------------------------------------------------------
// D. Second disconnect → room closes
// ---------------------------------------------------------------------------

describe('D. Second disconnect closes the room', () => {
  let room: MatchRoom;
  let c1: StubClient;
  let c2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'Close Test' });
    c1 = makeClient('session-alice');
    c2 = makeClient('session-bob');
  });

  it('D1: both clients leave lobby → disconnect() called', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });

    leaveRoom(room, c2); // slot removed, slot1 remains
    expect(room['disconnect']).not.toHaveBeenCalled();

    leaveRoom(room, c1); // no slots left
    expect(room['disconnect']).toHaveBeenCalledOnce();
  });

  it('D2: after results, first leave removes slot; second leave triggers disconnect', () => {
    advanceToResults(room, c1, c2, c2); // c2 leaves in_game → results
    // At this point c2 slot still exists but connected=false
    // c1 is still connected
    expect(room.state.phase).toBe('results');

    // c1 (winner) now leaves during results
    leaveRoom(room, c1);
    // slot deleted, c2 slot already not connected → 0 connected → disconnect
    expect(room['disconnect']).toHaveBeenCalledOnce();
  });

  it('D3: sole remaining player leaves pre-game after opponent disconnect → disconnect() called', () => {
    joinRoom(room, c1, { name: 'Alice' });
    joinRoom(room, c2, { name: 'Bob' });

    leaveRoom(room, c2); // drops to lobby with c1 alone
    expect(room.state.players.size).toBe(1);

    leaveRoom(room, c1); // last player leaves
    expect(room['disconnect']).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// E. tick() guard: no-op when phase !== 'in_game'
// ---------------------------------------------------------------------------

describe('E. tick() is a no-op outside in_game', () => {
  let room: MatchRoom;
  let c1: StubClient;
  let c2: StubClient;

  beforeEach(() => {
    room = createRoom({ name: 'Tick Guard' });
    c1 = makeClient('session-alice');
    c2 = makeClient('session-bob');
  });

  it('E1: tick in lobby does nothing (sim is undefined)', () => {
    joinRoom(room, c1);
    // No sim, no crash
    room.tick(16);
    expect(room.state.sim).toBeUndefined();
  });

  it('E2: tick in results after disconnect does not advance sim', () => {
    advanceToResults(room, c1, c2, c2);
    expect(room.state.phase).toBe('results');

    const timeBefore = room.state.sim?.timeMs ?? 0;
    room.tick(16);
    room.tick(16);
    expect(room.state.sim?.timeMs ?? 0).toBe(timeBefore);
  });
});
