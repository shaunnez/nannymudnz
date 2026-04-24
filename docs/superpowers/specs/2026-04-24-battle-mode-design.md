# Battle Mode Design

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Battle mode is a local free-for-all fight with 2–8 combatants (any mix of HUMAN and CPU). The player picks their guild, then configures all 8 slots (HUMAN / CPU / OFF) and assigns teams. The game runs a single simultaneous fight — all enemies fight the player at once — using the existing story-mode sim. A full scoreboard is shown on completion.

**MVP scope**: all CPU fighters target the player (not each other). True FFA targeting (CPU vs CPU) is a phase 2 enhancement.

---

## Flow

```
menu (batt) → charselect (P1) → battleconfig → stageselect → game (battle) → battresults
```

- CharSelect: P1 picks their guild. P2 panel hidden (opponent is configured in battleconfig).
- BattleConfig: player configures all 8 slots — HUMAN/CPU/OFF, guild per CPU slot, team A/B/C/D.
- StageSelect: unchanged.
- GameScreen: initialises sim with `battleMode: true`; renders `BattleHUD8` overlay.
- On match end (all enemies KO'd or player KO'd or timer expired), transitions to `'battresults'`.

---

## Simulation Changes

### New SimState fields

```ts
// packages/shared/src/simulation/types.ts
battleMode: boolean           // set to true at creation
battleSlots: BattleSlot[]     // mirrors TeamConfig output
battleTimer: number           // countdown in ms, default 180_000 (3 minutes)
```

```ts
type BattleSlot = {
  guildId: GuildId
  type: 'human' | 'cpu' | 'off'
  team: 'A' | 'B' | 'C' | 'D' | null
}
```

### `createSimState` for battle

When `battleMode: true`:
- `mode: 'story'` (reuses story tick path)
- `player` actor: the human slot's guild
- `enemies[]`: one `Actor` per active CPU slot, guild set from `battleSlot.guildId`, AI strategy from `guildData`
- Existing enemy spawn positions stagger them across the stage (use existing `PLAYER_SPAWN_X` offsets)
- `waves` array left empty — no wave spawning, all combatants present from tick 0
- `battleTimer` initialised to 180_000

### `tickSimulation` changes

In the story-mode branch, when `state.battleMode`:

1. **Timer**: decrement `state.battleTimer` by `dt`; when it reaches 0, resolve by highest remaining HP (all enemies with `hp > 0` → player wins if `state.player.hp > max(enemies[i].hp)`, else defeat).
2. **No wave spawning**: skip the wave-spawn logic entirely when `battleMode`.
3. **Win condition**: when all `state.enemies` have `hp <= 0`, set `phase: 'victory'`.
4. **KO tracking**: add a `battStats` object to `SimState` recording per-actor kills/deaths/damage dealt — used for the results scoreboard.

```ts
// Appended to SimState
battStats: {
  [actorId: string]: { kills: number; deaths: number; dmgDealt: number; healing: number }
} | null
```

No new `SimMode` — battle stays `mode: 'story'` with a flag.

---

## New AppScreens

```ts
AppScreen = ... | 'battleconfig' | 'battresults'
```

---

## New React Components

### `BattleConfigScreen`

`src/screens/BattleConfigScreen.tsx`  
Route: `AppScreen = 'battleconfig'`

Implements the `TeamConfig` design from `design_handoff_nannymud/screens-02.jsx`:

- 8 slot cards in a 4-column grid
- Each slot card shows: slot number, guild monogram (or EMPTY placeholder), slot name, type badge (HUMAN / CPU / OFF — click to cycle), team selector (A / B / C / D), color swatch
- Player's own slot (HUMAN) shows their chosen guild; guild is locked — cannot be changed here
- CPU slots: player can click to cycle through the 15 guilds
- OFF slots: greyed out, no guild
- Header: `SLOTS · CONFIG` kicker, `Set the field` title, `← BACK` and `STAGE →` (primary, enabled when ≥1 CPU slot active)
- Footer: hint text `CLICK TYPE TO CYCLE · HUMAN / CPU / OFF`

State shape (component-local, then passed to AppState on confirm):

