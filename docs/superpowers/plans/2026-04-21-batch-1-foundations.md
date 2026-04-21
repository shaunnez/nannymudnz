# Batch 1 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the design system foundation — terminal theme tokens, shared UI primitives, guild metadata, fonts, and the `useAppState` hook — so subsequent batches (screens 01–20) can assemble from stable pieces. After this batch, the app still renders the existing 4 screens, but they inherit the terminal theme (background, scanlines, fonts).

**Architecture:** All new UI code lives in `src/ui/` (primitives + theme tokens) and `src/data/` (guild-meta, stages). A new `src/state/useAppState.ts` replaces `App.tsx`'s inline `useState` and expands the screen union in preparation for later batches. The simulation layer is not touched. CLAUDE.md's one-way dependency rule holds: `simulation/` never imports from `ui/`, `data/`, `state/`, or `screens/`.

**Tech Stack:** React 18, TypeScript, Vite. No new npm packages. Fonts loaded via Google Fonts `<link>` in `index.html`. No test runner — validation is `npm run typecheck`, `npm run lint`, and manual `npm run dev` click-through. Not a git repo → no commit steps.

**Source material:** Theme values ported from `design_handoff_nannymud/theme.jsx` (NOT the README — README values are stale). Guild metadata ported from `design_handoff_nannymud/guilds.jsx`. Primitive implementations follow the handoff verbatim with React/TS idioms (`React.useState` → `useState`, `window.assign` exports → `export`).

---

## File Structure

Files created in this batch:

```
index.html                          MODIFY — add font <link>
src/index.css                       MODIFY — font-family CSS vars, body bg
src/ui/theme.ts                     CREATE — terminal color + typography tokens, guildAccent helpers
src/ui/Scanlines.tsx                CREATE — CRT overlay component
src/ui/Btn.tsx                      CREATE — button primitive
src/ui/Chip.tsx                     CREATE — chip primitive
src/ui/SectionLabel.tsx             CREATE — kicker+title row primitive
src/ui/MeterBar.tsx                 CREATE — HP/resource bar primitive
src/ui/GuildMonogram.tsx            CREATE — guild badge primitive
src/ui/ModalShell.tsx               CREATE — centered modal primitive
src/ui/index.ts                     CREATE — barrel export
src/data/guildMeta.ts               CREATE — GUILD_META, hue/tag/glyph/bio per GuildId
src/data/stages.ts                  CREATE — 9 stage entries, only `assembly` enabled
src/state/useAppState.ts            CREATE — app state hook + AppScreen union
src/App.tsx                         MODIFY — use useAppState; wrap in Scanlines; theme-bg
```

Files not touched in this batch: everything under `src/simulation/`, `src/rendering/`, `src/input/`, `src/audio/`, `src/layout/`, `src/screens/*.tsx` (batches 2+ replace these).

---

### Task 1: Add fonts and base CSS

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Add Google Fonts link to `index.html`**

Replace the entire `<head>` of `index.html` with:

```html
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nannymud LF2-Style Beat-&#39;Em-Up</title>
  <meta property="og:image" content="https://bolt.new/static/og_default.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://bolt.new/static/og_default.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:ital,wght@0,400;0,500;1,400&family=Space+Grotesk:wght@500;700&display=swap" />
</head>
```

- [ ] **Step 2: Update `src/index.css` with theme-friendly globals**

Replace the entire content of `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-display: "Space Grotesk", "Inter Tight", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: #0b0f14;
  color: #e6edf3;
  font-family: var(--font-body);
  overflow-x: hidden;
}

canvas {
  display: block;
}

button {
  font-family: inherit;
}
```

- [ ] **Step 3: Verify typecheck + lint pass**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: both pass with no errors.

---

### Task 2: Create theme tokens and guild-accent helpers

**Files:**
- Create: `src/ui/theme.ts`

- [ ] **Step 1: Write `src/ui/theme.ts`**

```ts
// Terminal theme tokens — ported from design_handoff_nannymud/theme.jsx (THEMES.terminal).
// Source-of-truth values; the handoff README has stale colors — ignore them.

export const theme = {
  id: 'terminal' as const,
  name: 'Terminal Esports',

  // Surfaces
  bg: '#0b0f14',
  bgDeep: '#05080c',
  panel: '#111820',
  panelRaised: '#172130',

  // Text
  ink: '#e6edf3',
  inkDim: '#9fb0c2',
  inkMuted: '#5f7186',

  // Strokes
  line: '#1e2b3b',
  lineSoft: '#15202d',

  // Accents
  accent: '#5cf2c2',  // neon mint
  warn: '#ffb347',
  good: '#5cf2c2',
  bad: '#ff5d73',

  // Team colors (multiplayer, per spec)
  team1: '#5cf2c2',
  team2: '#ff5d73',
  team3: '#ffb347',
  team4: '#928bff',

  // Typography
  fontDisplay: '"Space Grotesk", "Inter Tight", system-ui, sans-serif',
  fontBody: '"Inter", system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
} as const;

export type Theme = typeof theme;

// CRT scanline overlay — data URI so no asset file needed.
export const SCANLINE_BG =
  `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4'><rect width='4' height='1' fill='rgba(255,255,255,0.03)'/></svg>")`;

