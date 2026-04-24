# MP Polish — 4 Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix click-to-lock in MP char-select, header alignment, Phaser loading bar bleed-through, and bring stage select to full SP parity with live host-cursor sync for the joiner.

**Architecture:** Issues 1 & 2 are one-liner edits to `MpCharSelect.tsx`. Issue 4 removes the Phaser native bar and wires real progress to the React overlay via a game event. Issue 3 extracts `StageTile` + `StageDetailPanel` to a new `StagePanels.tsx`, updates `StageSelect.tsx` to use them, adds `hoveredStageIdx` to `MatchState`, adds a `hover_stage` message handler, and rewrites `MpStageSelect.tsx` to use the shared components with server-synced cursor.

**Tech Stack:** React 18, TypeScript, Phaser 3, Colyseus 0.17, @colyseus/schema, Vitest

---

## Task 1: MpCharSelect quick fixes (issues 1 & 2)

**Files:**
- Modify: `src/screens/mp/MpCharSelect.tsx`

- [ ] **Step 1: Fix click auto-lock — remove `room.send` from tile onClick**

Find this block (around line 186):
```tsx
onClick={() => {
  if (isLocked) return;
  setCursorIdx(i);
  room.send('lock_guild', { guildId: g.id });
}}
```
Replace with:
```tsx
onClick={() => {
  if (isLocked) return;
  setCursorIdx(i);
}}
```

- [ ] **Step 2: Fix header alignment — change `alignItems` on right header group**

Find this line (around line 130):
```tsx
<div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'center' }}>
```
Replace with:
```tsx
<div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/screens/mp/MpCharSelect.tsx
git commit -m "fix(mp): click previews guild without locking; fix LOCK IN button alignment"
```

---

## Task 2: Loading bar fix (issue 4)

**Files:**
- Modify: `src/game/scenes/BootScene.ts`
- Modify: `src/screens/GameScreen.tsx`

- [ ] **Step 1: Remove native Phaser loading bar from BootScene**

In `src/game/scenes/BootScene.ts`, inside `preload()`, delete everything from the line `const barBgWidth = ...` through the closing `this.load.on('complete', ...)` block. Replace those deleted lines with a single progress relay:

```ts
// Before (delete all of this):
const barBgWidth = Math.floor(VIRTUAL_WIDTH * 0.5);
const barBgHeight = 16;
const cx = VIRTUAL_WIDTH / 2;
const cy = VIRTUAL_HEIGHT / 2;

const barBg = this.add
  .rectangle(cx, cy, barBgWidth, barBgHeight, 0x222222)
  .setStrokeStyle(1, 0x555555);
const bar = this.add
  .rectangle(cx - barBgWidth / 2, cy, 0, barBgHeight - 4, 0xffffff)
  .setOrigin(0, 0.5);
const label = this.add
  .text(cx, cy - 24, 'Loading…', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#ffffff',
  })
  .setOrigin(0.5);

this.load.on('progress', (value: number) => {
  bar.width = (barBgWidth - 4) * value;
});
this.load.on('complete', () => {
  barBg.destroy();
  bar.destroy();
  label.destroy();
});

// After (add just this):
this.load.on('progress', (value: number) => {
  this.game.events.emit('preload-progress', value);
});
```

- [ ] **Step 2: Add `loadProgress` state to GameScreen**

In `src/screens/GameScreen.tsx`, add one state declaration alongside the existing ones (around line 38):

```ts
const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);
```

- [ ] **Step 3: Wire progress listener into the game-creation useEffect**

In the same file, inside the game-creation `useEffect` (around line 85, after the `preload-done` listener is registered):

```ts
// Add after: game.events.on('preload-done', onPreloadDone);
game.events.on('preload-progress', setLoadProgress);
```

And in the cleanup return function (before or after `game.events.off('preload-done', onPreloadDone)`):

```ts
game.events.off('preload-progress', setLoadProgress);
```

- [ ] **Step 4: Pass `progress` to LoadingScreen**

In the same file, find the LoadingScreen render (around line 189):

```tsx
// Before:
<LoadingScreen
  p1={p1}
  p2={p2 ?? 'knight'}
  stageId={stageId as StageId}
  showOpponent={mode === 'vs'}
/>

// After:
<LoadingScreen
  p1={p1}
  p2={p2 ?? 'knight'}
  stageId={stageId as StageId}
  showOpponent={mode === 'vs'}
  progress={loadProgress}
/>
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 6: Run tests**

```bash
npm test
```
Expected: 104/104 pass.

- [ ] **Step 7: Commit**

```bash
git add src/game/scenes/BootScene.ts src/screens/GameScreen.tsx
git commit -m "fix(loading): remove Phaser native bar; wire real preload-progress to React overlay"
```

---

## Task 3: Create `src/screens/StagePanels.tsx`

**Files:**
- Create: `src/screens/StagePanels.tsx`

- [ ] **Step 1: Create the file**

Write `src/screens/StagePanels.tsx` with the complete content below:

```tsx
import { theme } from '../ui';
import type { StageMeta } from '../data/stages';