```ts
{
  slots: Array<{
    type: 'human' | 'cpu' | 'off'
    guildId: GuildId | null
    team: 'A' | 'B' | 'C' | 'D'
    color: number  // 0–7 for TEAM_COLORS
  }>
}
```

Player's slot defaults to `type: 'human'` with their selected guild. Of the remaining 7 slots: 2 default to `type: 'cpu'` with random guilds, 5 default to `type: 'off'`, giving a ready-to-play 3-fighter default.

### `BattleHUD8`

`src/screens/BattleHUD8.tsx`

Overlay mounted over `GameScreen` when `gameMode === 'batt'`. Implements the 8P Battle HUD from `design_handoff_nannymud/screens-07.jsx`:

- **Top bar**: up to 4 player cards (36px monogram, name, HP meter green→amber→red, resource meter)
- **Bottom bar**: remaining player cards (if >4 slots active)
- **Centre area**: `X / N ALIVE` counter, stage backdrop, 3-minute countdown timer badge (MM:SS format)
- **Combat log** (right side, toggleable): `[actor] → [actor] · [ability] (dmg)`
- KO state: dims card, stamps `KO` in `bad` colour
- HP meter transitions: green (>35%), amber (15–35%), red (<15%), `width 200ms linear`
- Player's card outlined in `accent` colour; CPU cards in their team colour

Reads `simState` from `game.registry`, same pull pattern as VS HUD.

### `BattleResultsScreen`

`src/screens/BattleResultsScreen.tsx`  
Route: `AppScreen = 'battresults'`

Implements the `MPResults8` design from `design_handoff_nannymud/screens-07.jsx`:

- Winner banner: `RESULTS · BATTLE` kicker, winner name or team in `fontDisplay` at 64px
- Full scoreboard sorted by SCORE: `# | monogram | name | guild | K | D | DMG | HEAL | SCORE`
- Winning row(s) highlighted in `accent`
- Score bar (horizontal meter) per row
- Footer: `← MENU` and `REMATCH →` (primary — re-runs same config, skips battleconfig)

Score formula (computed from `battStats`):
```
score = kills × 500 + dmgDealt × 0.5 - deaths × 200 + healing × 0.3
```

---

## Routing Logic

In `useAppState.ts` / `App.tsx`:

- `menu → batt` → navigate to `'charselect'` with `gameMode: 'batt'`
- `charselect` lock-in → navigate to `'battleconfig'`
- `battleconfig` confirm → store slots in AppState, navigate to `'stage'`
- `stage` confirm → initialise sim with `battleMode: true` + slots, navigate to `'game'`
- `game` victory/defeat → navigate to `'battresults'`
- `battresults` REMATCH → re-initialise sim with same slots + stage, navigate to `'game'`
- `battresults` MENU → navigate to `'menu'`

---

## What is NOT in scope

- True FFA targeting (CPU fighters attacking each other — phase 2)
- Network multiplayer battle
- Spectator mode
- Saving battle replays or persistent stats

---

## Files Touched

| File | Change |
|---|---|
| `packages/shared/src/simulation/types.ts` | Add `battleMode`, `battleSlots`, `battleTimer`, `battStats` to `SimState`; add `BattleSlot` type |
| `packages/shared/src/simulation/simulation.ts` | Battle-mode branch in story tick: timer, skip waves, win condition, stat tracking |
| `src/state/useAppState.ts` | Add `'battleconfig'`, `'battresults'` to `AppScreen`; add `battleSlots` to AppState |
| `src/screens/BattleConfigScreen.tsx` | New file — 8-slot TeamConfig screen |
| `src/screens/BattleHUD8.tsx` | New file — 8P HUD overlay |
| `src/screens/BattleResultsScreen.tsx` | New file — scoreboard results |
| `src/screens/GameScreen.tsx` | Mount `BattleHUD8` when `gameMode === 'batt'`; route end → `'battresults'` |
| `src/screens/MainMenu.tsx` | Enable `batt` menu item (`enabled: true`) |
| `src/screens/CharSelect.tsx` | Hide P2 panel when `gameMode === 'batt'` |
| `src/App.tsx` | Wire new screen routes |
