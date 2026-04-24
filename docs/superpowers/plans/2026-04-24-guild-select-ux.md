# Guild Select UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix guild selection in VS (1v1 vs CPU) and multiplayer by separating "pick" (changeable) from "final commit" (READY/LOCK IN), and removing the auto-switch-on-click behaviour.

**Architecture:** Surgical edits to two files. `CharSelect.tsx` replaces the `locked`+`picks`+`cursors` triple with `picks: Record<'p1'|'cpu', GuildId|null>` (null = not yet clicked), removes the auto-switch-on-click, and updates the SWITCH button label. `MpCharSelect.tsx` adds `localPick: GuildId|null` local state so clicking is purely local until LOCK IN is pressed.

**Tech Stack:** React 18, TypeScript, Vitest (typecheck gate only — no component test infra). Spec: `docs/superpowers/specs/2026-04-24-guild-select-ux-design.md`.

---

## File map

| File | Change |
|------|--------|
| `src/screens/CharSelect.tsx` | Full state model refactor + interaction + render fixes |
| `src/screens/mp/MpCharSelect.tsx` | Add `localPick` state; fix click and LOCK IN |
| `src/screens/CharSelectPanels.tsx` | No structural changes; caller passes correct props |

---

### Task 1: CharSelect — replace state model and fix interactions

**Files:**
- Modify: `src/screens/CharSelect.tsx`

- [ ] **Step 1: Replace the state declarations**

Open `src/screens/CharSelect.tsx`. Replace lines 17–86 (the `Slot` type through the `unlockActive` callback) with the following:

```tsx
type Slot = 'p1' | 'cpu';

// ...keep COLS, ROWS, TILE_SIZE, TILE_GAP, pickRandom unchanged...

export function CharSelect({ mode, initialP1, initialP2, onBack, onReady }: Props) {
  const ids = useMemo(() => GUILDS.map((g) => g.id), []);
  const hasOpponent = mode === 'vs';

  const [cursors, setCursors] = useState<Record<Slot, number>>(() => {
    const p1Idx = Math.max(0, ids.indexOf(initialP1));
    const cpuIdx = Math.max(
      0,
      ids.indexOf(initialP2 !== initialP1 ? initialP2 : ids[(p1Idx + 2) % ids.length]),
    );
    return { p1: p1Idx, cpu: cpuIdx };
  });

  // null = not yet explicitly clicked. For non-VS, cpu is pre-seeded (never shown,
  // just passed to onReady so the caller always gets two valid IDs).
  const [picks, setPicks] = useState<Record<Slot, GuildId | null>>(() => ({
    p1: null,
    cpu: hasOpponent ? null : pickRandom(ids, initialP1),
  }));

  const [activeSlot, setActiveSlot] = useState<Slot>('p1');
  const [detailsFor, setDetailsFor] = useState<GuildId | null>(null);

  // READY enables when both slots have an explicit click-pick.
  // Non-VS: only p1 needs a pick; cpu was pre-seeded above.
  const readyToGo = hasOpponent
    ? picks.p1 !== null && picks.cpu !== null
    : picks.p1 !== null;

  const move = useCallback(
    (dx: number, dy: number) => {
      setCursors((c) => {
        const cur = c[activeSlot];
        const r = Math.floor(cur / COLS);
        const col = cur % COLS;
        const nr = Math.max(0, Math.min(ROWS - 1, r + dy));
        const nc = Math.max(0, Math.min(COLS - 1, col + dx));
        return { ...c, [activeSlot]: nr * COLS + nc };
      });
    },
    [activeSlot],
  );
```

- [ ] **Step 2: Replace the keyboard useEffect**

The old useEffect refs `locked`, `lockActive`, `unlockActive`. Replace the entire `useEffect` block (currently lines 95–121) with:

```tsx
  useEffect(() => {
    if (detailsFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, 0); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, 0); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(0, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(0, 1); }
      else if (e.key === 'Tab') {
        e.preventDefault();
        if (hasOpponent) setActiveSlot((s) => (s === 'p1' ? 'cpu' : 'p1'));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (readyToGo) {
          onReady(picks.p1!, picks.cpu!);
        } else {
          setPicks((p) => ({ ...p, [activeSlot]: ids[cursors[activeSlot]] }));
        }
      } else if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSlot, cursors, detailsFor, hasOpponent, ids, move, onBack, onReady, picks, readyToGo]);
```

- [ ] **Step 3: Update the hoveredId derivation**

Find this line (currently after the useEffect):

```tsx
const hoveredId = ids[cursors[active]];
```

Replace with:

```tsx
const hoveredId = ids[cursors[activeSlot]];
```

- [ ] **Step 4: Verify typecheck passes so far**

```bash
npm run typecheck
```

Expected: errors only in the render JSX (still references `locked`, `active`, etc.) — that's fine, we fix render next. If you see errors in the logic above (state / move / keyboard), fix those before continuing.

- [ ] **Step 5: Commit checkpoint**

```bash
git add src/screens/CharSelect.tsx
git commit -m "refactor(char-select): replace locked/active state with picks/activeSlot"
```

---

### Task 2: CharSelect — fix render (header, grid, panels, footer)

**Files:**
- Modify: `src/screens/CharSelect.tsx`

- [ ] **Step 1: Fix the header — SWITCH button and READY button**

Find the header section. Replace the right-side button cluster:

```tsx
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
          {hasOpponent && (
            <Btn size="md" onClick={() => setActive((p) => (p === 'p1' ? 'opp' : 'p1'))}>
              SWITCH · {active === 'p1' ? 'P1' : 'CPU'}
            </Btn>
          )}
          <Btn
            size="md"
            primary
            disabled={!readyToCommit}
            onClick={() => onReady(picks.p1, picks.opp)}
          >
            READY →
          </Btn>
        </div>
```

With:

```tsx
        <div style={{ justifySelf: 'end', display: 'flex', gap: 8 }}>
          {hasOpponent && (
            <Btn size="md" onClick={() => setActiveSlot((s) => (s === 'p1' ? 'cpu' : 'p1'))}>
              {activeSlot === 'p1' ? 'SWITCH CPU' : 'SWITCH P1'}
            </Btn>
          )}
          <Btn
            size="md"
            primary
            disabled={!readyToGo}
            onClick={() => onReady(picks.p1!, picks.cpu!)}
          >
            READY →
          </Btn>
        </div>
```

- [ ] **Step 2: Fix the left SidePanel (P1)**

Find:

```tsx
        <SidePanel
          role="P1"
          guildId={locked.p1 ? picks.p1 : ids[cursors.p1]}
          locked={hasOpponent ? locked.p1 : false}
          active={active === 'p1'}
          statusText={!hasOpponent ? 'HOVER' : undefined}
          onView={() => setDetailsFor(locked.p1 ? picks.p1 : ids[cursors.p1])}
        />
```

Replace with:

```tsx
        <SidePanel
          role="P1"
          guildId={picks.p1 ?? ids[cursors.p1]}
          locked={picks.p1 !== null}
          active={activeSlot === 'p1'}
          statusText={
            picks.p1 !== null ? 'PICKED' :
            activeSlot !== 'p1' ? 'NOT PICKED' :
            undefined
          }
          onView={() => setDetailsFor(picks.p1 ?? ids[cursors.p1])}
        />
```

- [ ] **Step 3: Fix the tile grid — onMouseEnter, onClick, badges**

Inside the `GUILDS.map((g, i) => { ... })` block, replace the entire `<div key={g.id} ...>` element with:

```tsx
              const p1Here = cursors.p1 === i;
              const oppHere = hasOpponent && cursors.cpu === i;
              const isActiveTile = activeSlot === 'p1' ? p1Here : oppHere;
              const p1Selected = !hasOpponent && picks.p1 === g.id;
              return (
                <div
                  key={g.id}
                  onMouseEnter={() => {
                    setCursors((c) => ({ ...c, [activeSlot]: i }));
                  }}
                  onClick={() => {
                    setCursors((c) => ({ ...c, [activeSlot]: i }));
                    setPicks((p) => ({ ...p, [activeSlot]: g.id }));
                  }}
                  style={{
                    position: 'relative',
                    width: tileSize,
                    cursor: 'pointer',
                    outline: p1Selected ? `2px solid ${theme.accent}` : 'none',
                    outlineOffset: 4,
                  }}
                >
                  <GuildMonogram guildId={g.id} size={tileSize} selected={p1Here || oppHere} />
                  <div
                    style={{
                      textAlign: 'center',
                      marginTop: 8,
                      fontFamily: theme.fontMono,
                      fontSize: 20,
                      color: isActiveTile ? acc : theme.inkDim,
                      letterSpacing: 2,
                    }}
                  >
                    {g.name.toUpperCase()}
                  </div>
                  {p1Here && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        left: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: acc,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ P1{picks.p1 === g.id ? ' ✓' : ''}
                    </div>
                  )}
                  {oppHere && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontFamily: theme.fontMono,
                        fontSize: 20,
                        color: acc,
                        letterSpacing: 2,
                        textShadow: `0 0 4px ${theme.bgDeep}`,
                        zIndex: 2,
                      }}
                    >
                      ◆ CPU{picks.cpu === g.id ? ' ✓' : ''}
                    </div>
                  )}
                </div>
              );
```

- [ ] **Step 4: Fix the right panel (VS: CPU; non-VS: echo)**

Find the right-panel block (currently lines ~323–341):

```tsx
        {hasOpponent ? (
          <SidePanel
            role="CPU"
            guildId={locked.opp ? picks.opp : ids[cursors.opp]}
            locked={locked.opp}
            active={active === 'opp'}
            onView={() => setDetailsFor(locked.opp ? picks.opp : ids[cursors.opp])}
          />
        ) : (
          <SidePanel
            role="P1"
            guildId={picks.p1}
            locked={true}
            active={false}
            statusText="SELECTED"
            onView={() => setDetailsFor(picks.p1)}
          />
        )}
```

Replace with:

