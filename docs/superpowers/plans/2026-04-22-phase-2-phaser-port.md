# Phase 2 — Phaser Port: Implementation Plan

**Date:** 2026-04-22
**Scope:** Execute Phase 2 of `docs/superpowers/specs/2026-04-21-phaser-colyseus-rewrite-design.md`. Replace `src/rendering/` (Canvas 2D) with a Phaser 3 scene that consumes the existing `SimState`. Only `GameScreen.tsx` changes in the screens layer. Simulation untouched.
**Estimated:** 15 tasks, ~1–2 weeks per spec. Each task is a commit.
**Branch:** `phase-2-phaser` (worktree `.worktrees/phase-2-phaser`)

## Ground rules (read first)

- **Nothing merges to main half-ported.** A single branch lands only when feature-parity with the Canvas build is reached.
- **Simulation is off-limits.** If a task tempts you into `src/simulation/**`, stop — that's out of scope and the golden test will catch any sneak-in.
- **Parallel work coordination:** menu screens (`CharSelect`, `GuildDetails`, `MainMenu`, `LoadingScreen`, `PauseOverlay`, `ResultsScreen`, `StageSelect`, `TitleScreen`) and asset generation are being touched outside this branch. This plan only rewrites `GameScreen.tsx` + deletes `src/rendering/` + deletes `src/input/inputManager.ts`. Merge main before starting each task if main has new commits.
- **No Phaser idioms beyond what's needed.** The spec is explicit: Phase 2 is a 1:1 port of what `gameRenderer.ts` does today. No Phaser physics (we already have simulation physics), no Phaser scene transitions (React handles screen routing), no Phaser cameras' bounds system (we have `state.cameraX`). Save Phaser idioms for Phase 3.
- **Placeholder fallback first.** Every visual element should render correctly with the placeholder (colored rect + letter) before we wire atlases. This is the current canvas behavior and it keeps every intermediate task playable.
- **Feature parity is the only shipping gate.** If a hit-spark particle is missing, Phase 2 isn't done. Use the feature-parity checklist in Task 15.

## Architectural target

```
src/
├── game/                         NEW — Phaser client
│   ├── PhaserGame.ts             Phaser.Game factory (resolution, scale, destroy)
│   ├── scenes/
│   │   ├── BootScene.ts          atlas/vfx manifest, loading bar, transition to Gameplay
│   │   ├── GameplayScene.ts      owns tickSimulation call + world rendering
│   │   └── HudScene.ts           overlay scene, separate camera, HUD + pause buttons
│   ├── view/
│   │   ├── ActorView.ts          wraps Phaser.GameObjects.Sprite; bound to actor id
│   │   ├── ProjectileView.ts
│   │   ├── PickupView.ts
│   │   └── ParticleFX.ts         wraps vfxEvents → Phaser particle emitters/tweens
│   ├── input/PhaserInputAdapter.ts   builds InputState from Phaser keyboard events
│   └── assets/manifest.ts        atlas + vfx + audio declarations (currently synth-only)
├── rendering/                    DELETED
├── input/
│   ├── inputManager.ts           DELETED (PhaserInputAdapter replaces it)
│   └── keyBindings.ts            KEPT — PhaserInputAdapter reads the same config
└── screens/GameScreen.tsx        REWRITTEN — mounts Phaser; no rAF loop here
```

- Audio calls (`audio.playAttack()`, `playHeal()`, `playBlock()`, `playJump()`) relocate from `GameScreen.tsx`'s rAF loop into `GameplayScene.update` after the tick. `AudioManager` itself is unchanged.
- Fullscreen pause-on-exit listener moves from `GameScreen.tsx` to `GameplayScene.create/shutdown`. React keeps `useFullscreen` for the `F` key + fullscreen button only.
- HUD buttons (pause/fullscreen/quit) — currently canvas-click + `hitTestHudButton` — become `HudScene` `Phaser.GameObjects.Image.setInteractive()` handlers. `hitTestHudButton.ts` deletes with the rest of `src/rendering/`.

## Task list

Each task ends with an explicit "Done when" gate. No task is considered complete while typecheck or lint is red.

### Task 1 — Vite + TypeScript scaffolding for Phaser

**Files:**
- Modify: `vite.config.ts` — add `optimizeDeps: { include: ['phaser'] }` and `define` block to strip the unused renderer at build time.
- Create: `src/game/` directory (empty placeholder `index.ts` re-exporting nothing yet).
- Modify: `eslint.config.js` — add `src/game/**` under the general TS config (no restricted-globals override; Phaser uses DOM heavily).
- Modify: `package.json` — confirm `phaser` dep is present (already installed in Task 0 baseline).

