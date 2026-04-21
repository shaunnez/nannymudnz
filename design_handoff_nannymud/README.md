# Handoff: Nannymud — Guild Fighter Prototype

## Overview
Nannymud is a 2D fighter game prototype set in a "mudpunk" world of 15 competing guilds. Players pick a guild, form a 3-character team, select a stage, and fight — either head-to-head (single-player) or in up to 8-player multiplayer rooms. This handoff covers a complete 20-screen flow: title → main menu → char-select → team → stage → loading → battle HUD → pause → results → move list → guild detail → settings → MP hub → create/join room → lobby → 8P char-select → 8P loading → 8P battle → 8P results.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these HTML designs in the target codebase's existing environment** (React app, in this case) using its established patterns, libraries, and state management. Do not ship the Babel-in-browser HTML as-is.

**Recommended approach for porting:**
1. Convert each `screens-*.jsx` file to a proper ES module with `export` statements — components are currently hoisted onto `window` for the Babel-standalone runtime
2. Extract shared primitives (`Btn`, `Chip`, `SectionLabel`, `GuildMonogram`, `guildAccent`, `Field`, `ModalShell`, `MeterBar`, `StatBar`) into a `components/shared/` folder
3. Move `guilds.js` and `mp-data.js` into a `data/` folder — these are pure data and port cleanly
4. Replace the `state.screen` switch-router in `app.jsx` with whatever routing the host app uses (React Router, TanStack Router, custom)
5. Replace the `localStorage` persistence with the host app's state store

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions. The prototype is pixel-accurate — recreate it precisely using the host codebase's existing primitives where overlap exists.

## Design System — TERMINAL theme (committed)
The final design uses a single aesthetic: **terminal / esports overlay**. (An alternate "grimoire arcade" paper theme exists in `theme.jsx` but is unused and can be deleted on port.)

### Color tokens (from `theme.jsx` → `THEMES.terminal`)
| Token | Value | Usage |
|---|---|---|
| `bg` | `#0a0d12` | App background |
| `bgDeep` | `#05070a` | Deepest surfaces (inputs, code) |
| `panel` | `#0f141b` | Panels / cards |
| `panelRaised` | `#141a23` | Elevated panels |
| `ink` | `#d8e5ef` | Primary text |
| `inkDim` | `#8ea3b5` | Secondary text |
| `inkMuted` | `#5a6a7a` | Tertiary text / kickers |
| `accent` | `#5cf2c2` | Primary action / highlights (mint-cyan) |
| `accent2` | `#7db8ff` | Secondary accent (ice-blue) |
| `warn` | `#ffb347` | Warning / MP mid |
| `bad` | `#ff5d73` | Bad / KO / low HP |
| `good` | `#5cf2c2` | Good / ready |
| `line` | `#1d2834` | Panel borders |
| `lineSoft` | `#141d27` | Softer dividers |

### Typography
- `fontDisplay`: `"JetBrains Mono", ui-monospace, SFMono-Regular, monospace` (weight 700, letter-spacing tight)
- `fontMono`: `"JetBrains Mono", ui-monospace, monospace` (weight 400-500, letter-spacing 1-3)
- `fontBody`: `"Inter", system-ui, sans-serif` — used sparingly for flavor/bio text

All HUD chrome is monospaced. Body copy in bios/flavor lines is Inter italic.

### Team colors (MP)
- Team 1: `#5cf2c2` (mint)
- Team 2: `#ff5d73` (coral)
- Team 3: `#ffb347` (amber)
- Team 4: `#928bff` (violet)

## Screens

### 01 Title
Full-viewport title card. Logo glyph + "NANNYMUD" wordmark, tagline, blinking "PRESS START" prompt. Any key → menu.

### 02 Main Menu
7 menu items in a vertical list: FIGHT, VERSUS, MULTIPLAYER, MOVE LIST, GUILD DOSSIER, SETTINGS, QUIT. Keyboard-driven (↑↓ Enter). Right-side panel shows flavor text for the focused item.

### 03 Character Select (1v1)
Grid of 15 guilds, P1 and P2 cursors, team color rings, bio panel, LOCK button per player. Enter → Team Config.

