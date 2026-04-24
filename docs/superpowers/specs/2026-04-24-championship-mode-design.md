# Championship Mode Design

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Championship mode is an 8-guild single-elimination tournament. The player picks their guild, is seeded into a bracket with 7 CPU opponents, and fights through three rounds (Quarter-Final, Semi-Final, Final). Other matchups are auto-simulated instantly using probabilistic stat comparison. The bracket is visualised between rounds. Winning all three fights earns the Championship title.

---

## Flow

```
menu (champ) → charselect (P1) → champbracket (QF seeding) 
  → stageselect → game (vs, BO1) → champtransition 
  → champbracket (updated) → stageselect → game → champtransition 
  → champbracket (Final) → stageselect → game → champresults
```

If the player is eliminated:
```
game (defeat) → champtransition (ELIMINATED) → champresults (loss state)
```

---

## Championship State

New state slice added to `AppState` (not SimState — this is meta-game state):

```ts
// src/state/useAppState.ts

type ChampParticipant = {
  guildId: GuildId
  isPlayer: boolean
}

type BracketMatch = {
  p1: GuildId
  p2: GuildId
  winner: GuildId | null  // null = not yet played
}

type BracketRound = {
  matches: BracketMatch[]  // 4 matches in QF, 2 in SF, 1 in Final
}

type ChampionshipState = {
  playerGuildId: GuildId
  participants: GuildId[]       // 8 guilds, ordered for bracket seeding
  rounds: BracketRound[]        // length 3: [QF, SF, Final]
  currentRound: 0 | 1 | 2      // which round the player is currently fighting
  playerEliminated: boolean
  matchHistory: ChampMatchResult[]  // one entry per player fight (win or loss)
}

type ChampMatchResult = {
  round: 0 | 1 | 2
  opponentGuildId: GuildId
  playerWon: boolean
  stats: MatchStats  // from SimState.matchStats after fight ends
}
```

`ChampionshipState` is stored in `useAppState` and cleared when the player exits to the menu or a new championship begins.

---

## Bracket Generation

On entry from charselect, `initChampionship(playerGuildId)` runs:

1. Gather 7 CPU guilds: exclude `playerGuildId`, shuffle remaining 14 guilds via `seededShuffle`, take first 7.
2. Assign 8 participants to bracket positions: player seeded at position 0 (top-left). Others fill positions 1–7.
3. Bracket positions pair as: `(0v1), (2v3), (4v5), (6v7)` for QF matches.
4. QF matches: player's match has `winner: null`. All other QF matches auto-simulated immediately (see below).
5. `rounds[0].matches` written; `rounds[1]` and `rounds[2]` computed lazily after each round.

This runs in client-side AppState code (not inside `tickSimulation`), so `Date.now()` is permitted here. A seed is captured once via `Date.now()` at `initChampionship` call time and stored in `ChampionshipState.seed`. A simple mulberry32 PRNG seeded by this value drives bracket shuffle and CPU match results — ensuring identical opponents if the player quits and returns without clearing state.

### Auto-simulation

`simulateCpuMatch(g1: GuildData, g2: GuildData, rng: () => number): GuildId`

```ts
function statScore(g: GuildData): number {
  return g.hpMax + g.armor + g.magicResist + g.moveSpeed * 10
       + g.abilities.reduce((sum, a) => sum + a.baseDamage, 0)
}

function simulateCpuMatch(g1, g2, rng) {
  const s1 = statScore(g1), s2 = statScore(g2)
  const p1WinChance = s1 / (s1 + s2)
  return rng() < p1WinChance ? g1.id : g2.id
}
```

Called for every non-player match. Pure, deterministic given the seed. No actual simulation loop is run.

---

## Simulation Changes

None. Player fights use existing `SimMode='vs'`, BO1 (first KO ends the match, no round state needed — set `roundCount: 1` in `createSimState`). The match result feeds `ChampMatchResult` when the fight resolves.

The only sim-adjacent change: the player's VS fight should run as BO1 (single sudden-death round). The existing `RoundState` already supports this — `createSimState` with `totalRounds: 1`.

---

## New AppScreens

```ts
AppScreen = ... | 'champbracket' | 'champtransition' | 'champresults'
```

---

## New React Components

### `ChampBracketScreen`

`src/screens/ChampBracketScreen.tsx`  
Route: `AppScreen = 'champbracket'`

Tournament tree visualisation.

Layout (4-column grid, left to right: QF → SF → Final → CHAMPION):

```
QF                  SF              FINAL           CHAMPION
[Guild A] ──┐                
[Guild B] ──┴──[Winner AB]──┐
[Guild C] ──┐               ├──[Winner ABCD]──┐
[Guild D] ──┴──[Winner CD]──┘                 │
[Guild E] ──┐                                 ├── ???
[Guild F] ──┴──[Winner EF]──┐                 │
[Guild G] ──┐               ├──[Winner EFGH]──┘
[Guild H] ──┴──[Winner GH]──┘
```

Rendering rules:
- Each guild slot: 40px `GuildMonogram` + name in `fontDisplay` at 14px
- Player's slot outlined in `accent` colour, name shows `· YOU`
- Completed match winner: filled slot with guild colour; loser slot greyed out with `×` stamp
- Player's upcoming match: border in `accent`, pulsing; shows "FIGHT →" CTA below the match
- Auto-simulated-but-not-yet-revealed matches: show `???` until the transition screen reveals them
- Connector lines between rounds: `1px solid theme.lineSoft`

