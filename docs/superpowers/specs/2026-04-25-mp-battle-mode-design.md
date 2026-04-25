# MP Battle Mode — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Overview

Add a second multiplayer game mode — **Battle** (up to 8 players) — alongside the existing **Versus** (1v1). The host picks the mode when creating a room. Versus is unchanged. Battle adds a lobby that supports up to 8 human + CPU slots, a shared battle config screen, and a new `battle_config` phase.

---

## 1. Schema & Protocol

### `MatchState` additions

```ts
@type('string') gameMode: 'versus' | 'battle' = 'versus'
@type('boolean') uniqueGuilds: boolean = false
@type([BattleSlotSchema]) battleSlots: ArraySchema<BattleSlotSchema>
```

`battleSlots` contains exactly 8 entries in Battle mode (populated on `launch_battle`). Empty in Versus rooms — never generates schema diffs.

### New `BattleSlotSchema`

```ts
@type('string') slotType: 'human' | 'cpu' | 'off' = 'off'
@type('string') guildId: string = ''
@type('string') team: string = ''          // 'A' | 'B' | 'C' | 'D' | ''
@type('string') ownerSessionId: string = ''  // set for human slots
```

### `MatchPhase` addition

```ts
type MatchPhase = 'lobby' | 'char_select' | 'stage_select' | 'loading' | 'in_game' | 'results'
                | 'battle_config'   // NEW — between lobby and stage_select in Battle mode
```

### New client→server messages

| Message | Sender | Payload | When |
|---|---|---|---|
| `set_battle_slot` | host only | `{ index, slotType, guildId, team }` | `battle_config` phase |
| `set_my_guild` | any human | `{ guildId }` | `battle_config` phase |
| `launch_from_config` | host only | `{}` | `battle_config` phase, ≥2 active slots |

Versus mode messages (`launch_battle`, `lock_guild`, etc.) are untouched.

---

## 2. Screens & UI Flow

### `CreateRoomModal`

- Add mode toggle: `VERSUS · 1V1` / `BATTLE · UP TO 8`
- Rounds picker (`1 / 3 / 5 / 7`) remains visible for **both** modes
- Battle mode adds two extra toggles:
  - **UNIQUE GUILDS** on/off — enforced server-side; visual indicators always shown regardless
  - *(visibility public/private remains as-is)*
- `gameMode`, `uniqueGuilds`, `rounds` all passed to `hostRoom()`

### `MpLobby` — Battle mode variant

- Header chip: `BATTLE` (not `1V1`); slot counter: `N/8`
- Player grid renders up to 8 `SlotCard`s — connected players as filled cards, remaining as dashed empty slots
- Host can kick any connected player (same `kick` message, same server guard)
- Ready logic unchanged — all connected players must ready up
- Host action button: **NEXT →** (instead of LAUNCH BATTLE) — sends `launch_battle` which transitions to `battle_config`
- `canLaunch` check: `atLeastTwoConnected && allReady`

### New `MpBattleConfig` screen

Rendered when `state.phase === 'battle_config'`.

**Layout:** 8-slot grid (matches `BattleConfigScreen` visually — 4 columns × 2 rows).

**Host controls (full edit):**
- Cycle slot type on non-human slots: `cpu → off → cpu`
- Cycle guild on CPU slots by clicking portrait
- Set team on all active slots (A / B / C / D / none)
- "STAGE →" button enabled when ≥2 active slots; sends `launch_from_config`

**Human player controls (own slot only):**
- Click own portrait to cycle guild; sends `set_my_guild`
- All other slots read-only

**Guild taken indicators (always shown, regardless of uniqueGuilds setting):**
- Each guild portrait shows a player tag (name initial + slot number) in the top corner for every slot that has claimed it — styled like `◆ P1` / `◆ OPP` in `MpCharSelect`, using team color or accent
- If `uniqueGuilds` is on, clicking a taken guild is rejected server-side; client detects no state change and flashes "TAKEN" on the portrait

**On player disconnect during `battle_config`:** their slot flips to `'off'`; host can flip it to `cpu` if desired.

### Unchanged screens

`MpStageSelect`, `MpCharSelect` (VS only), `MpBattle`, `ResultsScreen` — no changes. Battle mode enters `stage_select` from `launch_from_config` and proceeds identically to Versus from that point.

---

## 3. Server — `MatchRoom` changes

### `onCreate`

- Read `opts.gameMode` (`'versus'` default) and `opts.uniqueGuilds` (`false` default)
- Set `this.maxClients = gameMode === 'battle' ? 8 : 2`
- Set metadata to include `gameMode`

### `launch_battle` handler (modified)

- **Versus:** unchanged — guards `slots.length === 2 && all ready`, transitions to `char_select`
- **Battle:** guards `atLeastTwo connected && all ready`, initialises `battleSlots`:
  - One entry per connected player: `slotType: 'human'`, `ownerSessionId` set, `guildId: ''`, `team: ''`
  - Remaining entries (up to 8): `slotType: 'off'`
  - Transitions to `battle_config`

### `set_battle_slot` handler (new)

- Guard: host only, phase `=== 'battle_config'`
- Guard: if `uniqueGuilds` and another active slot already has the same `guildId`, reject (no state mutation)
- Otherwise: update `battleSlots[index]` fields

### `set_my_guild` handler (new)

- Guard: phase `=== 'battle_config'`
- Find slot where `ownerSessionId === client.sessionId`
- Same uniqueness guard as above
- Update `slot.guildId`

### `launch_from_config` handler (new)

- Guard: host only, phase `=== 'battle_config'`, active slot count ≥ 2
- Transition to `stage_select`

### `onLeave` in `battle_config` phase (modified)

- Departing player's slot: set `slotType = 'off'`, clear `ownerSessionId`
- If no connected slots remain, close room (same as existing logic)
- Host promotion: if host leaves, promote next connected player (same pattern as lobby)

### `startMatch` (modified for Battle mode)

`startMatch` is triggered by `ready_to_start` from both clients — same as Versus. The modification is a `gameMode` branch:

- **Versus:** existing logic unchanged — `createMpVsState(hostGuildId, joinerGuildId, seed, stageId)`
- **Battle:** reads `battleSlots` (filtering to `slotType !== 'off'`), converts to `BattleSlot[]` (matching the SP `BattleConfigScreen` output format), and calls the existing multi-actor battle simulation initializer (the same one the SP Battle mode uses)

The tick loop, `pick_stage`, `ready_to_start`, `rematch_offer/accept`, and results handling are untouched.

---

## 4. What is NOT changing

- Versus mode end-to-end: `CreateRoomModal` defaults to Versus, `MpLobby` 2-slot path, `MpCharSelect`, all server VS handlers
- `PlayerSlot` schema — no changes
- `BattleConfigScreen` (SP) — not touched; `MpBattleConfig` is a new parallel component
- Balance tooling, simulation, AI, audio, rendering — untouched
