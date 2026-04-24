# Battle Mode Polish — Design Spec

**Date:** 2026-04-24  
**Status:** Approved  
**Scope:** 5 focused fixes to battle mode; no new gameplay systems.

---

## Background

Battle mode (1 human vs up to 7 CPU fighters) is functional but has five UX gaps:
teams are cosmetic only (AI ignores them), the loading screen is missing most fighters,
health bars don't match the 1v1 visual style, player controls disappear entirely during
battle, and the stats screen is untested against real data.

---

## Issue 1 — Team-aware AI targeting

### Problem
`BattleTeam` (A/B/C/D) is stored on `BattleSlot` but never reaches the AI.
`findTarget()` in `ai.ts` uses the binary `actor.team === 'enemy'` check, so every
CPU attacks the human player regardless of assigned team. CPU actors on the same team
as the human (or each other) should not attack teammates.

### Design

**Data model change — `Actor` gets `battleTeam?: BattleTeam`**

Add the optional field to the `Actor` interface in `packages/shared/src/simulation/types.ts`.
This keeps targeting self-contained (no state lookup needed during AI tick).

**Set in `createBattleState()`**

- Human player: `state.player.battleTeam = humanSlot.team`
- Each CPU actor: `actor.battleTeam = slot.team` (set at spawn time)

**`findTarget()` update (`ai.ts`)**

When `state.battleMode` is true, filter candidates by team:
```
an actor is a valid target if:
  - its battleTeam is null, OR
  - its battleTeam !== attacker.battleTeam
```
The existing binary `'enemy'` / `'player'` `ActorTeam` field is unchanged — it still
drives non-battle logic.

**`synthesizeVsCpuInput()` update (`vsAI.ts`)**

The VS-CPU path also needs team awareness. Apply the same filter when the CPU selects
its pursuit target so CPU teammates don't chase each other.

**Victory condition update**

When teams are in use, "all enemies dead" needs to mean "all actors not on the human's
team are dead". Update the battle victory check in `simulation.ts` accordingly.

---

## Issue 2 — Loading screen: 2×4 fighter grid with per-card progress

### Problem
`LoadingScreen` was built for 1v1 (P1 + optional P2). Battle mode passes nothing for
the second slot, so only the human's card appears.

### Design

**New `BattleLoadingScreen` component**

Rather than overloading `LoadingScreen`, create a dedicated
`src/screens/BattleLoadingScreen.tsx`. `GameScreen` renders it instead of
`LoadingScreen` when `battleMode=true`.

**Layout: 2 rows × 4 columns, up to 8 slots**

Each card:
- Guild monogram (same style as current loading cards)
- Guild name
- Team colour accent on border (if team assigned)
- Individual progress bar (0–1 float prop)
- Dimmed/greyed placeholder for `type: 'off'` slots

**Per-card progress**

```
props: {
  slots: BattleSlot[];          // up to 8
  humanProgress: number;        // 0–1, tied to actual Phaser asset load
  onReady: () => void;
}
```

- Human card: `humanProgress` drives the bar directly.
- CPU cards: simulated stagger — each CPU gets a random target completion time
  between 0.6 s and 2.0 s; progress eases linearly to 1.0.
- `onReady` fires when `humanProgress >= 1` (same trigger as current loading screen;
  CPU animations are cosmetic and don't block).

**Future-proofing**

Per-card progress is a plain `number` prop. When multiplayer battle arrives, the parent
can replace simulated values with network-broadcast floats without touching the component.

---

## Issue 3 — Health bar styling in BattleHUD8

### Problem
`BattleHUD8` uses bespoke styling that doesn't match the 1v1 HUD: wrong bar colours,
missing HP/MP number readouts, inconsistent card borders and fonts.

### Design

Restyle each fighter card in `BattleHUD8` to match `HudTopBar`:

| Element | Spec |
|---|---|
| Card background | `theme.bgDeep` |
| Card border | `1px solid theme.lineSoft`; team colour neon glow if team assigned |
| HP bar | `MeterBar` component, height 10px, fill = `theme.team1` (teal) |
| MP/resource bar | `MeterBar`, height 5px, fill = guild accent colour |
| HP readout | `HP {value}/{max}`, font `theme.fontMono`, 9px, `theme.inkDim` |
| MP readout | `{RESOURCE_NAME} {value}/{max}`, same font |
| Guild name | Same weight/size as 1v1 top bar |
| Archetype tag | Shown if space allows (omit on very narrow cards) |
| KO state | Card dims to 40% opacity; "KO" label replaces HP bar |

Reuse the existing `MeterBar` component from `src/screens/hud/`. No new primitives.
Grid layout (2 rows × 4 columns) is unchanged.

---

## Issue 4 — Player controls footer in battle mode

### Problem
`GameScreen` renders either `HudOverlay` (1v1/story) or `BattleHUD8` (battle) — never
both. This means the ability strip, mobile joystick, and J/K touch buttons are
completely absent during battle mode. The human player has no visible controls.

### Design

In `GameScreen.tsx`, when `battleMode=true`, render all of the following (currently only
`BattleHUD8` is rendered):

- `BattleHUD8` (top — health bars for all fighters)
- `HudFooter` with `p2={null}` (bottom — P1 ability strip only)
- `TouchJoystick` (mobile only, same condition as `HudOverlay`)
- `TouchActionButtons` (mobile only, same condition as `HudOverlay`)

`TouchJoystick` and `TouchActionButtons` are currently rendered inside `HudOverlay` and
are absent from the battle layout. They are standalone components with no props — import
and render them directly in the battle branch of `GameScreen`, guarded by the same
`useIsMobile()` hook used in `HudOverlay`.

`HudFooter` handles `p2={null}` gracefully (story mode already uses this). Passing
`p2={null}` shows only the P1 ability strip with hotkeys and cooldown overlays, no
opponent panel.

`p1` actor is sourced from the game registry (`game.registry.get('simState').player`)
using the same pattern `HudOverlay` uses today.

---

## Issue 5 — Stats screen verification

### Finding
`BattleResultsScreen` already receives and displays real stats:
- Kills, deaths, damage dealt, healing (tracked live in `simulation.ts`)
- Score formula: `kills × 500 + dmgDealt × 0.5 − deaths × 200 + healing × 0.3`
- Sortable scoreboard with rank, guild icon, fighter name, team, K/D/DMG/HEAL/SCORE

The 1v1 VS mode has no post-match scoreboard at all — it returns directly to the lobby.
Battle mode's stats screen is therefore already more complete. No changes required.

---

## Out of scope

- Multiplayer battle mode (human players broadcasting real loading progress, network
  authority for multi-human battle) — deferred to a future initiative.
- Balance tuning for team compositions.
- New guild abilities or AI strategies.

---

## Files touched

| File | Change |
|---|---|
| `packages/shared/src/simulation/types.ts` | Add `battleTeam?: BattleTeam` to `Actor` |
| `packages/shared/src/simulation/battleSimulation.ts` | Set `battleTeam` on player + CPU actors |
| `packages/shared/src/simulation/ai.ts` | Team-aware `findTarget()` |
| `packages/shared/src/simulation/vsAI.ts` | Team-aware target selection in CPU path |
| `packages/shared/src/simulation/simulation.ts` | Victory condition uses team membership |
| `src/screens/BattleLoadingScreen.tsx` | New component (2×4 grid, per-card progress) |
| `src/screens/GameScreen.tsx` | Route to BattleLoadingScreen; add HudFooter to battle layout |
| `src/screens/BattleHUD8.tsx` | Restyle cards to match 1v1 HUD visual language |