// Guild accent derivation from a hue angle (0-360). Ported verbatim from guilds.jsx.
export function guildAccent(hue: number): string {
  return `oklch(0.72 0.19 ${hue})`;
}

export function guildAccentSoft(hue: number): string {
  return `oklch(0.72 0.19 ${hue} / 0.18)`;
}

export function guildAccentDim(hue: number): string {
  return `oklch(0.55 0.14 ${hue})`;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS. If it fails, the `as const` on the object literal should be narrowing strings — double-check the export shape.

---

### Task 3: Guild metadata side-car

**Files:**
- Create: `src/data/guildMeta.ts`

- [ ] **Step 1: Write `src/data/guildMeta.ts`**

Values ported verbatim from `design_handoff_nannymud/guilds.jsx` (`tag`, `glyph`, `hue`, `sub`, `bio`). `Armor` / `MR` / `Move` are design-only UI placeholders from the `vitals` block — sim doesn't track them yet. `HP` is intentionally absent here; the Dossier screen will read `hpMax` from `GUILDS` in `src/simulation/guildData.ts`.

```ts
import type { GuildId } from '../simulation/types';

export interface GuildMeta {
  id: GuildId;
  sub: string;          // "Adventurers Guild" — long-form
  tag: string;          // "Generalist Bruiser" — one-line archetype
  glyph: string;        // 2-char monogram, e.g. "Av"
  hue: number;          // 0-360, feeds guildAccent(hue)
  bio: string;
  // UI-only vitals fields not yet in the sim. Flagged so the sim can promote them later.
  // TODO: promote to simulation once Armor/MR/Move are real mechanics.
  uiVitals: {
    Armor: number;
    MR: number;
    Move: number;
  };
}

export const GUILD_META: Record<GuildId, GuildMeta> = {
  adventurer: {
    id: 'adventurer',
    sub: 'Adventurers Guild',
    tag: 'Generalist Bruiser',
    glyph: 'Av',
    hue: 28,
    bio: 'The first guild a recruit walks into. No creed, no god — just iron in the hand and road in the boots. Adventurers fill every gap in every line.',
    uiVitals: { Armor: 10, MR: 5, Move: 140 },
  },
  knight: {
    id: 'knight',
    sub: 'Assembly of Knights',
    tag: 'Holy Tank',
    glyph: 'Kn',
    hue: 210,
    bio: 'Oath-sworn, plate-clad, sanctified. The Assembly holds the line when the line should not hold.',
    uiVitals: { Armor: 25, MR: 10, Move: 120 },
  },
  mage: {
    id: 'mage',
    sub: 'Mages Guild',
    tag: 'Ranged Burst',
    glyph: 'Mg',
    hue: 260,
    bio: 'The tower accepts no half-measures. Frost, arcane, annihilation — cast clean or burn out.',
    uiVitals: { Armor: 3, MR: 15, Move: 130 },
  },
  druid: {
    id: 'druid',
    sub: 'Druids',
    tag: 'Healer-Shifter',
    glyph: 'Dr',
    hue: 140,
    bio: 'Keeper of the old groves. Shape becomes thought becomes shape again — bear on the press, wolf on the chase.',
    uiVitals: { Armor: 8, MR: 12, Move: 130 },
  },
  hunter: {
    id: 'hunter',
    sub: 'Hunters Guild',
    tag: 'Marksman + Pet',
    glyph: 'Hn',
    hue: 75,
    bio: 'Patient, precise, paired. The bow speaks, the wolf answers.',
    uiVitals: { Armor: 6, MR: 5, Move: 140 },
  },
  monk: {
    id: 'monk',
    sub: 'Holy Monks Order',
    tag: 'Melee Assassin',
    glyph: 'Mo',
    hue: 40,
    bio: 'Breath before blow. Blow before breath. The Order teaches both, the student learns neither until they are the same.',
    uiVitals: { Armor: 7, MR: 10, Move: 160 },
  },
  viking: {
    id: 'viking',
    sub: 'Vikings Guild',
    tag: 'Berserker',
    glyph: 'Vk',
    hue: 0,
    bio: 'Raise the horn, make the tide red. The Vikings guild prefers its arguments concluded.',
    uiVitals: { Armor: 15, MR: 5, Move: 125 },
  },
  prophet: {
    id: 'prophet',
    sub: 'Prophets',
    tag: 'Cleric / Buffer',
    glyph: 'Pp',
    hue: 185,
    bio: 'Reads the wind for signs. Paints the battle with blessings and the enemy with curses.',
    uiVitals: { Armor: 6, MR: 14, Move: 125 },
  },
  vampire: {
    id: 'vampire',
    sub: 'Vampires',
    tag: 'Stalker Lifesteal',
    glyph: 'Vp',
    hue: 330,
    bio: 'Coven of the long night. Moves where the lamps do not. Feeds, forgets, feeds again.',
    uiVitals: { Armor: 8, MR: 10, Move: 145 },
  },
  cultist: {
    id: 'cultist',
    sub: 'Cult of the Drowned',
    tag: 'DoT Caster',
    glyph: 'Cu',
    hue: 300,
    bio: 'They say the deep has eyes, and the eyes have names, and the names are vowels you should not make.',
    uiVitals: { Armor: 4, MR: 12, Move: 125 },
  },
  champion: {
    id: 'champion',
    sub: 'Champions of the Red Throne',
    tag: 'Forward-Only Bruiser',
    glyph: 'Ch',
    hue: 15,
    bio: 'Blood for the throne. Never retreat — the throne counts your steps, and the wrong ones bleed.',
    uiVitals: { Armor: 12, MR: 5, Move: 135 },
  },
  darkmage: {
    id: 'darkmage',
    sub: 'Dark Guild',
    tag: 'Shadow Controller',
    glyph: 'Dk',
    hue: 275,
    bio: 'The Dark Guild turned the lamps down and the books dark. What is learned here is not unlearned.',
    uiVitals: { Armor: 4, MR: 14, Move: 125 },
  },
  chef: {
    id: 'chef',
    sub: 'Chefs Guild',
    tag: 'Utility Support',
    glyph: 'Cf',
    hue: 50,
    bio: 'An army marches on its stomach. The Chefs Guild argues this is in fact the only way anything marches.',
    uiVitals: { Armor: 6, MR: 6, Move: 130 },
  },
  leper: {
    id: 'leper',
    sub: 'Lepers',
    tag: 'Diseased Bruiser',
    glyph: 'Lp',
    hue: 95,
    bio: 'Cast from the cities, kept from the temples, welcomed only by the rot. The Lepers return the favor.',
    uiVitals: { Armor: 12, MR: 10, Move: 120 },
  },
  master: {
    id: 'master',
    sub: 'Masters of Nannymud',
    tag: 'Prestige Hybrid',
    glyph: 'Ms',
    hue: 170,
    bio: "Few earn the title. Fewer keep it. The Masters don't choose a class — they rotate through yours.",
    uiVitals: { Armor: 10, MR: 10, Move: 135 },
  },
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS. If `Record<GuildId, GuildMeta>` fails with "property missing", a guild id in the sim's `GuildId` union has no matching entry here — cross-check `src/simulation/types.ts` (line 35-38) against this file's keys. The sim's 15-guild roster (adventurer, knight, mage, druid, hunter, monk, viking, prophet, vampire, cultist, champion, darkmage, chef, leper, master) must match exactly.

---

### Task 4: Stage data

**Files:**
- Create: `src/data/stages.ts`

- [ ] **Step 1: Write `src/data/stages.ts`**

```ts
// Stage metadata for the Stage Select screen. The live sim currently ships only one
// level — `assembly` is the single enabled stage. The other 8 render as disabled tiles.

export type StageId =
  | 'assembly' | 'market' | 'kitchen' | 'tower' | 'grove'
  | 'catacombs' | 'throne' | 'docks' | 'rooftops';

export interface StageMeta {
  id: StageId;
  name: string;
  hue: number;       // drives the radial-gradient backdrop, same convention as guilds
  blurb: string;
  enabled: boolean;
}

export const STAGES: StageMeta[] = [
  {
    id: 'assembly',
    name: 'Assembly Hall',
    hue: 210,
    blurb: 'Flagstones under torchlight. The Knights swore here — mind the pillars.',
    enabled: true,
  },
  {
    id: 'market',
    name: 'Night Market',
    hue: 40,
    blurb: 'Paper lanterns and slick cobbles. The stalls are open. The knives, also.',
    enabled: false,
  },
  {
    id: 'kitchen',
    name: 'Rot-Kitchen',
    hue: 95,
    blurb: 'The Lepers took the stoves. The stew is old and moves on its own.',
    enabled: false,
  },
  {
    id: 'tower',
    name: 'Mage Tower',
    hue: 260,
    blurb: 'Levitating glass floors. Do not step where the runes are singing.',
    enabled: false,
  },
  {
    id: 'grove',
    name: 'Moonwake Grove',
    hue: 140,
    blurb: 'The old trees listen. Tread polite. The Druids are watching.',
    enabled: false,
  },
  {
    id: 'catacombs',
    name: 'Drowned Catacombs',
    hue: 300,
    blurb: 'Stalactites, saltwater, and names written in a dead vowel.',
    enabled: false,
  },
  {
    id: 'throne',
    name: 'Red Throne',
    hue: 15,
    blurb: 'The throne counts. Every retreat is a step into the pit.',
    enabled: false,
  },
  {
    id: 'docks',
    name: 'Vampire Docks',
    hue: 330,
    blurb: 'Fog off the pier. Nothing docks here that returns.',
    enabled: false,
  },
  {
    id: 'rooftops',
    name: 'Monastery Rooftops',
    hue: 185,
    blurb: 'Slate tiles, thin air, one misstep to the courtyard below.',
    enabled: false,
  },
];

export const STAGES_BY_ID: Record<StageId, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageMeta>;
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 5: Scanlines overlay component

**Files:**
- Create: `src/ui/Scanlines.tsx`

- [ ] **Step 1: Write `src/ui/Scanlines.tsx`**

```tsx
import { SCANLINE_BG } from './theme';

// Mount inside ScalingFrame. Sits above the letterbox but pointer-events:none so it
// never swallows clicks.
export function Scanlines() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: SCANLINE_BG,
        pointerEvents: 'none',
        opacity: 0.6,
        zIndex: 5,
        mixBlendMode: 'overlay',
      }}
    />
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 6: `Btn` primitive

**Files:**
- Create: `src/ui/Btn.tsx`

- [ ] **Step 1: Write `src/ui/Btn.tsx`**

Ported from `design_handoff_nannymud/theme.jsx:164-185`. API: `primary`, `disabled`, `size: 'sm' | 'md' | 'lg'`. Theme is imported from `./theme` — not passed as a prop (the whole app runs on one theme per the spec's decision to drop grimoire).

```tsx
import type { ReactNode, MouseEventHandler } from 'react';
import { theme } from './theme';

interface BtnProps {
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  primary?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  type?: 'button' | 'submit';
}

const SIZES = {
  sm: { pad: '4px 10px', fs: 11 },
  md: { pad: '8px 16px', fs: 13 },
  lg: { pad: '12px 24px', fs: 15 },
} as const;

export function Btn({
  children,
  onClick,
  primary = false,
  disabled = false,
  size = 'md',
  title,
  type = 'button',
}: BtnProps) {
  const s = SIZES[size];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: s.pad,
        fontSize: s.fs,
        background: primary ? theme.accent : 'transparent',
        color: primary ? theme.bgDeep : theme.ink,
        border: `1px solid ${primary ? theme.accent : theme.line}`,
        fontFamily: theme.fontMono,
        letterSpacing: 1,
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        borderRadius: 2,
        transition: 'all 100ms ease',
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 7: `Chip` primitive

**Files:**
- Create: `src/ui/Chip.tsx`

- [ ] **Step 1: Write `src/ui/Chip.tsx`**

Ported from `design_handoff_nannymud/theme.jsx:67-83`. Tones: `default | accent | bad | good | warn`. `warn` tone is new — README claims it exists; the handoff source only had 4, but we add `warn` since MP midstate uses amber.

```tsx
import type { ReactNode } from 'react';
import { theme } from './theme';

type ChipTone = 'default' | 'accent' | 'bad' | 'good' | 'warn';

interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  mono?: boolean;
}

const TONES: Record<ChipTone, { bg: string; fg: string; bd: string }> = {
  default: { bg: theme.panelRaised, fg: theme.inkDim, bd: theme.line },
  accent:  { bg: 'transparent',     fg: theme.accent, bd: theme.accent },
  bad:     { bg: 'transparent',     fg: theme.bad,    bd: theme.bad },
  good:    { bg: 'transparent',     fg: theme.good,   bd: theme.good },
  warn:    { bg: 'transparent',     fg: theme.warn,   bd: theme.warn },
};

export function Chip({ children, tone = 'default', mono = false }: ChipProps) {
  const t = TONES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        border: `1px solid ${t.bd}`,
        color: t.fg,
        background: t.bg,
        fontFamily: mono ? theme.fontMono : theme.fontBody,
        fontSize: 10,
        letterSpacing: mono ? 1 : 0,
        textTransform: mono ? 'uppercase' : 'none',
        borderRadius: 2,
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 8: `SectionLabel` primitive

**Files:**
- Create: `src/ui/SectionLabel.tsx`

- [ ] **Step 1: Write `src/ui/SectionLabel.tsx`**

Ported from `design_handoff_nannymud/theme.jsx:54-65`.

```tsx
import type { ReactNode } from 'react';
import { theme } from './theme';

interface SectionLabelProps {
  children: ReactNode;
  kicker?: string;
  right?: ReactNode;
}

export function SectionLabel({ children, kicker, right }: SectionLabelProps) {
  const monoStyle: React.CSSProperties = {
    fontFamily: theme.fontMono,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.inkMuted,
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: `1px solid ${theme.lineSoft}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        {kicker && <span style={monoStyle}>{kicker}</span>}
        <span
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 16,
            color: theme.ink,
            letterSpacing: '-0.01em',
          }}
        >
          {children}
        </span>
      </div>
      {right && <div style={monoStyle}>{right}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 9: `MeterBar` primitive

**Files:**
- Create: `src/ui/MeterBar.tsx`

- [ ] **Step 1: Write `src/ui/MeterBar.tsx`**

Ported from `design_handoff_nannymud/theme.jsx:136-161`. Segmented mode draws 9 dividers for small-max resources (chi=5, bloodtally=10).

```tsx
import { theme } from './theme';

interface MeterBarProps {
  value: number;
  max: number;
  color: string;
  height?: number;
  label?: string;
  segmented?: boolean;
  flash?: boolean;
}

export function MeterBar({
  value,
  max,
  color,
  height = 8,
  label,
  segmented = false,
  flash = false,
}: MeterBarProps) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkDim,
            letterSpacing: 1,
            marginBottom: 2,
          }}
        >
          <span>{label}</span>
          <span>
            {Math.round(value)}/{max}
          </span>
        </div>
      )}
      <div
        style={{
          height,
          background: theme.bgDeep,
          border: `1px solid ${theme.lineSoft}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct * 100}%`,
            background: color,
            transition: 'width 200ms linear',
            boxShadow: flash ? `0 0 10px ${color}` : 'none',
          }}
        />
        {segmented &&
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${(i + 1) * 10}%`,
                width: 1,
                background: theme.bgDeep,
              }}
            />
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 10: `GuildMonogram` primitive

**Files:**
- Create: `src/ui/GuildMonogram.tsx`

- [ ] **Step 1: Write `src/ui/GuildMonogram.tsx`**

Ported from `design_handoff_nannymud/theme.jsx:86-123`. Takes a `GuildId`, reads `GUILD_META` for `glyph` + `hue`, derives accent colors. Sizes are freeform px.

```tsx
import type { GuildId } from '../simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, guildAccentSoft, guildAccentDim } from './theme';

interface GuildMonogramProps {
  guildId: GuildId;
  size?: number;
  selected?: boolean;
  dim?: boolean;
}

export function GuildMonogram({
  guildId,
  size = 64,
  selected = false,
  dim = false,
}: GuildMonogramProps) {
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);
  const accentSoft = guildAccentSoft(meta.hue);
  const accentDim = guildAccentDim(meta.hue);

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        background: `linear-gradient(135deg, ${accentSoft}, transparent 70%), ${theme.panelRaised}`,
        border: `1px solid ${selected ? accent : theme.line}`,
        boxShadow: selected ? `inset 0 0 0 1px ${accent}, 0 0 0 2px ${accent}` : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: dim ? theme.inkMuted : selected ? accent : theme.ink,
        fontFamily: theme.fontMono,
        fontSize: Math.round(size * 0.42),
        fontWeight: 500,
        letterSpacing: 1,
        opacity: dim ? 0.45 : 1,
        transition: 'all 120ms ease',
        overflow: 'hidden',
      }}
    >
      {selected && (
        <>
          <span style={cornerStyle(accent, { top: 3, left: 3 }, 'tl')} />
          <span style={cornerStyle(accent, { top: 3, right: 3 }, 'tr')} />
          <span style={cornerStyle(accent, { bottom: 3, left: 3 }, 'bl')} />
          <span style={cornerStyle(accent, { bottom: 3, right: 3 }, 'br')} />
        </>
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{meta.glyph}</span>
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          left: 6,
          right: 6,
          height: 1,
          background: accentDim,
          opacity: 0.5,
        }}
      />
    </div>
  );
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function cornerStyle(
  accent: string,
  pos: React.CSSProperties,
  corner: Corner,
): React.CSSProperties {
  const borders: React.CSSProperties = {};
  if (corner === 'tl') {
    borders.borderTop = `1px solid ${accent}`;
    borders.borderLeft = `1px solid ${accent}`;
  }
  if (corner === 'tr') {
    borders.borderTop = `1px solid ${accent}`;
    borders.borderRight = `1px solid ${accent}`;
  }
  if (corner === 'bl') {
    borders.borderBottom = `1px solid ${accent}`;
    borders.borderLeft = `1px solid ${accent}`;
  }
  if (corner === 'br') {
    borders.borderBottom = `1px solid ${accent}`;
    borders.borderRight = `1px solid ${accent}`;
  }
  return {
    position: 'absolute',
    width: 6,
    height: 6,
    ...pos,
    ...borders,
  };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 11: `ModalShell` primitive

**Files:**
- Create: `src/ui/ModalShell.tsx`

- [ ] **Step 1: Write `src/ui/ModalShell.tsx`**

Ported from `design_handoff_nannymud/screens-05.jsx:427-447`. Adds ESC-to-close keyboard handler (handoff version relied on app-level ESC routing; we make it self-contained per the spec's architecture preference for clear unit boundaries).

```tsx
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { theme } from './theme';
import { Btn } from './Btn';

interface ModalShellProps {
  title: string;
  kicker?: string;
  onCancel: () => void;
  primary?: { label: string; onClick: () => void; disabled?: boolean };
  children: ReactNode;
}

export function ModalShell({ title, kicker, onCancel, primary, children }: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 780,
          maxHeight: 'calc(100% - 80px)',
          background: theme.bg,
          border: `1px solid ${theme.accent}`,
          boxShadow: `0 0 0 1px ${theme.line}, 0 30px 80px rgba(0,0,0,0.7)`,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            {kicker && (
              <div
                style={{
                  fontFamily: theme.fontMono,
                  fontSize: 10,
                  color: theme.inkMuted,
                  letterSpacing: 3,
                }}
              >
                {kicker}
              </div>
            )}
            <div
              style={{
                fontFamily: theme.fontDisplay,
                fontSize: 22,
                color: theme.ink,
                letterSpacing: '-0.01em',
                marginTop: 2,
              }}
            >
              {title}
            </div>
          </div>
          <div
            onClick={onCancel}
            style={{
              cursor: 'pointer',
              fontFamily: theme.fontMono,
              fontSize: 18,
              color: theme.inkDim,
              padding: '0 8px',
            }}
          >
            ×
          </div>
        </div>
        <div style={{ padding: 24, overflow: 'auto', flex: 1 }}>{children}</div>
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${theme.lineSoft}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Btn onClick={onCancel}>CANCEL · ESC</Btn>
          {primary && (
            <Btn primary onClick={primary.onClick} disabled={primary.disabled}>
              {primary.label}
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 12: UI barrel export

**Files:**
- Create: `src/ui/index.ts`

- [ ] **Step 1: Write `src/ui/index.ts`**

```ts
export { theme, guildAccent, guildAccentSoft, guildAccentDim, SCANLINE_BG } from './theme';
export type { Theme } from './theme';
export { Scanlines } from './Scanlines';
export { Btn } from './Btn';
export { Chip } from './Chip';
export { SectionLabel } from './SectionLabel';
export { MeterBar } from './MeterBar';
export { GuildMonogram } from './GuildMonogram';
export { ModalShell } from './ModalShell';
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

### Task 13: `useAppState` hook

**Files:**
- Create: `src/state/useAppState.ts`

- [ ] **Step 1: Write `src/state/useAppState.ts`**

This is the full 20-screen union from the spec, but only the current 4 screens are reachable after this batch. Later batches wire up the rest. `mpRoom` / `mpSlots` / `editingRoom` / `returnTo` use `unknown`-ish types for now — batch 7+ will narrow them when the Room/Slot types are defined.

```ts
import { useCallback, useEffect, useState } from 'react';
import type { GuildId } from '../simulation/types';
import type { StageId } from '../data/stages';

export type AppScreen =
  | 'title'
  | 'menu'
  | 'charselect'
  | 'team'
  | 'stage'
  | 'loading'
  | 'game'
  | 'pause'
  | 'results'
  | 'moves'
  | 'guild_dossier'
  | 'settings'
  | 'mp_hub'
  | 'mp_create'
  | 'mp_join'
  | 'mp_lobby'
  | 'mp_cs'
  | 'mp_load'
  | 'mp_battle'
  | 'mp_results';

// Placeholder shapes — batch 7 narrows these when MP mocking lands.
export type Room = { id: string; [k: string]: unknown };
export type Slot = { i: number; [k: string]: unknown };

export interface AppState {
  screen: AppScreen;
  returnTo: AppScreen | null;
  editingRoom: Room | null;

  // Single-player fighter-shape roster
  p1: GuildId;
  p2: GuildId;
  p1Team: [GuildId, GuildId, GuildId];
  p2Team: [GuildId, GuildId, GuildId];
  stageId: StageId;
  guildId: GuildId;           // dossier focus
  winner: 'P1' | 'P2' | null;

  // Mocked multiplayer
  mpRoom: Room | null;
  mpSlots: Slot[] | null;

  // Settings toggles surfaced in the Tweaks/Settings screen
  animateHud: boolean;
  showLog: boolean;
}

const STORAGE_KEY = 'nannymud-app-state-v1';

const DEFAULT_STATE: AppState = {
  screen: 'title',
  returnTo: null,
  editingRoom: null,
  p1: 'adventurer',
  p2: 'knight',
  p1Team: ['adventurer', 'knight', 'mage'],
  p2Team: ['viking', 'monk', 'druid'],
  stageId: 'assembly',
  guildId: 'adventurer',
  winner: null,
  mpRoom: null,
  mpSlots: null,
  animateHud: true,
  showLog: true,
};

// Only these keys are persisted across reloads. Screen, winner, MP state are session-only.
const PERSISTED_KEYS: (keyof AppState)[] = [
  'p1',
  'p2',
  'p1Team',
  'p2Team',
  'stageId',
  'animateHud',
  'showLog',
];

function loadPersisted(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const picked: Partial<AppState> = {};
    for (const key of PERSISTED_KEYS) {
      if (key in parsed) {
        (picked as Record<string, unknown>)[key] = parsed[key];
      }
    }
    return picked;
  } catch {
    return {};
  }
}

export interface AppStateActions {
  state: AppState;
  set: (patch: Partial<AppState>) => void;
  go: (screen: AppScreen, extras?: Partial<AppState>) => void;
}

export function useAppState(): AppStateActions {
  const [state, setState] = useState<AppState>(() => ({ ...DEFAULT_STATE, ...loadPersisted() }));

  useEffect(() => {
    const persisted: Partial<AppState> = {};
    for (const key of PERSISTED_KEYS) {
      (persisted as Record<string, unknown>)[key] = state[key];
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Storage full / disabled — fail quiet.
    }
  }, [state]);

  const set = useCallback((patch: Partial<AppState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const go = useCallback((screen: AppScreen, extras?: Partial<AppState>) => {
    setState((s) => ({ ...s, screen, ...(extras ?? {}) }));
  }, []);

  return { state, set, go };
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS. If it complains about `GuildId` not including the defaults (`'adventurer'`, `'knight'`, etc.), cross-check against `src/simulation/types.ts:35-38`.

---

### Task 14: Rewire `App.tsx` to use `useAppState` and mount Scanlines

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace the entire content of `src/App.tsx`**

Still renders the current 4 screens; just flows through `useAppState` and paints the terminal background/scanlines everywhere. Later batches add the remaining 16 screens into this switch.

```tsx
import { TitleScreen } from './screens/TitleScreen';
import { GuildSelect } from './screens/GuildSelect';
import { GameScreen } from './screens/GameScreen';
import { GameOverScreen } from './screens/GameOverScreen';
import { ScalingFrame } from './layout/ScalingFrame';
import { Scanlines, theme } from './ui';
import { useAppState } from './state/useAppState';
import { useState } from 'react';
import type { GuildId } from './simulation/types';

type BatchOneScreen = 'title' | 'guild_select' | 'game' | 'game_over';

export default function App() {
  const { state, go, set } = useAppState();

  // Batch 1 only exposes the 4 existing screens. Map the AppScreen union onto the
  // legacy sub-set until batches 2+ replace each screen. The full union lives in
  // useAppState.ts so later batches don't need to redefine it.
  const legacy: BatchOneScreen =
    state.screen === 'title' ? 'title'
      : state.screen === 'charselect' ? 'guild_select'
      : state.screen === 'game' ? 'game'
      : state.screen === 'results' ? 'game_over'
      : 'title';

  // Outcome/score belong to the game-over flow — still session-only since spec
  // keeps winner transient. Batch 5 replaces this with Results reading from sim.
  const [outcome, setOutcome] = useState<'victory' | 'defeat'>('defeat');
  const [finalScore, setFinalScore] = useState(0);

  return (
    <ScalingFrame>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: theme.bg,
          color: theme.ink,
          fontFamily: theme.fontBody,
          overflow: 'hidden',
        }}
      >
        {legacy === 'title' && <TitleScreen onStart={() => go('charselect')} />}

        {legacy === 'guild_select' && (
          <GuildSelect
            onSelect={(guildId: GuildId) => {
              set({ p1: guildId });
              go('game');
            }}
          />
        )}

        {legacy === 'game' && (
          <GameScreen
            guildId={state.p1}
            onVictory={(score) => {
              setOutcome('victory');
              setFinalScore(score);
              go('results');
            }}
            onDefeat={() => {
              setOutcome('defeat');
              go('results');
            }}
            onQuit={() => go('charselect')}
          />
        )}

        {legacy === 'game_over' && (
          <GameOverScreen
            outcome={outcome}
            score={finalScore}
            onRetry={() => go('game')}
            onMenu={() => go('charselect')}
          />
        )}

        <Scanlines />
      </div>
    </ScalingFrame>
  );
}
```

- [ ] **Step 2: Verify typecheck and lint pass**

Run:
```bash
npm run typecheck
npm run lint
```
Expected: both pass.

---

### Task 15: Manual click-through validation

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:5173`. No console errors.

