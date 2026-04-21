# Screen Port — Design

**Date:** 2026-04-20
**Scope:** Port all 20 screens from `design_handoff_nannymud/` into the live React app, adopting the TERMINAL theme as the game's signature look. Menu-layer only — the Battle HUD (07, 19) is deferred until the battle rewrite. Multiplayer screens render with mocked state; no socket/backend layer.

## Goals

- Replace current programmer-art menus (`TitleScreen`, `GuildSelect`, `GameOverScreen`) with hi-fi terminal-themed screens that match `design_handoff_nannymud/` pixel-for-pixel within the 16:9 frame.
- Reshape single-player flow from "pick 1 guild → fight waves" into the fighter-shaped flow the designs imply: **P1 vs P2 (CPU)**, 3-guild teams, stage pick, rounds.
- Port every non-Battle screen (1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20) into the real app, each validated interactively before moving on.
- Adopt the screens incrementally, in grouped batches, with an approval gate between batches.

## Non-goals

- **Battle HUD (07, 19)** is out of scope. The existing canvas game loop keeps running unchanged during the `playing` phase. The battle rewrite to a true fighter is a later project.
- **Real multiplayer** — no WebSockets, no Supabase, no lobby backend. MP screens drive off in-memory mock state with fake-bot ambient sims.
- **Stage variety** — the sim has one level. Stage Select shows all 9 stage tiles from the design; only one (`assembly`, re-themed as "Assembly Hall" for the existing level) is enabled.
- **Sprite/character art** — guild monograms remain glyph+tag badges exactly as the design renders them. Sprite work continues on its own track.
- **Mobile/touch.** Keyboard-first, same as today.
- **Persistence beyond settings.** Runtime state (P1/P2/teams/stage/mpRoom) is session-only. Settings (volume, keybinds, terminal-theme toggles) continue using `localStorage`.

## Architecture

### Layer map (after port)

```
src/
├── ui/                        NEW — shared design-system primitives
│   ├── theme.ts               terminal color/typography tokens
│   ├── Btn.tsx
│   ├── Chip.tsx
│   ├── SectionLabel.tsx
│   ├── GuildMonogram.tsx
│   ├── MeterBar.tsx
│   ├── ModalShell.tsx
│   └── Scanlines.tsx          the terminal theme overlay
├── data/                      NEW — UI-only data not tied to simulation
│   ├── guildMeta.ts           tag/glyph/accent/bio/radar per GuildId
│   ├── stages.ts              9 stage entries (`assembly` is the only enabled one)
│   └── mpMock.ts              MP_MODES, MP_ROOMS, FAKE_PLAYERS, seedSlotsForRoom, rollCode
├── screens/                   grows: existing 4 screens → ~20
│   ├── TitleScreen.tsx        replaces current
│   ├── MainMenu.tsx           new
│   ├── CharSelect.tsx         replaces current GuildSelect
│   ├── TeamConfig.tsx         new
│   ├── StageSelect.tsx        new
│   ├── LoadingScreen.tsx      new
│   ├── PauseOverlay.tsx       new (overlays on GameScreen)
│   ├── ResultsScreen.tsx      replaces current GameOverScreen
│   ├── MoveList.tsx           new
│   ├── GuildDossier.tsx       new
│   ├── SettingsScreen.tsx     new
│   ├── GameScreen.tsx         UNCHANGED (still runs the canvas battle loop)
│   └── mp/
│       ├── MPHub.tsx
│       ├── CreateRoomModal.tsx
│       ├── JoinByCodeModal.tsx
│       ├── RoomLobby.tsx
│       ├── MPCharSelect8.tsx
│       ├── MPLoading.tsx
│       └── MPResults8.tsx
├── state/                     NEW — top-level app state hook
│   └── useAppState.ts         session state: screen, p1/p2, teams, stage, mpRoom, mpSlots, returnTo, editingRoom
├── simulation/                UNCHANGED
├── rendering/                 UNCHANGED
├── input/                     UNCHANGED (may gain a "menu-mode" read pathway later; not this project)
├── audio/                     UNCHANGED (may trigger menu SFX via new state hook; not required this project)
├── layout/                    UNCHANGED (ScalingFrame keeps its 16:9 contract)
└── App.tsx                    grows: screen enum 4 → 20, routes wire through useAppState
```

### Strict-layer discipline

