# Versus Mode + Battle HUD — Design

**Date:** 2026-04-22 (revised 2026-04-22 after Phase-2 Phaser merge)
**Scope:** Build real 1v1 Versus mode. Add a React/DOM terminal-themed HUD overlay (top bar, round timer, combat log, per-player ability strip) that renders on top of the Phaser canvas. Story modes (`stage`, `surv`, `champ`) keep the existing `HudScene` Phaser HUD unchanged. 4v4 BATTLE stays stubbed — HUD primitives are shaped so a later project can drop it in without rewrites.

**Context:** Phase 2 replaced `src/rendering/` with `src/game/` (Phaser 3 scenes: `BootScene`, `GameplayScene`, `HudScene`). The game loop now lives in `GameplayScene.update`; React only hosts the Phaser mount + pause overlay. The simulation layer is still pure TypeScript and untouched by the Phaser migration. This spec builds the VS HUD on top of that new architecture, not the old canvas renderer.

## Goals

- `mode: 'vs'` routes to a genuine 1v1 match (player guild vs CPU-controlled opponent guild), not the story/wave sim.
- Best-of-3 rounds, 60s round timer, HP-to-zero or timeout resolution, higher-HP-wins on timeout, draw if tied, full HP/MP/cooldown reset between rounds.
- Battle HUD matches the mock: P1 badge + HP + resource bars (left), stage title + round timer + round counter (center), P2 bars + badge (right), combat log (bottom-left), two ability strips (bottom-center/right).
- Combat log is sim-owned, deterministic, serializable, renders in React.
- Number keys `1–5` and `R` fire the player's ability slots 1–5 + RMB utility in VS mode; combo grammars keep working in parallel.
- HUD primitives (top-bar players list, ability strip, combat log) are data-driven so a future 4v4 project can render them by passing an array of 4 instead of 2.

## Non-goals

- **4v4 BATTLE sim.** Kept stubbed. `mode === 'batt'` still shows the existing "Coming soon" shell in the menu; no 8-slot configurator, no team win logic. Out of scope until Batch 5a of the screen-port project.
- **Second resource bar ("Resolve").** The mock's `RESOLVE 80/100` label was decorative. In the real HUD, only the guild's existing resource (`guildDef.resource`) renders under HP. No new sim-level resource.
- **Combat redesign.** Damage numbers, ability costs, cooldowns, status effects, crit math stay as `guildData.ts` / `combat.ts` define them today.
- **Stage variety.** One Phaser-drawn stage (Assembly Hall) remains.
- **Real multiplayer.** No sockets, no Supabase, no lobby backend.
- **Sprite / VFX work.** Existing sprite and VFX loading pathways unchanged.
- **Story-mode HUD refresh.** The new React overlay is VS-only for this project. Story mode retains its current Phaser `HudScene` until a later pass.

## Architecture

### Layer map after this project

```
src/
├── simulation/
│   ├── vsSimulation.ts          NEW — createVsState, tickVs, round state machine
│   ├── combatLog.ts             NEW — appendLog, capLog
│   ├── simulation.ts            tickSimulation branches on state.mode
│   ├── types.ts                 +mode, +opponent, +round, +combatLog, +LogEntry
│   └── ... (unchanged)
├── game/                         Phaser layer (from Phase 2)
│   ├── PhaserGame.ts            +mode/p2/stageId in GameBootConfig + registry
│   ├── scenes/
│   │   ├── GameplayScene.ts     branches: VS uses createVsState; skips Hud launch
│   │   ├── HudScene.ts          UNCHANGED — still used by story mode
│   │   └── BootScene.ts         unchanged
│   ├── input/PhaserInputAdapter.ts   promote 1-5, R in VS via existing testAbility slots
│   └── ... (unchanged)
├── screens/
│   ├── GameScreen.tsx           VS renders HudOverlay over Phaser; story unchanged
│   └── hud/                     NEW
│       ├── HudOverlay.tsx       absolute-positioned React overlay root
│       ├── HudTopBar.tsx
│       ├── RoundTimer.tsx
│       ├── AbilityStrip.tsx
│       ├── CombatLog.tsx
│       └── HudFooter.tsx
├── ui/                          unchanged (MeterBar, Chip, SectionLabel, GuildMonogram all reused)
├── input/keyBindings.ts         unchanged — existing testAbility slots are reused
└── App.tsx                      passes {mode, p1, p2, stageId} to GameScreen
```