### 04 Team Config
3-slot team builder for each player. Pick 3 guilds to field in sequence. Shows stat preview.

### 05 Stage Select
Grid of stages (Assembly Hall, Night Market, Rot-Kitchen, etc.) with flavor blurb and hue swatch.

### 06 Loading
Loading card per player with progress bars, stage backdrop, rotating tip at the bottom.

### 07 Battle HUD (1v1)
Classic LF2-style arena: HP/resource bars top-left (P1) and top-right (P2), combo counters, timer center, ability cooldown row along the bottom, combat log in the corner.

### 08 Pause
Translucent overlay on top of battle. Resume / Restart / Quit options.

### 09 Results (1v1)
Winner banner (huge), killing-blow callout, round summary stats (damage dealt/taken, longest combo, resource used), REMATCH / MAIN MENU.

### 10 Move List
Reference screen. Lists all 5 abilities + ult + RMB for a given guild with combo notation, cooldown, effect description.

### 11 Guild Detail / Dossier
Full-page profile for a single guild: monogram, tag, bio, vitals grid (HP/Armor/MR/Move), resource card, 6-point radar of stats, ability list, "KILLING BLOW" ult card.

### 12 Settings
Gameplay options. Density, show/hide combat log, HUD animation toggle, browser chrome toggle.

### 13 MP Hub — TABLE layout (committed)
Dense live room browser. Header with mode tabs (FFA / 4v4 / 2v2v2v2 / CUSTOM), search, region filter, "HOST" and "JOIN BY CODE" CTAs. Table columns: # | ROOM | HOST | MODE | MAP | PLAYERS | PING | STATE. Row click → Enter Room.

### 14 Create Room (modal over Hub)
780px-wide centered modal with solid backdrop. Two-column form:
- **Left:** Room Name, Mode (FFA / 4v4 / 2v2v2v2 / Custom), Stage
- **Right:** Visibility (Public / Friends / Private), auto-generated 6-char room code + COPY + lock toggle, Options (Rounds BO1/3/5/7, Friendly Fire on/off, Spectator slots 0/2/4/8)
- Footer: CANCEL · ESC / CREATE ROOM →
- Also used in **EDIT ROOM** mode when host clicks ✎ from lobby — pre-populates fields, title becomes "EDIT ROOM", CTA becomes SAVE CHANGES.

### 15 Join by Code (modal over Hub)
6-cell code input with auto-advance, paste support, recent-codes list, JOIN → CTA.

### 16 Room Lobby
Top bar: room name, shareable code (click to copy), LEAVE. Meta strip: mode / BO# / map / visibility / FF / spec slots. 8-slot grid (2×4) of player cards — each shows monogram, name, guild name, ping, READY/WAIT, team badge (click to cycle team), host KICK option. Footer actions:
- `[ CHANGE GUILD ]` link on your slot
- `⇄ CHANGE GUILD` button (→ char-select, returns to lobby)
- `✎ EDIT ROOM` button (host only, → EDIT modal)
- `□ READY UP` / `■ READY` toggle
- `LAUNCH BATTLE →` (host only, enabled when all ready)
- Chat panel on the right with system + player messages.

### 17 8P Char Select — LIST layout (committed)
340px left rail: vertical list of 8 player slots with monogram + guild name + LOCKED/... state. Right panel: 5×3 guild picker grid, selected-guild callout card (80px monogram, tag, name, bio, DETAILS button, LOCK IN → button). Clicking DETAILS opens the Guild Dossier overlay (shared component).

### 18 8P Loading
Team-grouped (if mode has teams) or FFA grid (if not). Per-player load card with progress bar, monogram, ping. Stage backdrop and flavor at the top. Rotating tip at the bottom.

### 19 8P Battle HUD
4 player bars top + 4 player bars bottom (LF2 8P classic). Each bar: 36px monogram, name, HP meter (green → amber → red), resource meter. KO state dims the card, stamps "KO". Center: radial stage backdrop with timer, "X/8 ALIVE" counter, and 8 fighter-token positions with KO states. Right-side combat log (toggleable). Random hits and occasional big flashes drive the sim.