The one-way dependency rule from CLAUDE.md still holds. New screens and UI primitives live above the simulation line and **read** from simulation types (`GuildId`, `GuildDef`, `AbilityDef`) but never mutate them. `guildMeta.ts` lives in `src/data/` and is imported by screens only; `src/simulation/` never imports from `src/ui/`, `src/data/`, or `src/screens/`.

### Theme + primitives

- `src/ui/theme.ts` exports a single `theme` object matching `THEMES.terminal` from `design_handoff_nannymud/theme.jsx` (bg, bgDeep, panel, panelRaised, ink, inkDim, inkMuted, accent, accent2, warn, bad, good, line, lineSoft, team1–4, fontDisplay, fontMono, fontBody). Grimoire theme is dropped per the handoff README.
- `Scanlines` is mounted once at the app root (inside `ScalingFrame`) so every screen inherits the CRT overlay. Opacity 0.6, mixBlendMode overlay.
- `Btn`, `Chip`, `SectionLabel`, `GuildMonogram`, `MeterBar`, `ModalShell` mirror the handoff component API exactly. Variants:
  - `Btn`: `primary | default`, `size: 'sm' | 'md'`, `disabled`
  - `Chip`: `mono`, `tone: 'default' | 'accent' | 'bad' | 'good' | 'warn'`
  - `ModalShell`: 780px centered, `rgba(0,0,0,0.72)` backdrop + blur(2px), ESC closes, click-outside closes, focus trap.

### Guild data split

- `src/simulation/guildData.ts` stays untouched. Source of truth for HP, abilities (incl. real `combo` strings that drive gameplay), damage, resources, stats.
- `src/data/guildMeta.ts` exports `GUILD_META: Record<GuildId, GuildMeta>` with the UI-only fields: `tag`, `glyph`, `accent` (oklch string), `bio`. Values are ported verbatim from `design_handoff_nannymud/guilds.jsx`.
- The 6-axis radar is derived from the sim's existing `Stats` (STR/DEX/CON/INT/WIS/CHA already present on `GuildDef`). No duplication.
- Vitals grid (HP/Armor/MR/Move) for the dossier: `HP` comes from `guildDef.hpMax`; `Armor/MR/Move` are stub UI values on `GUILD_META` until the sim grows them — with a `// TODO: promote to sim` comment.
- Move List renders combos from `guildDef.abilities[].combo` (the live gameplay strings), never from the handoff's decorative combo notation. Names and descriptions come from `guildDef` too. Cost/cooldown/icon tint come from `guildDef`/`guildMeta`.

### State hook (`useAppState`)

Single `useState`-driven store. Replaces App.tsx's current 4-screen switch with a 20-entry union plus transient slots:

```ts
type AppScreen =
  | 'title' | 'menu'
  | 'charselect' | 'team' | 'stage' | 'loading' | 'game' | 'pause' | 'results'
  | 'moves' | 'guild_dossier' | 'settings'
  | 'mp_hub' | 'mp_create' | 'mp_join' | 'mp_lobby'
  | 'mp_cs' | 'mp_load' | 'mp_battle' | 'mp_results';

interface AppState {
  screen: AppScreen;
  returnTo: AppScreen | null;
  editingRoom: Room | null;

  // Single-player (fighter-shape) roster
  p1: GuildId;
  p2: GuildId;
  p1Team: [GuildId, GuildId, GuildId];
  p2Team: [GuildId, GuildId, GuildId];
  stageId: StageId;
  guildId: GuildId;            // dossier focus
  winner: 'P1' | 'P2' | null;

  // Mocked multiplayer
  mpRoom: Room | null;
  mpSlots: Slot[] | null;
}
```

Action verbs: `go(screen, extras?)`, `setP1/setP2/setP1Team/setP2Team/setStage`, `enterRoom(room)`, `launchMP()`, `clearMP()`. Persisted subset (localStorage key `nannymud-app-state-v1`): `p1`, `p2`, `p1Team`, `p2Team`, `stageId`, `showChrome`, `animateHud`, `showLog` — everything else is session-only.

No router library. `App.tsx` keeps its literal `if (screen === …)` cascade, just wider.

### Routing + transitions

