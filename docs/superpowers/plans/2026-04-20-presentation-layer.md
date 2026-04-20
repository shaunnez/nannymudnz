# Presentation Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Nannymud browser client fill the viewport with a 16:9 letterbox at 1600×900 backing resolution, with a fullscreen toggle (`F`), while preserving gameplay feel and moving render-only state out of the simulation layer.

**Architecture:** Introduce a `ScalingFrame` React wrapper that owns the letterbox layout and the fullscreen API. Bump the canvas backing buffer to 1600×900, apply a uniform `RENDER_SCALE` via `ctx.setTransform` once per frame so the renderer continues to draw in its existing ~900×506 virtual units. Migrate orphaned render-only constants from `simulation/constants.ts` into a new `rendering/constants.ts`. Remap `Esc` (hijacked by the browser in fullscreen) to `P` for pause.

**Tech Stack:** React 18, TypeScript 5.5, Vite 5, Canvas 2D, browser Fullscreen API. No test runner in this repo — verification per task is `npm run typecheck`, `npm run lint`, `npm run build`, and manual browser verification.

**Spec:** `docs/superpowers/specs/2026-04-20-presentation-layer-design.md`

---

## Pre-flight

- [ ] **Confirm working tree is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` — or an intentional starting branch state. Start from a fresh branch: `git checkout -b presentation-layer`.

- [ ] **Verify build baseline**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all three succeed with zero errors. If any fails before you've changed anything, stop and investigate — this plan assumes a green baseline.

---

## Task 1: Create `src/rendering/constants.ts` and retire orphaned simulation constants

Establishes the single home for render-only constants. Nothing else imports these names yet, so removal from `simulation/constants.ts` is safe.

**Files:**
- Create: `src/rendering/constants.ts`
- Modify: `src/simulation/constants.ts` (remove lines 32-37)

- [ ] **Step 1.1: Create `src/rendering/constants.ts`**

Write exactly:

```typescript
// Render-only constants. Never imported by anything under src/simulation/.
// The simulation works in world units; this file defines how those world units
// get projected to canvas pixels.

// The virtual coordinate space the renderer draws into. Matches the game's
// historical 900×500 canvas, slightly adjusted so (VIRTUAL_WIDTH : VIRTUAL_HEIGHT)
// equals (CANVAS_BUFFER_WIDTH : CANVAS_BUFFER_HEIGHT) for uniform scaling.
export const VIRTUAL_WIDTH = 900;
export const VIRTUAL_HEIGHT = 506;

// The canvas backing-buffer dimensions — what <canvas width/height> gets set to.
// 16:9 at 1600×900 lines up cleanly with ScalingFrame's 16:9 letterbox.
export const CANVAS_BUFFER_WIDTH = 1600;
export const CANVAS_BUFFER_HEIGHT = 900;

// Uniform scale applied once per frame via ctx.setTransform in GameScreen.
// CANVAS_BUFFER_WIDTH / VIRTUAL_WIDTH === CANVAS_BUFFER_HEIGHT / VIRTUAL_HEIGHT
// by construction (1600/900 === 900/506.25, rounded to 506).
export const RENDER_SCALE = CANVAS_BUFFER_WIDTH / VIRTUAL_WIDTH;

// Elevation (world-z → screen-y) falloff factor. Moved from simulation/constants.ts.
export const DEPTH_SCALE = 0.6;
```

- [ ] **Step 1.2: Remove the orphaned render-only constants from `src/simulation/constants.ts`**

Open `src/simulation/constants.ts` and delete lines 32-37:

```typescript
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 500;
export const WORLD_TO_SCREEN_X_SCALE = CANVAS_WIDTH / 900;
export const VIEW_HEIGHT = CANVAS_HEIGHT;
export const GROUND_SCREEN_Y = 420;
export const DEPTH_SCALE = 0.6;
```

Leave everything above and below untouched. These constants are currently orphaned (no importers) — a prior grep confirmed zero call sites under `src/`.

- [ ] **Step 1.3: Confirm no import breakage**

Run:
```bash
npm run typecheck
```
Expected: zero errors. If tsc complains about missing exports (`CANVAS_WIDTH`, etc.), it means the grep missed a caller. Find it with:
```
grep -rn "CANVAS_WIDTH\|CANVAS_HEIGHT\|VIEW_HEIGHT\|GROUND_SCREEN_Y\|WORLD_TO_SCREEN_X_SCALE" src/
```
Any hit other than `rendering/constants.ts` and `simulation/constants.ts` must be updated to import from `rendering/constants.ts`. Re-run typecheck.

- [ ] **Step 1.4: Run the full verification trio**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

- [ ] **Step 1.5: Commit**

```bash
git add src/rendering/constants.ts src/simulation/constants.ts
git commit -m "chore(rendering): move render-only constants out of simulation layer"
```

---

## Task 2: Fix hard-coded canvas height in projectile and pickup rendering

A prerequisite for the canvas resize. `gameRenderer.ts` lines 241 and 278 pass a literal `500` to `worldYToScreenY` — at any other canvas height, projectiles and pickups would render at the wrong Y. Fix first, in isolation, so the resize task doesn't get blamed for a behavior change.

**Files:**
- Modify: `src/rendering/gameRenderer.ts:238-304`

- [ ] **Step 2.1: Pipe canvas height into `renderProjectiles` and `renderPickups`**

In `src/rendering/gameRenderer.ts`, change the call sites (inside `render`, around line 42 and 54) and signatures:

Find (inside `render` method):

```typescript
    this.renderPickups(ctx, state);
