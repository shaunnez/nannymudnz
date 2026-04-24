# Survival Mode Design

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Survival mode is an endless single-player wave-fight where the player picks one guild and fights escalating waves until KO. Score is tracked per-wave and persisted to a local leaderboard (top 10 per guild). It reuses the existing story/wave simulation machinery with minimal changes.

---

## Flow

```
menu (surv) → charselect (P1 only) → stageselect → game (survival) → survresults
```

- CharSelect shows a single P1 cursor; P2 panel is hidden. Lock-in sends directly to stage select (no opponent needed).
- StageSelect is unchanged.
- GameScreen initialises sim with `survivalMode: true`; renders a `SurvivalHUD` overlay in place of the story HUD.
- On player KO, transitions to `'survresults'` screen.

---

## Simulation Changes

### New SimState fields

```ts
// packages/shared/src/simulation/types.ts
survivalMode: boolean     // set to true at creation; never mutated
survivalScore: number     // running tally, incremented per enemy KO
```

### Wave generator — `tickSimulation` changes

In `packages/shared/src/simulation/simulation.ts`, inside the story-mode branch:

1. **No victory**: when `state.survivalMode && state.phase === 'victory'`, instead of resolving victory:
   - Increment `state.currentWave`
   - Call `spawnSurvivalWave(state)` (new helper, see below)
   - Reset `state.phase` to `'playing'`

2. **Score on KO**: when an enemy transitions to `hp <= 0`, add `100 × state.currentWave` to `state.survivalScore`.

### `spawnSurvivalWave(state)`

New pure function in `packages/shared/src/simulation/survivalWaves.ts`:

```ts
function spawnSurvivalWave(state: SimState): void
```

- Enemy count: `2 + Math.floor(state.currentWave * 0.6)`, capped at 8
- Guild tier escalation:
  - Waves 1–4: random guild from the 15
  - Waves 5–9: random guild, but min-stat floor applied (higher STR/CON)
  - Waves 10+: draw from a hardened pool (Champion, Darkmage, Viking, Master, Monk)
  - Every 5 waves, one enemy is a "boss" variant (1.5× HP, 1.2× damage)
- Uses `state.rng()` exclusively — no `Math.random()`
- Spawns enemies via the existing enemy-spawn path used by the story wave system
- Enemy AI difficulty matches the existing bot difficulty setting

No changes to the `SimMode` type — survival stays `mode: 'story'`.

---

## Routing Changes

### New AppScreen

```ts
// src/state/useAppState.ts
AppScreen = ... | 'survresults'
```

### GameMode routing

When `gameMode === 'surv'`:
- `createSimState` called with `survivalMode: true`, `currentWave: 1`, `survivalScore: 0`
- `waves` array seeded with wave 1 config only (subsequent waves generated dynamically)
- On `phase === 'defeat'`, navigate to `'survresults'`

---

## New React Components

### `SurvivalHUD`

`src/screens/SurvivalHUD.tsx`

Mounts as an overlay over `GameScreen` when `gameMode === 'surv'`. Reads `simState.currentWave` and `simState.survivalScore` from `game.registry` (same pull pattern as other HUD overlays).

Layout:
- **Top-centre**: Wave badge — `WAVE 01` in `fontDisplay`, score counter below in `fontMono` (e.g. `SCORE · 4,200`)
- Replaces the round timer (survival has no round timer)
- Minimal — does not cover the action area

### `SurvivalResultsScreen`

`src/screens/SurvivalResultsScreen.tsx`

New `AppScreen = 'survresults'`.

Layout follows the terminal design system:

```
┌──────────────────────────────────────────────────────┐
│  GAME OVER · SURVIVAL                                │
│  Wave 07 Reached               [guild monogram 160] │
│  Score · 8,400                                       │
│  [PERSONAL BEST chip] [NEW RECORD chip if applicable]│
├──────────────────────────────────────────────────────┤
│  LOCAL LEADERBOARD · [guild name]                    │
│  01  ████████████  12,400   · WAVE 14                │
│  02  ████████░░░░   8,400   · WAVE 07  ← YOU        │
│  …  (up to 10 entries)                               │
├──────────────────────────────────────────────────────┤
│  [← MENU]                        [RETRY →] (primary) │
└──────────────────────────────────────────────────────┘
```

### Leaderboard persistence

Key: `nannymud-surv-{guildId}` in localStorage.  
Value: `{ entries: Array<{ score: number; wave: number; date: string }> }`, max 10 entries, sorted descending by score.

Read on mount, write on new entry before render. No server persistence in this phase.

---

## What is NOT in scope

- Online leaderboard / server-side ranking
- Co-op survival (two human players)
- Selectable difficulty modifiers (hard mode, modifiers)
- Achievements or unlocks tied to survival milestones

---

## Files Touched

| File | Change |
|---|---|
| `packages/shared/src/simulation/types.ts` | Add `survivalMode`, `survivalScore` to `SimState` |
| `packages/shared/src/simulation/simulation.ts` | Intercept victory in survival mode; score on enemy KO |
| `packages/shared/src/simulation/survivalWaves.ts` | New file — `spawnSurvivalWave()` |
| `src/state/useAppState.ts` | Add `'survresults'` to `AppScreen`; survival init logic |
| `src/screens/SurvivalHUD.tsx` | New file — wave + score overlay |
| `src/screens/SurvivalResultsScreen.tsx` | New file — results + leaderboard |
| `src/screens/GameScreen.tsx` | Mount `SurvivalHUD` when `gameMode === 'surv'`; route defeat → `'survresults'` |
| `src/screens/MainMenu.tsx` | Enable `surv` menu item (`enabled: true`) |
| `src/screens/CharSelect.tsx` | Hide P2 panel when `gameMode === 'surv'` |