- ESC policy:
  - `game` → `pause` (keep existing `P` key too; ESC becomes a second pause binding for menu consistency)
  - `pause` → `game`
  - any MP modal (`mp_create`, `mp_join`) → back to `mp_hub`
  - any other non-title, non-menu screen → `menu`
- `charselect` respects a `returnTo` slot for the MP-lobby change-guild round-trip.
- `loading` screen auto-advances after a staggered progress animation (~2.2s + 450ms × player_index) and then mounts `GameScreen`. The existing `resetController('player')` invariant from `GameScreen.tsx` still runs on mount/cleanup.

### Single-player flow (fighter-shape, feeding the existing wave battle)

```
title → menu
menu → FIGHT → charselect (P1 picks; P2 = CPU auto-pick) → team (P1 builds 3; P2 built automatically)
  → stage (only `assembly` enabled) → loading → game → results
  results → REMATCH (→ loading) or MAIN MENU (→ menu)
```

During `game`, the canvas battle is the existing wave simulation — the fighter shape is menu-level scaffolding while Battle HUD is deferred. On `results`, winner is derived from the sim's `phase`: `victory` → P1 wins, `defeat` → P2 wins. When the battle rewrite lands, this boundary tightens without further menu work.

Team Config rule for now: the three guild slots drive a simple "if P1 dies, respawn as next team guild" rotation in the sim (cheap to add — no combat system changes). If that's too much scope for an initial UI pass, the team is cosmetic for batch 3 and wired up in batch 5 alongside Results. Flagging explicitly so the plan can choose.

### Multiplayer mocking

- `src/data/mpMock.ts` contains `MP_MODES` (FFA / 4v4 / 2v2v2v2 / Custom), a demo `MP_ROOMS` list (10–14 entries), `FAKE_PLAYERS` bot names, `seedSlotsForRoom(room)`, and `rollCode()` — all ported verbatim from `mp-data.jsx`.
- `MPHub` renders the demo room list against `MP_ROOMS`. "HOST" opens `CreateRoomModal`; submission mutates local state to create an in-memory room. "JOIN BY CODE" opens `JoinByCodeModal`; matches against `MP_ROOMS` or fabricates a remote-looking stub.
- `RoomLobby` ambient sim: `useEffect` with `setInterval(3600)` flips bot-slot `ready` flags with 20% probability per tick. When all non-empty slots are ready, host's LAUNCH BATTLE enables.
- `MPCharSelect8` ambient sim: bot slots cycle guild picks every 1.8s (15% probability).
- `MPLoading` fakes per-player progress bars with staggered completion, then routes to `mp_battle`.
- `MPBattleHUD8` is **not built** in this project. `mp_battle` is skipped from the iteration plan; if it's reached (e.g., via a future debug jump), it falls back to a placeholder "battle in progress" panel that routes to `mp_results` after a timer.
- `MPResults8` fabricates a scoreboard from `mpSlots` using Math.random-seeded K/D/DMG/HEAL/SCORE, winning row(s) highlighted in `accent` (or the team color if `mode.teams`).

### Scaling + fonts

- `ScalingFrame` is unchanged (16:9 letterbox, 1600×900 backing). All new screens render inside it and use flex/grid to fill the 1.78:1 aspect — design source uses 1440×880 (≈1.64:1), layouts stretch horizontally to match. No hardcoded pixel widths; where the handoff uses fixed px (`340px` left rail, `780px` modal), we use the same px values since `ScalingFrame` scales the whole frame.
- Fonts loaded via `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:ital,wght@0,400;0,500;1,400&display=swap">` in `index.html`. No npm dep, honors `.bolt/prompt`'s package restriction.
- `index.css` gets a `*` reset matching the design (box-sizing, color inheritance) and the base `body { font-family: var(--font-body); }` vars.

### Existing-screen fate

| Current file | Disposition |
|---|---|
| `TitleScreen.tsx` | Rewrite. Same filename, new content. |
| `GuildSelect.tsx` | Delete. Replaced by new `CharSelect.tsx`. `App.tsx` import updated. |
| `GameScreen.tsx` | **Unchanged** structurally; its new callers are `LoadingScreen` (mounts it) and `PauseOverlay`/`ResultsScreen` (navigated to). |
| `GameOverScreen.tsx` | Delete. Replaced by `ResultsScreen.tsx`. |
| `App.tsx` | Rewritten to use `useAppState` and the 20-entry screen union. |

## Iteration plan

