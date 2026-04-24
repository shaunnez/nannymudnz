# CharSelect MP Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `MpCharSelect.tsx` to full visual parity with `CharSelect.tsx` by extracting shared panel components and rewriting the MP layout to use them.

**Architecture:** Extract `SidePanel`, `VitalRow`, `AccentBtn`, `StatBar` from `CharSelect.tsx` into a new `CharSelectPanels.tsx`. `CharSelect.tsx` imports from the new file with zero behavioural change. `MpCharSelect.tsx` is rewritten to use the shared components, match SP tile sizes/fonts (190 px, 20 px labels), add the GuildDetails modal, and move the LOCK IN button to the header.

**Tech Stack:** React 18, TypeScript, Vitest (typecheck + golden sim test gate)

---

## Task 1: Create `src/screens/CharSelectPanels.tsx`

**Files:**
- Create: `src/screens/CharSelectPanels.tsx`

- [ ] **Step 1: Create the file**

Write `src/screens/CharSelectPanels.tsx` with the exact content below. This is a pure extraction from `CharSelect.tsx` plus one new optional `roleLabel` prop on `SidePanel`:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, GuildMonogram, ComboDisplay } from '../ui';

export interface SidePanelProps {
  role: 'P1' | 'CPU';
  guildId: GuildId;
  locked: boolean;
  active: boolean;
  statusText?: string;
  roleLabel?: string;
  onView: () => void;
}

export function SidePanel({ role, guildId, locked, active, statusText, roleLabel, onView }: SidePanelProps) {
  const guild = GUILDS.find((g) => g.id === guildId)!;
  const meta = GUILD_META[guildId];
  const accent = guildAccent(meta.hue);
  const ult = guild.abilities[4];
  const labelColor = role === 'P1' ? theme.accent : theme.warn;

  return (
    <div
      style={{
        padding: 24,
        borderRight: role === 'P1' ? `1px solid ${theme.lineSoft}` : 'none',
        borderLeft: role === 'CPU' ? `1px solid ${theme.lineSoft}` : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: active ? theme.panel : 'transparent',
        overflow: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: theme.fontMono,
            fontSize: 14,
            letterSpacing: 3,
            color: active ? labelColor : theme.inkMuted,
          }}
        >
          {roleLabel ?? (role === 'P1' ? 'P1 · HUMAN' : 'CPU · OPPONENT')}{active ? ' ◆' : ''}
        </span>
        <span
          style={{
            fontFamily: theme.fontMono,
            fontSize: 14,
            color: locked ? theme.good : theme.warn,
          }}
        >
          {statusText ?? (locked ? 'LOCKED' : 'SELECTING…')}
        </span>
      </div>
      <GuildMonogram guildId={guildId} size={180} selected={locked} />
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 30,
            color: theme.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
          }}
        >
          {guild.name}
        </div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 15, color: theme.inkDim, fontStyle: 'italic' }}>
          {meta.sub}
        </div>
      </div>
      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 15,
          color: theme.inkDim,
          lineHeight: 1.55,
          minHeight: 'calc(12px * 1.55 * 4)',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {meta.bio}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <VitalRow label={guild.resource.name} value={String(guild.resource.max)} accent={accent} emphasized />
        <VitalRow label="HP" value={String(guild.hpMax)} accent={accent} />
        <VitalRow label="ARMOR" value={String(meta.uiVitals.Armor)} accent={accent} />
        <VitalRow label="MR" value={String(meta.uiVitals.MR)} accent={accent} />
        <VitalRow label="MOVE" value={String(meta.uiVitals.Move)} accent={accent} />
      </div>
      <AccentBtn accent={accent} onClick={onView}>VIEW DETAILS</AccentBtn>
      <div style={{ marginTop: 'auto', borderTop: `1px solid ${theme.lineSoft}`, paddingTop: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: theme.fontMono,
            fontSize: 20,
            color: theme.inkMuted,
            letterSpacing: 2,
            marginBottom: 6,
          }}
        >
          <span>ULT ·</span>
          <ComboDisplay combo={ult.combo} size={20} color={theme.ink} />
        </div>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 18, color: accent }}>{ult.name}</div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 14, color: theme.inkDim }}>
          {ult.description}
        </div>
      </div>
    </div>
  );
}

export interface VitalRowProps {
  label: string;
  value: string;
  accent: string;
  emphasized?: boolean;
}