```

Replace with:

```typescript
    this.renderPickups(ctx, state, height);
```

Find:

```typescript
    this.renderProjectiles(ctx, state);
```

Replace with:

```typescript
    this.renderProjectiles(ctx, state, height);
```

Find the method signatures:

```typescript
  private renderProjectiles(ctx: CanvasRenderingContext2D, state: SimState): void {
```

Replace with:

```typescript
  private renderProjectiles(ctx: CanvasRenderingContext2D, state: SimState, canvasHeight: number): void {
```

Find:

```typescript
  private renderPickups(ctx: CanvasRenderingContext2D, state: SimState): void {
```

Replace with:

```typescript
  private renderPickups(ctx: CanvasRenderingContext2D, state: SimState, canvasHeight: number): void {
```

- [ ] **Step 2.2: Replace the hard-coded `500`s**

In `renderProjectiles`, find:

```typescript
      const sy = this.worldYToScreenY(proj.y, 500) - proj.z * 0.5;
```

Replace with:

```typescript
      const sy = this.worldYToScreenY(proj.y, canvasHeight) - proj.z * 0.5;
```

In `renderPickups`, find:

```typescript
      const sy = this.worldYToScreenY(pickup.y, 500);
```

Replace with:

```typescript
      const sy = this.worldYToScreenY(pickup.y, canvasHeight);
```

- [ ] **Step 2.3: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
Start a game, let a projectile or archer volley fly past, walk near a rock/club pickup. Both should render at the same screen-Y they did before. (They will — at 500 canvas height the formula is unchanged; this is just plumbing.)

- [ ] **Step 2.4: Commit**

```bash
git add src/rendering/gameRenderer.ts
git commit -m "fix(rendering): pipe canvas height into projectile and pickup rendering"
```

---

## Task 3: Bump canvas backing buffer to 1600×900 and apply `RENDER_SCALE`

The heart of the visual upgrade. Canvas backing grows; renderer keeps drawing in 900×506 virtual units via a one-time `ctx.setTransform`.

**Files:**
- Modify: `src/screens/GameScreen.tsx` (canvas element + game loop)

- [ ] **Step 3.1: Import render constants**

In `src/screens/GameScreen.tsx`, add this import near the other imports at the top:

```typescript
import {
  CANVAS_BUFFER_WIDTH,
  CANVAS_BUFFER_HEIGHT,
  VIRTUAL_WIDTH,
  VIRTUAL_HEIGHT,
  RENDER_SCALE,
} from '../rendering/constants';
```

- [ ] **Step 3.2: Update canvas element dimensions and pixel-rendering CSS**

Find:

```tsx
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{
          width: '100%',
          maxWidth: 900,
          height: 'auto',
          display: 'block',
          imageRendering: 'crisp-edges',
        }}
        tabIndex={0}
      />
```

Replace with:

```tsx
      <canvas
        ref={canvasRef}
        width={CANVAS_BUFFER_WIDTH}
        height={CANVAS_BUFFER_HEIGHT}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          imageRendering: 'pixelated',
        }}
        tabIndex={0}
      />
```

Rationale: drop `maxWidth: 900` — the ScalingFrame (Task 5) will constrain size. Use `pixelated` over `crisp-edges` (modern browsers). `height: '100%'` lets the ScalingFrame's 16:9 box own both dimensions.

- [ ] **Step 3.3: Apply `RENDER_SCALE` transform in the game loop**

Find this block in the `gameLoop` function (around the `rendererRef.current.render(...)` call):

```typescript
      rendererRef.current.render(
        ctx,
        state,
        comboBufferRef.current,
        canvas.width,
        canvas.height,
        dtMs,
      );
```

Replace with:

```typescript
      ctx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);

      rendererRef.current.render(
        ctx,
        state,
        comboBufferRef.current,
        VIRTUAL_WIDTH,
        VIRTUAL_HEIGHT,
        dtMs,
      );

      ctx.setTransform(1, 0, 0, 1, 0, 0);
```

The `setTransform` calls bracket the render. Leading call installs the uniform scale; trailing call resets so any future non-scaled drawing (none today, but defensive) starts clean.

Pass `VIRTUAL_WIDTH`/`VIRTUAL_HEIGHT` (900/506), not `canvas.width`/`canvas.height` — the renderer is drawing into the *virtual* coordinate space, and the `setTransform` does the upscale.

- [ ] **Step 3.4: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
Open in browser. On a large monitor the canvas should now render at a larger CSS size (no more 900px max). Gameplay feel must be identical: walk to first enemy takes the same time, camera locks at the same player position, basic attacks hit at the same relative distances. Zoom into the canvas — text and rectangles should be sharper than before (no fuzzy upscale).

If gameplay feels wrong (e.g., the view shows way more of the world than before), you probably forgot the `VIRTUAL_WIDTH`/`VIRTUAL_HEIGHT` substitution — re-check Step 3.3.

- [ ] **Step 3.5: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "feat(rendering): bump canvas to 1600x900 with uniform RENDER_SCALE transform"
```