Strict one-way dependency rule preserved: simulation reads nothing from game/ui/screens. Phaser scenes read simulation types and mutate only their own view state. React HUD reads a snapshot of `SimState` (pulled from `game.registry` or a push-style event) and never mutates it. No cycles.

### Simulation additions

`SimState` grows (all VS-only; story mode defaults these to safe values):

```ts
mode: 'story' | 'vs';                   // existing state.mode was on useAppState only; now on SimState
opponent: Actor | null;                 // null in story
round: RoundState | null;               // null in story
combatLog: LogEntry[];                  // capped to last 64
```

```ts
interface RoundState {
  index: 0 | 1 | 2;                     // up to 3 rounds in BO3
  wins: { p1: number; p2: number };
  timeRemainingMs: number;              // 60_000 at round start
  phase: 'intro' | 'fighting' | 'resolved' | 'matchOver';
  phaseStartedAtMs: number;
  winnerOfRound: 'p1' | 'p2' | 'draw' | null;
  matchWinner: 'p1' | 'p2' | null;
}

interface LogEntry {
  id: number;                           // state.nextLogId++
  tickId: number;                       // state.tick
  tag: 'P1' | 'P2' | 'SYS';
  tone: 'info' | 'damage' | 'ko' | 'round';
  text: string;
}
```

`createVsState(p1, p2, stageId)` (new, in `vsSimulation.ts`):
- Builds a normal state via the existing `createInitialState` path but with `enemies: []`, `waves: []`, `mode: 'vs'`.
- Constructs `opponent` from `createPlayerActor(p2)` (reuse existing factory) with `id: 'opponent'`, `team: 'enemy'`, spawn x on the right side, `facing: -1`. Runs through the same controller registration path.
- Initializes `round = { index: 0, wins: {p1:0,p2:0}, timeRemainingMs: 60_000, phase: 'intro', phaseStartedAtMs: 0, winnerOfRound: null, matchWinner: null }`.
- Seeds `combatLog` with two `[SYS]` entries (`Knight has entered the arena.`, `Mage has entered the arena.`).

`tickSimulation(state, input, dt)` gains a branch:
- If `state.mode === 'story'`: existing behavior, untouched.
- If `state.mode === 'vs'`: ticks the player controller as today; ticks the opponent through `tickAI` (reuse existing AI pipeline — opponent behavior is `'chaser'` targeting `'player'`). Runs physics, combat, status effects, projectiles unchanged. Decrements `round.timeRemainingMs` by `dt` while `phase === 'fighting'`. Between physics and cleanup, runs `tickRound(state)` (in `vsSimulation.ts`).

`tickRound` state machine:
- `intro` — count down for ~1500ms, then `phase = 'fighting'`, timer starts, append `[SYS] Round N — FIGHT!`.
- `fighting` — resolves if either actor's `hp <= 0` (other wins round) or timer hits 0 (higher HP wins, tie = draw).
- `resolved` — freeze inputs for ~2000ms, append `[SYS] Round N — P1 WINS` / `P2 WINS` / `DRAW`, increment wins. If a side hit 2 wins → `phase = 'matchOver'`. Else reset actors (restore HP, MP, cooldowns, positions, clear status effects) and step `round.index++`, `phase = 'intro'`.
- `matchOver` — `state.phase` transitions to `'victory'` (if p1 won) or `'defeat'` (if p2 won). `GameScreen`'s existing victory/defeat callbacks fire.