### 20 8P Results
Winner banner (team-aware — shows team color if team mode). Full scoreboard sorted by SCORE: slot # | monogram | name | guild | K | D | DMG | HEAL | SCORE. Winning row(s) highlighted in accent. REMATCH / LEAVE footer.

## Shared Components

### Guild Monogram
Square badge with guild glyph + 2-char tag, accent border, optional "selected" ring. Sized 40/56/72/80px across screens.

### Meter Bar
Horizontal bar with fill (accent or theme-derived), optional segmented rendering for small max values (chi, bloodtally), flash animation on big hits.

### Modal Shell
780px centered on `rgba(0,0,0,0.72)` backdrop with `blur(2px)`, solid `bg` panel with `1px accent` border and 30px shadow. ESC closes. Click outside closes. Zindex 1 inside a `zIndex:15` wrapper sitting above theme overlays (scanlines) but below the ScreenNav debug menu.

### Guild Dossier Overlay
Shared detail modal used from 8P char-select DETAILS button. Two-column body (vitals+stats / abilities list). ESC + click-outside to close. SELECT → CTA if guild isn't yours and not locked.

### Chip / SectionLabel / Btn / Field
Small tokenized UI. `Btn` has `primary`, `size="sm"`, `disabled` variants. `Chip` has `mono`, `tone="accent|bad|good"`. `SectionLabel` shows a mono kicker with title and optional right-side text.

## Interactions & Behavior

### Navigation
- Title → any key → Menu
- Menu → Enter → selected screen
- Most screens → ESC → previous or menu
- `◇ SCREENS` nav (top-right, debug-only) jumps to any screen by label

### MP flow
1. Menu → MULTIPLAYER → MP Hub
2. Hub → HOST → Create Room modal → Create → Lobby (1 slot filled)
3. Hub → JOIN → Join by Code modal → Join → Lobby (8 filled if real room)
4. Hub → row click → Lobby (8 filled)
5. Lobby → CHANGE GUILD → char-select with `returnTo: 'mp_lobby'` → back to Lobby
6. Lobby → EDIT ROOM (host) → Create modal in edit mode → Save → Lobby
7. Lobby → READY UP → LAUNCH (host, all ready) → MP Char Select → Loading → Battle HUD → Results → REMATCH (→ Loading) or LEAVE (→ Hub)

### Animations
- HP bars: `width 200ms linear`
- Resource bars: `width 200ms linear`
- Hit flash: `filter brightness(1.6)` for 140ms
- Damage shake: none (intentional — flash only)
- Loading progress: staggered per-player, ~2.2s + 450ms × index
- Modal backdrop: `backdrop-filter: blur(2-3px)`
- Combat log: auto-scroll, max 40 entries

### Ambient sim
- In MP lobby: bots toggle ready ~every 3.6s (20% chance per bot per tick)
- In MP char-select: bots cycle guild picks every 1.8s (15% chance per unlocked bot)
- In MP battle: random chip damage every 900ms, 8% chance of a big hit (20-50 dmg), combat log message every 1.4s
- In 1v1 battle: attacks exchange every 1.4s with cooldown tracking

## State Shape (current prototype)
```js
{
  // Screen routing
  screen: 'title' | 'menu' | 'charselect' | 'team' | 'stage' | 'loading' |
          'battle' | 'pause' | 'results' | 'moves' | 'guild' | 'settings' |
          'mp_hub' | 'mp_create' | 'mp_join' | 'mp_lobby' | 'mp_cs' |
          'mp_load' | 'mp_battle' | 'mp_results',
  returnTo: string | null,        // charselect → back target
  editingRoom: Room | null,       // edit-mode flag for create modal

  // Single-player choices
  p1: guildId, p2: guildId,
  stageId: stageId, guildId: guildId,  // dossier focus
  winner: 'P1' | 'P2',

  // Multiplayer
  mpRoom: Room | null,
  mpSlots: Slot[] | null,

  // Settings
  showChrome: boolean,
  animateHud: boolean,
  showLog: boolean,
}
```

