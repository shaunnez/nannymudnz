# MP Polish — 4 Issues Design Spec

**Date:** 2026-04-23  
**Branch:** feat/vs-mode-hud  
**Status:** Approved

## Overview

Four follow-up fixes to the MP char-select parity work:

1. Click should not auto-lock guild in MP char-select
2. Header alignment (LOCK IN button too high vs RoomCodeBadge)
3. Stage select visual parity + real-time host cursor sync for joiner
4. Remove Phaser native loading bar; wire real progress to React bars

---

## Issue 1 — MP click no longer auto-locks

**File:** `src/screens/mp/MpCharSelect.tsx`

Remove `room.send('lock_guild', ...)` from the tile `onClick` handler. Click should only move the cursor (preview the guild). Only the LOCK IN button in the header and the Enter key should send the lock message.

```tsx
// Before
onClick={() => {
  if (isLocked) return;
  setCursorIdx(i);
  room.send('lock_guild', { guildId: g.id });
}}

// After
onClick={() => {
  if (isLocked) return;
  setCursorIdx(i);
}}
```

---

## Issue 2 — Header alignment

**File:** `src/screens/mp/MpCharSelect.tsx`

The right header group uses `alignItems: 'center'`. `RoomCodeBadge` is two rows tall (label + code), `Btn` is single-row, so the button floats too high. Fix: `alignItems: 'flex-end'`.

```tsx
// Before
<div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'center' }}>

// After
<div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
```

---

## Issue 3 — Stage select parity

### New file: `src/screens/StagePanels.tsx`

Exports two components extracted/unified from `StageSelect.tsx`:

**`StageTile`**

Props:
```ts
interface StageTileProps {
  stage: StageMeta;
  index: number;
  active: boolean;
  isHost: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}
```

Renders one stage card: image (or gradient+pattern fallback if no preview), scrim gradient for label legibility, number badge (top-left), HUE badge (top-right), name + status label at bottom. When `!isHost`, cursor is `'default'` and `onClick` is ignored.

**`StageDetailPanel`**

Props:
```ts
interface StageDetailPanelProps {
  stages: StageMeta[];
  cursor: number;
  isHost: boolean;
  onSelect: (idx: number) => void;
}
```

Renders the 420px right-hand sidebar: availability tag, stage name, 16:9 image preview (or gradient fallback), blurb, scrollable stage list. When `!isHost`, `onSelect` is a no-op (list items are read-only).

### Modified: `src/screens/StageSelect.tsx`

Replace local tile rendering and sidebar with `StageTile` + `StageDetailPanel`. Zero behaviour change.

### Modified: `src/screens/mp/MpStageSelect.tsx`

**Host view** — same layout as SP (`flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px'`):
- Uses `StageTile` with `isHost={true}`
- Tile `onClick` sends `pick_stage` (committed pick); cursor moves on `onMouseEnter`
- On every cursor change (keyboard `move()` + `setCursor()` from mouse enter): `room.send('hover_stage', { idx })`
- Send once on mount: `room.send('hover_stage', { idx: 0 })` (or initial cursor)
- Uses `StageDetailPanel` with `isHost={true}`, `onSelect` → `room.send('pick_stage', ...)`

**Joiner view** — same grid + panel layout with `isHost={false}`:
- `cursor={state.hoveredStageIdx}` (server-synced host cursor)
- No keyboard handler
- FIGHT button absent from header
- Footer: "Waiting for host…" + ESC LEAVE

### Server: `packages/shared/src/schema/MatchStateSchema.ts`

Add:
```ts
@type('uint8') hoveredStageIdx: number = 0;
```

### Server: `packages/server/src/rooms/MatchRoom.ts`

Add message handler:
```ts
this.onMessage('hover_stage', (client, { idx }: { idx: number }) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  this.state.hoveredStageIdx = Math.max(0, Math.min(8, idx));
});
```

---

## Issue 4 — Loading bar

### Modified: `src/game/scenes/BootScene.ts`

Remove the native Phaser loading bar (the rectangle/label creation and `this.load.on('progress', ...)` block). Replace with a progress relay:

```ts
this.load.on('progress', (value: number) => {
  this.game.events.emit('preload-progress', value);
});
```

The React `LoadingScreen` already has a `progress` prop (0..1) that wires both player bars to real data instead of the cosmetic 2.2s animation.

### Modified: `src/screens/GameScreen.tsx`

Add `progress` state and listener:

```ts
const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);

// Inside the game-creation useEffect, after creating `game`:
game.events.on('preload-progress', setLoadProgress);
// In cleanup:
game.events.off('preload-progress', setLoadProgress);
```

Pass to `LoadingScreen`:
```tsx
<LoadingScreen
  p1={p1}
  p2={p2 ?? 'knight'}
  stageId={stageId as StageId}
  showOpponent={mode === 'vs'}
  progress={loadProgress}
/>
```

When `preload-done` fires, `preloading` becomes `false` and `LoadingScreen` is unmounted — no need to reset `loadProgress`.

---

## What Does Not Change

- SP `StageSelect` behaviour (zero change beyond the component import swap)
- SP `CharSelect` / `MpCharSelect` outside of issues 1 & 2
- `LoadingScreen` component itself (already supports `progress` prop)
- `MpLoadingScreen` (pre-game lobby loading screen — separate from GameScreen's preload bar)
- All simulation code