- [ ] **Step 2: Walk the happy path**

- Open `http://localhost:5173`.
- Verify the Title screen loads. The canvas art is the *old* placeholder (no changes this batch), but the page background is `theme.bg` (#0b0f14, near-black) and scanlines are visible over the letterbox.
- Click the title. → `GuildSelect` appears. Scanlines still visible.
- Pick a guild. → `GameScreen` runs the canvas battle. Scanlines visible over the canvas.
  - **Watch for:** canvas readability. If scanlines hurt gameplay visibility, note it — it's flagged as a known risk in the spec and will be mitigated in Batch 2+ by gating scanlines to menus only.
- Press `P` to pause, then `P` to resume — existing behavior should still work.
- Win or lose to reach `GameOverScreen`. Click Retry — goes back to game. Click Menu — goes back to GuildSelect.

- [ ] **Step 3: Verify localStorage persistence**

- In DevTools → Application → Local Storage → `http://localhost:5173`, confirm a key `nannymud-app-state-v1` exists with a JSON body containing `p1`, `p2`, `p1Team`, `p2Team`, `stageId`, `animateHud`, `showLog`.
- Refresh the page. Verify `p1` (the guild you picked) is still set — the Title screen still loads (screen is session-only) but picking charselect shows your last guild is persisted through the legacy `GuildSelect` (which reads from its own internal state — that's fine, it gets replaced in Batch 3).

- [ ] **Step 4: Verify fonts loaded**

- In DevTools → Network, filter by "font". Confirm `JetBrains Mono`, `Inter`, and `Space Grotesk` woff2 files load.
- In DevTools → Elements → computed styles, body `font-family` resolves to `Inter, system-ui, sans-serif`.

- [ ] **Step 5: Confirm no regressions**

- Fullscreen toggle (`F`) still works.
- Pause key (`P`) still works.
- Audio plays during battle.
- Combo detection still works (try `→→J` on any guild that has a run-forward ability).

---

## Self-Review

**Spec coverage:**
- `src/ui/theme.ts` ✓ (Task 2)
- Primitives Btn, Chip, SectionLabel, GuildMonogram, MeterBar, ModalShell, Scanlines ✓ (Tasks 5–11)
- `src/data/guildMeta.ts` ✓ (Task 3)
- `src/data/stages.ts` ✓ (Task 4)
- Font `<link>` in `index.html` ✓ (Task 1)
- `useAppState` hook ✓ (Task 13)
- `App.tsx` rewired, still 4 screens ✓ (Task 14)
- Scanlines mounted app-wide ✓ (Task 14, with the spec-flagged risk noted in Task 15 validation)

**Placeholder scan:** No "TBD" or "TODO: implement later". One annotated `// TODO: promote to sim` in guildMeta (Armor/MR/Move) is a deliberate forward-pointer, not a placeholder; values are filled.

**Type consistency:** `GuildId` flows in from `src/simulation/types.ts` everywhere. `StageId` defined once in `src/data/stages.ts`, re-used in `useAppState`. `theme` is a single imported object, not passed as a prop (architecture decision from brainstorming — the app runs on one theme).

**Known scope discipline:** The AppScreen union includes all 20 screens, but only 4 are routed. The unused screen names are accepted as dead branches for the duration of Batch 1 — they get wired up as their screens land. No speculative code for those branches ships this batch.

---

## Risks flagged for next batch

- **Scanlines over canvas readability** — if Task 15 Step 2 reveals the CRT overlay degrades battle visibility, Batch 2 will split `Scanlines` into per-screen mounts (menus only) rather than app-wide.
- **Legacy `GuildSelect` binding.** Batch 1 keeps the old guild-select alive; it writes to `p1` via `set()` but its internal `GuildId` picker list may not match the sim's full 15. Batch 3 replaces the whole screen, so we don't fix it here.
