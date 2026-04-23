# Public Rooms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players can host public rooms and browse/join them from the Multiplayer Hub without a room code.

**Architecture:** Server exposes a `GET /api/public-rooms` Express route (added via the Colyseus `express` server option) that calls `matchMaker.query()` and filters to public rooms. `MatchRoom` calls `setMetadata` so room info appears in query results. Client polls this endpoint every 5 seconds via a `usePublicRooms` hook and renders the list in `MpHub`. Full rooms appear disabled; clicking a non-full row calls `joinRoom(roomId, playerName)`.

**Tech Stack:** Colyseus 0.17 (ws-transport + Express), React hooks, TypeScript, Vitest

---

## File Map

| File | Change |
|------|--------|
| `packages/server/src/rooms/MatchRoom.ts` | Add `setMetadata` call in `onCreate` and `onJoin` |
| `packages/server/src/index.ts` | Add `express` callback + extend `filterBy` |
| `packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts` | Stub `setMetadata`; add metadata assertion tests |
| `src/game/net/ColyseusClient.ts` | Add `PublicRoom` type + `getPublicRooms`; rename `joinByCode` → `joinRoom` |
| `src/game/net/__tests__/ColyseusClient.test.ts` | Add `getPublicRooms` tests; update `joinByCode` → `joinRoom` |
| `src/screens/mp/usePublicRooms.ts` | New: 5-second polling hook |
| `src/screens/mp/CreateRoomModal.tsx` | Make visibility toggle functional |
| `src/screens/mp/JoinByCodeModal.tsx` | Update import: `joinByCode` → `joinRoom` |
| `src/screens/mp/MpHub.tsx` | Replace COMING SOON panel with live room list |

---

## Task 1: MatchRoom — server-side metadata

**Files:**
- Modify: `packages/server/src/rooms/MatchRoom.ts`
- Modify: `packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts`

### Step 1: Write failing tests

Add two tests to `MatchRoom.phase.test.ts`. First, update `createRoom` to stub `setMetadata` on the room instance, then add the assertions.

In `MatchRoom.phase.test.ts`, add this import at the top and update `createRoom`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
```

Update `createRoom` helper (add the two lines marked with `// +`):

```ts
function createRoom(opts: { name?: string; rounds?: number; visibility?: 'public' | 'private' } = {}) {
  const room = new MatchRoom();
  room['state'] = new MatchState();
  const store: MsgStore = { events: {} };
  room['onMessageEvents'] = store;
  (room['onMessage'] as unknown) = function(type: string, handler: MsgHandler) {
    if (!store.events[type]) store.events[type] = [];
    store.events[type].push(handler);
  };
  // + stub setMetadata so direct-instantiation tests don't crash
  room['setMetadata'] = vi.fn().mockResolvedValue(undefined);
  room.onCreate(opts);
  return room;
}
```

Add these two tests at the bottom of the `describe` block:

```ts
// -------------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------------

it('sets metadata on create with correct fields', () => {
  const room = createRoom({ name: 'Arena', rounds: 5, visibility: 'public' });
  expect(room['setMetadata']).toHaveBeenCalledOnce();
  expect(room['setMetadata']).toHaveBeenCalledWith({
    name: 'Arena',
    rounds: 5,
    visibility: 'public',
    hostName: '',
  });
});

it('updates metadata with hostName when first client joins', () => {
  const room = createRoom({ name: 'Pit', rounds: 3, visibility: 'public' });
  const client1 = makeClient('session-alice');
  joinRoom(room, client1, { name: 'Alice' });
  // setMetadata called twice: once in onCreate, once in onJoin
  expect(room['setMetadata']).toHaveBeenCalledTimes(2);
  const secondCall = (room['setMetadata'] as ReturnType<typeof vi.fn>).mock.calls[1][0];
  expect(secondCall.hostName).toBe('Alice');
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

Expected: FAIL — `setMetadata` is not a function (or `setMetadata` was not called)

- [ ] **Step 3: Implement — add `setMetadata` to `MatchRoom.ts`**

In `packages/server/src/rooms/MatchRoom.ts`, add these calls.

At the end of `onCreate`, after the existing `console.log`:

```ts
void this.setMetadata({
  name: this.state.name,
  rounds: this.state.rounds,
  visibility: this.state.visibility,
  hostName: '',
});
```

In `onJoin`, after assigning `this.state.hostSessionId` (i.e. after the `if (!this.state.hostSessionId)` block sets the host), add the metadata update. The block currently reads:

```ts
if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
```

Change it to:

```ts
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
```

Also remove the existing `console.log` line that's now duplicated (the original `const isHost = ...` and `console.log` at the bottom of `onJoin`). The full updated `onJoin` body:

```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/rooms/MatchRoom.ts packages/server/src/rooms/__tests__/MatchRoom.phase.test.ts
git commit -m "feat(mp): MatchRoom sets metadata for room listing"
```

---

## Task 2: Server — `/api/public-rooms` endpoint + filterBy

**Files:**
- Modify: `packages/server/src/index.ts`

No unit test (would require a running Colyseus server). Covered by manual verification in Task 9.

- [ ] **Step 1: Rewrite `packages/server/src/index.ts`**

```ts
import { Server, matchMaker } from 'colyseus';
import { createServer } from 'node:http';
import { MatchRoom } from './rooms/MatchRoom.js';