Round reset is a dedicated helper `resetActorsForRound(state)` — pure, reuses `createPlayerActor` for shape reference to restore defaults without re-creating IDs or controllers.

**Combat log sources** (append sites):
- Round start/end → `[SYS]`, tone `round`.
- Ability fire — hook into the existing `ability_name` VFX event emit path in `tickSimulation` / combat code. When an ability fires, append `[P1|P2] <GuildName> uses <AbilityName> — <damageDealtThisCast>` with tone `info`. If the ability deals no direct damage (buff/heal/teleport), omit the trailing number.
- KO → `[SYS] <GuildName> is KO'd.` tone `ko`.

Damage number source: sum `damageEvent` VFX events emitted during the cast frame (or the resolved damage from the calc), attributed to the caster. Exact site lives wherever the `ability_name` VFX is currently emitted — change is local to combat.ts.

All appends are pure, tick-stamped, and go through `appendLog(state, entry)` which mutates `state.combatLog` in the same style as the rest of the sim (array push + cap at 64). Determinism preserved — no `Date.now()`, no `Math.random()`.

### Phaser (src/game/) changes

`HudScene` **stays untouched**. Story mode continues to launch it from `GameplayScene.create` exactly as today — that mode's Phaser HUD is out of scope to replace here. VS mode simply does **not** launch `HudScene`; the React overlay owns that layer instead.

`PhaserGame.ts` / `GameBootConfig` grows three fields passed in from the React host:

```ts
interface GameBootConfig {
  guildId: GuildId;
  mode: 'story' | 'vs';
  p2?: GuildId;                        // required when mode === 'vs'
  stageId: StageId;
  seed?: number;                       // optional deterministic seed
  callbacks: GameCallbacks;
}
```

These land in `game.registry` alongside the existing entries. `GameplayScene.create` reads `mode`/`p2`/`stageId` and:
- `mode === 'story'` — calls `createInitialState(guildId, seed)` and `this.scene.launch('Hud')` as today.
- `mode === 'vs'` — calls `createVsState(p1, p2, stageId, seed)`. Does not launch `HudScene`. Optionally calls `this.cameras.main.setViewport(0, HUD_TOP_PX, VIRTUAL_WIDTH, VIRTUAL_HEIGHT - HUD_TOP_PX - HUD_BOTTOM_PX)` so the camera-followed action centers in the un-covered band between the top bar and the footer. `HUD_TOP_PX` / `HUD_BOTTOM_PX` are render-only constants in `src/game/constants.ts` (suggested values: 72 / 160).

Virtual resolution (`VIRTUAL_WIDTH` / `VIRTUAL_HEIGHT` = 900×506) is unchanged. Phaser's `Scale.FIT` continues to upscale the whole canvas to the host div, which the React HUD overlays sit on top of in the same coordinate space.

`GameplayScene.update` pushes `simState` to the registry each tick as today. For VS mode it additionally emits `scene.events.emit('sim-tick', state)` — the React overlay subscribes to that event to schedule a re-render. (Alternative: React `useSyncExternalStore` against the registry. Either works; plan phase picks one.)

### React HUD overlay

New directory `src/screens/hud/`:

