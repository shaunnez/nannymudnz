# CharSelect MP Parity — Design Spec

**Date:** 2026-04-23  
**Branch:** feat/vs-mode-hud  
**Status:** Approved

## Problem

`MpCharSelect.tsx` was written independently from `CharSelect.tsx` and has accumulated significant visual drift:

| Property | SP (reference) | MP (current) |
|---|---|---|
| Tile size | 190 px | 175 px |
| Tile gap | 20 px | 16 px |
| Tile name font | 20 px | 14 px |
| Tile marker font | 20 px | 10 px |
| Side panel: vitals table | ✓ | ✗ |
| Side panel: VIEW DETAILS | ✓ | ✗ |
| Side panel: guild bio | ✓ | ✗ |
| Side panel: ULT section | ✓ | ✗ |
| Center strip: StatBar chart | ✓ | ✗ (bio text only) |
| GuildDetails modal | ✓ | ✗ |
| Active panel highlight | ✓ | ✗ |
| Shared AccentBtn | ✓ | ✗ (raw button) |

Goal: bring MP to full visual parity with SP by extracting shared panel components and rewriting the MP layout to use them.

## Approach

Extract shared components → import in both files. No behaviour changes to SP. MP rewritten to use the same layout primitives.

## File Changes

### New: `src/screens/CharSelectPanels.tsx`

Extracts from `CharSelect.tsx` and exports:

- `SidePanel` + `SidePanelProps`
- `VitalRow` + `VitalRowProps`
- `AccentBtn` + `AccentBtnProps`
- `StatBar` + `StatBarProps`

Nothing else lives here. No new logic — pure extraction.

### Modified: `src/screens/CharSelect.tsx`

- Remove local definitions of `SidePanel`, `VitalRow`, `AccentBtn`, `StatBar`
- Add: `import { SidePanel, StatBar } from './CharSelectPanels'`
- (`VitalRow` and `AccentBtn` are only used inside `SidePanel` — importing them in `CharSelect.tsx` would trigger `noUnusedLocals`)
- Zero behavioural change

### Modified: `src/screens/mp/MpCharSelect.tsx`

Full layout rewrite. Details below.

## `SidePanel` API Change

One new optional prop:

```ts
interface SidePanelProps {
  role: 'P1' | 'CPU';    // drives accent colour: blue (P1) vs amber (CPU)
  guildId: GuildId;
  locked: boolean;
  active: boolean;
  statusText?: string;   // overrides "LOCKED" / "SELECTING…"
  roleLabel?: string;    // NEW — overrides the "P1 · HUMAN" / "CPU · OPPONENT" line
  onView: () => void;
}
```

Default behaviour (no `roleLabel`) is identical to today. MP passes:
- Left panel: `roleLabel="P1 · YOU"`
- Right panel: `roleLabel={\`P2 · ${opponentSlot.name}\`}`

## `MpCharSelect` Layout

### Header

```
[← LEAVE]   [title + subtitle]   [room-code-badge] [LOCK IN →]
```

LOCK IN button is primary, lives in the header (mirrors SP's READY button position). States:
- Default: `"LOCK IN →"`, primary style, enabled
- After lock: `"LOCKED ✓"`, disabled, success colour

The existing inline LOCK IN button inside the left panel is removed.

### Body — 3-column grid: `280px 1fr 280px`

**Left panel:**
- Component: `SidePanel`
- `roleLabel="P1 · YOU"`
- `guildId`: locked guild if `isLocked`, otherwise `cursorGuildId`
- `locked={isLocked}`
- `active={true}` (always — single cursor in MP)
- `onView`: sets `detailsFor` to open GuildDetails

**Center:**
- Tile grid: `TILE_SIZE=190`, `TILE_GAP=20` (up from 175/16)
- Tile name label: `fontSize: 20` (up from 14)
- Tile marker overlays (✓ P1, ✓ OPP): `fontSize: 20` (up from 10)
- Bottom strip: StatBar 6-stat pip chart (replaces bio text strip), always visible

**Right panel — three conditional states:**

| State | Condition | Render |
|---|---|---|
| Waiting | `!opponentSlot` | Placeholder: same border/bg as SidePanel, "Waiting for opponent to join…" |
| Opponent selecting | `opponentSlot && !opponentSlot.locked` | Placeholder: "Opponent is selecting…" |
| Opponent locked | `opponentSlot?.locked && opponentGuildId` | Full `SidePanel` with `roleLabel`, `guildId`, `locked={true}`, `active={false}`, `onView` |

### Footer

Same keyboard hint bar as SP, minus TAB (no slot switching in MP):
```
◀▶▲▼ MOVE   ↵ LOCK IN   CLICK INSTANT LOCK   ESC LEAVE
```

## Edge Cases

### GuildDetails modal

```ts
const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);
```

- Left panel `onView`: `setDetailsFor(isLocked ? localSlot!.guildId : cursorGuildId)`
- Right panel `onView` (opponent locked only): `setDetailsFor(opponentGuildId as GuildId)`
- Render at component root: `{detailsFor && <GuildDetails guildId={detailsFor} onClose={() => setDetailsFor(null)} />}`

### Keyboard suppression

`useEffect` keyboard handler guard:
```ts
if (detailsFor) return;
```
Same pattern as SP — prevents arrow/Enter from firing while GuildDetails modal is open.

### Tile click behaviour

Unchanged: click = instant lock (same as current MP). This mirrors SP VS mode where clicking a tile locks that slot.

## What Does Not Change

- MP networking (Colyseus `room.send`, `useMatchState`, `getMatchSlots`)
- SP `CharSelect` behaviour (zero change beyond the import swap)
- `GuildDetails` component itself
- `usePhaseBounce`, `RoomCodeBadge`, `MpLoading` — untouched