```tsx
        {hasOpponent ? (
          picks.cpu !== null || activeSlot === 'cpu' ? (
            <SidePanel
              role="CPU"
              guildId={picks.cpu ?? ids[cursors.cpu]}
              locked={picks.cpu !== null}
              active={activeSlot === 'cpu'}
              statusText={picks.cpu !== null ? 'PICKED' : undefined}
              onView={() => setDetailsFor(picks.cpu ?? ids[cursors.cpu])}
            />
          ) : (
            <div
              style={{
                padding: 24,
                borderLeft: `1px solid ${theme.lineSoft}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontFamily: theme.fontMono, fontSize: 12, letterSpacing: 3, color: theme.inkMuted }}>
                CPU · OPPONENT
              </div>
              <div style={{ fontFamily: theme.fontBody, fontSize: 15, color: theme.inkMuted, fontStyle: 'italic' }}>
                Click "SWITCH CPU" to pick opponent
              </div>
            </div>
          )
        ) : (
          picks.p1 !== null ? (
            <SidePanel
              role="P1"
              guildId={picks.p1}
              locked={true}
              active={false}
              statusText="SELECTED"
              onView={() => setDetailsFor(picks.p1!)}
            />
          ) : (
            <div
              style={{
                padding: 24,
                borderLeft: `1px solid ${theme.lineSoft}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontFamily: theme.fontBody, fontSize: 15, color: theme.inkMuted, fontStyle: 'italic' }}>
                Click a guild to select
              </div>
            </div>
          )
        )}
```

- [ ] **Step 5: Fix the footer hint bar**

Find:

```tsx
        <span>{hasOpponent ? '↵ LOCK / READY' : '↵ SELECT'}</span>
        {hasOpponent && <span>TAB SWITCH</span>}
        <span>ESC BACK</span>
```

Replace with:

```tsx
        <span>{hasOpponent ? '↵ PICK / READY' : '↵ PICK'}</span>
        {hasOpponent && <span>TAB SWITCH</span>}
        <span>ESC BACK</span>
```

- [ ] **Step 6: Run typecheck — must be clean**

```bash
npm run typecheck
```

Expected: zero errors. If you see errors referencing `locked`, `active`, `picks.opp`, `readyToCommit`, `lockActive`, or `unlockActive` — those are leftovers from before; search and remove them.

- [ ] **Step 7: Manual smoke test — VS mode**

Start the dev server: `npm run dev:client`

1. Navigate to VS mode char select.
2. Hover over tiles — center stat strip updates. Side panels do NOT change pick.
3. Click any tile — P1 side panel shows that guild with "PICKED". Badge shows `◆ P1 ✓`.
4. Click a different tile — P1 panel updates to new guild. Previous ✓ disappears.
5. READY button is still disabled (CPU not picked yet).
6. Click "SWITCH CPU" — button label changes to "SWITCH P1". Active focus moves to CPU side.
7. Click any tile — CPU panel appears with "PICKED". Badge shows `◆ CPU ✓`.
8. READY button enables. Click it — game proceeds.
9. Reload. Press Tab — switches between P1 and CPU mode, same as SWITCH button.
10. Press Escape — returns to previous screen (no lock/unlock, just back).

- [ ] **Step 8: Manual smoke test — story/wave mode**

1. Navigate to story mode char select.
2. Hover over tiles — stat strip updates. Right panel shows "Click a guild to select".
3. Click a tile — left panel shows "PICKED", right panel echoes the same guild with "SELECTED".
4. Click a different tile — both panels update.
5. READY button enables. Click — proceeds.

- [ ] **Step 9: Commit**

```bash
git add src/screens/CharSelect.tsx
git commit -m "fix(char-select): click-to-pick with explicit READY, remove auto-switch"
```

---

### Task 3: MpCharSelect — add localPick and fix LOCK IN

**Files:**
- Modify: `src/screens/mp/MpCharSelect.tsx`

- [ ] **Step 1: Add `localPick` state**

After the `isLocked` derivation (line ~32), add:

```tsx
  const [localPick, setLocalPick] = useState<GuildId | null>(null);
```

- [ ] **Step 2: Update `localGuildId` derivation**

Find:

```tsx
  const localGuildId = isLocked ? (localSlot!.guildId as GuildId) : cursorGuildId;
```

Replace with:

```tsx
  const localGuildId = isLocked
    ? (localSlot!.guildId as GuildId)
    : (localPick ?? cursorGuildId);
```

- [ ] **Step 3: Fix tile `onClick`**

Find the tile `onClick` handler (currently just `setCursorIdx(i)`):

```tsx
                  onClick={() => {
                    if (isLocked) return;
                    setCursorIdx(i);
                  }}
```

Replace with:

```tsx
                  onClick={() => {
                    if (isLocked) return;
                    setCursorIdx(i);
                    setLocalPick(g.id);
                  }}
```

- [ ] **Step 4: Fix the LOCK IN button**

Find:

```tsx
          <Btn size="md" primary disabled={isLocked} onClick={lockIn}>
            {isLocked ? 'LOCKED ✓' : 'LOCK IN →'}
          </Btn>
```

Replace with:

```tsx
          <Btn
            size="md"
            primary
            disabled={isLocked || localPick === null}
            onClick={() => {
              if (localPick) room.send('lock_guild', { guildId: localPick });
            }}
          >
            {isLocked ? 'LOCKED ✓' : localPick !== null ? 'LOCK IN →' : 'SELECT FIRST'}
          </Btn>
```

- [ ] **Step 5: Remove the now-unused `lockIn` callback**

Delete the `lockIn` useCallback (it sent `lock_guild` from `cursorGuildId` — superseded by Step 4):

```tsx
  // DELETE this entire block:
  const lockIn = useCallback(() => {
    if (isLocked) return;
    room.send('lock_guild', { guildId: cursorGuildId });
  }, [isLocked, room, cursorGuildId]);
```

- [ ] **Step 6: Fix the keyboard handler — Enter uses `localPick`**

Find the `Enter` key branch in the `useEffect`:

```tsx
      else if (e.key === 'Enter') { e.preventDefault(); lockIn(); }
```

Replace with:

```tsx
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (!isLocked && localPick !== null) {
          room.send('lock_guild', { guildId: localPick });
        } else if (!isLocked) {
          setLocalPick(cursorGuildId);
        }
      }
```

Also update the `useEffect` dependency array — remove `lockIn`, add `isLocked`, `localPick`, `cursorGuildId`:

```tsx
  }, [detailsFor, isLocked, localPick, cursorGuildId, move, onLeave, room]);
```

- [ ] **Step 7: Update the left SidePanel props**

Find:

```tsx
        <SidePanel
          role="P1"
          roleLabel="P1 · YOU"
          guildId={localGuildId}
          locked={isLocked}
          active={true}
          onView={() => setDetailsFor(localGuildId)}
        />
```

Replace with:

```tsx
        <SidePanel
          role="P1"
          roleLabel="P1 · YOU"
          guildId={localGuildId}
          locked={isLocked || localPick !== null}
          active={true}
          statusText={isLocked ? 'LOCKED ✓' : localPick !== null ? 'PICKED' : undefined}
          onView={() => setDetailsFor(localGuildId)}
        />
```

- [ ] **Step 8: Update the footer hint**

Find:

```tsx
        <span>↵ LOCK IN</span>
        <span>CLICK PREVIEW</span>
```

Replace with:

```tsx
        <span>CLICK PICK · ↵ / BTN LOCK IN</span>
```

- [ ] **Step 9: Run typecheck — must be clean**

```bash
npm run typecheck
```

Expected: zero errors. Fix any lingering references to `lockIn` or old dependency arrays.

- [ ] **Step 10: Manual smoke test — multiplayer**

You need two browser tabs. Start full stack: `npm run dev`

1. Open two tabs, create a room in one and join from the other.
2. Navigate both to char select.
3. In tab 1: hover over tiles — LOCK IN button stays disabled ("SELECT FIRST"). Left panel shows cursor guild (not "PICKED").
4. In tab 1: click a tile — left panel shows "PICKED", button becomes "LOCK IN →". Tab 2 still shows "Opponent is selecting…" (pick is hidden).
5. In tab 1: click a different tile — left panel updates. Still local only.
6. In tab 1: press "LOCK IN →" (or Enter) — button changes to "LOCKED ✓", tiles disable. Tab 2 now shows tab 1's chosen guild in the opponent panel.
7. In tab 2: repeat click-to-pick and LOCK IN.
8. Both locked — game proceeds to stage select.

- [ ] **Step 11: Commit**

```bash
git add src/screens/mp/MpCharSelect.tsx
git commit -m "fix(mp-char-select): click-to-pick local, LOCK IN sends final guild"
```

---

### Task 4: Full regression check

**Files:** (none — verification only)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all pass. The golden determinism test should be unaffected (no sim code changed).

- [ ] **Step 2: Run typecheck one final time**

```bash
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 3: Smoke test non-VS modes**

Navigate to story mode char select. Verify:
- Clicking picks. Right panel echoes pick. READY gates on explicit click.

Navigate to VS mode:
- P1 → click → SWITCH CPU → click → READY. Confirm both badges show ✓.

Navigate to MP (two tabs):
- Click-to-pick (hidden from opponent). LOCK IN reveals pick and proceeds.

- [ ] **Step 4: Tag branch as ready**

```bash
git log --oneline -5
```

Confirm the three feature commits are present, then the branch is ready for review/merge.