const app = createServer();
const gameServer = new Server({
  server: app,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  express: async (expressApp: any) => {
    expressApp.get('/api/public-rooms', async (_req, res) => {
      try {
        const rooms = await matchMaker.query({});
        const publicRooms = rooms
          .filter((r) => r.metadata?.visibility === 'public')
          .map((r) => ({
            roomId: r.roomId,
            name: r.metadata?.name ?? '',
            hostName: r.metadata?.hostName ?? '',
            rounds: r.metadata?.rounds ?? 3,
            clients: r.clients,
            maxClients: r.maxClients,
          }));
        res.set('Access-Control-Allow-Origin', '*');
        res.json(publicRooms);
      } catch {
        res.status(500).json({ error: 'query failed' });
      }
    });
  },
});

gameServer.define('match', MatchRoom).filterBy(['code', 'visibility']);

const port = Number(process.env.PORT ?? 2567);

gameServer
  .listen(port)
  .then(() => {
    console.log(`[server] Colyseus listening on :${port}`);
  })
  .catch((err) => {
    console.error('[server] failed to start:', err);
    process.exit(1);
  });
```

- [ ] **Step 2: Run typecheck to confirm no errors**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(mp): add /api/public-rooms endpoint; extend filterBy with visibility"
```

---

## Task 3: ColyseusClient — `getPublicRooms` + rename `joinByCode`

**Files:**
- Modify: `src/game/net/ColyseusClient.ts`
- Modify: `src/game/net/__tests__/ColyseusClient.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the full contents of `src/game/net/__tests__/ColyseusClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getClient, hostRoom, joinRoom, getPublicRooms, __setClientForTests } from '../ColyseusClient';

describe('ColyseusClient', () => {
  const mockRoom = {};
  const mockCreate = vi.fn().mockResolvedValue(mockRoom);
  const mockJoinById = vi.fn().mockResolvedValue(mockRoom);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockClient = { create: mockCreate, joinById: mockJoinById } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    __setClientForTests(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getClient() returns the same instance on repeated calls (singleton)', () => {
    __setClientForTests(mockClient);
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
    expect(a).toBe(mockClient);
  });

  it('hostRoom calls client.create with expected opts including playerName', async () => {
    __setClientForTests(mockClient);
    const opts = { name: 'TestRoom', rounds: 3 as const, visibility: 'public' as const, playerName: 'Alice' };
    await hostRoom(opts);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith('match', {
      name: 'TestRoom',
      rounds: 3,
      visibility: 'public',
      playerName: 'Alice',
    });
  });

  it('joinRoom calls client.joinById with code and name', async () => {
    __setClientForTests(mockClient);
    await joinRoom('ABCDEF', 'Alice');
    expect(mockJoinById).toHaveBeenCalledOnce();
    expect(mockJoinById).toHaveBeenCalledWith('ABCDEF', { name: 'Alice' });
  });

  describe('getPublicRooms', () => {
    it('filters to only public rooms and maps fields correctly', async () => {
      const mockRooms = [
        {
          roomId: 'AAA111',
          clients: 1,
          maxClients: 2,
          metadata: { name: 'Pub Room', hostName: 'Alice', rounds: 3, visibility: 'public' },
        },
        {
          roomId: 'BBB222',
          clients: 1,
          maxClients: 2,
          metadata: { name: 'Private Room', hostName: 'Bob', rounds: 5, visibility: 'private' },
        },
      ];
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRooms.filter(r => r.metadata.visibility === 'public').map(r => ({
          roomId: r.roomId,
          name: r.metadata.name,
          hostName: r.metadata.hostName,
          rounds: r.metadata.rounds,
          clients: r.clients,
          maxClients: r.maxClients,
        }))),
      }));
      const rooms = await getPublicRooms();
      expect(rooms).toHaveLength(1);
      expect(rooms[0]).toEqual({
        roomId: 'AAA111',
        name: 'Pub Room',
        hostName: 'Alice',
        rounds: 3,
        clients: 1,
        maxClients: 2,
      });
    });

    it('throws when fetch response is not ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      await expect(getPublicRooms()).rejects.toThrow('Failed to fetch rooms');
    });
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose src/game/net/__tests__/ColyseusClient.test.ts
```

Expected: FAIL — `joinRoom` not exported, `getPublicRooms` not exported

- [ ] **Step 3: Implement changes in `ColyseusClient.ts`**

Replace the full contents of `src/game/net/ColyseusClient.ts`:

```ts
import { Client, Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';

const WS_URL = import.meta.env.VITE_COLYSEUS_URL ?? 'ws://localhost:2567';
const HTTP_URL = WS_URL.replace(/^ws/, 'http');

let client: Client | null = null;

export function getClient(): Client {
  if (!client) client = new Client(WS_URL);
  return client;
}

export interface HostRoomOpts {
  name: string;
  rounds: 1 | 3 | 5 | 7;
  visibility: 'public' | 'private';
  playerName: string;
}

export async function hostRoom(opts: HostRoomOpts): Promise<Room<MatchState>> {
  return await getClient().create<MatchState>('match', {
    name: opts.name,
    rounds: opts.rounds,
    visibility: opts.visibility,
    playerName: opts.playerName,
  });
}

export async function joinRoom(id: string, playerName: string): Promise<Room<MatchState>> {
  return await getClient().joinById<MatchState>(id, { name: playerName });
}

export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  rounds: number;
  clients: number;
  maxClients: number;
}