---

## Task 4: Create `ScalingFrame` wrapper component

A new React component that owns the 16:9 letterbox layout. Does not yet handle fullscreen — that's Task 6.

**Files:**
- Create: `src/layout/ScalingFrame.tsx`

- [ ] **Step 4.1: Create `src/layout/ScalingFrame.tsx`**

Write exactly:

```tsx
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// ScalingFrame fills the browser viewport with a black background and centers
// a 16:9 box inside it. Children render inside that box at whatever natural
// size they want; CSS aspect-ratio handles the letterbox math. The frame
// never overflows — on ultrawide monitors you get pillar bars, on narrow
// monitors you get letterbox bars.
export function ScalingFrame({ children }: Props) {
  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {children}
      </div>
    </div>
  );
}

const outerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  background: '#000',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  margin: 0,
};

const innerStyle: React.CSSProperties = {
  aspectRatio: '16 / 9',
  width: 'min(100vw, calc(100vh * 16 / 9))',
  height: 'min(100vh, calc(100vw * 9 / 16))',
  background: '#0f172a',
  position: 'relative',
  overflow: 'hidden',
};
```

- [ ] **Step 4.2: Verify compile**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green. Nothing consumes `ScalingFrame` yet, so no behavior change.

- [ ] **Step 4.3: Commit**

```bash
git add src/layout/ScalingFrame.tsx
git commit -m "feat(layout): add ScalingFrame wrapper component (16:9 letterbox)"
```

---

## Task 5: Wrap all screens in `ScalingFrame`; strip redundant sizing from screens

