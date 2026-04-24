# MP Lobby Upgrade — Design Spec

**Date:** 2026-04-24
**Branch:** feat/vs-mode-hud
**Status:** Approved

## Overview

Upgrade `MpLobby.tsx` from its minimal "VS card" layout to a full lobby screen matching the `screens-06.jsx` design reference. Add a server-side chat broadcast and a client-side chat panel. Guild info is not shown (pick happens post-lobby) — player avatars use a letter-initial placeholder.

---

## Server Changes

**File:** `packages/server/src/rooms/MatchRoom.ts`

Add one `chat` message handler after the existing `ready_toggle` handler:

```ts
this.onMessage('chat', (client: Client, msg: { text: string }) => {
  const slot = this.state.players.get(client.sessionId);
  if (!slot) return;
  const text = String(msg.text ?? '').slice(0, 200).trim();
  if (!text) return;
  this.broadcast('chat', { name: slot.name, text });
});
```

Chat is ephemeral — not persisted in schema. The server broadcasts `{ name, text }` to all clients in the room.

---

## Client: `MpLobby.tsx` Rewrite

### Layout

```
[Header]          room name | code (click-to-copy) | LEAVE button
[Meta strip]      1V1 · BO{rounds} · {VISIBILITY} chips
[Body]            1.7fr left | 1fr right (split, overflow hidden)
  [Left]            section label + 2 slot cards (stacked) + footer actions
  [Right]           chat panel: header | scrollable messages | input form
[Keyboard hints]  R READY · ENTER LAUNCH (host) · ESC LEAVE
```

### Header

Three-column grid `1fr auto 1fr`:
- Left: `← LEAVE` (`Btn size="md"`)
- Center: kicker `ROOM LOBBY · PRE-GAME · {filled}/{max}` + room name (`state.name || 'Untitled Room'`, `fontSize: 26`)
- Right: code display (click-to-copy, shows `COPIED ✓` for 1.5s after copy) + `RoomCodeBadge` removed from right-center since the code display replaces it

The code element:
```tsx
<div onClick={copyCode} style={{ cursor: 'pointer', padding: '8px 14px', background: theme.bgDeep,
  border: `1px solid ${theme.accent}`, color: theme.accent, fontFamily: theme.fontMono,
  fontSize: 18, letterSpacing: 6 }}>
  #{state.code}
</div>
<span style={{ fontFamily: theme.fontMono, fontSize: 9, color: copied ? theme.good : theme.inkMuted,
  letterSpacing: 2, width: 62 }}>
  {copied ? 'COPIED ✓' : 'CLICK·COPY'}
</span>
```

### Meta Strip

Row of `Chip` components (tone="accent" mono for the mode, plain mono for the rest):

```tsx
<Chip tone="accent" mono>1V1</Chip>
<Chip mono>BO{state.rounds}</Chip>
<Chip mono>{state.visibility.toUpperCase()}</Chip>
```

### Slot Cards

Two slot cards stacked vertically in the left column. Each card uses a 3-column grid: `auto 1fr auto`.

**Filled slot:**
- Left: circle avatar (72px, letter initial, accent tint for "you", warn tint for opponent)
- Center: name (display font 15px), YOU/HOST chip tags, ping (`{slot.ping}ms · slot {i+1}`)
- Right (stacked vertically): READY / NOT READY badge, KICK button (host only, shown on opponent's card)

**Empty slot:** dashed border, centered "EMPTY SLOT · WAITING…" text + "Share the room code…" sub-text.

**YOU slot border:** `1px solid ${theme.accent}`, background `${theme.accent}0a`. Other slots: `theme.line` border, `theme.panel` background.

### Footer Actions (bottom of left column)

```tsx
<div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid ${theme.lineSoft}`,
  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
  {/* Status text */}
  <div style={{ flex: 1, fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted }}>
    {allReady ? '▸ ALL PLAYERS READY' : `▸ WAITING FOR ${notReadyCount} PLAYER(S)`}
  </div>
  {/* Ready toggle */}
  <Btn onClick={toggleReady}>{localSlot?.ready ? '■ READY' : '□ READY UP'}</Btn>
  {/* Launch (host only) */}
  {isHost && (
    <Btn primary disabled={!canLaunch} onClick={() => room.send('launch_battle', {})}>
      LAUNCH BATTLE →
    </Btn>
  )}
</div>
```

`canLaunch`: `isHost && bothPresent && allReady`.

### Chat Panel (right column)

```
[Chat header: "▸ LOBBY CHAT" | "{n} msg"]
[Scrollable message list (flex: 1, overflow: auto)]
[Input form: text input + SEND button]
```

**Message list:** each entry is:
```tsx
<div style={{ color: msg.sys ? theme.inkMuted : theme.inkDim, fontStyle: msg.sys ? 'italic' : 'normal' }}>
  {!msg.sys && <span style={{ color: msg.isYou ? theme.accent : theme.ink }}>&lt;{msg.name}&gt; </span>}
  {msg.text}
</div>
```

**State:**
```ts
interface ChatMessage { name: string; text: string; sys?: boolean; isYou?: boolean; }
const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
  { name: 'system', text: `Room ${state.code} — share the code to invite a friend`, sys: true },
]);
const [chatInput, setChatInput] = useState('');
const chatEndRef = useRef<HTMLDivElement>(null);
const chatInputRef = useRef<HTMLInputElement>(null);
```

**Auto-scroll:** `useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [chatMessages])`. Render a `<div ref={chatEndRef} />` at the end of the list.

**Room message listener:**
```ts
useEffect(() => {
  const handler = (msg: { name: string; text: string }) => {
    setChatMessages((prev) => [
      ...prev.slice(-99),
      { name: msg.name, text: msg.text, isYou: msg.name === (localSlot?.name ?? '') },
    ]);
  };
  room.onMessage('chat', handler);
  // Colyseus onMessage returns the room; no per-handler remove API.
  // Component unmounts when leaving the room, so the room is destroyed — no leak.
}, [room, localSlot?.name]);
```

**Send handler:**
```ts
const sendChat = (e: React.FormEvent) => {
  e.preventDefault();
  const text = chatInput.trim();
  if (!text) return;
  room.send('chat', { text });
  setChatInput('');
};
```

### Keyboard Hints (footer bar)

```tsx
<span>R READY</span>
{isHost && <span>ENTER LAUNCH</span>}
<span>ESC LEAVE</span>
```

Keyboard handler (`useEffect`):
- `r` / `R` → toggle ready (`room.send('ready_toggle', { ready: !currentReady })`)
- `Enter` → launch if `canLaunch` (host only), but NOT if chat input is focused
- `Escape` → `onLeave()`

The Enter/R guard: check `document.activeElement !== chatInputRef.current` before acting on keypresses — prevents game keys firing while typing in chat.

---

## What Does Not Change

- `usePhaseBounce`, `useMatchState`, `getMatchSlots` — untouched
- The ready/launch Colyseus messages (`ready_toggle`, `launch_battle`) — untouched
- All other MP screens — untouched
- `MpHub.tsx`, `MpLobby.tsx` Props interface — same (`room`, `onLeave`, `onPhaseChange`)

---

## Files Changed

| File | Change |
|---|---|
| `packages/server/src/rooms/MatchRoom.ts` | Add `chat` handler |
| `src/screens/mp/MpLobby.tsx` | Full rewrite |