Header: `CHAMPIONSHIP · QUARTER-FINALS` (updates per round), `← QUIT` (exits to menu after confirm), `FIGHT →` (primary CTA, navigates to stageselect for player's match).

### `ChampTransitionScreen`

`src/screens/ChampTransitionScreen.tsx`  
Route: `AppScreen = 'champtransition'`

Post-fight transition that reveals other match results and advances the bracket.

Sequence (auto-playing, ~3s total):
1. Show player's match result: `WIN` in `accent` or `ELIMINATED` in `bad` (1s)
2. Reveal other round matches one by one with a 600ms stagger: each match slot fills with winner guild monogram + name
3. Show the round summary: "QUARTER-FINALS COMPLETE · 4 GUILDS REMAIN"
4. CTA: `ADVANCE TO SEMI-FINALS →` (or `ADVANCE TO FINAL →`, or `VIEW RESULTS` if eliminated)

If player is eliminated: show who eliminated them, show who went on to win the tournament (run remaining auto-sim now), then CTA → `champresults`.

### `ChampResultsScreen`

`src/screens/ChampResultsScreen.tsx`  
Route: `AppScreen = 'champresults'`

Victory layout (player won all 3):
```
CHAMPION
[Guild monogram 200px]
[Guild name — fontDisplay 80px]

Match history across 3 fights:
  QF  vs [Guild]  WIN  ·  DMG 612  COMBO 9  KO: [ult name]
  SF  vs [Guild]  WIN  ·  DMG 744  COMBO 12 KO: [ult name]
  FIN vs [Guild]  WIN  ·  DMG 891  COMBO 15 KO: [ult name]

[← MENU]                              [PLAY AGAIN →]
```

Elimination layout (player lost):
```
ELIMINATED · ROUND 2
Knocked out by [Guild name]

[Guild] went on to claim the Championship.
[Final bracket with all results revealed]

[← MENU]                              [TRY AGAIN →]
```

Both layouts use terminal design system: `fontDisplay` for names/banner, `fontMono` for stats/kickers.

---

## Routing Logic

In `useAppState.ts` / `App.tsx`:

- `menu → champ` → navigate to `'charselect'` with `gameMode: 'champ'`
- `charselect` lock-in → call `initChampionship(playerGuildId)`, navigate to `'champbracket'`
- `champbracket` FIGHT → navigate to `'stage'`
- `stage` confirm → initialise sim as BO1 VS with player vs `currentOpponent`, navigate to `'game'`
- `game` end (victory or defeat) → record `ChampMatchResult`, navigate to `'champtransition'`
- `champtransition` advance → if more rounds and not eliminated: advance bracket, navigate to `'champbracket'`; else navigate to `'champresults'`
- `champresults` PLAY AGAIN / TRY AGAIN → clear `ChampionshipState`, navigate to `'charselect'`
- `champresults` MENU → clear `ChampionshipState`, navigate to `'menu'`

### Determining the current opponent

```ts
function getPlayerMatch(state: ChampionshipState): BracketMatch {
  const round = state.rounds[state.currentRound]
  return round.matches.find(m => m.p1 === state.playerGuildId || m.p2 === state.playerGuildId)!
}

function getOpponent(state: ChampionshipState): GuildId {
  const match = getPlayerMatch(state)
  return match.p1 === state.playerGuildId ? match.p2 : match.p1
}
```

### Advancing the bracket

After player's fight resolves, `advanceBracket(champState, playerWon)`:

1. Set `winner` on player's match in current round.
2. Auto-simulate any remaining matches in the round that haven't been revealed yet.
3. Build next round's match list from winners.
4. Increment `currentRound` (or set `playerEliminated: true` if player lost).

---

## What is NOT in scope

- Multiplayer championship (all 8 players human)
- Configurable bracket size (4-guild or 16-guild variants)
- Seeding by rank or win rate
- Persistent championship history / trophies
- Spectating CPU vs CPU fights as actual gameplay

---

## Files Touched

| File | Change |
|---|---|
| `src/state/useAppState.ts` | Add `ChampionshipState`, `BracketMatch`, `BracketRound`, `ChampMatchResult` types; add `championshipState` to AppState; add `'champbracket'`, `'champtransition'`, `'champresults'` to `AppScreen` |
| `src/state/championship.ts` | New file — `initChampionship`, `advanceBracket`, `simulateCpuMatch`, `getPlayerMatch`, `getOpponent` helpers |
| `src/screens/ChampBracketScreen.tsx` | New file — tournament bracket visualisation |
| `src/screens/ChampTransitionScreen.tsx` | New file — post-round reveal + advance |
| `src/screens/ChampResultsScreen.tsx` | New file — victory / elimination results |
| `src/screens/GameScreen.tsx` | Pass BO1 config when `gameMode === 'champ'`; on match end, record to `matchHistory` |
| `src/screens/MainMenu.tsx` | Enable `champ` menu item (`enabled: true`) |
| `src/screens/CharSelect.tsx` | Hide P2 panel when `gameMode === 'champ'` |
| `src/App.tsx` | Wire new screen routes |