**Important:**
- Use `define: { 'typeof CANVAS_RENDERER': "'true'", 'typeof WEBGL_RENDERER': "'true'" }` — strings, not booleans — matching Phaser's build-flag convention.
- No code yet; this is config only. If `npm run dev` still loads and plays the existing Canvas game, the task is done.

**Done when:**
- `npm run dev` plays identically to pre-change build.
- `npm run build` succeeds with Phaser included; bundle size grows by ~700KB gzipped (expected).
- `npm run typecheck` green.
- Commit: `chore(phase-2): Vite config for Phaser, scaffold src/game/`

---

### Task 2 — PhaserGame factory + BootScene skeleton

**Files:**
- Create: `src/game/PhaserGame.ts` — `makePhaserGame(parent: HTMLElement, guildId: GuildId, callbacks)` factory returning a `Phaser.Game`. Config: `type: Phaser.AUTO`, `width: VIRTUAL_WIDTH`, `height: VIRTUAL_HEIGHT`, `scale: { mode: FIT, autoCenter: CENTER_BOTH }`, `pixelArt: true`, `backgroundColor: '#000'`. Scene list: `[BootScene, GameplayScene, HudScene]`, but only `BootScene` registered/started for now.
- Create: `src/game/scenes/BootScene.ts` — extends `Phaser.Scene`. `preload()` queues zero assets for now (just displays the loading bar). `create()` transitions to a stub `GameplayScene` that just draws "Gameplay (Phase 2 WIP)" text.
- Create: `src/game/scenes/GameplayScene.ts` — stub only: `create()` adds a `Phaser.GameObjects.Text` with placeholder content. No tick yet.
- Create: `src/game/scenes/HudScene.ts` — stub only: empty scene.
- Create: `src/game/assets/manifest.ts` — exported `MANIFEST` constant (empty for now; atlases added in Task 6, VFX in Task 7).

**Important:**
- `VIRTUAL_WIDTH` / `VIRTUAL_HEIGHT` currently imported from `src/rendering/constants.ts`. For Phase 2, move them to a new `src/game/constants.ts` that re-exports them. Leave `rendering/constants.ts` in place for now — it gets deleted in Task 15.
- `callbacks: { onVictory, onDefeat, onQuit }` pass through the registry: `game.registry.set('callbacks', callbacks)`. Scenes read from `this.game.registry.get('callbacks')`.

**Done when:**
- In an isolated temporary React page (or by adding a temporary "dev: mount Phaser only" toggle in `App.tsx`), mounting a Phaser game shows the boot-then-stub transition.
- Don't wire into `GameScreen.tsx` yet — the Canvas game still runs as today.
- Typecheck green.
- Commit: `feat(game): PhaserGame factory + empty BootScene/GameplayScene/HudScene stubs`

---

### Task 3 — GameplayScene runs tickSimulation (no rendering)

**Files:**
- Modify: `src/game/scenes/GameplayScene.ts` — add `create()` that initializes `this.simState = createInitialState(guildId, seed)`, creates a `PhaserInputAdapter` (stub for now; full impl in Task 4), and starts HudScene as overlay. Add `update(time, delta)` that calls `tickSimulation(this.simState, this.inputAdapter.getInputState(time), delta)`. Keep rendering empty — just a text label showing `this.simState.wave` / `score` / `player.hp` to prove the tick is running.
- Create: `src/game/input/PhaserInputAdapter.ts` — stub class with `getInputState(timeMs): InputState` returning an all-false InputState. Real wiring in Task 4.
- Modify: `src/game/scenes/GameplayScene.ts` — wire `shutdown()` to `resetController(this.simState, 'player')` + dispose adapter.

**Important:**
- `createInitialState(guildId, seed?)` — if seed omitted, `Date.now()` is used. Pass `Date.now()` explicitly from the scene so the ESLint disable lives in one place (matches Phase 1 pattern).
- `vfxEvents` on `simState` will start accumulating. Don't render them yet; they clear naturally at the top of the next tick.
- `phase` transitions: wire victory/defeat handoff here via `this.time.delayedCall(1500, () => callbacks.onVictory(this.simState.score))`. Don't use `setTimeout` — Phaser scenes have `this.time.delayedCall` which is tick-driven.

**Done when:**
- With the stub gameplay scene mounted (temporary toggle), the HUD text advances (score ticks, wave changes when you cross trigger X) even though nothing is drawn. Victory/defeat hand-off fires correctly if you force `phase = 'victory'` via dev tools.
- Typecheck green.
- Commit: `feat(game): GameplayScene calls tickSimulation, phase routing`

---

### Task 4 — PhaserInputAdapter (feature parity with InputManager)