Each batch ends with the user running `npm run dev`, clicking through, approving, then the next batch begins. No batch merges before approval.

**Batch 1 — Foundations.** `src/ui/theme.ts`, primitives (`Btn`, `Chip`, `SectionLabel`, `GuildMonogram`, `MeterBar`, `ModalShell`, `Scanlines`), `src/data/guildMeta.ts`, `src/data/stages.ts`, font `<link>` in `index.html`, `useAppState` hook, `App.tsx` rewired to the new hook (still rendering only the 4 current screens, now terminal-themed). Validation: existing flow still works, terminal theme visible on every current screen.

**Batch 2 — Title + Main Menu (01, 02).** Replaces `TitleScreen`; adds `MainMenu`. Keyboard nav (↑↓ Enter), flavor panel per item. FIGHT routes to `charselect`, SETTINGS to `settings` stub, etc.

**Batch 3 — Char Select (03) + Team Config (04).** P1/P2 dual-cursor grid, LOCK button, bio panel. Team Config with 3 slots per side + stat preview. P2 is CPU — auto-pick on charselect entry (randomized from sim's 15 guilds), auto-team on team entry. Replaces `GuildSelect.tsx`.

**Batch 4 — Stage Select (05) + Loading (06).** 9 stage tiles, only `assembly` clickable. Loading screen with per-player progress bars, stage backdrop, rotating tips. On done → mount `GameScreen`. Team-rotation wiring on P1 death is included here only if it's <50 lines of sim change; otherwise deferred to Batch 5.

**Batch 5 — Pause (08) + Results (09).** `PauseOverlay` renders on top of `GameScreen` (GameScreen stays mounted, loop paused via existing pause path). `ResultsScreen` replaces `GameOverScreen`, reads winner/stats from sim phase + score. Team rotation lands here if not already in 4.

**Batch 6 — Move List (10) + Guild Dossier (11) + Settings (12).** Reference screens. Move List reads live `guildData.ts` combos. Dossier reads both sim and meta. Settings wires to existing audio/keybind stores for overlapping options; terminal-theme toggles (`animateHud`, `showLog`) wire to `useAppState`.

**Batch 7 — MP Hub (13) + Create Room (14) + Join by Code (15).** Read-only + modals over the hub. All data mocked.

**Batch 8 — Room Lobby (16).** 8-slot grid with ambient bot-ready sim, CHANGE GUILD round-trip via `returnTo`, EDIT ROOM opens `CreateRoomModal` in edit mode.

**Batch 9 — 8P Char Select (17) + 8P Loading (18) + 8P Results (20).** LIST layout for char-select, Guild Dossier overlay reused from Batch 6. Loading behaves like SP loading. Results fabricates scoreboard. `mp_battle` (19) remains a stub placeholder per the non-goal above.

## Open risks / follow-ups

- **Team rotation sim change.** Actor-on-death respawn using the P1 team array is the lightest-touch fighter-shape hook. If it balloons, batches 4/5 can ship team UI without the rotation (P1 just dies as today; team UI is cosmetic until battle rewrite).
- **ESC/pause binding overlap.** `P` currently pauses (CLAUDE.md notes the Esc→P remap was intentional because fullscreen hijacks Esc). ESC will now *also* pause from `game`. Both bindings coexist. `F` for fullscreen unchanged.
- **Scanlines + canvas.** The `Scanlines` overlay sits at `zIndex 5` over the canvas. If it degrades battle readability, Batch 1 gates it to menus only (mount inside each screen, not `ScalingFrame`).
- **localStorage schema migration.** Existing volume/keybind storage keys are untouched. New `nannymud-app-state-v1` is net-new; no migration needed.

## Sizing (rough)

- Batch 1: ~400 LOC (primitives are small, data files are paste-from-handoff).
- Batch 2: ~250 LOC.
- Batch 3: ~500 LOC (two large screens).
- Batch 4: ~300 LOC + 0–50 sim LOC for team rotation if included.
- Batch 5: ~250 LOC.
- Batch 6: ~600 LOC (three reference screens, each dense).
- Batch 7: ~500 LOC (hub table + 2 modals).
- Batch 8: ~400 LOC.
- Batch 9: ~500 LOC.

Total: ~3700 LOC of new UI + ~600 LOC of shared primitives/data. Comparable in size to one of the sim's larger files.