- **`HudOverlay.tsx`** — root of the VS HUD. Rendered as a sibling of the Phaser mount `<div>` inside `GameScreen`, using `position: absolute; inset: 0; pointer-events: none`. Child regions opt back into `pointer-events: auto` only where they actually need interaction (e.g., a future tweaks menu). Subscribes to the Phaser instance's `sim-tick` event (or polls `game.registry.get('simState')` each rAF), stores the latest `SimState` in a React ref, and triggers a re-render via a tick counter. Renders `HudTopBar` (top strip), `HudFooter` (bottom strip), leaves the middle transparent so the Phaser canvas shows through.
- **`HudTopBar.tsx`** — receives `players: HudPlayer[]` (2 for VS, accepts 4 later for BATT), plus `stage: { title: string; tags: string[] }` and `round: RoundState | null`. Renders P1 on the left, stage + `RoundTimer` in the center, P2 on the right. Each player slot: `GuildMonogram` badge, class/title text (`guildDef.name` + `GUILD_META.tag`), HP `MeterBar`, resource `MeterBar`, numeric readouts (`HP 168/180`, `<ResourceName> 80/100`). Opaque `theme.bg` background covers the Phaser pixels beneath it.
- **`RoundTimer.tsx`** — 60px tabular-numeric display of `ceil(timeRemainingMs / 1000)`, subtitle `ROUND n/3`. Pulses red below 10s only if `appState.animateHud`.
- **`AbilityStrip.tsx`** — props `{ player: Actor; guildDef: GuildDef; side: 'p1'|'p2'; showKeys: boolean }`. Renders 6 cards (5 abilities + RMB). Each card: key label top-left (`1`–`5` / `R`) hidden if `!showKeys`, ability name, combo glyph (reuse Batch 6's combo glyph renderer), cooldown ring, mp-cost chip. Dimmed when on CD or unaffordable. Card index 0–4 maps to `guildDef.abilities[0..4]`; index 5 is RMB (`K+J`).
- **`CombatLog.tsx`** — props `{ entries: LogEntry[]; visible: boolean }`. Fixed-height panel with auto-scroll to latest. `[P1]` colored `theme.team1`, `[P2]` colored `theme.team2`, `[SYS]` colored `theme.inkDim`. Optional `tone` maps to subtle text color (damage → accent, ko → warn, round → ink). Hidden entirely when `!visible`.
- **`HudFooter.tsx`** — CSS-grid `log (flex) | p1 strip | p2 strip`. Mounts `CombatLog` + two `AbilityStrip`s. Opaque `theme.bg` background.

All components use `theme` tokens + existing `ui/` primitives. No new design tokens, no new colors. The existing `Scanlines` overlay at the app root continues to draw over everything, including this HUD — consistent with other screens.

### `GameScreen.tsx` reshape

New props: `{ mode: 'story' | 'vs'; p1: GuildId; p2?: GuildId; stageId: StageId; onMatchEnd(winner: 'P1'|'P2'|'DRAW', score: number): void; onQuit(): void }`.

Mount logic:
- `mode === 'story'`: call `makePhaserGame(parent, { guildId: p1, mode: 'story', stageId, callbacks })`. JSX is unchanged from today — `<div ref={parentRef}>` + `PauseOverlay` + `GuildDetails`. No React HUD.
- `mode === 'vs'`: call `makePhaserGame(parent, { guildId: p1, mode: 'vs', p2, stageId, callbacks })`. JSX adds `<HudOverlay game={gameRef.current} settings={{ animateHud, showLog }} />` as a sibling of the Phaser mount div, inside the same absolute-positioned container. `HudOverlay` wires itself to the Phaser instance once mounted.

Pause overlay, Tab move-list, fullscreen toggle — all unchanged. The Phaser `sim-tick` event also powers React re-renders in VS; story mode keeps the registry-pull pattern `HudScene` already uses.

### Input changes

`src/input/keyBindings.ts` already has the `testAbilitySlot_1..5` and `testAbilitySlot_rmb` bindings. `PhaserInputAdapter` in `src/game/input/` already reads them into `InputState.testAbilitySlot_*`. No keybinding change is needed.

The behavioral promotion happens inside the VS tick branch in `simulation.ts` / `vsSimulation.ts`: when `state.mode === 'vs'` and a `testAbilitySlot_N` just-pressed flag is set, route it through the same code path the combo detector uses to call `fireAbility(state, playerId, abilityIndex)`. Combo grammar input still works — two input paths in parallel; whichever fires first wins and the other is swallowed for the same tick.

Story-mode behavior unchanged — the same keys still behave as dev-only test bindings there.

### Mode routing (App.tsx)

- `App.tsx` already holds `state.mode`. On entering `screen: 'game'`, pass `{ mode: state.mode, p1: state.p1, p2: state.p2, stageId: state.stageId }` into `GameScreen`.
- `onMatchEnd` receives the winner and transitions to `results` with `set({ winner: winner === 'P1' ? 'P1' : 'P2' })`. `DRAW` routes like P2 for now (results screen doesn't have a draw state yet; flagging but not solving in this project).

### Data shapes passed around

```ts
interface HudPlayer {
  actor: Actor;                   // for HP/MP live values
  guildDef: GuildDef;             // for name/color/abilities
  meta: GuildMeta;                // for tag (Holy Tank), glyph, accent
  tag: 'P1' | 'P2' | 'P3' | 'P4';
  isCpu: boolean;
  side: 'left' | 'right';         // for mirroring
}
```

## Testing

- `src/simulation/__tests__/vs.test.ts` — seeded match flow:
  - BO3 completes in at most 3 rounds.
  - HP=0 wins the round; timer expiry resolves by higher HP; equal HP → draw.
  - HP/MP/cooldowns reset between rounds; log records round boundaries.
  - Log cap holds at 64.
- Golden determinism test (`golden.test.ts`) stays story-mode, stays green. Confirms story path untouched.
- No React tests (project convention). Manual browser verification is the acceptance gate: pick 1v1, fight 3 rounds, confirm log populates, ability strip keys fire, timer counts down, match resolves to Results.

## Edge cases

- Tab-switch `dtMs` clamp (50ms ceiling) applies to round timer too — you can't lose a round by alt-tabbing past it.
- Draw on BO3 final score → results treats draw as P2-leaning for this project; a dedicated draw UI is a later polish.
- Player chose CPU opponent guild same as their own (mirror match) — no special handling needed, actors are independent by id.
- Fullscreen exit while mid-round still pauses via existing `FULLSCREEN_EXIT_EVENT`; round timer freezes because state.phase becomes `'paused'`.
- If `p2` is undefined when entering VS (shouldn't happen post-Batch-3) → throw in `createVsState` with a clear message.

## Deliverables checklist

- [ ] `simulation/vsSimulation.ts` — createVsState, tickVs helpers, round machine
- [ ] `simulation/combatLog.ts` — appendLog, capLog
- [ ] `simulation/types.ts` — mode, opponent, round, combatLog, LogEntry
- [ ] `simulation/simulation.ts` — tick branch on mode; promote `testAbilitySlot_*` to real ability fires when `state.mode === 'vs'`
- [ ] `simulation/combat.ts` — emit log entries alongside `ability_name` VFX + KO
- [ ] `simulation/__tests__/vs.test.ts`
- [ ] `game/PhaserGame.ts` — extend `GameBootConfig` with `mode`, `p2`, `stageId`, `seed`; store in registry
- [ ] `game/scenes/GameplayScene.ts` — VS branch in `create`: `createVsState` path + skip `scene.launch('Hud')`; emit `sim-tick`; optional camera `setViewport` for VS
- [ ] `game/constants.ts` — add `HUD_TOP_PX`, `HUD_BOTTOM_PX`
- [ ] `game/scenes/HudScene.ts` — no change (still used by story mode)
- [ ] `screens/hud/HudOverlay.tsx`
- [ ] `screens/hud/HudTopBar.tsx`
- [ ] `screens/hud/RoundTimer.tsx`
- [ ] `screens/hud/AbilityStrip.tsx`
- [ ] `screens/hud/CombatLog.tsx`
- [ ] `screens/hud/HudFooter.tsx`
- [ ] `screens/GameScreen.tsx` — VS branch, new props, mount `HudOverlay` alongside Phaser
- [ ] `App.tsx` — pass mode/p1/p2/stage, handle match-end winner
- [ ] Manual browser verification
- [ ] Golden test still green; new vs.test.ts green