**Files:**
- Modify: `src/game/input/PhaserInputAdapter.ts` — implement fully. Read `loadKeyBindings()` from `src/input/keyBindings.ts`. Install `this.scene.input.keyboard.on('keydown', …)` / `keyup` listeners; mirror the held/justPressed/doubleTap logic in `InputManager`.
- Preserve: double-tap run detection (`runningLeft`, `runningRight`, `lastLeftPressMs`, `lastRightPressMs`).
- Preserve: `fullscreenToggleJustPressed` behavior for `F`.
- Preserve: `clearJustPressed()` contract — call after `tickSimulation`.
- Do NOT touch `src/input/keyBindings.ts`. Read it unchanged.

**Important:**
- `InputManager` has ~180 LOC and existing tests would be nice. No existing tests — port logic carefully, compare side-by-side. Consider writing a small adapter test with a fake `Phaser.Input.Keyboard` in Task 14 hardening if time allows.
- `this.scene.input.keyboard` is `Phaser.Input.Keyboard.KeyboardPlugin | undefined` — guard with early-return in `constructor`.
- The `pause` keybinding (`P`) is a simulation input now, so the adapter produces `pauseJustPressed`. Don't intercept it at the adapter layer.

**Done when:**
- Stub gameplay scene accepts arrow keys + J/K/L/Space/P/F and the simulation responds (you can see the player's `x` drift in the debug text from Task 3).
- Double-tap right makes `runningRight` true in the input state (verify via debug text).
- Typecheck green.
- Commit: `feat(game): PhaserInputAdapter feature-parity with InputManager`

---

### Task 5 — Parallax background + camera follow

**Files:**
- Modify: `src/game/scenes/GameplayScene.ts` — in `create()`, spawn the background: a solid gradient `Phaser.GameObjects.Rectangle` (or a generated texture) for the sky, plus 2 `TileSprite` layers for parallax hills. In `update()` after the tick, scroll each `TileSprite.tilePositionX` proportional to `state.cameraX` with different factors (near=1.0, mid=0.5, far=0.2).
- Modify: `src/game/scenes/GameplayScene.ts` — add ground-stripe graphics: two horizontal bands at `GROUND_Y_MIN` and `GROUND_Y_MAX` (from simulation constants) projected through the same `DEPTH_SCALE` used by `rendering/constants.ts`.
- Keep: `DEPTH_SCALE` in `src/rendering/constants.ts` until Task 15; import it from there in the scene. Cannot move to `src/game/constants.ts` safely until rendering/ is deleted.
- Camera: `this.cameras.main.scrollX = state.cameraX` each frame. Do not use `camera.startFollow` — simulation owns camera position.

**Important:**
- Current canvas renders parallax in `gameRenderer.ts` — study it for layer colors and parallax factors before reimplementing.
- The scene's camera transform automatically handles `scrollX`; do not subtract `cameraX` in sprite positions.
- `VIRTUAL_WIDTH` = 900, `VIRTUAL_HEIGHT` = 506. All y-coordinates use `GROUND_Y_MIN=60..GROUND_Y_MAX=380` with `DEPTH_SCALE` lifting depth (`y`) onto the screen.

**Done when:**
- Mounting the Phaser scene (still via dev toggle) shows the background scrolling as the player moves right (using debug text + player `x`).
- Parallax layers move at different rates. Foreground strip matches camera speed.
- Typecheck green.
- Commit: `feat(game): parallax background + depth-projected ground, camera follow`

---

### Task 6 — ActorView with placeholder rendering

**Files:**
- Create: `src/game/view/ActorView.ts`. Constructor takes `(scene: Phaser.Scene, actor: Actor)`. Holds a `Phaser.GameObjects.Graphics` object drawing a colored rect + initial-letter text (mirrors `PlaceholderRenderer.ts`). Methods: `syncFrom(actor: Actor)` updates position (`x`, projected `y - z * DEPTH_SCALE`), scale-X flip for facing, tint on damage flash, visibility on death phase.
- Modify: `src/game/scenes/GameplayScene.ts` — maintain `Map<string, ActorView>`. After `tickSimulation`, reconcile: for every actor in `[state.player, ...state.allies, ...state.enemies]`, get-or-create view, call `syncFrom`. Destroy views for actors no longer in state.
- Depth sort: each view sets `this.graphics.depth = actor.y` so 2.5D depth ordering respects the y-axis. Phaser sorts automatically per frame when `scene.children.depthSort()` is called; use `scene.children.depthSortChildrenArray` or just rely on per-object `depth`.

**Important:**
- Pull colors + letters from `guildData.ts` / `enemyData.ts` (already imported by `PlaceholderRenderer`).
- Draw the shadow (the dark ellipse under each actor) as a second Graphics object per view, at depth = actor.y - 0.1 so it sorts just below. Current canvas draws shadows in a separate pass; in Phaser they become per-view.
- Don't build an animation state machine yet. Placeholder only.

**Done when:**
- Mounting Phaser shows player + spawned enemies as colored rectangles with letter initials, positioned correctly, flipping facing, with shadows. Depth sort works — actor farther back draws before actor in front.
- Damage flash (tint) shows on hit.
- Victory fadeout works (phase = victory → actors stay, but no new waves spawn).
- Typecheck green.
- Commit: `feat(game): ActorView placeholder parity + depth sort`

---

### Task 7 — ProjectileView, PickupView

**Files:**
- Create: `src/game/view/ProjectileView.ts`. Mirrors `renderProjectile` in `gameRenderer.ts`: shape (circle/rect/bolt), color, pierce count, trail. Bind to `projectile.id`.
- Create: `src/game/view/PickupView.ts`. Mirrors `renderPickup`: icon-drawn-as-colored-shape based on `pickup.kind`, pulse scale on lifetime.
- Modify: `src/game/scenes/GameplayScene.ts` — add reconcile loops for `state.projectiles` and `state.pickups` identical to ActorView pattern in Task 6.

**Done when:**
- Firing a projectile (knight's combo) spawns a moving visual that destroys on land/expire.
- Enemy drops visible pickups; collecting one removes the view.
- Typecheck green.
- Commit: `feat(game): ProjectileView + PickupView parity`

---

### Task 8 — VFX events → Phaser tweens + particles

**Files:**
- Create: `src/game/view/ParticleFX.ts`. Exports `consumeVfxEvents(scene, events: VFXEvent[])`. For each event type in `state.vfxEvents`, spawn the appropriate transient visual:
  - `hit_spark` → short radial particle burst (Phaser `Phaser.GameObjects.Particles.ParticleEmitter`).
  - `damage_number` → Phaser text, tween upward + fade, destroy on complete.
  - `blink_trail` → ghost copies of the caster sprite, alpha fade-out tween.
  - `aoe_pop` → expanding circle tween on a Graphics object, destroy on complete.
  - `heal_glow`, `death_fx`, `channel_ring`, `grab_marker`, `summon_spark`, `shockwave`, miasma, bloodtally stacks, dish-throw, etc. — enumerate every `type` currently emitted in simulation.
- Modify: `src/game/scenes/GameplayScene.ts` — after `tickSimulation`, call `consumeVfxEvents(this, state.vfxEvents)` before any audio dispatch.
- Reference: `src/rendering/particles.ts` (the 1200-line canvas implementation). Don't try to port the particle physics 1:1 — use Phaser's built-in particle system, tweak presets to match the visual feel. Perfect parity is impossible; "close enough" is the target.

**Important:**
- The leper VFX that codex landed in main (`src/rendering/vfx/`) is externally-loaded PNGs keyed by guild. That pipeline moves to Task 9 (sprite atlases) — don't try to handle image-based VFX in Task 8. Procedural (shape-based) VFX only here.
- Some VFX are per-tick (damage numbers spawn once and fade); some are continuous (channel_ring while casting). The simulation emits each kind differently — read each path in `simulation.ts` to confirm.

**Done when:**
- Hitting an enemy shows a spark + damage number that float-fades.
- Blink ability leaves ghost trail.
- AoE effects visible.
- Channel ring appears while a channeled ability is active.
- Typecheck green.
- Commit: `feat(game): VFX events → Phaser particles + tweens`

---

### Task 9 — Sprite atlases for guilds (consume existing pixellab pipeline)

**Files:**
- Modify: `src/game/assets/manifest.ts` — declare an atlas per guild, pointing at `public/sprites/<guildId>/metadata.json` produced by `scripts/composite-pixellab-sprites.py`. The metadata file describes per-animation frame rects inside each horizontal strip PNG (`attack_1.png`, `walk.png`, etc).
- Modify: `src/game/scenes/BootScene.ts` — for each declared atlas, call `this.load.atlas(key, imageUrl, metadataUrl)` **or** load each per-animation strip as a spritesheet (`this.load.spritesheet(key, url, { frameWidth, frameHeight, endFrame })`) — decide based on which Phaser primitive better fits metadata.json's shape.
- Create: `src/game/view/AnimationRegistry.ts` — on `BootScene.create`, register one Phaser animation per animation declared in each guild's metadata: `this.anims.create({ key: '${guildId}:${animId}', frames, frameRate, repeat })`.
- Modify: `src/game/view/ActorView.ts` — add `setAnimation(animId: string)` that calls `this.sprite.play('${actor.kind}:${animId}', true)`. Retain the placeholder Graphics path as a fallback when no atlas is loaded.
- Sync driver: `ActorView.syncFrom` derives `animId` from `actor.state` + `actor.facing` (`attack_1`, `attack_2`, `idle`, `walk`, `run`, `jump`, `block`, `hurt`, `death`). Mirror what `SpriteActorRenderer.ts` does today.

**Important:**
- The pixellab-based `metadata.json` may not be Phaser's native atlas format. Two possible paths: (a) write a small adapter in `AnimationRegistry.ts` that reads metadata.json and calls `this.textures.addSpriteSheetFromAtlas` manually, or (b) regenerate the metadata into Phaser atlas JSON with an offline script. Pick (a) for now — keep the existing pipeline — unless it's clearly harder than (b). Flag in commit message if you switch.
- Only wire the guilds that already have sprites on disk (knight, vampire, leper per latest main). Every other guild falls back to placeholder rendering — explicit `if (!atlasLoaded) return placeholder`.
- Enemies (skeleton, goblin, archer, brute, boss) have no sprites yet and continue placeholder.

**Done when:**
- Knight sprite animates on move/attack/hurt/death. Vampire and leper likewise.
- Every other actor still placeholder-rendered.
- No broken animations — if metadata is missing a key, graceful fallback to idle.
- Typecheck green.
- Commit: `feat(game): sprite atlases per guild, animation registry, ActorView anim driver`

---

### Task 10 — HudScene: HP/MP bars, score, wave, boss bar

**Files:**
- Modify: `src/game/scenes/HudScene.ts` — runs as overlay scene (separate camera with `cameras.main.setScroll(0, 0)`). Spawn:
  - HP bar (player, bottom-left) — background rect + fill graphics, updates from `simState.player.hp`.
  - MP bar (below HP) — same pattern.
  - Resource bars per guild (chiOrbs, sanity, bloodtally, dishes, shapeshiftForm) — gated on `guildId`. Mirror `renderSpecialInfo` in `hud.ts`.
  - Score text (top-center).
  - Wave indicator (top-right).
  - Boss bar (top, center) when `state.bossSpawned`.
- Communication: `GameplayScene` calls `this.scene.get('Hud').emit('state', simState)` each tick via Phaser's event emitter. `HudScene.create` subscribes and updates all its graphics. Don't let HudScene reach into `GameplayScene` directly.
- Reference: `src/rendering/hud.ts` + `renderBossInfo` + `renderSpecialInfo` + `renderScore` + `renderWaveInfo`.

**Important:**
- Per-guild resource UI is the trickiest piece — there are guild-specific icons (chi orbs as dots, bloodtally stacks as skulls, dishes as plates). Start with colored rects + counts; polish in Task 12 if time remains.
- HUD scene's camera has `ignore` set for world objects so world doesn't re-render on HUD's canvas. Use `this.cameras.main.ignore([…])` after GameplayScene populates its objects, OR use `scene.sys.updateList` — Phaser has multiple idioms; pick whichever is canonical for v3.90.

**Done when:**
- HP/MP bars update live as you take damage / spend MP.
- Score and wave text reflect state.
- Boss bar appears when boss spawns, updates, disappears on phase transitions.
- Typecheck green.
- Commit: `feat(game): HudScene with bars, score, wave, boss indicator`

---

### Task 11 — HudScene: combo hints, damage numbers, controls hint, pause overlay routing

**Files:**
- Modify: `src/game/scenes/HudScene.ts` — add:
  - Combo-hint row (bottom, center) — mirror `renderComboHints`. Reads `comboBuffer` from GameplayScene via event payload.
  - Controls-hint strip (bottom, under combo). Hides when `isFullscreen`. Mirror current canvas behavior.
  - Pause-when-paused dim layer — when `state.phase === 'paused'`, draw a translucent black rect over the world (but under HUD). React still renders `<PauseOverlay />` on top (its controls are outside the canvas); Phaser only owns the dim.
  - Moves-panel dim — same idea. React renders `<GuildDetails />`; Phaser dims underneath.
- Emit `pause-requested` / `resume-requested` events when hud buttons fire. React `<GameScreen>` listens and toggles `isPaused` state.

**Important:**
- React still mediates the actual pause overlay UI. Phaser just dims. This matches the spec: menus stay in React.
- `comboBuffer` is currently created in `GameScreen.tsx`. In Phase 2 it moves inside `GameplayScene` (since it's drawn by the HUD). Pass it through scene events, or store it on `scene.data`. Don't let React reach into Phaser for it.

**Done when:**
- Combo grammar hints render.
- Controls hint shows/hides based on fullscreen.
- Pause dim fires; React overlay sits on top correctly.
- Typecheck green.
- Commit: `feat(game): HudScene combo hints, controls hint, pause dim`

---

### Task 12 — Audio integration: move dispatch into GameplayScene

**Files:**
- Modify: `src/game/scenes/GameplayScene.ts` — construct `AudioManager` in `create()`, dispose in `shutdown()`. After each `tickSimulation`, inspect `state.vfxEvents` and `state.player.state` to call `audio.playAttack()`/`playHeal()`/`playBlock()`/`playJump()`. Mirror lines 145–149 in the current `GameScreen.tsx`.
- Modify: `src/game/scenes/GameplayScene.ts` — on boss spawn detection, call `audio.startBossMusic()`. On scene create, `audio.startStageMusic()`. On phase victory/defeat, call `audio.stopMusic()` + `audio.playVictory()`/`playDefeat()`.
- Do NOT import `AudioManager` from React's GameScreen anymore — Task 14 rewrites GameScreen to delete that wiring.

**Important:**
- The `setTimeout(..., 1500)` for victory/defeat hand-off becomes `this.time.delayedCall(1500, …)`. Phaser's scheduled calls are scene-scoped; they cancel when the scene shuts down. Better than raw setTimeout for lifecycle safety.
- `AudioManager` already has no simulation coupling; no changes there.

**Done when:**
- Hitting enemies plays attack sound.
- Blocking plays block sound.
- Jumping plays jump sound (once per jump, not continuously).
- Boss music kicks in on boss spawn.
- Victory/defeat plays correct sting then transitions via callbacks.
- Typecheck green.
- Commit: `feat(game): GameplayScene owns audio dispatch (moved from React)`

---

### Task 13 — Fullscreen-exit pause + HUD button interactions

**Files:**
- Modify: `src/game/scenes/GameplayScene.ts` — in `create()`, attach a `window.addEventListener(FULLSCREEN_EXIT_EVENT, …)` that calls `this.simState = forcePause(this.simState)`. Remove in `shutdown()`.
- Modify: `src/game/scenes/HudScene.ts` — convert pause/fullscreen/quit HUD buttons from canvas-rendered shapes (old `hudButtons.ts`) to Phaser `Graphics` + `.setInteractive()` with `'pointerdown'` listeners. On pause click: `this.scene.get('Gameplay').events.emit('pause')`. On fullscreen click: emit `fullscreen-toggle` up to React (via registry callback or a `window.dispatchEvent` of a custom event). On quit click: call `callbacks.onQuit()`.
- Don't reinvent fullscreen API — keep `useFullscreen` in React; the button fires back to React.

**Important:**
- Clicks on Phaser objects return Phaser pointer events — no hit-testing math needed. The old `hitTestHudButton` logic deletes with `src/rendering/`.
- Fullscreen button behavior: user presses `F` key → `PhaserInputAdapter` sets `fullscreenToggleJustPressed` → `GameplayScene.update` calls `scene.registry.get('toggleFullscreen')()`. Same path for clicks on the HUD button.

**Done when:**
- Exiting fullscreen pauses the game (same as today).
- All three HUD buttons respond to clicks and trigger the right action.
- `F` key toggles fullscreen.
- Typecheck green.
- Commit: `feat(game): fullscreen-exit pause wire + HUD button interactions`

---

### Task 14 — Rewrite GameScreen.tsx to mount Phaser

**Files:**
- Rewrite: `src/screens/GameScreen.tsx`. New responsibilities, total: ≤ 100 LOC.
  - Owns the `<canvas>` (no longer, actually — Phaser creates its own `<canvas>` inside a parent div).
  - Mounts `makePhaserGame(parent, guildId, callbacks)` in a `useEffect([guildId, restartToken])`.
  - Cleanup: `game.destroy(true)`.
  - Keeps `<PauseOverlay>` and `<GuildDetails>` overlays controlled by React state (`isPaused`, `showMoves`).
  - Listens for Phaser events (`pause`, `resume`, `restart-requested`) via the scene registry → react setState.
  - Keeps `useFullscreen` hook + `toggleFullscreen` wiring; passes it down to the game via registry so HUD buttons can call it.
  - `FULLSCREEN_EXIT_EVENT` listener moves to GameplayScene (Task 13) — delete it from React.
  - `resetController` calls delete — GameplayScene.shutdown handles it.
  - `restartToken` state to force Phaser remount (same pattern as canvas today — bump token, destroy/recreate game).
- Delete nothing yet — wait for Task 15 for the mass delete.

**Important:**
- Strict-mode double-mount: `Phaser.Game.destroy(true)` is synchronous; React cleanup → destroy → new effect → new game should work. If StrictMode double-creates two games in dev, disable StrictMode for the `<GameScreen>` subtree (a wrapper that doesn't render `<StrictMode>`).
- HMR: mark `GameScreen.tsx` with `// @vite-ignore` or accept that HMR reloads the whole game. Current canvas build has the same constraint; no regression.
- Tab-key moves-panel logic stays in React (it's a React modal).

**Done when:**
- Menu → start game → Phaser scene loads → play → pause → resume → restart (via overlay) → die → results screen.
- No React state leaks between runs (retry doesn't leave stale input).
- Fullscreen F-key and fullscreen HUD button both work.
- Typecheck green.
- Commit: `feat(screens): GameScreen mounts Phaser, delegates to scenes`

---

### Task 15 — Delete src/rendering/ and src/input/inputManager.ts

**Files:**
- Delete: `src/rendering/**` (entire directory).
- Delete: `src/input/inputManager.ts`.
- Move: `VIRTUAL_WIDTH`, `VIRTUAL_HEIGHT`, `CANVAS_BUFFER_WIDTH`, `CANVAS_BUFFER_HEIGHT`, `RENDER_SCALE`, `DEPTH_SCALE` from `src/rendering/constants.ts` to `src/game/constants.ts`. Update all imports.
- Keep: `src/input/keyBindings.ts` — the key-binding schema + storage is still used by PhaserInputAdapter.

**Important:**
- Grep for every import from `rendering/` after deletion — typecheck will surface anything missed.
- `hitTestHudButton.ts`, `hudButtons.ts`, `particles.ts`, `vfxLoader.ts`, `spriteLoader.ts`, `spriteActorRenderer.ts`, `hud.ts`, `actorRenderer.ts`, `gameRenderer.ts`, `placeholderRenderer.ts` — all delete.
- Double-check: does any React screen import from `rendering/`? `GuildDetails` might for sprite previews. If so, refactor those imports to read from the new pipeline or keep a tiny compat shim — but prefer deletion.

**Done when:**
- `git status` shows large deletion of `src/rendering/`.
- `npm run dev` still plays.
- `npm run build` green.
- `npm run typecheck` green (zero dangling imports).
- `npm run lint` no new errors.
- Commit: `refactor(render): delete src/rendering/ and inputManager.ts; Phaser replaces both`

---

### Task 16 — Feature-parity audit + docs

**Files:**
- Modify: `CLAUDE.md` — rewrite Architecture section. New structure:
  ```
  input/ (keyBindings only) ──►  simulation/  ◄── (read-only) ──  game/ (Phaser)
                                        ▲
  audio/  ──────────────────────────────┘ (reads vfxEvents + phase transitions)
  ```
  Update Game loop section — rAF loop lives in Phaser now, not React. React owns Phaser mount + overlays only.
  Update Coordinate system bullet — `DEPTH_SCALE` moved to `src/game/constants.ts`.
  Delete any reference to `rendering/`.
- Modify: `AGENTS.md` — same updates (it's parallel to CLAUDE.md for codex sessions).
- Add: a short "Phaser conventions" section to CLAUDE.md: scene boundaries, no simulation in scene code, animation key format, depth sort convention.

**Feature-parity checklist** (tick each on main build vs. Phase 2 build):

- [ ] Title screen → character select → game mounts without error
- [ ] Player sprite animates (idle/walk/run/attack/hurt/death for knight, vampire, leper)
- [ ] Enemies placeholder-render (sprites not yet)
- [ ] Projectiles fly and destroy on contact
- [ ] Pickups visible, collectable
- [ ] HP/MP bars update
- [ ] Guild-specific resources (chi orbs, sanity, bloodtally, dishes, shapeshift) update
- [ ] Score text updates
- [ ] Wave indicator updates
- [ ] Boss bar appears when boss spawns
- [ ] Combo hints render
- [ ] Controls hint visible out of fullscreen; hidden in fullscreen
- [ ] Damage numbers float up and fade
- [ ] Hit sparks on attack
- [ ] Blink trail on teleport abilities
- [ ] AoE pop on explosions
- [ ] Channel ring during channeled abilities
- [ ] Parallax background
- [ ] Camera follows `state.cameraX`
- [ ] Pause via P key
- [ ] Pause via HUD button
- [ ] Pause overlay (React) shows on top
- [ ] Moves panel via Tab
- [ ] Fullscreen via F key
- [ ] Fullscreen via HUD button
- [ ] Fullscreen exit auto-pause
- [ ] Victory sound + transition
- [ ] Defeat sound + transition
- [ ] Quit button
- [ ] Restart flow (die → retry → no stale input)
- [ ] Boss music transition
- [ ] Stage music on mount
- [ ] Golden-state test still passes (simulation untouched)

**Done when:**
- All checklist items ticked on Phaser build.
- `CLAUDE.md` + `AGENTS.md` updated.
- Commit: `docs: update CLAUDE.md + AGENTS.md for Phaser-based rendering`

---

### Task 17 — Final verification + merge prep

**Files:**
- Run full verification stack:
  - `npm run typecheck` → 0 errors
  - `npm run lint` → no new errors in `src/game/**`
  - `npm test` → 5/5 (simulation tests untouched)
  - `npm run build` → succeeds, bundle size checked
- Merge main into this branch to pick up any in-flight screen/asset work. Resolve conflicts (expected in `App.tsx` if routing changed).
- End-to-end smoke test: play a full round on each of knight, vampire, leper; reach boss; die; retry; win.
- Assess bundle size impact — Phaser adds ~700KB gzipped. If that's unacceptable, investigate tree-shaking via `define` flags at Task 1.

**Done when:**
- Verification stack all-green.
- Smoke test passes.
- Final commit: `chore(phase-2): final pass, ready to merge`
- PR description drafted (template below).

---

## PR description template

```
## Phase 2 — Phaser Port

Replaces Canvas 2D rendering with Phaser 3. Simulation untouched — the
layer that became pure in Phase 1 is still pure. Menus still in React.
Only src/screens/GameScreen.tsx changed in the screens layer.

### What's different
- src/rendering/ deleted (~2k LOC Canvas pipeline replaced)
- src/input/inputManager.ts deleted (PhaserInputAdapter replaces it)
- src/game/ new: Phaser scenes, views, input adapter, asset manifest
- Audio dispatch moved from React rAF loop into GameplayScene.update
- Fullscreen-exit pause handled in GameplayScene, not React
- HUD buttons are Phaser interactive objects now; no canvas click math

### What's the same
- SimState + tickSimulation — no diff
- React screens (Title, CharSelect, GuildDetails, Main, Stage, Loading,
  Pause, Results, GameOver) — no diff other than GameScreen
- AudioManager — no diff
- Fullscreen UX, key bindings, combo grammar, guild abilities

### Risks / follow-ups
- Bundle size +~700KB gzipped from Phaser
- Enemy sprites not yet atlased — all placeholder-rendered (Phase 3)
- VFX visual feel is "close enough", not pixel-perfect parity
- Phaser 3 not Phaser 4 (see spec, battle-tested choice)

### Next
Phase 3 — build content on Phaser. Phase 4 — Colyseus.
```

## Spec coverage check

| Spec Phase 2 section | Task(s) |
|---|---|
| New layout (`src/game/`, scenes, views, input) | Tasks 2, 3, 5–11 |
| Scene responsibilities (tickSimulation in update, reconcile, depth sort) | Tasks 3, 6–7 |
| Parallax, camera | Task 5 |
| HUD reimplementation | Tasks 10, 11 |
| vfxEvents → tweens/emitters | Task 8 |
| Audio triggers move into scene | Task 12 |
| Fullscreen-exit listener rewire | Task 13 |
| Sprite pipeline (atlases, AnimationManager, placeholder fallback) | Tasks 6, 9 |
| GameScreen.tsx rewrite | Task 14 |
| Deletion of src/rendering/ and src/input/inputManager.ts | Task 15 |
| Phaser 3 (not 4) | Task 0 baseline (already installed) |
| Vite `optimizeDeps.include` + `define` flags | Task 1 |
| CLAUDE.md update | Task 16 |

## Open questions (resolve at kickoff, not mid-task)

- **metadata.json format vs. Phaser atlas JSON**: the pixellab script outputs a custom format. Task 9 assumes we adapt at runtime. If the format is harder to adapt than expected, write an offline conversion script in `scripts/` instead. Decide after reading `scripts/composite-pixellab-sprites.py` and a sample metadata.json.
- **VFX image pipeline**: `public/vfx/leper/*.png` exists for image-based VFX. The current `src/rendering/vfx/vfxLoader.ts` loads these. In Phase 2 this becomes Phaser texture loading in BootScene. Task 8 handles procedural; task 9 should also handle image VFX (retitle if needed, or add Task 8.5).
- **React StrictMode**: if Phaser's double-mount handling in Strict mode is flaky, the fallback is disabling StrictMode for `<GameScreen>` only. Decide during Task 14.
- **Bundle size**: if 700KB gzipped is too much, we can consider `phaser/dist/phaser-arcade-physics.min.js` (smaller custom build). Don't go this route unless profiling demands it.

## Not in Phase 2

- Colyseus (Phase 4)
- New guilds, new stages, new abilities (Phase 3)
- ECS refactor (explicit non-goal)
- Touch/mobile input (non-goal)
- Client-side prediction (Phase 4 follow-up)