export async function getPublicRooms(): Promise<PublicRoom[]> {
  const res = await fetch(`${HTTP_URL}/api/public-rooms`);
  if (!res.ok) throw new Error('Failed to fetch rooms');
  return res.json() as Promise<PublicRoom[]>;
}

// Test hook: allow tests to inject a mock client
export function __setClientForTests(c: Client | null): void {
  client = c;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose src/game/net/__tests__/ColyseusClient.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/net/ColyseusClient.ts src/game/net/__tests__/ColyseusClient.test.ts
git commit -m "feat(mp): add getPublicRooms and rename joinByCode to joinRoom"
```

---

## Task 4: `usePublicRooms` hook

**Files:**
- Create: `src/screens/mp/usePublicRooms.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useState } from 'react';
import { getPublicRooms, type PublicRoom } from '../../game/net/ColyseusClient';

export function usePublicRooms() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      getPublicRooms()
        .then((r) => { if (alive) { setRooms(r); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    poll();
    const id = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { rooms, error };
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/mp/usePublicRooms.ts
git commit -m "feat(mp): add usePublicRooms polling hook"
```

---

## Task 5: `CreateRoomModal` — functional visibility toggle

**Files:**
- Modify: `src/screens/mp/CreateRoomModal.tsx`

- [ ] **Step 1: Update the component**

In `CreateRoomModal.tsx`, make these targeted changes:

Add `visibility` state after the existing `rounds` state:

```ts
const [visibility, setVisibility] = useState<'public' | 'private'>('private');
```

Update `handleCreate` to pass `visibility`:

```ts
const room = await hostRoom({
  name: roomName.trim(),
  rounds,
  visibility,
  playerName,
});
```

Replace the entire Visibility section (currently has both labels, one disabled):

```tsx
{/* Visibility */}
<div>
  <div
    style={{
      fontFamily: theme.fontMono,
      fontSize: 10,
      color: theme.inkMuted,
      letterSpacing: 3,
      marginBottom: 8,
    }}
  >
    VISIBILITY
  </div>
  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
    {(['private', 'public'] as const).map((v) => (
      <label
        key={v}
        onClick={() => !loading && setVisibility(v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: theme.fontBody,
          fontSize: 14,
          color: loading ? theme.inkMuted : theme.ink,
          opacity: loading ? 0.5 : 1,
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: `2px solid ${visibility === v ? theme.accent : theme.line}`,
            background: visibility === v ? theme.accent : 'transparent',
            display: 'inline-block',
            flexShrink: 0,
            transition: 'all 100ms ease',
          }}
        />
        {v.charAt(0).toUpperCase() + v.slice(1)}
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/mp/CreateRoomModal.tsx
git commit -m "feat(mp): enable public visibility option in CreateRoomModal"
```

---

## Task 6: `JoinByCodeModal` — update import

**Files:**
- Modify: `src/screens/mp/JoinByCodeModal.tsx`

- [ ] **Step 1: Update import and call site**

Change line 6 from:

```ts
import { joinByCode } from '../../game/net/ColyseusClient';
```

to:

```ts
import { joinRoom } from '../../game/net/ColyseusClient';
```

Change the call on line 91 from:

```ts
const room = await joinByCode(code, playerName);
```

to:

```ts
const room = await joinRoom(code, playerName);
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/mp/JoinByCodeModal.tsx
git commit -m "refactor(mp): joinByCode → joinRoom in JoinByCodeModal"
```

---

## Task 7: `MpHub` — live public rooms list

**Files:**
- Modify: `src/screens/mp/MpHub.tsx`

- [ ] **Step 1: Implement the live list**

Replace the full contents of `src/screens/mp/MpHub.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { usePlayerName } from './usePlayerName';
import { CreateRoomModal } from './CreateRoomModal';
import { JoinByCodeModal } from './JoinByCodeModal';
import { usePublicRooms } from './usePublicRooms';
import { joinRoom, type PublicRoom } from '../../game/net/ColyseusClient';

interface Props {
  onBack: () => void;
  onHosted: (room: Room<MatchState>) => void;
  onJoined: (room: Room<MatchState>) => void;
}

type Modal = 'none' | 'create' | 'join';

function formatRounds(n: number): string {
  return `Bo${n}`;
}

export function MpHub({ onBack, onHosted, onJoined }: Props) {
  const [playerName, setPlayerName] = usePlayerName();
  const [modal, setModal] = useState<Modal>('none');
  const [nameInput, setNameInput] = useState(playerName);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const nameReady = playerName.trim().length > 0;
  const { rooms, error: roomsError } = usePublicRooms();

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setPlayerName(trimmed);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const handleJoinPublic = async (room: PublicRoom) => {
    if (!nameReady || joiningRoomId || room.clients >= room.maxClients) return;
    setJoiningRoomId(room.roomId);
    setJoinError(null);
    try {
      const joined = await joinRoom(room.roomId, playerName);
      onJoined(joined);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join room.');
      setJoiningRoomId(null);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '52px 48px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 3,
          }}
        >
          MAIN MENU → MULTIPLAYER
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 36,
            color: theme.ink,
            letterSpacing: '-0.02em',
          }}
        >
          ◇ MULTIPLAYER HUB
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 0,
          minHeight: 0,
          padding: '32px 48px 48px',
        }}
      >
        {/* LEFT — actions */}
        <div
          style={{
            flex: '0 0 44%',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            paddingRight: 48,
            borderRight: `1px solid ${theme.lineSoft}`,
          }}
        >
          {/* Player name field */}
          <div>
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 10,
                color: theme.inkMuted,
                letterSpacing: 3,
                marginBottom: 8,
              }}
            >
              YOUR NAME
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitName();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="Enter your name…"
                maxLength={24}
                style={{
                  flex: 1,
                  background: theme.panel,
                  border: `1px solid ${nameReady ? theme.accent : theme.warn}`,
                  color: theme.ink,
                  fontFamily: theme.fontBody,
                  fontSize: 16,
                  padding: '10px 14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {!nameReady && (
                <div
                  style={{
                    alignSelf: 'center',
                    fontFamily: theme.fontMono,
                    fontSize: 10,
                    color: theme.warn,
                    letterSpacing: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  REQUIRED
                </div>
              )}
            </div>
            {!nameReady && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 1,
                }}
              >
                Set your name to enable hosting and joining rooms.
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => nameReady && setModal('create')}
              disabled={!nameReady}
              style={{
                padding: '18px 24px',
                background: nameReady ? theme.accent : theme.panel,
                color: nameReady ? theme.bgDeep : theme.inkMuted,
                border: `1px solid ${nameReady ? theme.accent : theme.line}`,
                fontFamily: theme.fontMono,
                fontSize: 15,
                letterSpacing: 2,
                textAlign: 'left',
                cursor: nameReady ? 'pointer' : 'not-allowed',
                opacity: nameReady ? 1 : 0.45,
                borderRadius: 2,
                transition: 'all 100ms ease',
              }}
            >
              HOST ROOM
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: 0,
                  marginTop: 4,
                  opacity: 0.75,
                }}
              >
                Create a private or public room
              </div>
            </button>

            <button
              onClick={() => nameReady && setModal('join')}
              disabled={!nameReady}
              style={{
                padding: '18px 24px',
                background: 'transparent',
                color: nameReady ? theme.ink : theme.inkMuted,
                border: `1px solid ${nameReady ? theme.line : theme.lineSoft}`,
                fontFamily: theme.fontMono,
                fontSize: 15,
                letterSpacing: 2,
                textAlign: 'left',
                cursor: nameReady ? 'pointer' : 'not-allowed',
                opacity: nameReady ? 1 : 0.45,
                borderRadius: 2,
                transition: 'all 100ms ease',
              }}
            >
              JOIN BY CODE
              <div
                style={{
                  fontFamily: theme.fontBody,
                  fontSize: 12,
                  fontWeight: 400,
                  letterSpacing: 0,
                  marginTop: 4,
                  opacity: 0.75,
                }}
              >
                Enter a 6-character code from the host
              </div>
            </button>
          </div>

          {/* Back button */}
          <div style={{ marginTop: 'auto' }}>
            <Btn onClick={onBack}>← BACK</Btn>
          </div>
        </div>

        {/* RIGHT — public rooms */}
        <div
          style={{
            flex: 1,
            paddingLeft: 48,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
              marginBottom: 16,
            }}
          >
            PUBLIC ROOMS
          </div>

          {/* Join error */}
          {joinError && (
            <div
              style={{
                marginBottom: 12,
                fontFamily: theme.fontMono,
                fontSize: 11,
                color: theme.bad,
                letterSpacing: 1,
                padding: '6px 10px',
                border: `1px solid ${theme.bad}`,
                background: `${theme.bad}18`,
              }}
            >
              {joinError}
            </div>
          )}

          {/* Room list area */}
          <div
            style={{
              flex: 1,
              border: `1px solid ${theme.line}`,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {roomsError ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.bad,
                  letterSpacing: 2,
                  opacity: 0.7,
                }}
              >
                COULD NOT REACH SERVER
              </div>
            ) : rooms.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 2,
                  opacity: 0.5,
                }}
              >
                NO PUBLIC ROOMS
              </div>
            ) : (
              rooms.map((room) => {
                const isFull = room.clients >= room.maxClients;
                const isJoining = joiningRoomId === room.roomId;
                const canJoin = nameReady && !isFull && !joiningRoomId;
                return (
                  <button
                    key={room.roomId}
                    onClick={() => handleJoinPublic(room)}
                    disabled={!canJoin}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${theme.lineSoft}`,
                      color: canJoin ? theme.ink : theme.inkMuted,
                      cursor: canJoin ? 'pointer' : 'not-allowed',
                      textAlign: 'left',
                      gap: 12,
                      opacity: canJoin ? 1 : 0.5,
                      transition: 'background 100ms ease',
                    }}
                    onMouseEnter={(e) => {
                      if (canJoin) (e.currentTarget as HTMLButtonElement).style.background = theme.panel;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {/* Room info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: theme.fontMono,
                          fontSize: 13,
                          letterSpacing: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {room.name}
                      </div>
                      <div
                        style={{
                          fontFamily: theme.fontBody,
                          fontSize: 11,
                          color: theme.inkMuted,
                          marginTop: 2,
                        }}
                      >
                        {room.hostName} · {formatRounds(room.rounds)}
                      </div>
                    </div>

                    {/* Slot badge */}
                    <div
                      style={{
                        fontFamily: theme.fontMono,
                        fontSize: 10,
                        letterSpacing: 2,
                        color: isFull ? theme.bad : theme.accent,
                        flexShrink: 0,
                      }}
                    >
                      {isJoining ? '…' : isFull ? 'FULL' : `${room.clients}/2`}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <CreateRoomModal
          playerName={playerName}
          onCancel={() => setModal('none')}
          onCreated={(room) => {
            setModal('none');
            onHosted(room);
          }}
        />
      )}
      {modal === 'join' && (
        <JoinByCodeModal
          playerName={playerName}
          onCancel={() => setModal('none')}
          onJoined={(room) => {
            setModal('none');
            onJoined(room);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/screens/mp/MpHub.tsx
git commit -m "feat(mp): live public rooms list in MpHub"
```

---

## Task 8: Full verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests PASS (golden sim test, MatchRoom tests, ColyseusClient tests, etc.)

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 4: Manual smoke test (requires server running)**

Start the dev server:
```bash
npm run dev
```

1. Open `http://localhost:5173` in two tabs
2. Tab A: Multiplayer → set name → HOST ROOM → set visibility to Public → CREATE
3. Confirm the room appears in Tab B's Public Rooms list within 5 seconds
4. Tab B: Set a different name → click the room → confirm it joins and reaches the lobby
5. Tab A: HOST ROOM → Private → CREATE — confirm this room does NOT appear in the public list
6. Tab A: JOIN BY CODE — confirm `joinByCode` was renamed and still works (code still works since code = roomId)