export function VitalRow({ label, value, accent, emphasized }: VitalRowProps) {
  const fg = emphasized ? accent : theme.ink;
  const border = emphasized ? accent : theme.lineSoft;
  const bg = emphasized ? `${accent}14` : theme.panel;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: bg,
        border: `1px solid ${border}`,
      }}
    >
      <span
        style={{
          fontFamily: theme.fontMono,
          fontSize: emphasized ? 18 : 16,
          color: emphasized ? accent : theme.ink,
          fontWeight: emphasized ? 400 : 700,
          letterSpacing: 2,
        }}
      >
        {label.toUpperCase()}
      </span>
      <span
        style={{
          fontFamily: theme.fontDisplay,
          fontSize: emphasized ? 20 : 16,
          color: fg,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export interface AccentBtnProps {
  accent: string;
  onClick: () => void;
  children: ReactNode;
}

export function AccentBtn({ accent, onClick, children }: AccentBtnProps) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 20px',
        fontSize: 15,
        background: hover ? `${accent}22` : 'transparent',
        color: accent,
        border: `1px solid ${accent}`,
        fontFamily: theme.fontMono,
        letterSpacing: 2,
        textTransform: 'uppercase',
        cursor: 'pointer',
        borderRadius: 2,
        transition: 'all 120ms ease',
        boxShadow: hover ? `0 0 0 1px ${accent}55` : 'none',
      }}
    >
      {children}
    </button>
  );
}

export interface StatBarProps {
  label: string;
  value: number;
  max: number;
  hue: number;
}

export function StatBar({ label, value, max, hue }: StatBarProps) {
  const accent = guildAccent(hue);
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: theme.fontMono,
          fontSize: 18,
          color: theme.inkDim,
          letterSpacing: 1,
          marginBottom: 3,
        }}
      >
        <span>{label}</span>
        <span style={{ color: theme.ink }}>{value}</span>
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 10,
              background: i < value ? accent : theme.bgDeep,
              border: `1px solid ${i < value ? accent : theme.lineSoft}`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck — expect zero errors**

```bash
npm run typecheck
```

Expected: exits 0 with no errors. If there are import errors (e.g. `ComboDisplay` not exported from `../ui`), check the actual export name in `src/ui/index.ts` and correct accordingly.

---

## Task 2: Update `src/screens/CharSelect.tsx` to import from shared file

**Files:**
- Modify: `src/screens/CharSelect.tsx` (imports + remove 237 lines of component defs)

- [ ] **Step 1: Update the import block**

Replace the current import block at the top of `CharSelect.tsx` (lines 1–8):

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, Btn, Chip, GuildMonogram, ComboDisplay } from '../ui';
import { GuildDetails } from './GuildDetails';
import type { GameMode } from '../state/useAppState';
```

With:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { GUILD_META } from '../data/guildMeta';
import { theme, guildAccent, Btn, Chip, GuildMonogram } from '../ui';
import { GuildDetails } from './GuildDetails';
import type { GameMode } from '../state/useAppState';
import { SidePanel, StatBar } from './CharSelectPanels';
```

Changes: removed `ReactNode` (no longer used directly), removed `ComboDisplay` (moved to CharSelectPanels), added `SidePanel` and `StatBar` imports.

- [ ] **Step 2: Delete the local component definitions**

Delete everything from line 366 to the end of the file (the `SidePanelProps` interface through the closing `}` of `StatBar`). These are now in `CharSelectPanels.tsx`.

The file should end at the closing `}` of the `CharSelect` export function (around line 364 currently, which is `}`).

- [ ] **Step 3: Run typecheck — expect zero errors**

```bash
npm run typecheck
```