Puts the frame into effect. Menu and game screens now size themselves relative to the frame.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/screens/GameScreen.tsx` (outer div styles)
- Modify: `src/screens/TitleScreen.tsx`, `src/screens/GuildSelect.tsx`, `src/screens/GameOverScreen.tsx` (remove `minHeight: 100vh` / `maxWidth` if present)

- [ ] **Step 5.1: Wrap App in `ScalingFrame`**

In `src/App.tsx`, find:

```tsx
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: 0,
      margin: 0,
      fontFamily: 'sans-serif',
    }}>
      {screen === 'title' && (
```

Replace with:

```tsx
  return (
    <ScalingFrame>
      {screen === 'title' && (
```

Find the closing `</div>` at the end of the returned JSX (directly after `GameOverScreen` usage) and replace with:

```tsx
    </ScalingFrame>
```

Add the import at the top of `App.tsx`:

```typescript
import { ScalingFrame } from './layout/ScalingFrame';
```

- [ ] **Step 5.2: Simplify `GameScreen.tsx` outer div**

In `src/screens/GameScreen.tsx`, find the outer wrapper (right above the `<canvas>`):

```tsx
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#000000',
      minHeight: '100vh',
      justifyContent: 'center',
    }}>
```

Replace with:

```tsx
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      background: '#000',
    }}>
```

The `absolute`+`inset: 0` makes the game fill the ScalingFrame's 16:9 box exactly. `alignItems: stretch` + canvas `height: 100%` (from Task 3) means the canvas fills the box.

- [ ] **Step 5.3: Strip `minHeight: 100vh` and `maxWidth` from menu screens**

Open `src/screens/TitleScreen.tsx`, `src/screens/GuildSelect.tsx`, `src/screens/GameOverScreen.tsx` in turn. In each, search for and DELETE any of:
- `minHeight: '100vh'`
- `minHeight: 100vh`
- `height: '100vh'`
- `maxWidth: 900`
- `maxWidth: '900px'`

Replace the outermost container's sizing with `width: '100%'` and `height: '100%'` (and `overflow: 'auto'` if the screen has tall content like the guild list). Do NOT change layout direction, colors, or typography — this task is scope-limited to sizing.

- [ ] **Step 5.4: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check — this is the key moment, test all four screens:
```bash
npm run dev
```
- Title screen should fill a 16:9 letterboxed area.
- Resize the browser window narrower — pillar/letterbox bars should appear smoothly.
- Click through: Guild select → game → game over. None of the screens should overflow the letterbox or leave a white/blue gap at the bottom.
- Gameplay in the letterbox: canvas fills the 16:9 box, visuals crisp.

If the letterbox doesn't appear (screen extends past the black frame): you missed a `minHeight: 100vh` in one of the menu screens. Grep: `grep -rn "100vh" src/screens/`.

- [ ] **Step 5.5: Commit**

```bash
git add src/App.tsx src/screens/
git commit -m "feat(layout): wrap app in ScalingFrame; strip redundant viewport sizing"
```

---

## Task 6: Fullscreen API via context and `fullscreenchange` listener in `ScalingFrame`

Adds browser-fullscreen entry/exit, exposed to the rest of the app through a simple context. Keybinding wiring happens in Task 7.

**Files:**
- Modify: `src/layout/ScalingFrame.tsx`

- [ ] **Step 6.1: Extend `ScalingFrame.tsx` with a context and a global listener**

Replace the entire contents of `src/layout/ScalingFrame.tsx` with:

```tsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface FullscreenCtx {
  isFullscreen: boolean;
  toggle: () => void;
}

const FullscreenContext = createContext<FullscreenCtx>({
  isFullscreen: false,
  toggle: () => {},
});

export function useFullscreen(): FullscreenCtx {
  return useContext(FullscreenContext);
}

// CustomEvent emitted on the window when the user exits browser fullscreen,
// so GameScreen can auto-pause. Kept decoupled from React state to avoid
// prop-drilling through the screen router.
export const FULLSCREEN_EXIT_EVENT = 'nannymud:fullscreen-exit';

interface Props {
  children: ReactNode;
}

export function ScalingFrame({ children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // Browser refused (iframe without allow="fullscreen", user gesture
        // missing, etc.). Graceful no-op.
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const onChange = () => {
      const nowFullscreen = !!document.fullscreenElement;
      const wasFullscreen = isFullscreen;
      setIsFullscreen(nowFullscreen);
      if (wasFullscreen && !nowFullscreen) {
        window.dispatchEvent(new CustomEvent(FULLSCREEN_EXIT_EVENT));
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [isFullscreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement | null;
        // Don't hijack F while typing in an input.
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggle }}>
      <div ref={rootRef} style={outerStyle}>
        <div style={innerStyle}>
          {children}
        </div>
      </div>
    </FullscreenContext.Provider>
  );
}

const outerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  background: '#000',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflow: 'hidden',
  margin: 0,
};

const innerStyle: React.CSSProperties = {
  aspectRatio: '16 / 9',
  width: 'min(100vw, calc(100vh * 16 / 9))',
  height: 'min(100vh, calc(100vw * 9 / 16))',
  background: '#0f172a',
  position: 'relative',
  overflow: 'hidden',
};
```

Notes on decisions:
- `requestFullscreen` is called on the outer ScalingFrame root so the fullscreen takes over the full letterbox frame, not just the canvas.
- `FULLSCREEN_EXIT_EVENT` is a `CustomEvent` on `window` (not a React prop) because `GameScreen` already listens on `window` for input — this fits its existing pattern.
- The F-key handler intentionally uses lowercase+uppercase comparison and skips input/textarea focus, so rebinding menus (if ever added) don't break.

- [ ] **Step 6.2: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
- Press `F` on title screen → browser enters fullscreen, letterbox now fills monitor.
- Press `F` again → exits. No console errors.
- Enter fullscreen, press `Esc` (browser hard-wired) → exits fullscreen. No console errors.
- Focus in an input if any exists — F should NOT hijack typing (there currently are no text inputs, just defensive).

- [ ] **Step 6.3: Commit**

```bash
git add src/layout/ScalingFrame.tsx
git commit -m "feat(layout): add fullscreen toggle (F key) and exit event to ScalingFrame"
```

---

## Task 7: Keybinding migration — pause `Esc → P`, add `fullscreen: 'f'`

`Esc` is hijacked by browser fullscreen. Remap pause to `P`. Add a `fullscreen` binding so InputManager can also emit toggles (in addition to the global F listener — belt and suspenders; if the game canvas has focus and swallows keys, the global listener is the fallback).

**Files:**
- Modify: `src/input/keyBindings.ts`
- Modify: `src/input/inputManager.ts`
- Modify: `src/simulation/types.ts` (add field to `InputState`)

- [ ] **Step 7.1: Read current `keyBindings.ts` to understand the shape**

```bash
cat src/input/keyBindings.ts
```

Note the exact interface and default-object structure. The steps below assume a single `KeyBindings` interface with string values and a `loadKeyBindings()`/`saveKeyBindings()` pair. If the file has a different shape, adapt the edits to match — the intent is: (1) add a `fullscreen` binding with default `'f'`, (2) change the default `pause` from `'Escape'` to `'p'`, (3) if loading from localStorage yields `pause === 'Escape'`, rewrite to `'p'` and re-save.

- [ ] **Step 7.2: Add `fullscreen` to the `KeyBindings` type, change pause default, add migration**

In `src/input/keyBindings.ts`:

- Add `fullscreen: string;` to the `KeyBindings` interface.
- In the defaults object, add `fullscreen: 'f'`, and change `pause: 'Escape'` → `pause: 'p'`.
- In `loadKeyBindings`, after parsing localStorage, insert a migration step:

```typescript
  // Migrate legacy bindings: Esc used to be pause, but browser fullscreen
  // hijacks it. One-shot rewrite so old players don't find pause unusable.
  if (bindings.pause === 'Escape' || bindings.pause === 'Esc') {
    bindings.pause = 'p';
    saveKeyBindings(bindings);
  }
  // Fill in any keys that didn't exist in older saved copies.
  if (!bindings.fullscreen) {
    bindings.fullscreen = 'f';
    saveKeyBindings(bindings);
  }
```

Exact placement depends on the existing `loadKeyBindings` structure — insert the migration immediately after the parsed bindings are merged with defaults, before the return.

- [ ] **Step 7.3: Add `fullscreenToggleJustPressed` to `InputState`**

In `src/simulation/types.ts`, find the `InputState` interface. Add a new optional field:

```typescript
  fullscreenToggleJustPressed: boolean;
```

If other `*JustPressed` fields are non-optional booleans, match that style and add it as required. Then any object literal that constructs an `InputState` (check `inputManager.ts`) needs the field set.

- [ ] **Step 7.4: Have `InputManager` set the field when the `fullscreen` binding fires**

In `src/input/inputManager.ts`, find where the `InputState` is constructed/returned (likely in `getInputState`). Where other `*JustPressed` bools are computed from `justPressed.has(this.bindings.<key>)`, add:

```typescript
const fullscreenToggleJustPressed = this.justPressed.has(this.bindings.fullscreen);
```

…and include it in the returned `InputState`.

Notes:
- The simulation does not *need* this field — the simulation doesn't toggle fullscreen; only `GameScreen` does. But piping it through `InputState` keeps a single source of truth for "what the player just pressed," instead of a second side-channel. `GameScreen`'s game loop (Task 8) will read `inputState.fullscreenToggleJustPressed` and call the fullscreen toggle.
- The `simulation/types.ts` additions do NOT make the simulation aware of rendering — it's just a boolean; simulation code can ignore it. If you want to avoid even that appearance, place the field on a different struct owned by input. For this plan we add it to `InputState` to match the existing pattern of `pauseJustPressed` (or equivalent) already flowing through the same channel.

- [ ] **Step 7.5: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check — use the browser DevTools Application tab to inspect/clear localStorage between runs:
```bash
npm run dev
```
- Fresh localStorage: press `P` during gameplay → pauses. Press `P` again → unpauses.
- Simulate legacy save: in DevTools console run `localStorage.setItem('nannymud.bindings', JSON.stringify({ ...JSON.parse(localStorage.getItem('nannymud.bindings') || '{}'), pause: 'Escape' }))` (adjust key name to whatever `keyBindings.ts` actually uses), reload the page, press `P` → pauses. Inspect localStorage — the `pause` value should now be `'p'`.
- Press `F` during gameplay → fullscreen toggles (via ScalingFrame global listener).

- [ ] **Step 7.6: Commit**

```bash
git add src/input/keyBindings.ts src/input/inputManager.ts src/simulation/types.ts
git commit -m "feat(input): remap pause Esc->P, add fullscreen binding with migration"
```

---

## Task 8: Auto-pause on fullscreen exit; optional game-loop fullscreen trigger

Wire `GameScreen` to listen for `FULLSCREEN_EXIT_EVENT` and transition the sim to `'paused'`. Also honor `inputState.fullscreenToggleJustPressed` by calling the fullscreen context toggle — this lets players press F while the canvas has keyboard focus even if the global listener's precondition failed.

**Files:**
- Modify: `src/screens/GameScreen.tsx`
- Possibly: `src/simulation/simulation.ts` — add or confirm a "force pause" helper, see Step 8.2.

- [ ] **Step 8.1: Add `useFullscreen` import and trigger toggle from input**

In `src/screens/GameScreen.tsx`, add to the imports:

```typescript
import { useFullscreen, FULLSCREEN_EXIT_EVENT } from '../layout/ScalingFrame';
```

Inside the component, after the existing `useRef`/`useState` hooks, call:

```typescript
const { toggle: toggleFullscreen } = useFullscreen();
```

Inside `gameLoop`, after `const inputState = input.getInputState(...)`:

```typescript
if (inputState.fullscreenToggleJustPressed) {
  toggleFullscreen();
}
```

Keep this ABOVE the `tickSimulation` call so the toggle fires even if the sim pauses in the same frame.

- [ ] **Step 8.2: Listen for `FULLSCREEN_EXIT_EVENT` and force-pause**

Read the current `tickSimulation` contract in `src/simulation/simulation.ts` to confirm how pause is represented. Most likely `state.phase === 'paused'` is set when a pause input arrives. If there's an existing `pauseSimulation(state)` helper or a "force pause" affordance, use it. If not, you have two options:

- **Option A** (preferred): add a small exported helper at the bottom of `simulation.ts`:

```typescript
export function forcePause(state: SimState): SimState {
  if (state.phase !== 'playing') return state;
  return { ...state, phase: 'paused' };
}
```

- **Option B**: synthesize an `InputState` with `pauseJustPressed: true` and feed it through `tickSimulation` — brittle, don't do this unless pause handling has side effects the helper can't replicate.

Use Option A.

Inside `GameScreen.tsx`, add a new `useEffect` after the existing ones:

```typescript
useEffect(() => {
  const onExit = () => {
    stateRef.current = forcePause(stateRef.current);
  };
  window.addEventListener(FULLSCREEN_EXIT_EVENT, onExit);
  return () => window.removeEventListener(FULLSCREEN_EXIT_EVENT, onExit);
}, []);
```

Import `forcePause` alongside the other simulation imports at the top.

- [ ] **Step 8.3: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
- Start a game. Press `F` → enters fullscreen. Gameplay continues.
- Press `Esc` (browser exits fullscreen) → game auto-pauses. PAUSED overlay visible.
- Press `P` → unpauses. Continue playing.
- Pause with `P`, then `F` while paused → fullscreen toggles but game stays paused.

- [ ] **Step 8.4: Commit**

```bash
git add src/screens/GameScreen.tsx src/simulation/simulation.ts
git commit -m "feat(game): auto-pause on fullscreen exit; honor fullscreen input binding"
```

---

## Task 9: Remove the DOM info bar below the canvas

The info bar (keybinds hint + Quit button, `GameScreen.tsx:142-170`) no longer makes sense inside the letterbox. Remove it. Quit and keybinds hints move into the canvas HUD in Tasks 10 and 11.

**Files:**
- Modify: `src/screens/GameScreen.tsx`

- [ ] **Step 9.1: Delete the info bar JSX**

In `src/screens/GameScreen.tsx`, find this block (approximately lines 142-170):

```tsx
      <div style={{
        display: 'flex',
        gap: 16,
        padding: '8px 16px',
        background: '#0f172a',
        width: '100%',
        maxWidth: 900,
        boxSizing: 'border-box',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ color: '#6b7280', fontSize: 11 }}>
          ← → ↑ ↓ Move &nbsp;|&nbsp; Space Jump &nbsp;|&nbsp; J Attack &nbsp;|&nbsp; K Block &nbsp;|&nbsp; L Grab &nbsp;|&nbsp; Esc Pause
        </div>
        <button
          onClick={onQuit}
          style={{
            background: 'transparent',
            border: '1px solid #374151',
            color: '#9ca3af',
            padding: '4px 12px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Quit
        </button>
      </div>
```

Delete the entire block. The outer component div now contains only the `<canvas>`.

- [ ] **Step 9.2: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check: the canvas fills the full letterbox now. No controls hint and no Quit button (temporarily). Gameplay still works via keyboard. Tasks 10-11 restore these in-canvas.

- [ ] **Step 9.3: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "refactor(game): remove DOM info bar in preparation for canvas HUD buttons"
```

---

## Task 10: Canvas HUD button cluster (pause / fullscreen / quit)

Draw three small clickable buttons at the top-right of the canvas. Wire a mouse-click handler on the canvas that maps click coordinates (canvas CSS → buffer → virtual) and hit-tests against the buttons.

**Files:**
- Create: `src/rendering/hudButtons.ts`
- Modify: `src/rendering/hud.ts` (call into hudButtons)
- Modify: `src/screens/GameScreen.tsx` (add click handler, pass quit/toggle callbacks)
- Modify: `src/rendering/gameRenderer.ts` (accept and pass through HUD callbacks)

- [ ] **Step 10.1: Create `src/rendering/hudButtons.ts`**

Write exactly:

```typescript
import { VIRTUAL_WIDTH } from './constants';

export interface HudButtonRect {
  id: 'pause' | 'fullscreen' | 'quit';
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

// Layout is in VIRTUAL coords (the renderer's coordinate space). Top-right cluster.
const BUTTON_W = 72;
const BUTTON_H = 22;
const GAP = 6;
const RIGHT_MARGIN = 10;
const TOP_MARGIN = 74; // below the wave-info box at the top-right

export function getHudButtonRects(): HudButtonRect[] {
  // Right-to-left: quit | fullscreen | pause
  const ids: Array<HudButtonRect['id']> = ['pause', 'fullscreen', 'quit'];
  const labels: Record<HudButtonRect['id'], string> = {
    pause: 'Pause (P)',
    fullscreen: 'Fullscreen (F)',
    quit: 'Quit',
  };
  const rects: HudButtonRect[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const x = VIRTUAL_WIDTH - RIGHT_MARGIN - (ids.length - i) * BUTTON_W - (ids.length - 1 - i) * GAP;
    rects.push({ id, x, y: TOP_MARGIN, w: BUTTON_W, h: BUTTON_H, label: labels[id] });
  }
  return rects;
}

export function renderHudButtons(
  ctx: CanvasRenderingContext2D,
  isPaused: boolean,
  isFullscreen: boolean,
): void {
  const rects = getHudButtonRects();
  ctx.save();
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of rects) {
    const active = (r.id === 'pause' && isPaused) || (r.id === 'fullscreen' && isFullscreen);
    ctx.fillStyle = active ? 'rgba(251,191,36,0.25)' : 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = active ? '#fbbf24' : '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2);
  }
  ctx.restore();
}

// Hit-test a click in VIRTUAL coords against the button layout.
// Returns the id of the clicked button, or null.
export function hitTestHudButton(virtualX: number, virtualY: number): HudButtonRect['id'] | null {
  for (const r of getHudButtonRects()) {
    if (virtualX >= r.x && virtualX <= r.x + r.w && virtualY >= r.y && virtualY <= r.y + r.h) {
      return r.id;
    }
  }
  return null;
}
```

- [ ] **Step 10.2: Plumb fullscreen state + click callbacks through the renderer**

Extend `GameRenderer.render`'s signature (`src/rendering/gameRenderer.ts`) to accept extra inputs:

```typescript
  render(
    ctx: CanvasRenderingContext2D,
    state: SimState,
    comboBuffer: ComboBuffer,
    width: number,
    height: number,
    dtMs: number,
    isFullscreen: boolean,
  ): void {
```

Inside `render`, after `renderHUD(...)`, add:

```typescript
    renderHudButtons(ctx, state.phase === 'paused', isFullscreen);
```

Import at the top:

```typescript
import { renderHudButtons } from './hudButtons';
```

- [ ] **Step 10.3: Pass `isFullscreen` and a click-handler wire from `GameScreen`**

In `src/screens/GameScreen.tsx`:

1. Pull `isFullscreen` from the `useFullscreen` hook (already introduced in Task 8):
   ```typescript
   const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
   ```

2. Pass it into the render call:
   ```typescript
   rendererRef.current.render(
     ctx,
     state,
     comboBufferRef.current,
     VIRTUAL_WIDTH,
     VIRTUAL_HEIGHT,
     dtMs,
     isFullscreen,
   );
   ```

3. Add a click handler on the `<canvas>` that maps CSS pixels to VIRTUAL coords and dispatches actions:

Add to imports:

```typescript
import { hitTestHudButton } from '../rendering/hudButtons';
import { forcePause } from '../simulation/simulation'; // if not already imported from Task 8
```

Inside the component, add a handler `useCallback` (or a plain function):

```typescript
const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  // Click in CSS pixels -> canvas buffer -> virtual (divide by RENDER_SCALE).
  const bufferX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const bufferY = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const virtualX = bufferX / RENDER_SCALE;
  const virtualY = bufferY / RENDER_SCALE;

  const hit = hitTestHudButton(virtualX, virtualY);
  if (!hit) return;
  if (hit === 'pause') {
    stateRef.current = forcePause(stateRef.current);
  } else if (hit === 'fullscreen') {
    toggleFullscreen();
  } else if (hit === 'quit') {
    onQuit();
  }
};
```

Add `onClick={handleCanvasClick}` to the `<canvas>` element.

- [ ] **Step 10.4: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
- Start a game. Three small buttons visible at top-right of canvas.
- Click Pause → game pauses. Click Pause again has no extra effect (already paused). Press `P` → unpauses.
- Click Fullscreen → browser enters fullscreen. Click again → exits.
- Click Quit → returns to GuildSelect screen.
- Resize browser and repeat — clicks should still land on the buttons (coordinate math honors CSS scaling).
- When paused, the Pause button should visually indicate the paused state (amber tint). When in fullscreen, the Fullscreen button should indicate active.

- [ ] **Step 10.5: Commit**

```bash
git add src/rendering/hudButtons.ts src/rendering/gameRenderer.ts src/screens/GameScreen.tsx
git commit -m "feat(hud): add in-canvas pause/fullscreen/quit button cluster"
```

---

## Task 11: Fading controls hint

Replaces the deleted info-bar controls hint. Low-opacity text at the bottom-center of the canvas, visible for the first 5 seconds of gameplay, then fades out. Re-shows when paused.

**Files:**
- Modify: `src/rendering/hud.ts`
- Modify: `src/rendering/gameRenderer.ts` (call into the new hint helper)

- [ ] **Step 11.1: Add `renderControlsHint` in `hud.ts`**

At the end of `src/rendering/hud.ts` (below `renderPauseOverlay`), append:

```typescript
// Fades from full opacity to zero across 5 seconds of real gameplay time,
// then stays hidden. Re-shows at full opacity whenever the game is paused.
export function renderControlsHint(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  simTimeMs: number,
  isPaused: boolean,
): void {
  const fadeStartMs = 4000;
  const fadeEndMs = 5000;
  let alpha: number;
  if (isPaused) {
    alpha = 0.9;
  } else if (simTimeMs < fadeStartMs) {
    alpha = 0.7;
  } else if (simTimeMs < fadeEndMs) {
    alpha = 0.7 * (1 - (simTimeMs - fadeStartMs) / (fadeEndMs - fadeStartMs));
  } else {
    return;
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(
    '← → ↑ ↓ Move  |  Space Jump  |  J Attack  |  K Block  |  L Grab  |  P Pause  |  F Fullscreen',
    canvasWidth / 2,
    canvasHeight - 8,
  );
  ctx.restore();
}
```

- [ ] **Step 11.2: Call the helper from `GameRenderer.render`**

In `src/rendering/gameRenderer.ts`, import the helper:

```typescript
import { renderHUD, renderPauseOverlay, renderControlsHint } from './hud';
```

Inside `render`, right before the `renderHudButtons(...)` call added in Task 10:

```typescript
    renderControlsHint(ctx, width, height, state.timeMs, state.phase === 'paused');
```

Place it before the buttons so buttons draw on top (the hint is a background element).

Also update the existing pause-overlay hint text — find inside `renderPauseOverlay` (in `hud.ts`):

```typescript
  ctx.fillText('Press Esc to resume', width / 2, height / 2 + 10);
```

Replace with:

```typescript
  ctx.fillText('Press P to resume', width / 2, height / 2 + 10);
```

- [ ] **Step 11.3: Verify**

```bash
npm run typecheck && npm run lint && npm run build
```
Expected: all green.

Manual browser check:
```bash
npm run dev
```
- Start a game. Controls hint visible at the bottom, somewhat faint. After ~5 seconds it fades to nothing.
- Press `P` → PAUSED overlay says "Press P to resume", and the controls hint reappears at higher opacity at the bottom.
- Press `P` again → resumes. Controls hint stays hidden (already past the 5s window).
- Restart a round → hint shows again for 5s from `state.timeMs === 0`.

- [ ] **Step 11.4: Commit**

```bash
git add src/rendering/hud.ts src/rendering/gameRenderer.ts
git commit -m "feat(hud): fading controls hint at bottom of canvas"
```

---

## Task 12: Update `CLAUDE.md` with the new conventions

Keep the architecture doc honest. Anyone touching the renderer next needs to know where constants live and what `RENDER_SCALE` means.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 12.1: Add a render-constants note**

In `CLAUDE.md`, under the "Architecture: strict layer separation" section (around the `rendering/` bullet), append a new sub-bullet:

```markdown
  - Render-only constants live in `src/rendering/constants.ts` (`VIRTUAL_WIDTH`, `VIRTUAL_HEIGHT`, `CANVAS_BUFFER_WIDTH`, `CANVAS_BUFFER_HEIGHT`, `RENDER_SCALE`, `DEPTH_SCALE`). The game loop in `GameScreen.tsx` applies `ctx.setTransform(RENDER_SCALE, ...)` once per frame; the renderer draws in virtual units (900×506) and the transform upscales to the 1600×900 backing buffer. Never put these in `src/simulation/constants.ts`.
```

- [ ] **Step 12.2: Add a layout section note**

Under the same section, append after the input/audio sub-bullets:

```markdown
- **`src/layout/ScalingFrame.tsx`** — wraps the whole app in a 16:9 letterbox and owns the browser Fullscreen API (F key, per-frame `fullscreenchange` listener). Emits a `FULLSCREEN_EXIT_EVENT` on `window` so `GameScreen` can auto-pause on exit. If you need a new screen, render it inside `ScalingFrame` — don't reach for `minHeight: 100vh`.
```

- [ ] **Step 12.3: Update the keybinds section**

If the Controls table in `CLAUDE.md` mentions `Esc` for pause, update to `P`. Add a row for `F` → fullscreen toggle.

- [ ] **Step 12.4: Verify**

No build impact. Just re-read `CLAUDE.md` top-to-bottom and make sure the added notes are consistent with everything else on the page (no contradictions).

- [ ] **Step 12.5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for ScalingFrame and render-constants conventions"
```

---

## Post-flight

- [ ] **Full manual regression**

```bash
npm run dev
```

Run through the spec's testing checklist end to end:
- Letterbox behaves correctly when resizing browser window from very wide to very tall and back. No clipping.
- `F` → enters fullscreen, `F` again → exits. `Esc` in fullscreen → exits + auto-pauses.
- Click HUD Pause / Fullscreen / Quit buttons — all three work.
- `P` pauses and resumes.
- Gameplay feel unchanged vs. the pre-plan baseline: spawn-to-first-enemy walk time identical; basic attack connect distance identical; camera lock position identical.
- On a 4K monitor, text and shapes are noticeably sharper than the pre-plan baseline.
- Controls hint fades after ~5s; re-shows on pause.
- localStorage migration: simulate a legacy `pause: 'Escape'` save; `P` still pauses after reload; localStorage value rewritten to `'p'`.

- [ ] **Final build**

```bash
npm run typecheck && npm run lint && npm run build
```
All green.

- [ ] **Push branch (do not merge yet)**

```bash
git push -u origin presentation-layer
```

Report back to the user with a summary: what changed, any surprises, and the branch name for review.

---

## Notes for the implementer

- **Every task ends in a commit.** Do not batch multiple tasks into one commit. If a task's manual check fails, fix and amend the commit for that task — don't leak into the next task's scope.
- **Never widen scope.** Sprite integration, VFX overhaul, menu redesign, multiplayer — all explicitly out of scope for this plan (sub-projects A, D, E, later). If you find yourself wanting to touch `actorRenderer.ts` or `placeholderRenderer.ts` beyond the RENDER_SCALE transform, stop.
- **Virtual vs. buffer coordinates.** Renderer code works in virtual (VIRTUAL_WIDTH × VIRTUAL_HEIGHT = 900×506). HUD positions use small numbers (`10`, `68`, `220`). Canvas click coordinates must be divided by `RENDER_SCALE` before hit-testing against HUD geometry (see Task 10.3).
- **No tests.** The repo has no test runner. Verification per task is `typecheck`, `lint`, `build`, and manual browser check. If a future task needs unit tests, adding a test runner is its own sub-project, not a silent addition here.
