# Stage Mode Char-Select: Two-Panel Layout

Date: 2026-04-23
Scope: `src/screens/CharSelect.tsx` — stage mode only (`mode !== 'vs'`).
Non-goal: any change to VS / MP char-select flow.

## Problem

In stage mode today, `CharSelect` renders a single left-hand detail panel. Hover drives both the cursor and `picks.p1`, so there is no visual distinction between "what I'm previewing" and "what I've committed to." The right half of the screen is empty.

## Goal

Mirror the VS layout in stage mode:

- Left panel = **hover preview** (follows cursor).
- Right panel = **selected guild** (what `onReady` will commit).

VS mode stays exactly as-is.

## Behavior

### Layout
- Body grid becomes `'280px 1fr 280px'` in both VS and stage.
- Tile size: 175px, 16px gap (current VS values) in both modes.
- `TILE_SOLO` constant is deleted.

### Selection flow (stage mode)
- `picks.p1` is pre-populated from `initialP1` (unchanged). Right panel shows that guild on open, READY is enabled immediately.
- Hover (mouse-enter or arrow keys) only moves `cursors.p1`. It **does not** write `picks.p1`.
- Click a tile = set `picks.p1` to that tile's guild. No lock, can change again freely.
- Enter = same as click: commit the currently hovered guild to `picks.p1`.
- READY button = `onReady(picks.p1, picks.opp)`. No keyboard shortcut other than clicking.
- Escape / Backspace = `onBack` (unchanged).
- Tab / SWITCH button = hidden in stage (unchanged).

### Panel contents
Reuse `SidePanel` verbatim. Add one optional prop:

```ts
statusText?: string; // overrides the default "LOCKED" / "SELECTING…" label
```

When present it replaces the status span text; colors still derive from `locked`.

Stage mode usage:
- **Left** — `role="P1"`, `active={true}`, `locked={false}`, `guildId={ids[cursors.p1]}`, `statusText="HOVER"`.
- **Right** — `role="P1"`, `active={false}`, `locked={true}`, `guildId={picks.p1}`, `statusText="SELECTED"`.

The right panel's `locked={true}` gives it the green "committed" status color; `statusText="SELECTED"` overrides the word.

### Grid tile indicators
- Hover badge (`◆ P1`) stays on the cursor tile.
- Selected outline (`outline: 2px solid theme.accent` on `picks.p1 === g.id`, already in code at the `p1Picked` branch) stays.

### Footer hint
Stage mode text becomes: `◀▶▲▼ MOVE   ↵ SELECT   ESC BACK`.
VS mode footer unchanged.

## Files

- `src/screens/CharSelect.tsx`
  - Body grid: use `'280px 1fr 280px'` in both modes.
  - Tile sizing: use VS values for both modes; delete `TILE_SOLO`.
  - Remove the `!hasOpponent` branch inside the grid's `onMouseEnter` (hover no longer writes `picks.p1`).
  - `onClick` branch for stage: just `setPicks({ ...p, p1: g.id })` and move the cursor. No lock, no switch.
  - Enter handler for stage: commit the hovered guild to `picks.p1`; do **not** call `onReady`.
  - Render a right-side `SidePanel` in stage mode, bound to `picks.p1`.
  - Update footer hint text for stage.
  - Extend `SidePanel` with an optional `statusText` prop.

## VS mode risk

All stage-specific branches are gated on `!hasOpponent`. VS keeps its `'280px 1fr 280px'` layout, dual panels, lock semantics, Tab switching, SWITCH button, and existing keyboard flow.

Because the body grid is now `'280px 1fr 280px'` for all modes, VS is unchanged there — the previous `320px 1fr` only applied in stage.

## Out of scope

- No change to `p1Chosen` tracking / localStorage schema. Right panel pre-fills with `initialP1` on every entry.
- No new keyboard shortcut for READY.
- No toggle/deselect on clicking the already-selected tile.