Expected: exits 0. If `noUnusedLocals` fires on `ReactNode`, confirm it was removed from the import. If it fires on any other symbol, that symbol should either be kept or also removed.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```

Expected: all tests PASS. The golden simulation test must not be affected (it has nothing to do with UI components).

- [ ] **Step 5: Commit**

```bash
git add src/screens/CharSelectPanels.tsx src/screens/CharSelect.tsx
git commit -m "refactor(char-select): extract SidePanel/StatBar/AccentBtn/VitalRow to CharSelectPanels"
```

---

## Task 3: Rewrite `src/screens/mp/MpCharSelect.tsx`

**Files:**
- Modify: `src/screens/mp/MpCharSelect.tsx`

- [ ] **Step 1: Replace the entire file**

Write `src/screens/mp/MpCharSelect.tsx` with the complete content below:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { GUILDS } from '@nannymud/shared/simulation/guildData';
import type { GuildId, Stats } from '@nannymud/shared/simulation/types';
import { theme, guildAccent, Btn, Chip, GuildMonogram } from '../../ui';
import { GUILD_META } from '../../data/guildMeta';
import { useMatchState, getMatchSlots } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';
import { SidePanel, StatBar } from '../CharSelectPanels';
import { GuildDetails } from '../GuildDetails';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const COLS = 5;
const ROWS = 3;
const TILE_SIZE = 190;
const TILE_GAP = 20;

export function MpCharSelect({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  const ids = useMemo(() => GUILDS.map((g) => g.id), []);

  const { localSlot, opponentSlot } = getMatchSlots(state, room.sessionId);

  const isLocked = localSlot?.locked ?? false;

  const [cursorIdx, setCursorIdx] = useState<number>(() => {
    const gid = localSlot?.guildId;
    if (gid) {
      const i = ids.indexOf(gid as GuildId);
      return i >= 0 ? i : 0;
    }
    return 0;
  });

  const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);

  const cursorGuildId = ids[cursorIdx];
  const hoveredMeta = GUILD_META[cursorGuildId];
  const hoveredGuild = GUILDS.find((g) => g.id === cursorGuildId)!;

  usePhaseBounce(state?.phase ?? 'char_select', 'char_select', onPhaseChange);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (isLocked) return;
      setCursorIdx((c) => {
        const r = Math.floor(c / COLS);
        const col = c % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return nr * COLS + nc;
      });
    },
    [isLocked],
  );

  const lockIn = useCallback(() => {
    if (isLocked) return;
    room.send('lock_guild', { guildId: cursorGuildId });
  }, [isLocked, room, cursorGuildId]);

  useEffect(() => {
    if (detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); lockIn(); }
      else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        onLeave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailsFor, lockIn, move, onLeave]);

  if (!state) return <MpLoading />;

  const opponentGuildId = opponentSlot?.locked ? opponentSlot.guildId : null;
  const localGuildId = isLocked ? (localSlot!.guildId as GuildId) : cursorGuildId;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 36px',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.lineSoft}`,
          gap: 16,
        }}
      >
        <div style={{ justifySelf: 'start' }}>
          <Btn size="md" onClick={onLeave}>← LEAVE</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontFamily: theme.fontMono,
              fontSize: 10,
              color: theme.inkMuted,
              letterSpacing: 3,
            }}
          >
            SELECT · {GUILDS.length} GUILDS · MULTIPLAYER
          </span>
          <span
            style={{
              fontFamily: theme.fontDisplay,
              fontSize: 26,
              color: theme.ink,
              textAlign: 'center',
            }}
          >
            Choose your guild
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RoomCodeBadge code={state.code} />
          <Btn size="md" primary disabled={isLocked} onClick={lockIn}>
            {isLocked ? 'LOCKED ✓' : 'LOCK IN →'}
          </Btn>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '280px 1fr 280px',
          overflow: 'hidden',
        }}
      >
        {/* Left panel — local player */}
        <SidePanel
          role="P1"
          roleLabel="P1 · YOU"
          guildId={localGuildId}
          locked={isLocked}
          active={true}
          onView={() => setDetailsFor(localGuildId)}
        />

        {/* Center — guild grid */}
        <div
          style={{
            padding: '28px 36px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            overflow: 'auto',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`,
              gap: TILE_GAP,
              justifyContent: 'center',
            }}
          >
            {GUILDS.map((g, i) => {
              const meta = GUILD_META[g.id];
              const acc = guildAccent(meta.hue);
              const isActive = cursorIdx === i;
              const localLockedHere = isLocked && localSlot?.guildId === g.id;
              const oppLockedHere = opponentSlot?.locked && opponentSlot.guildId === g.id;

              return (
                <div
                  key={g.id}
                  onMouseEnter={() => { if (!isLocked) setCursorIdx(i); }}
                  onClick={() => {
                    if (isLocked) return;
                    setCursorIdx(i);
                    room.send('lock_guild', { guildId: g.id });
                  }}
                  style={{
                    position: 'relative',
                    width: TILE_SIZE,
                    cursor: isLocked ? 'default' : 'pointer',
                    outline: isActive ? `2px solid ${acc}` : 'none',
                    outlineOffset: 3,
                  }}
                >
                  <GuildMonogram guildId={g.id} size={TILE_SIZE} selected={isActive} />
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: 8,
                      fontFamily: theme.fontMono,
                      fontSize: 20,
                      color: isActive ? acc : theme.inkDim,
                      letterSpacing: 2,
                    }}
                  >
                    {g?.name?.toUpperCase()}
                  </div>
                  {localLockedHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: theme.accent,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ P1
                    </div>
                  )}
                  {oppLockedHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: theme.warn,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ OPP
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stat strip — always visible, matches SP center strip */}
          <div
            style={{
              marginTop: 'auto',
              padding: '16px 18px',
              border: `1px solid ${theme.lineSoft}`,
              background: theme.panel,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <span
                style={{
                  fontFamily: theme.fontDisplay,
                  fontSize: 20,
                  color: guildAccent(hoveredMeta.hue),
                }}
              >
                {hoveredGuild.name}
              </span>
              <span style={{ marginLeft: 'auto' }}>
                <Chip tone="accent" mono>{hoveredMeta.tag}</Chip>
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 30 }}>
              {(Object.entries(hoveredGuild.stats) as [keyof Stats, number][]).map(([k, v]) => (
                <StatBar key={k} label={k} value={v} max={20} hue={hoveredMeta.hue} />
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — opponent */}
        {opponentSlot?.locked && opponentGuildId ? (
          <SidePanel
            role="CPU"
            roleLabel={`P2 · ${opponentSlot.name || 'OPPONENT'}`}
            guildId={opponentGuildId as GuildId}
            locked={true}
            active={false}
            onView={() => setDetailsFor(opponentGuildId as GuildId)}
          />
        ) : (
          <div
            style={{
              padding: 24,
              borderLeft: `1px solid ${theme.lineSoft}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                fontFamily: theme.fontMono,
                fontSize: 14,
                letterSpacing: 3,
                color: theme.inkMuted,
              }}
            >
              {opponentSlot ? 'P2 · OPPONENT' : 'OPP · EMPTY'}
            </div>
            <div
              style={{
                fontFamily: theme.fontBody,
                fontSize: 15,
                color: theme.inkMuted,
                fontStyle: 'italic',
              }}
            >
              {opponentSlot ? 'Opponent is selecting…' : 'Waiting for opponent to join…'}
            </div>
          </div>
        )}
      </div>

      {detailsFor && <GuildDetails guildId={detailsFor} onClose={() => setDetailsFor(null)} />}

      {/* Footer */}
      <div
        style={{
          padding: '10px 36px',
          borderTop: `1px solid ${theme.lineSoft}`,
          display: 'flex',
          gap: 24,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.inkMuted,
          letterSpacing: 2,
        }}
      >
        <span>◀▶▲▼ MOVE</span>
        <span>↵ LOCK IN</span>
        <span>CLICK INSTANT LOCK</span>
        <span>ESC LEAVE</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck — expect zero errors**

```bash
npm run typecheck
```

Expected: exits 0. Common errors to watch for:
- `Stats` not imported — it's in `import type { GuildId, Stats }` already in the file above
- `Chip` not exported from `../../ui` — check `src/ui/index.ts` for the export name
- `opponentSlot.name` not a property on the slot type — if so, replace with `opponentSlot.displayName` or whatever the actual field is (check `getMatchSlots` return type)

- [ ] **Step 3: Run the test suite**

```bash
npm test
```

Expected: all tests PASS (golden sim test is unaffected by UI changes).

- [ ] **Step 4: Visual verification**

Start the dev client:

```bash
npm run dev:client
```

Open `http://localhost:5173` in a browser. Navigate:

1. **SP Story mode** → CharSelect: confirm side panels, stat strip, tile sizes, VIEW DETAILS still work exactly as before.
2. **SP VS CPU mode** → CharSelect: same as above, plus CPU panel.
3. **MP mode** (host in one tab, join in another via room code):
   - Confirm tile grid is 190 px, names are 20 px
   - Left panel shows full SidePanel with vitals, bio, VIEW DETAILS, ULT
   - LOCK IN → button in header (not in panel)
   - After locking: button shows "LOCKED ✓", left panel shows locked guild
   - When opponent locks: right panel switches from placeholder to full SidePanel
   - VIEW DETAILS opens GuildDetails modal; arrow keys are suppressed while modal is open

- [ ] **Step 5: Commit**

```bash
git add src/screens/mp/MpCharSelect.tsx
git commit -m "feat(char-select): MP full parity — shared panels, 190px tiles, vitals, GuildDetails"
```
