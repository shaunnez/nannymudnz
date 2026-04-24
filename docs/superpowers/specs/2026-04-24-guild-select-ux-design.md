# Guild Select UX — Design Spec

**Date:** 2026-04-24  
**Branch:** feat/vs-mode-hud  
**Files in scope:** `src/screens/CharSelect.tsx`, `src/screens/MpCharSelect.tsx`, `src/screens/CharSelectPanels.tsx`

---

## Problem

The current guild selection flow conflates two things in the `locked` state:

1. "Has the player explicitly clicked a guild at least once" (pick state)
2. "Is this selection final and committed" (ready state)

This causes the current bugs:
- Clicking a tile in VS mode auto-switches the active slot, making it impossible to re-pick P1 without pressing Tab/SWITCH.
- In MP, clicking doesn't pick anything — only the LOCK IN button does, so the click feedback is wrong.
- The READY button in VS mode can be gated by "locked" even when neither player has intentionally confirmed.

---

## Design

### Mental model

There are two distinct phases:

| Phase | Meaning | Reversible? |
|-------|---------|------------|
| **Pick** | Player has explicitly clicked a guild | Yes — click another tile to change |
| **Ready / Lock In** | Final commit, game proceeds | No |

"Hovering" (cursor movement) is always free and previews the center stat strip. It never commits anything.

---

### `CharSelect.tsx` — 1v1 vs CPU

#### State shape

```ts
picks:      Record<'p1' | 'cpu', GuildId | null>  // null = not yet explicitly clicked
cursors:    Record<'p1' | 'cpu', number>           // grid cursor index per slot
activeSlot: 'p1' | 'cpu'                           // which slot the player is currently selecting for
```

The old `locked` state is removed entirely. `picks[slot] !== null` replaces "has picked".

#### Interaction rules

- **Hover** (`onMouseEnter`) → moves `cursors[activeSlot]`. No commit.
- **Click** → sets `picks[activeSlot] = guildId`. Always overwrites previous pick. Never auto-switches `activeSlot`.
- **SWITCH button** → the **only** way to change `activeSlot`. Label: "SWITCH CPU" when active = p1, "SWITCH P1" when active = cpu.
- **Tab key** → same as SWITCH button.
- **READY button** → enabled when `picks.p1 !== null && picks.cpu !== null` (VS), or `picks.p1 !== null` (non-VS). Calls `onReady(picks.p1!, picks.cpu!)`.
- **Enter** → if ready: call onReady; else: set pick from cursor (same as click).
- **Escape** → call onBack.

#### Side panel display

| picks[slot] | activeSlot matches? | Status label |
|-------------|--------------------|----|
| null | yes | SELECTING… |
| null | no | NOT PICKED |
| GuildId | yes | PICKED |
| GuildId | no | PICKED (dimmed) |

The center stat strip always previews the currently hovered tile regardless of active slot or pick state.

#### Non-VS mode (story/waves)

Only P1 slot exists. No SWITCH button, no CPU panel. Right panel is the "SELECTED echo" panel showing P1's current pick (or empty if nothing clicked). READY enabled as soon as `picks.p1 !== null`.

---

### `MpCharSelect.tsx` — Multiplayer

#### State shape

Add one piece of local state:

```ts
localPick: GuildId | null   // null = not yet clicked; purely local until LOCK IN
```

`isLocked` (derived from `localSlot?.locked`) continues to represent the server-confirmed final state.

#### Interaction rules

- **Hover** → moves cursor. No commit.
- **Click** → sets `localPick = guildId`. Always overwrites previous local pick. Only works while `!isLocked`.
- **LOCK IN button** → enabled when `localPick !== null && !isLocked`. Sends `room.send('lock_guild', { guildId: localPick })`. After this, tiles are disabled.
- **Enter** → if `localPick !== null && !isLocked`: lock in; else if no pick yet: set pick from cursor.
- **Escape** → call onLeave.

No server changes required. The `lock_guild` message is the same as before — we're just delaying it until the button rather than not sending it from a click.

#### Opponent panel

Unchanged. Shows "Selecting…" until `opponentSlot?.locked` arrives from the server. The local player's hover and pick are invisible to the opponent.

#### Left panel (local player)

Shows the `localPick` guild if not null, otherwise an empty/unselected state. `locked` prop = `isLocked` (server-confirmed).

---

### `CharSelectPanels.tsx` — `SidePanel`

`SidePanel` already accepts a `locked` and `active` prop. Adjust `statusText` derivation:

| locked | active | statusText |
|--------|--------|-----------|
| true | any | LOCKED / PICKED |
| false | true | SELECTING… |
| false | false | NOT PICKED |

No structural changes to the component. The caller passes the right values.

---

## Edge cases

- **Same guild for both slots:** allowed in VS mode. CPU can mirror P1's pick.
- **Keyboard with detailsFor open:** keyboard handler is suppressed while GuildDetails modal is open (existing behaviour, unchanged).
- **MP re-join / reconnect:** if `localSlot?.locked` is already true on mount (reconnect scenario), show locked state immediately and disable tiles.

---

## Out of scope

- Animated lock-in transitions
- Random CPU pick button ("randomise CPU")
- Keyboard shortcut to confirm CPU pick without switching slots