### Room shape
```js
{
  id, name, host, mode: MPMode, filled: number, max: number,
  locked: boolean, code: string (6-char A-Z2-9), region, ping,
  stageId, state: 'LOBBY' | 'IN_GAME',
  visibility: 'public' | 'friends' | 'private',
  rounds: 1 | 3 | 5 | 7,
  friendlyFire: boolean,
  specSlots: 0 | 2 | 4 | 8,
}
```

### Slot shape
```js
{
  i: number,                       // 0..max-1
  empty?: true,
  name, guild: guildId, team: number | null,
  ping, ready: boolean, isHost: boolean, isYou: boolean,
}
```

### MPMode shape
```js
{ id: 'ffa' | '4v4' | '2v2v2v2' | 'custom', label, sub, max, teams }
```

### Guild shape (see `guilds.js` for full data)
```js
{
  id, name, tag, glyph, accent: oklch color,
  resource: { name, max, color },
  stats: { STR, DEX, CON, INT, WIS, CHA },
  vitals: { HP, Armor, MR, Move },
  bio, abilities: [{ slot, combo, name, fx, cd }, ...5],
  rmb: { name, fx },
}
```

## Data Modules
- `guilds.js` — 15 guilds with complete stats, vitals, abilities, bios, resources. Pure data, ports as-is.
- `mp-data.js` — `MP_MODES` (4 modes), `MP_ROOMS` (demo room list), `FAKE_PLAYERS` (bot names), `STAGES` (9 stages), `seedSlotsForRoom()`, `rollCode()`, helper fns.

## Assets
- **No external images.** All guild identities are CSS/SVG-drawn monograms using the glyph character from each guild's data (`⚔`, `✦`, `☾`, etc.).
- **No external icons.** UI chrome is all monospace typography and unicode glyphs (`◇`, `▸`, `□`, `■`, `×`).
- **Stage backdrops** are radial gradients using per-stage `hue` values in `oklch()`.
- **Brand accent color** per guild is an `oklch()` value stored on the guild object, rendered through the `guildAccent()` helper.

## Files (in this bundle)
- `Nannymud Screens.html` — root prototype entry
- `app.jsx` — router, state, Tweaks panel
- `theme.jsx` — theme definitions + shared primitives (Btn, Chip, SectionLabel, MeterBar, GuildMonogram, guildAccent)
- `guilds.jsx` — 15-guild dataset
- `mp-data.jsx` — MP modes, rooms, stages, helpers
- `screens-01.jsx` — title, menu
- `screens-02.jsx` — character select, team config
- `screens-03.jsx` — stage, loading, battle HUD (1v1), pause, results (1v1)
- `screens-04.jsx` — move list, guild dossier
- `screens-05.jsx` — MP hub, Create Room modal, Join by Code modal, ModalShell
- `screens-06.jsx` — Room lobby, SlotCard, seedSlotsForRoom
- `screens-07.jsx` — 8P char select (list layout), 8P loading, 8P battle, 8P results, GuildDetailOverlay

## Integration Notes for the React App
1. Drop the grimoire theme branches (any `theme.id === 'grimoire'` and `PAPER` overlays in `app.jsx`).
2. The Babel runtime tags (`<script type="text/babel">` and unpkg/integrity CDN imports in the HTML) go away — JSX becomes native via the host build.
3. `Object.assign(window, {...})` at the bottom of each screens file → `export { ... }`.
4. `React.useState` / `React.useEffect` → direct `import { useState, useEffect } from 'react'`.
5. Replace `localStorage.setItem('nannymud-state', ...)` with the host store (Zustand, Redux, React Query, etc.).
6. Replace the `state.screen` switch with real routes (`/mp/hub`, `/mp/lobby/:code`, `/battle/:id`, etc.).
7. Replace hardcoded `MP_ROOMS` and `FAKE_PLAYERS` with real socket/API data — slot and room shapes already match typical matchmaking payloads.
8. Replace the random-sim `useEffect`s in 1v1 battle and 8P battle with real combat state from your engine.
9. The Tweaks panel (`TweaksPanel` in `app.jsx`) is dev-only scaffolding; drop on port.
10. The `ScreenNav` debug menu (`◇ SCREENS` in top-right) is dev-only; drop on port.