export interface StageTileProps {
  stage: StageMeta;
  index: number;
  active: boolean;
  isHost: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}

export function StageTile({ stage, index, active, isHost, onMouseEnter, onClick }: StageTileProps) {
  const acc = `oklch(0.70 0.16 ${stage.hue})`;
  const locked = !stage.enabled;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onClick={isHost ? onClick : undefined}
      style={{
        position: 'relative',
        border: `1px solid ${active ? acc : theme.lineSoft}`,
        background: theme.panel,
        outline: active ? `1px solid ${acc}` : 'none',
        outlineOffset: 2,
        cursor: !isHost ? 'default' : locked ? 'not-allowed' : 'pointer',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        transition: 'border-color 120ms ease',
      }}
    >
      {stage.preview ? (
        <img
          src={stage.preview}
          alt={stage.name}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            filter: active ? 'none' : 'saturate(0.85) brightness(0.88)',
            transition: 'filter 120ms ease',
          }}
        />
      ) : (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(145deg, ${acc}22, ${theme.panel} 70%)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(135deg, transparent 0 14px, ${acc}18 14px 15px)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: `1px solid ${acc}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: theme.fontMono,
                fontSize: 20,
                color: acc,
              }}
            >
              ◇
            </div>
            <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.warn, letterSpacing: 3 }}>
              COMING SOON
            </div>
          </div>
        </>
      )}

      {/* Scrim */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '55%',
          background: 'linear-gradient(to top, rgba(5,7,10,0.92) 0%, rgba(5,7,10,0.55) 55%, rgba(5,7,10,0) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Number badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: theme.ink,
          letterSpacing: 2,
          background: 'rgba(5,7,10,0.6)',
          padding: '2px 6px',
          border: `1px solid ${active ? acc : 'transparent'}`,
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </div>

      {/* HUE badge */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          fontFamily: theme.fontMono,
          fontSize: 10,
          color: acc,
          letterSpacing: 2,
          background: 'rgba(5,7,10,0.6)',
          padding: '2px 6px',
        }}
      >
        HUE {stage.hue}°
      </div>

      {/* Bottom label */}
      <div style={{ position: 'relative', padding: 16 }}>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 26,
            color: theme.ink,
            letterSpacing: '-0.01em',
            lineHeight: 1.05,
            textShadow: '0 1px 2px rgba(0,0,0,0.6)',
          }}
        >
          {stage.name}
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: locked ? theme.warn : active ? acc : theme.inkDim,
            letterSpacing: 2,
          }}
        >
          {locked ? 'LOCKED · SOON' : active ? '◆ SELECTED' : 'READY'}
        </div>
      </div>
    </div>
  );
}

export interface StageDetailPanelProps {
  stages: StageMeta[];
  cursor: number;
  isHost: boolean;
  onHover: (idx: number) => void;
  onCommit: (idx: number) => void;
}

export function StageDetailPanel({ stages, cursor, isHost, onHover, onCommit }: StageDetailPanelProps) {
  const cur = stages[cursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;

  return (
    <div
      style={{
        borderLeft: `1px solid ${theme.lineSoft}`,
        padding: '28px 30px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        overflow: 'auto',
      }}
    >
      <div>
        <div style={{ fontFamily: theme.fontMono, fontSize: 10, color: accent, letterSpacing: 3 }}>
          {cur.enabled ? 'AVAILABLE' : 'COMING SOON'}
        </div>
        <div
          style={{
            fontFamily: theme.fontDisplay,
            fontSize: 30,
            color: theme.ink,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            marginTop: 6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {cur.name}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          border: `1px solid ${theme.lineSoft}`,
          background: `linear-gradient(145deg, ${accent}22, ${theme.panel} 70%)`,
          overflow: 'hidden',
        }}
      >
        {cur.preview ? (
          <img
            src={cur.preview}
            alt={cur.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(135deg, transparent 0 18px, ${accent}12 18px 19px)`,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 14,
            fontFamily: theme.fontMono,
            fontSize: 10,
            color: theme.inkMuted,
            letterSpacing: 2,
            background: cur.preview ? 'rgba(0,0,0,0.55)' : 'transparent',
            padding: cur.preview ? '2px 6px' : 0,
          }}
        >
          {cur.preview ? cur.name.toUpperCase() : '[ stage preview ]'}
        </div>
      </div>

      <div
        style={{
          fontFamily: theme.fontBody,
          fontSize: 13,
          color: theme.inkDim,
          lineHeight: 1.55,
          fontStyle: 'italic',
          minHeight: `calc(13px * 1.55 * 3)`,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {cur.blurb}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderTop: `1px solid ${theme.lineSoft}`,
        }}
      >
        {stages.map((s, i) => {
          const act = i === cursor;
          const acc = `oklch(0.70 0.16 ${s.hue})`;
          return (
            <div
              key={s.id}
              onMouseEnter={() => onHover(i)}
              onClick={() => {
                if (!isHost) return;
                if (s.enabled) onCommit(i);
                else onHover(i);
              }}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'grid',
                gridTemplateColumns: '32px 12px 1fr auto',
                gap: 14,
                alignItems: 'center',
                padding: '0 6px',
                borderBottom: `1px solid ${theme.lineSoft}`,
                borderLeft: `2px solid ${act ? acc : 'transparent'}`,
                background: act ? `${acc}10` : 'transparent',
                cursor: !isHost ? 'default' : s.enabled ? 'pointer' : 'default',
                transition: 'background 120ms ease, border-color 120ms ease',
              }}
            >
              <span style={{ fontFamily: theme.fontMono, fontSize: 12, color: act ? accent : theme.inkMuted, letterSpacing: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ width: 10, height: 10, background: acc, opacity: act ? 1 : s.enabled ? 0.6 : 0.25 }} />
              <span style={{ fontFamily: theme.fontDisplay, fontSize: 18, letterSpacing: '-0.01em', color: act ? accent : s.enabled ? theme.ink : theme.inkMuted }}>
                {s.name}
              </span>
              <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: s.enabled ? (act ? accent : theme.inkMuted) : theme.warn, letterSpacing: 2 }}>
                {s.enabled ? (act ? '◆ SELECTED' : 'READY') : 'SOON'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: exits 0.

---

## Task 4: Update `StageSelect.tsx` to use shared components

**Files:**
- Modify: `src/screens/StageSelect.tsx`

- [ ] **Step 1: Add import and update the stage grid**

Add import at top of `src/screens/StageSelect.tsx`:

```tsx
import { StageTile, StageDetailPanel } from './StagePanels';
```

Replace the entire `{STAGES.map((s, i) => { ... })}` block inside the left grid column (the one that renders tiles with image/fallback/scrim/badges) with:

```tsx
{STAGES.map((s, i) => (
  <StageTile
    key={s.id}
    stage={s}
    index={i}
    active={i === cursor}
    isHost={true}
    onMouseEnter={() => setCursor(i)}
    onClick={() => { if (s.enabled) onReady(s.id); }}
  />
))}
```

- [ ] **Step 2: Replace the right-hand sidebar**

Replace the entire right-hand sidebar `<div>` (the one with `borderLeft`, the preview image, blurb, and stage list) with:

```tsx
<StageDetailPanel
  stages={STAGES}
  cursor={cursor}
  isHost={true}
  onHover={(i) => setCursor(i)}
  onCommit={(i) => { if (STAGES[i].enabled) onReady(STAGES[i].id); }}
/>
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: 104/104 pass.

- [ ] **Step 5: Commit both new and modified files**

```bash
git add src/screens/StagePanels.tsx src/screens/StageSelect.tsx
git commit -m "refactor(stage-select): extract StageTile + StageDetailPanel to StagePanels"
```

---

## Task 5: Add `hoveredStageIdx` to server schema + `hover_stage` handler

**Files:**
- Modify: `packages/shared/src/schema/MatchState.ts`
- Modify: `packages/server/src/rooms/MatchRoom.ts`

- [ ] **Step 1: Add `hoveredStageIdx` field to `MatchState`**

In `packages/shared/src/schema/MatchState.ts`, add one field after `stageId`:

```ts
// Before:
@type('string') stageId = '';

// After:
@type('string') stageId = '';
@type('number') hoveredStageIdx: number = 0;
```

- [ ] **Step 2: Add `hover_stage` message handler to `MatchRoom`**

In `packages/server/src/rooms/MatchRoom.ts`, add after the `pick_stage` handler (around line 89):

```ts
this.onMessage('hover_stage', (client: Client, msg: { idx: number }) => {
  if (client.sessionId !== this.state.hostSessionId) return;
  if (this.state.phase !== 'stage_select') return;
  this.state.hoveredStageIdx = Math.max(0, Math.min(8, msg.idx));
});
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Expected: exits 0.

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: all pass. The schema structural tests will automatically pick up the new field.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema/MatchState.ts packages/server/src/rooms/MatchRoom.ts
git commit -m "feat(server): add hoveredStageIdx to MatchState + hover_stage message handler"
```

---

## Task 6: Rewrite `MpStageSelect.tsx`

**Files:**
- Modify: `src/screens/mp/MpStageSelect.tsx`

- [ ] **Step 1: Replace the entire file**

Write `src/screens/mp/MpStageSelect.tsx` with the complete content below:

```tsx
import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@colyseus/sdk';
import type { MatchState, MatchPhase } from '@nannymud/shared';
import { theme, Btn } from '../../ui';
import { STAGES } from '../../data/stages';
import { useMatchState } from './useMatchState';
import { usePhaseBounce } from './usePhaseBounce';
import { RoomCodeBadge } from './RoomCodeBadge';
import { MpLoading } from './MpLoading';
import { StageTile, StageDetailPanel } from '../StagePanels';

interface Props {
  room: Room<MatchState>;
  onLeave: () => void;
  onPhaseChange: (phase: MatchPhase) => void;
}

const COLS = 3;
const ROWS = 3;

export function MpStageSelect({ room, onLeave, onPhaseChange }: Props) {
  const state = useMatchState(room);
  const isHost = room.sessionId === (state?.hostSessionId ?? '');

  const [cursor, setCursor] = useState<number>(0);

  usePhaseBounce(state?.phase ?? 'stage_select', 'stage_select', onPhaseChange);

  // Relay host cursor to server so joiner sees it live.
  useEffect(() => {
    if (!isHost) return;
    room.send('hover_stage', { idx: cursor });
  }, [cursor, isHost, room]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (!isHost) return;
      setCursor((c) => {
        const r = Math.floor(c / COLS);
        const col = c % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return nr * COLS + nc;
      });
    },
    [isHost],
  );

  const commit = useCallback(
    (idx: number) => {
      if (!isHost) return;
      const stage = STAGES[idx];
      if (!stage.enabled) return;
      room.send('pick_stage', { stageId: stage.id });
    },
    [isHost, room],
  );

  useEffect(() => {
    if (!isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Enter') { e.preventDefault(); commit(cursor); }
      else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commit, cursor, isHost, move, onLeave]);

  // Non-host ESC to leave.
  useEffect(() => {
    if (isHost) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); onLeave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, onLeave]);

  if (!state) return <MpLoading />;

  // Host uses local cursor; joiner mirrors server-broadcast host cursor.
  const displayCursor = isHost ? cursor : (state.hoveredStageIdx ?? 0);
  const cur = STAGES[displayCursor];
  const accent = `oklch(0.70 0.16 ${cur.hue})`;

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
          <span style={{ fontFamily: theme.fontMono, fontSize: 10, color: theme.inkMuted, letterSpacing: 3 }}>
            {isHost
              ? `STAGE · ${String(displayCursor + 1).padStart(2, '0')} / ${String(STAGES.length).padStart(2, '0')}`
              : 'STAGE · MULTIPLAYER'}
          </span>
          <span style={{ fontFamily: theme.fontDisplay, fontSize: 26, color: theme.ink, textAlign: 'center' }}>
            {isHost ? 'Pick the battlefield' : 'Host is picking a stage…'}
          </span>
        </div>
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <RoomCodeBadge code={state.code} />
          {isHost && (
            <Btn size="md" primary disabled={!cur.enabled} onClick={() => commit(displayCursor)}>
              FIGHT →
            </Btn>
          )}
        </div>
      </div>

      {/* Body — same 1fr 420px layout for host and joiner */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 420px', overflow: 'hidden' }}>
        <div
          style={{
            padding: 36,
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gap: 14,
          }}
        >
          {STAGES.map((s, i) => (
            <StageTile
              key={s.id}
              stage={s}
              index={i}
              active={i === displayCursor}
              isHost={isHost}
              onMouseEnter={() => { if (isHost) setCursor(i); }}
              onClick={() => commit(i)}
            />
          ))}
        </div>
        <StageDetailPanel
          stages={STAGES}
          cursor={displayCursor}
          isHost={isHost}
          onHover={(i) => { if (isHost) setCursor(i); }}
          onCommit={commit}
        />
      </div>

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
        {isHost ? (
          <>
            <span>◀▶▲▼ MOVE</span>
            <span>↵ FIGHT</span>
            <span>CLICK INSTANT PICK</span>
          </>
        ) : (
          <span>Watching host pick…</span>
        )}
        <span>ESC LEAVE</span>
        <span style={{ marginLeft: 'auto', color: accent }}>
          {STAGES.filter((s) => s.enabled).length} / {STAGES.length} UNLOCKED
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exits 0. If `state.hoveredStageIdx` is flagged as not existing on the type, confirm Task 5 was completed first (it adds the field to `MatchState`).

- [ ] **Step 3: Run tests**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/mp/MpStageSelect.tsx
git commit -m "feat(stage-select): MP parity with image tiles, detail panel, live host cursor for joiner"
```
