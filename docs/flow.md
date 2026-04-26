# Screen Flow by Game Mode

## How routing works

Single state machine in `src/state/useAppState.ts`. One `screen` field (enum of ~32 IDs). `App.tsx` is a conditional render switch on `state.screen`. Screens navigate by calling `go(nextScreen, stateUpdates?)`. No React Router — just state.

Multiplayer is the exception: server phase broadcasts drive transitions instead of the screens themselves. `App.tsx` maps `MatchPhase → AppScreen` via `PHASE_TO_SCREEN`.

---

## VS (local 1v1 vs CPU or 2P)

```
TitleScreen.tsx
  → MainMenu.tsx
  → CharSelect.tsx          (hasOpponent=true, dual-slot)
  → StageSelect.tsx
  → GameScreen.tsx          (mode='vs')
  → ResultsScreen.tsx       (rematch loops back to GameScreen, menu goes to MainMenu)
```

Difficulty: `vsDifficulty` (0–5), set in SettingsScreen.

---

## Story / Stage (wave-based campaign)

```
MainMenu.tsx
  → CharSelect.tsx          (hasOpponent=false, single-slot, CPU auto-seeded)
  → StageSelect.tsx         (progression tracked in useStageProgress / localStorage)
  → GameScreen.tsx          (mode='story')
  → StoryVictoryOverlay.tsx  OR  StoryGameOverOverlay.tsx
    → rematch → GameScreen  OR  menu → MainMenu
```

---

## Survival (endless waves)

```
MainMenu.tsx
  → CharSelect.tsx
  → StageSelect.tsx
  → GameScreen.tsx          (survivalMode=true, onSurvivalEnd callback)
  → SurvivalResultsScreen.tsx   (wave reached, score, top-10 leaderboard per guild in localStorage)
    → retry → GameScreen   OR  menu → MainMenu
```

---

## Championship (8-player seeded bracket tournament)

```
MainMenu.tsx
  → CharSelect.tsx
  → [initChampionship(p1, seed)]
  → ChampBracketScreen.tsx  (shows QF/SF/F, next opponent)
  → StageSelect.tsx         (p2 auto-set via getOpponent(champState))
  → GameScreen.tsx          (onChampEnd callback, not onVictory/onDefeat)
  → ChampTransitionScreen.tsx   (result reveal banner, all round scores)
    → if not final → ChampBracketScreen  (loop)
    → if final OR eliminated → ChampResultsScreen.tsx
      → play again → CharSelect   OR  menu → MainMenu
```

Bracket logic: `src/state/championship.ts` — `initChampionship`, `getOpponent`, `advanceBracket`. PRNG-seeded; player always slot 0.

---

## Battle (8-actor team deathmatch)

```
MainMenu.tsx
  → CharSelect.tsx              (picks human player guild)
  → BattleConfigScreen.tsx      (8 slots: 4 per team, toggle human/CPU/off, cycle guild)
  → StageSelect.tsx
  → BattleLoadingScreen.tsx
  → GameScreen.tsx              (battleMode=true, onBattleEnd callback, battleSlots prop)
  → BattleResultsScreen.tsx     (kills/deaths/dmg/healing per actor, ranked by score)
    → rematch → GameScreen   OR  menu → MainMenu
```

HUD during battle: `BattleHUD8.tsx` (8-actor HUD, replaces standard HudOverlay).

---

## Multiplayer (online 1v1 via Colyseus)

Transitions are **server-driven**. The server broadcasts `MatchPhase`; `App.tsx` maps it to a screen.

```
MainMenu.tsx
  → mp/MpHub.tsx              (create room / join by code / browse public rooms)
  → mp/MpLobby.tsx            (chat, ready button, room code badge) [phase: lobby]
  → mp/MpCharSelect.tsx       (1v1 pick, server validates)           [phase: char_select]
  → mp/MpStageSelect.tsx      (host or both pick stage)             [phase: stage_select]
  → mp/MpLoadingScreen.tsx    (asset preload, state sync)           [phase: loading]
  → mp/MpBattle.tsx           (wraps GameScreen with matchRoom prop) [phase: in_game]
  → ResultsScreen.tsx                                                [phase: results]
    → rematch offer → (server resets) → mp/MpCharSelect   OR  leave → mp/MpHub
```

Phase → screen map (in `App.tsx`):
```
lobby         → mp_lobby
char_select   → mp_cs
stage_select  → mp_stage
loading       → mp_load
in_game       → mp_battle
results       → mp_results (ResultsScreen in MP mode)
battle_config → mp_battle_config
```

Leave/disconnect: `onLeave()` calls `room.leave()`, clears `mpRoom`, redirects to `mp_hub` or `menu`.

---

## Shared screens (used by multiple modes)

| Screen | Modes |
|--------|-------|
| `CharSelect.tsx` | All SP modes — `hasOpponent` prop toggles dual/single slot |
| `StageSelect.tsx` | VS, Story, Survival, Championship (not Battle, not MP) |
| `GameScreen.tsx` | All SP modes + MP (via MpBattle wrapper); props control mode |
| `ResultsScreen.tsx` | VS, Story, MP results |
| `PauseOverlay.tsx` | Any mode during GameScreen |

---

## Overlays / HUD (not screens)

- `PauseOverlay.tsx` — modal pause, uses `returnTo` in AppState
- `StoryVictoryOverlay.tsx` / `StoryGameOverOverlay.tsx` — shown over GameScreen in story mode
- `hud/HudOverlay.tsx` — root SP HUD (AbilityStrip, RoundTimer, CombatLog, etc.)
- `BattleHUD8.tsx` — 8-actor HUD for Battle mode

---

## Key files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Full routing switch, MP phase→screen map, `PHASE_TO_SCREEN` |
| `src/state/useAppState.ts` | State machine, `go()`, localStorage persistence |
| `src/state/championship.ts` | Bracket init, seeding, `advanceBracket` |
| `src/screens/GameScreen.tsx` | Core battle; props drive VS/Story/Survival/Battle/MP behaviour |
| `src/screens/mp/` | All multiplayer screens |
| `packages/server/src/rooms/MatchRoom.ts` | Authoritative MP room, phase broadcasts |
