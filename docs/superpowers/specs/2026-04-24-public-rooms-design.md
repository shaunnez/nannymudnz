# Public Rooms Design

**Date:** 2026-04-24  
**Status:** Approved

## Summary

Players can host public rooms and browse/join them from the Multiplayer Hub without needing a room code. The list polls every 5 seconds and shows all public rooms regardless of fullness.

---

## Server Changes

### `MatchRoom.ts`

`onCreate` calls `this.setMetadata()` immediately after existing state setup:

```ts
this.setMetadata({
  name: this.state.name,
  rounds: this.state.rounds,
  visibility: this.state.visibility,
  hostName: '',
});
```

`onJoin` updates `hostName` when the host slot is first claimed (i.e. `!this.state.hostSessionId` is true before assignment):

```ts
if (!this.state.hostSessionId) {
  this.updateMetadata({ hostName: slot.name });
}
```

### `index.ts`

Extend `filterBy` to expose `visibility` through the matchmake API:

```ts
gameServer.define('match', MatchRoom).filterBy(['code', 'visibility']);
```

---

## Client — Data Layer

### `ColyseusClient.ts`

Add `PublicRoom` interface and `getPublicRooms` function:

```ts
export interface PublicRoom {
  roomId: string;
  name: string;
  hostName: string;
  rounds: number;
  clients: number;
  maxClients: number;
}

export async function getPublicRooms(): Promise<PublicRoom[]> {
  const rooms = await getClient().getAvailableRooms('match');
  return rooms
    .filter(r => r.metadata?.visibility === 'public')
    .map(r => ({
      roomId: r.roomId,
      name: r.metadata.name,
      hostName: r.metadata.hostName,
      rounds: r.metadata.rounds,
      clients: r.clients,
      maxClients: r.maxClients,
    }));
}
```

Rename `joinByCode` to `joinRoom(id: string, playerName: string)`. The room code IS the roomId so the call is identical — this is a clarity fix only. Update all callers (`JoinByCodeModal`, `MpHub`).

### `usePublicRooms.ts` (new file in `src/screens/mp/`)

```ts
export function usePublicRooms() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const fetch = () =>
      getPublicRooms()
        .then(r => { if (alive) { setRooms(r); setError(false); } })
        .catch(() => { if (alive) setError(true); });
    fetch();
    const id = setInterval(fetch, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { rooms, error };
}
```

---

## Client — UI

### `MpHub.tsx`

Replace the "COMING SOON" placeholder in the right panel with the live room list.

- Consumes `usePublicRooms()`
- Rows are unclickable while `!nameReady` (list is still visible for browsing, but joining requires a name)
- On error: show "Could not reach server" notice in place of the list
- On empty: show "No public rooms" message
- Each row displays:
  - Room name (primary text)
  - Host name (muted, secondary)
  - Rounds formatted as `Bo3` / `Bo5` / `Bo7` / `Bo1`
  - Slot badge: `1/2` (joinable) or `FULL` (2/2, not joinable)
- Clicking a non-full row triggers `joinRoom(room.roomId, playerName)` — same loading/error pattern as `JoinByCodeModal`
- While a join is in flight, disable all rows

### `CreateRoomModal.tsx`

Make the `Public` visibility radio functional:

- Add `visibility` state (`'private' | 'public'`), defaulting to `'private'`
- Both radios are now interactive
- Pass `visibility` to `hostRoom()`
- Remove the "— SOON" label from the public option

---

## Data Flow

```
MpHub mounts
  → usePublicRooms fires immediately + every 5s
  → getPublicRooms() calls client.getAvailableRooms('match')
  → filters metadata.visibility === 'public'
  → renders list

User clicks row (clients < maxClients)
  → joinRoom(roomId, playerName)
  → onJoined(room) → MpHub propagates up via onJoined prop
  → normal lobby flow continues
```

---

## Out of Scope

- Server-side filtering of public vs private rooms (client-side filter is sufficient; knowing a private room exists without its code grants no access)
- Push-based room updates (polling every 5s is adequate for this use case)
- Spectating full rooms
