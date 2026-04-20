# PixelLab Guild Sprites — Leper Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an in-game Leper character rendered with PixelLab-generated pixel-art sprites (15 animations), behind a `localStorage` feature flag, plus a repeatable operator runbook for generating additional guilds later.

**Architecture:** Two parallel workstreams sharing one spritesheet + `metadata.json` contract.
(1) App-side — new `src/rendering/sprite/` subsystem implementing `ActorRendererImpl`, loaded async per guild, swapped into `GameRenderer` behind a flag.
(2) Generation — Claude invokes the `pixellab` MCP tools (`mcp__pixellab__create_character` + `mcp__pixellab__animate_character`) in-session to produce 15 PNGs saved under `public/sprites/leper/`.

**Tech Stack:** TypeScript, Vite, React 19, HTML5 Canvas 2D, PixelLab MCP (https://api.pixellab.ai/mcp/docs). No test runner (per `CLAUDE.md` — verification is `npm run typecheck`, `npm run lint`, and manual in-browser testing).

**Related spec:** `docs/superpowers/specs/2026-04-20-pixellab-guild-sprites-design.md`

---

## File Structure

| Path | Disposition | Responsibility |
|---|---|---|
| `src/rendering/sprite/types.ts` | Create | Type definitions only: `AnimationMetadata`, `SpriteSheet`, `GuildSpriteSet`, `GuildSpriteMetadataFile`. |
| `src/rendering/sprite/animationFallback.ts` | Create | Pure data + resolver: `resolveAnimation(id, available)` returns the first available fallback (or `'idle'`). |
| `src/rendering/sprite/spriteLoader.ts` | Create | Async `loadGuildSpriteSet(guildId)`: fetches metadata JSON, preloads all referenced `HTMLImageElement`s, caches by `guildId`. Returns `null` on failure. |
| `src/rendering/sprite/spriteActorRenderer.ts` | Create | `SpriteActorRenderer` class implementing `ActorRendererImpl`. Draws spritesheet frames with horizontal-flip for `direction === -1`, plus the HP bar (to match `PlaceholderRenderer`'s existing behavior). |
| `src/rendering/gameRenderer.ts` | Modify | Hold a swappable `ActorRendererImpl` instance instead of calling `PlaceholderRenderer` statically. Add `setActorRenderer(impl)`. |
| `src/screens/GameScreen.tsx` | Modify | On mount, if feature flag is ON, async-load the selected guild's sprite set; on resolve, call `setActorRenderer` on the renderer. Game loop starts with placeholder either way (no blocking load). |
| `public/sprites/leper/*.png` | Create (15 files) | One horizontal spritesheet PNG per animation. |
| `public/sprites/leper/metadata.json` | Create | Per-animation frame counts, durations, anchors. |
| `docs/runbooks/generate-guild-sprites.md` | Create | Operator runbook for repeating the generation on any guild. |

**Boundary notes:**
- `sprite/` is a sub-folder of `src/rendering/`. Zero imports from `src/simulation/` except *type-only* (`GuildId`, `AnimationId`). No changes to `src/simulation/`, `src/input/`, or `src/audio/`.
- `spriteActorRenderer.ts` re-implements HP-bar drawing to match `PlaceholderRenderer` line 150-159, because HP bar is currently inside the `ActorRendererImpl` contract, not `GameRenderer`.

---

## Task 1: Sprite type definitions

**Files:**
- Create: `src/rendering/sprite/types.ts`

- [ ] **Step 1: Create the file with all sprite types**

```ts
// src/rendering/sprite/types.ts
import type { AnimationId, GuildId } from '../../simulation/types';

export interface AnimationMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
}

export interface SpriteSheet {
  image: HTMLImageElement;
  meta: AnimationMetadata;
}

export interface GuildSpriteSet {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  sheets: Partial<Record<AnimationId, SpriteSheet>>;
}

/**
 * Shape of `metadata.json` as stored on disk. `animations` is a sparse map —
 * only keys that have PNGs on disk need to appear. Missing keys are handled by
 * `animationFallback.resolveAnimation`.
 */
export interface GuildSpriteMetadataFile {
  guildId: GuildId;
  frameSize: { w: number; h: number };
  facing: 'right' | 'left';
  animations: Partial<Record<AnimationId, AnimationMetadata>>;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (new file references existing `AnimationId`, `GuildId` types; adds no external deps).

- [ ] **Step 3: Commit**

```bash
git add src/rendering/sprite/types.ts
git commit -m "feat(rendering): sprite type definitions"
```

---

## Task 2: Animation fallback resolver

**Files:**
- Create: `src/rendering/sprite/animationFallback.ts`

- [ ] **Step 1: Create the fallback table + resolver**

```ts
// src/rendering/sprite/animationFallback.ts
import type { AnimationId } from '../../simulation/types';

/**
 * For each AnimationId, the preference list the resolver walks when the
 * requested animation has no sheet on disk. `idle` is the universal
 * last-resort — every guild is required to ship at least `idle`.
 */
const FALLBACK: Record<AnimationId, readonly AnimationId[]> = {
  idle:        ['idle'],
  walk:        ['walk', 'idle'],
  run:         ['run', 'walk', 'idle'],
  jump:        ['jump', 'idle'],
  fall:        ['jump', 'idle'],
  land:        ['jump', 'idle'],
  attack_1:    ['attack_1', 'idle'],
  attack_2:    ['attack_2', 'attack_1', 'idle'],
  attack_3:    ['attack_3', 'attack_2', 'attack_1', 'idle'],
  run_attack:  ['attack_1', 'idle'],
  jump_attack: ['attack_1', 'idle'],
  block:       ['block', 'idle'],
  dodge:       ['idle'],
  hurt:        ['hurt', 'idle'],
  knockdown:   ['hurt', 'idle'],
  getup:       ['hurt', 'idle'],
  death:       ['death', 'hurt', 'idle'],
  ability_1:   ['ability_1', 'attack_1', 'idle'],
  ability_2:   ['ability_2', 'attack_2', 'attack_1', 'idle'],
  ability_3:   ['ability_3', 'attack_3', 'attack_1', 'idle'],
  ability_4:   ['ability_4', 'attack_1', 'idle'],
  ability_5:   ['ability_5', 'attack_1', 'idle'],
  channel:     ['ability_5', 'idle'],
  grab:        ['ability_3', 'attack_1', 'idle'],
  throw:       ['attack_3', 'attack_1', 'idle'],
  pickup:      ['idle'],
};

/**
 * Returns the first AnimationId from the fallback list that is present in
 * `available`, or `'idle'` if none match. Caller must guarantee that `idle`
 * is in `available` for any loaded sprite set.
 */
export function resolveAnimation(
  requested: AnimationId,
  available: Partial<Record<AnimationId, unknown>>,
): AnimationId {
  const chain = FALLBACK[requested] ?? ['idle'];
  for (const id of chain) {
    if (available[id] !== undefined) return id;
  }
  return 'idle';
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS. (If TypeScript complains that not every `AnimationId` key is present in `FALLBACK`, the exhaustive `Record<AnimationId, ...>` will catch it — ensures we update the table when new `AnimationId`s are added.)

- [ ] **Step 3: Commit**

```bash
git add src/rendering/sprite/animationFallback.ts
git commit -m "feat(rendering): animation fallback resolver"
```

---

## Task 3: Make GameRenderer accept a swappable actor renderer

**Files:**
- Modify: `src/rendering/gameRenderer.ts:21-27` (constructor), `src/rendering/gameRenderer.ts:207-211` (call site)

- [ ] **Step 1: Replace static `PlaceholderRenderer` call with an instance field**

Edit `src/rendering/gameRenderer.ts`. Change the class header + constructor block from:

```ts
export class GameRenderer {
  private particles: ParticleSystem;
  private frameCount: number = 0;

  constructor() {
    this.particles = new ParticleSystem();
  }
```

to:

```ts
import type { ActorRendererImpl } from './actorRenderer';

export class GameRenderer {
  private particles: ParticleSystem;
  private frameCount: number = 0;
  private actorRenderer: ActorRendererImpl;

  constructor(actorRenderer: ActorRendererImpl = PlaceholderRenderer) {
    this.particles = new ParticleSystem();
    this.actorRenderer = actorRenderer;
  }

  setActorRenderer(impl: ActorRendererImpl): void {
    this.actorRenderer = impl;
  }
```

Note: `PlaceholderRenderer` is already imported at line 4. The new `ActorRendererImpl` type import can go alongside the existing `ActorRenderHandle` import at line 5 — merge into `import type { ActorRendererImpl, ActorRenderHandle } from './actorRenderer';`.

- [ ] **Step 2: Update the call site (line ~207) to use the instance**

Change:

```ts
PlaceholderRenderer.renderActor(
  ctx, handle, color, initial,
  screenX, screenY, actor.width, actor.height,
  actor.isAlive, actor.hp, actor.hpMax,
);
```

to:

```ts
this.actorRenderer.renderActor(
  ctx, handle, color, initial,
  screenX, screenY, actor.width, actor.height,
  actor.isAlive, actor.hp, actor.hpMax,
);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS. The default-parameter makes all existing callers (`new GameRenderer()`) continue to work.

- [ ] **Step 4: Verify placeholder rendering is unchanged in browser**

Run: `npm run dev`. Open http://localhost:5173. Start a game (any guild). Verify that actors still render as colored rectangles with letters (no visual change). This proves Task 3 introduced no regression before we add any sprite code.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/gameRenderer.ts
git commit -m "feat(rendering): swappable ActorRendererImpl on GameRenderer"
```

---

## Task 4: Sprite loader

**Files:**
- Create: `src/rendering/sprite/spriteLoader.ts`

- [ ] **Step 1: Create the loader with caching + parallel image preload**

```ts
// src/rendering/sprite/spriteLoader.ts
import type { AnimationId, GuildId } from '../../simulation/types';
import type {
  GuildSpriteSet,
  GuildSpriteMetadataFile,
  SpriteSheet,
} from './types';

const cache = new Map<GuildId, GuildSpriteSet>();

/**
 * Fetches `/sprites/<guildId>/metadata.json`, then parallel-loads each referenced
 * PNG via `new Image()`. Resolves once all images have fired `onload`.
 *
 * On any failure (missing JSON, parse error, any image fails to load) returns
 * `null` and logs. Caller is expected to fall back to the placeholder renderer.
 *
 * Results are cached by `guildId` so switching guilds and coming back is free.
 */
export async function loadGuildSpriteSet(
  guildId: GuildId,
): Promise<GuildSpriteSet | null> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const metaUrl = `/sprites/${guildId}/metadata.json`;

  let meta: GuildSpriteMetadataFile;
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) {
      console.warn(`[spriteLoader] ${metaUrl} -> ${res.status}; falling back to placeholder`);
      return null;
    }
    meta = (await res.json()) as GuildSpriteMetadataFile;
  } catch (err) {
    console.warn(`[spriteLoader] failed to fetch metadata for ${guildId}:`, err);
    return null;
  }

  const animationEntries = Object.entries(meta.animations) as [
    AnimationId,
    GuildSpriteMetadataFile['animations'][AnimationId],
  ][];

  const sheets: Partial<Record<AnimationId, SpriteSheet>> = {};

  try {
    await Promise.all(
      animationEntries.map(async ([animId, animMeta]) => {
        if (!animMeta) return;
        const img = await loadImage(`/sprites/${guildId}/${animId}.png`);
        sheets[animId] = { image: img, meta: animMeta };
      }),
    );
  } catch (err) {
    console.warn(`[spriteLoader] failed to load PNGs for ${guildId}:`, err);
    return null;
  }

  if (!sheets.idle) {
    console.warn(`[spriteLoader] ${guildId} is missing required 'idle' animation; falling back to placeholder`);
    return null;
  }

  const set: GuildSpriteSet = {
    guildId,
    frameSize: meta.frameSize,
    facing: meta.facing,
    sheets,
  };
  cache.set(guildId, set);
  return set;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${url}`));
    img.src = url;
  });
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/rendering/sprite/spriteLoader.ts
git commit -m "feat(rendering): async sprite-set loader with cache"
```

---

## Task 5: SpriteActorRenderer

**Files:**
- Create: `src/rendering/sprite/spriteActorRenderer.ts`

**Reference:** `src/rendering/placeholderRenderer.ts:150-159` shows the HP-bar draw code this renderer must reproduce. `src/rendering/actorRenderer.ts` defines the `ActorRendererImpl` interface contract.

- [ ] **Step 1: Create the sprite actor renderer**

```ts
// src/rendering/sprite/spriteActorRenderer.ts
import type { ActorRendererImpl, ActorRenderHandle } from '../actorRenderer';
import type { GuildSpriteSet } from './types';
import { resolveAnimation } from './animationFallback';

/**
 * Draws actors from a preloaded `GuildSpriteSet`. Handles:
 *  - frame selection (looping vs clamped non-loop)
 *  - horizontal flip when direction === -1
 *  - HP bar (matches PlaceholderRenderer behavior)
 *  - dead-actor prone draw (matches PlaceholderRenderer behavior)
 */
export class SpriteActorRenderer implements ActorRendererImpl {
  private set: GuildSpriteSet;
  private lastHandleFrame = new WeakMap<object, number>();

  constructor(set: GuildSpriteSet) {
    this.set = set;
  }

  renderActor(
    ctx: CanvasRenderingContext2D,
    handle: ActorRenderHandle,
    color: string,
    _initial: string,
    screenX: number,
    screenY: number,
    width: number,
    _height: number,
    isAlive: boolean,
    hp: number,
    hpMax: number,
  ): void {
    if (!isAlive) {
      // Prone-body slab, matches PlaceholderRenderer behavior
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = color;
      ctx.fillRect(screenX - width / 2, screenY - _height * 0.2, width, _height * 0.2);
      ctx.restore();
      return;
    }

    const resolvedId = resolveAnimation(handle.animationId, this.set.sheets);
    const sheet = this.set.sheets[resolvedId];
    if (!sheet) {
      // Contract violation (idle missing). Draw a visible error marker.
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(screenX - 16, screenY - 32, 32, 32);
      return;
    }

    const { frames, loop } = sheet.meta;
    const frameIdx = loop
      ? handle.frameIndex % frames
      : Math.min(handle.frameIndex, frames - 1);

    const { w: fw, h: fh } = this.set.frameSize;
    const { x: ax, y: ay } = sheet.meta.anchor;

    ctx.save();
    if (handle.direction === -1) {
      // Flip around the pivot column by translating to screenX and scaling.
      ctx.translate(screenX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-screenX, 0);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sheet.image,
      frameIdx * fw, 0, fw, fh,
      screenX - ax, screenY - ay, fw, fh,
    );
    ctx.restore();

    if (hp < hpMax) {
      const barW = width;
      const barH = 4;
      const barX = screenX - barW / 2;
      const barY = screenY - ay - 10;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barW * (hp / hpMax), barH);
    }
  }
}
```

Note: the `_initial` and `_height` parameters are intentionally prefixed with `_` because the interface supplies them but sprites don't need them (sprite pixels already include the visual, and height is encoded in `frameSize.h`). This prefix satisfies `noUnusedParameters` in `tsconfig.app.json`.

Note: `lastHandleFrame` is declared for future use (per-actor frame time tracking) but not read — remove it if typecheck flags it as unused.

- [ ] **Step 2: Remove `lastHandleFrame` if TS flags it**

If `npm run typecheck` complains about unused `lastHandleFrame`, delete these two lines from the class:

```ts
private lastHandleFrame = new WeakMap<object, number>();
```

(It was speculative. We use `handle.frameIndex` directly — no per-actor state needed in the renderer for now.)

- [ ] **Step 3: Verify typecheck + lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/rendering/sprite/spriteActorRenderer.ts
git commit -m "feat(rendering): SpriteActorRenderer implementing ActorRendererImpl"
```

---

## Task 6: Feature flag + async sprite loading in GameScreen

**Files:**
- Modify: `src/screens/GameScreen.tsx:60-75` (mount useEffect)

- [ ] **Step 1: Add sprite imports at the top of GameScreen.tsx**

Locate the existing import block near line 7 (`import { GameRenderer } from '../rendering/gameRenderer';`). Add below it:

```ts
import { loadGuildSpriteSet } from '../rendering/sprite/spriteLoader';
import { SpriteActorRenderer } from '../rendering/sprite/spriteActorRenderer';
```

- [ ] **Step 2: Define the feature-flag read helper inside the component**

Insert this near the top of the `GameScreen` function body (after the `guildId` destructure, before the first `useEffect`):

```ts
const SPRITE_FLAG_KEY = 'nannymud:sprites';
const shouldUseSprites = (): boolean => {
  try {
    return localStorage.getItem(SPRITE_FLAG_KEY) === '1';
  } catch {
    return false;
  }
};
```

The `try/catch` handles SSR-like or storage-blocked browsers — though this app only runs client-side, it costs nothing.

- [ ] **Step 3: Add the async-load effect to the main mount `useEffect`**

Locate `useEffect(() => { ... }, [guildId])` starting at line 60. Just after line 76 (`audio.startStageMusic();`) and before the `const gameLoop = ...` declaration, insert:

```ts
let cancelled = false;
if (shouldUseSprites()) {
  loadGuildSpriteSet(guildId).then((set) => {
    if (cancelled || !set) return;
    rendererRef.current.setActorRenderer(new SpriteActorRenderer(set));
  });
}
```

Then in the cleanup returned by this `useEffect` (the existing `return () => { ... }` block), add `cancelled = true;` as the first line. If no cleanup exists, add `return () => { cancelled = true; };`.

- [ ] **Step 4: Verify typecheck + lint pass**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Verify placeholder still works (flag off)**

Run: `npm run dev`. In browser devtools console: `localStorage.removeItem('nannymud:sprites')`. Reload. Start a game. Verify actors still render as placeholder rectangles. No console warnings about missing sprites (because the loader is never called when flag is off).

- [ ] **Step 6: Verify feature flag ON works gracefully with no sprites on disk**

In devtools console: `localStorage.setItem('nannymud:sprites', '1')`. Reload. Start a game with Leper (or any guild). Expected behavior:
- Console shows a `[spriteLoader]` warning about missing `/sprites/<guild>/metadata.json` (404).
- Game continues running with placeholder rendering. No errors thrown.

- [ ] **Step 7: Commit**

```bash
git add src/screens/GameScreen.tsx
git commit -m "feat(rendering): feature-flagged async sprite loading per guild"
```

---

## Task 7: Operator runbook

**Files:**
- Create: `docs/runbooks/generate-guild-sprites.md`

- [ ] **Step 1: Write the runbook**

```markdown
# Runbook — Generate Guild Sprite Sheets via PixelLab MCP

**Purpose:** Step-by-step procedure to generate a new guild's 15-animation sprite sheet. Follow this whenever you need to add (or regenerate) sprites for any of the 15 guilds defined in `lore-old/guilds.json`.

**Prerequisites:**
- Active PixelLab subscription (MCP tools return credit errors otherwise).
- `pixellab` MCP server connected to this Claude session.
- Access to `lore-old/guilds.json` and `oneshot.md` §5 for guild flavor text.

## Inputs per run

- `guildId` (e.g. `leper`) — matches the id in `lore-old/guilds.json`.
- Guild entry from `lore-old/guilds.json` — supplies `colorPalette`, `archetype`, `fantasy`, `loreSummary`.
- Guild entry from `oneshot.md` §5.x — supplies the 5 ability names and effects.

## Output layout (contract)

Everything this runbook produces lives under:

```
public/sprites/<guildId>/
├── idle.png, walk.png, run.png, jump.png
├── attack_1.png, attack_2.png, attack_3.png
├── ability_1.png, ability_2.png, ability_3.png, ability_4.png, ability_5.png
├── block.png
├── hurt.png
├── death.png
└── metadata.json
```

Each PNG is a horizontal strip of 64×64 frames. `metadata.json` schema is documented in `docs/superpowers/specs/2026-04-20-pixellab-guild-sprites-design.md` §Sprite contract.

## Step 1 — Base character prompt

Fill this template using the guild's data:

> **"{ARCHETYPE-DESCRIPTOR} {ROLE}, {FANTASY-CUES}, {PALETTE-CUES}, pixel art, side-view, plain background, 64x64"**

Examples:

| Guild | Filled prompt |
|---|---|
| leper | "diseased plague-bearer bruiser, ragged hooded robe, torn bandages, hunched posture, necrotic green skin patches, no facial features visible, muted olive/brown palette (#6B7F4F #8B5A2B #3F4F2F), pixel art, side-view, plain background, 64x64" |
| knight | "armored frontline knight, plate armor with tabard, sword and kite shield, stoic posture, gold trim on deep blue and white palette (#C9A961 #2B4C6F #F5F5F5), pixel art, side-view, plain background, 64x64" |
| mage  | "robed arcane scholar, tall hood, staff, glowing runes, deep violet robes on pale background (#4A2E75 #8E6DC8 #E8D5FF), pixel art, side-view, plain background, 64x64" |

## Step 2 — Generate base character

Invoke the MCP tool:

```
mcp__pixellab__create_character
  description: <the filled prompt from Step 1>
  size: 64
  view: "side"
```

The tool returns a job ID. Poll until completion. Download the returned PNG and display it in-conversation.

**Retry gate #1:** If the result is off-style, re-run with an adjusted prompt **before** moving on. Each animation call depends on the base character; iterating here saves 15× the credits.

Once happy, save the base character reference somewhere temporary (the MCP may require it as input to the animation calls — consult the tool's argument schema at invocation time).

## Step 3 — Generate 15 animations in parallel

For each row in the per-animation action-prompt table below, invoke:

```
mcp__pixellab__animate_character
  characterId/reference: <from Step 2>
  action: <action-prompt from the table>
  frames: <hint — actual count is whatever PixelLab returns>
```

All 15 calls can be sent in parallel (MCP jobs are non-blocking). Poll each for completion and download the returned spritesheet PNGs.

### Per-animation action-prompt table (universal + per-guild flavor)

Replace `{flavor}` placeholders using `oneshot.md` §5.x for the target guild.

| AnimationId | Action prompt |
|---|---|
| `idle` | "standing still, slight sway/breathing, 4 frames, loop" |
| `walk` | "walking right, 6 frames, loop" |
| `run` | "running right, 6 frames, loop" |
| `jump` | "jump arc: crouch, launch, peak, land, 4 frames, non-loop" |
| `attack_1` | "basic attack: {flavor: primary weapon} swing, 5 frames, non-loop" |
| `attack_2` | "basic attack 2: {flavor: alternate swing or follow-up}, 5 frames, non-loop" |
| `attack_3` | "basic attack 3 (combo finisher): {flavor: heavy strike}, 6 frames, non-loop" |
| `ability_1` | "{flavor: slot-1 ability name + visual cue from oneshot.md §5.x}, 5 frames, non-loop" |
| `ability_2` | "{flavor: slot-2 ability}, 5 frames, non-loop" |
| `ability_3` | "{flavor: slot-3 ability}, 5 frames, non-loop" |
| `ability_4` | "{flavor: slot-4 ability}, 5 frames, non-loop" |
| `ability_5` | "{flavor: slot-5 ability — often a channel / ultimate}, 6 frames, may loop if it's a channel" |
| `block` | "defensive stance, 2 frames, loop" |
| `hurt` | "recoil back, head tilted, 3 frames, non-loop" |
| `death` | "stagger, collapse forward, 6 frames, non-loop" |

### Leper worked example (§5.14 of `oneshot.md`)

| AnimationId | Action prompt |
|---|---|
| `attack_1` | "overhead claw swipe, 5 frames, non-loop" |
| `attack_2` | "backhand slash, 5 frames, non-loop" |
| `attack_3` | "heavy double-fisted smash, 6 frames, non-loop" |
| `ability_1` | "plague vomit: hunches forward, cone of green vomit from mouth, 5 frames, non-loop" |
| `ability_2` | "diseased claw swipe, overhead, 5 frames, non-loop" |
| `ability_3` | "necrotic embrace: arms out, grab/bear-hug forward, 5 frames, non-loop" |
| `ability_4` | "two-handed hex curse gesture, ranged pointing, 5 frames, non-loop" |
| `ability_5` | "rotting tide channel: arms raised, swaying, 6 frames, loop" |

### Known hard cases per guild (character-only scope)

These abilities do **not** generate their full effect in the base-character sheet — the character animation is only the *caster's pose*. The effect entity (pet, summon, alt-form) is a separate actor kind and out of scope for the guild's base sheet:

| Guild | Skip-the-entity note |
|---|---|
| druid (§5.4.1) | RMB Shapeshift — bear and wolf forms are separate actor-kind sheets. Base druid sheet renders the *caster in human form only.* |
| hunter (§5.5) | RMB Pet Command — the wolf pet is actor kind `wolf_pet`, separate sheet. Base hunter `ability_RMB` can reuse `idle` or a whistle gesture. |
| cultist (§5.10) | Summons drowned-spawn tentacles — separate actor kind. |
| leper (§5.14) | Rotting Tide revives enemies as rotting husks — separate actor kind. |
| master (§5.15) | Prestige class; defer entirely. |

Some RMB utilities have no visually distinct caster pose (e.g. Chef's Pocket Dish, Hunter's Pet Command). For those, skip RMB in the sheet — the runtime renderer falls back to `idle`.

## Step 4 — Place files + author metadata

Save each returned PNG to `public/sprites/<guildId>/<animation>.png`.

Author `public/sprites/<guildId>/metadata.json` by hand. Use this template:

```json
{
  "guildId": "<guildId>",
  "frameSize": { "w": 64, "h": 64 },
  "facing": "right",
  "animations": {
    "idle":     { "frames": <N>, "frameDurationMs": 180, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "walk":     { "frames": <N>, "frameDurationMs": 120, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "run":      { "frames": <N>, "frameDurationMs": 90,  "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "jump":     { "frames": <N>, "frameDurationMs": 120, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_1": { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_2": { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_3": { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_1": { "frames": <N>, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_2": { "frames": <N>, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_3": { "frames": <N>, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_4": { "frames": <N>, "frameDurationMs": 90, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_5": { "frames": <N>, "frameDurationMs": 150, "loop": true, "anchor": { "x": 32, "y": 56 } },
    "block":    { "frames": <N>, "frameDurationMs": 200, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "hurt":     { "frames": <N>, "frameDurationMs": 100, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "death":    { "frames": <N>, "frameDurationMs": 150, "loop": false, "anchor": { "x": 32, "y": 56 } }
  }
}
```

Replace each `<N>` with the actual frame count from the returned PNG (divide image width by 64). Durations are the defaults from the design doc — tune later after in-game evaluation.

Rules:
- `idle` is mandatory. If it failed to generate, retry before shipping.
- Any animation you skip (e.g. `ability_4` where the guild has no visually distinct pose) is simply omitted. The runtime falls back per `src/rendering/sprite/animationFallback.ts`.

## Step 5 — In-game evaluation

1. `npm run dev`
2. Browser devtools: `localStorage.setItem('nannymud:sprites', '1')`, reload.
3. Select the guild, play a wave. Check:
   - Looping animations (idle, walk, run, block) cycle smoothly.
   - Non-looping animations (attack, ability, hurt, death) play once and hold.
   - Horizontal flip tracks the character facing.
   - HP bar appears above the sprite.

**Retry gate #2:** any animation looks wrong → re-run *just that row* of Step 3 and overwrite the PNG. Don't regenerate the whole sheet.

## Step 6 — Commit

```bash
git add public/sprites/<guildId>/
git commit -m "feat(assets): PixelLab sprite sheet for <guildId>"
```
```

- [ ] **Step 2: Commit the runbook**

```bash
git add docs/runbooks/generate-guild-sprites.md
git commit -m "docs(runbook): guild sprite generation procedure"
```

---

## Task 8: Generate Leper base character (MCP call, pilot)

**Files:** none (generation output held in-session until Task 10 writes files)

**Prerequisite:** Active PixelLab subscription. Verify by checking that `mcp__pixellab__list_characters` returns without an auth error.

- [ ] **Step 1: Invoke `mcp__pixellab__create_character`**

Call with:
- `description`: `"diseased plague-bearer bruiser, ragged hooded robe, torn bandages, hunched posture, necrotic green skin patches, no facial features visible, muted olive/brown palette (#6B7F4F #8B5A2B #3F4F2F), pixel art, side-view, plain background, 64x64"`
- `size`: `64` (if the tool accepts; consult tool schema at invocation)

Poll until the job completes.

- [ ] **Step 2: Display the returned base character**

Download the returned image and display it inline so the operator (human user) can approve or request a re-prompt.

- [ ] **Step 3: Retry-or-continue decision**

If the operator says the base character is off-style, re-run Step 1 with an adjusted prompt (emphasize the problem cue — e.g. if palette is wrong: lead with the hex codes; if posture is wrong: emphasize "hunched").

Do **not** proceed to Task 9 until the operator approves the base character. Each animation call depends on this reference.

- [ ] **Step 4: Note the character ID/reference returned by the tool**

Store the `characterId` (or whatever identifier the tool returned) for use in Task 9. No file commit at this step — the PNGs land in Task 10.

---

## Task 9: Generate 15 Leper animations (parallel MCP calls)

**Files:** none (generation output held in-session until Task 10 writes files)

- [ ] **Step 1: Build the 15 `animate_character` calls**

Using the base character ID from Task 8, build one call per row in this table. All 15 calls should be dispatched in parallel in a single tool-use message.

| # | AnimationId | Action prompt |
|---|---|---|
| 1 | `idle` | standing still, slight sway/breathing, 4 frames, loop |
| 2 | `walk` | walking right, 6 frames, loop |
| 3 | `run` | running right, 6 frames, loop |
| 4 | `jump` | jump arc: crouch, launch, peak, land, 4 frames, non-loop |
| 5 | `attack_1` | overhead claw swipe, 5 frames, non-loop |
| 6 | `attack_2` | backhand slash, 5 frames, non-loop |
| 7 | `attack_3` | heavy double-fisted smash, 6 frames, non-loop |
| 8 | `ability_1` | plague vomit: hunches forward, cone of green vomit from mouth, 5 frames, non-loop |
| 9 | `ability_2` | diseased claw swipe, overhead, 5 frames, non-loop |
| 10 | `ability_3` | necrotic embrace: arms out, grab/bear-hug forward, 5 frames, non-loop |
| 11 | `ability_4` | two-handed hex curse gesture, ranged pointing, 5 frames, non-loop |
| 12 | `ability_5` | rotting tide channel: arms raised, swaying, 6 frames, loop |
| 13 | `block` | defensive crouch, arms crossed, 2 frames, loop |
| 14 | `hurt` | recoil back, head tilted, 3 frames, non-loop |
| 15 | `death` | stagger, collapse forward, 6 frames, non-loop |

- [ ] **Step 2: Dispatch all 15 calls in parallel**

Invoke `mcp__pixellab__animate_character` × 15 in a single message. Each tool call uses the base character from Task 8 + the action prompt from the table.

- [ ] **Step 3: Poll all jobs to completion**

Some may finish faster than others. Collect all 15 returned spritesheets.

- [ ] **Step 4: Flag any individual failures for retry**

For any animation that is (a) off-style, (b) wrong frame count, or (c) failed to generate: list it and re-invoke `mcp__pixellab__animate_character` for just that one row with a refined prompt. Repeat until every row is acceptable.

- [ ] **Step 5: Hold all 15 PNGs in memory for Task 10**

No commits at this step. Continue to Task 10.

---

## Task 10: Write Leper sprites + metadata to disk

**Files:**
- Create: `public/sprites/leper/idle.png`, `walk.png`, `run.png`, `jump.png`, `attack_1.png`, `attack_2.png`, `attack_3.png`, `ability_1.png`, `ability_2.png`, `ability_3.png`, `ability_4.png`, `ability_5.png`, `block.png`, `hurt.png`, `death.png`
- Create: `public/sprites/leper/metadata.json`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p public/sprites/leper
```

- [ ] **Step 2: Save each PNG from Task 9 with its AnimationId filename**

For each of the 15 animations from Task 9, save the returned bytes to `public/sprites/leper/<animationId>.png`. Filenames exactly match the `AnimationId` string: `idle.png`, `walk.png`, ..., `death.png`.

- [ ] **Step 3: Record frame counts**

For each saved PNG, compute `frames = imageWidth / 64`. Record the value. Example table (fill in actual numbers from the generated images):

| AnimationId | Image width (px) | Frames |
|---|---|---|
| idle | (fill) | (fill) |
| walk | (fill) | (fill) |
| ... | ... | ... |

- [ ] **Step 4: Write `metadata.json`**

Write the file at `public/sprites/leper/metadata.json`. Template (replace the `<N>` frame counts with the values from Step 3; tune durations only if the defaults look wrong in Task 11):

```json
{
  "guildId": "leper",
  "frameSize": { "w": 64, "h": 64 },
  "facing": "right",
  "animations": {
    "idle":      { "frames": <N>, "frameDurationMs": 180, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "walk":      { "frames": <N>, "frameDurationMs": 120, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "run":       { "frames": <N>, "frameDurationMs": 90,  "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "jump":      { "frames": <N>, "frameDurationMs": 120, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_1":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_2":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "attack_3":  { "frames": <N>, "frameDurationMs": 80,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_1": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_2": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_3": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_4": { "frames": <N>, "frameDurationMs": 90,  "loop": false, "anchor": { "x": 32, "y": 56 } },
    "ability_5": { "frames": <N>, "frameDurationMs": 150, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "block":     { "frames": <N>, "frameDurationMs": 200, "loop": true,  "anchor": { "x": 32, "y": 56 } },
    "hurt":      { "frames": <N>, "frameDurationMs": 100, "loop": false, "anchor": { "x": 32, "y": 56 } },
    "death":     { "frames": <N>, "frameDurationMs": 150, "loop": false, "anchor": { "x": 32, "y": 56 } }
  }
}
```

- [ ] **Step 5: Commit PNGs + metadata**

```bash
git add public/sprites/leper/
git commit -m "feat(assets): PixelLab sprite sheet for Leper (pilot)"
```

---

## Task 11: End-to-end in-browser verification

**Files:** none (verification only — no code changes)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open http://localhost:5173.

- [ ] **Step 2: Enable the sprite flag**

Browser devtools console:

```js
localStorage.setItem('nannymud:sprites', '1')
```

Reload the page.

- [ ] **Step 3: Select Leper and start a game**

On the guild-select screen, pick Leper. Watch the browser devtools console during the transition — expect a brief network flurry fetching `/sprites/leper/metadata.json` and 15 PNGs, no warnings about missing files.

- [ ] **Step 4: Verify each animation state**

Play a wave and observe:
- **Idle:** when not moving, Leper loops through the `idle` spritesheet (looks like breathing, not frozen on frame 0).
- **Walk / run:** hold arrow key, Leper cycles through `walk`; double-tap for `run` (different, faster cycle).
- **Jump:** Space → jump animation plays; at peak, holds final frame until landing.
- **Attack chain:** J → attack_1 plays once; J again within window → attack_2; J again → attack_3.
- **Abilities:** execute each combo (`↓↓J` = Plague Vomit → ability_1, etc.). All five should visually differ from basic attacks and from each other.
- **Block:** K → `block` animation, 2-frame loop.
- **Hurt:** take a hit, `hurt` plays briefly.
- **Death:** die, `death` plays through to the final frame and holds.
- **Flip:** change direction (arrow right → left); sprite mirrors horizontally.

- [ ] **Step 5: Verify fallback behavior**

Press a key that would trigger `dodge` or `channel` (if bindings exist). Those animations aren't in the sheet — verify the renderer falls back without throwing (check console). Sprite should visibly fall through to `idle`, `ability_5`, or `attack_1` depending on the fallback table.

- [ ] **Step 6: Run typecheck and lint one more time**

```bash
npm run typecheck
npm run lint
```

Both must pass.

- [ ] **Step 7: Toggle the flag off and verify no regression**

```js
localStorage.removeItem('nannymud:sprites')
```

Reload. Start a game with any guild. Actors render as placeholder rectangles (no sprite loading, no warnings). This confirms the flag cleanly gates the entire feature.

- [ ] **Step 8: User evaluation gate**

Present the running game to the user. They decide:
- **Scale-up:** open a follow-up plan to generate the other 14 guilds.
- **Re-prompt:** list which animations need regeneration; loop back to Task 9 for those rows.
- **Abandon:** disable the flag by default, keep the renderer code (reusable for future attempts), stop spending credits.

Whatever they decide is the terminus of this plan.

---

## Self-Review Checklist (completed by plan author)

### Spec coverage
- [x] §Decisions — every locked decision has a corresponding task (guild scope → runbook generalizes; animation set → Task 9; pilot guild → Tasks 8–10; sprite spec → Task 10 metadata; effects exclusion → no VFX tasks; pipeline → Tasks 8–10 use MCP).
- [x] §Animation set — Task 9 table covers all 15; Task 2 fallback table handles missing ones.
- [x] §Sprite contract — Task 1 types mirror it; Task 10 writes a file matching the schema.
- [x] §Overall architecture — Tasks 1–6 land Workstream 2 (integration); Tasks 8–10 land Workstream 1 (generation).
- [x] §Generation workflow — Tasks 7–10 execute it; runbook captures it for reuse.
- [x] §App-side integration — Tasks 1–6 create the four new files + modify `gameRenderer.ts` and `GameScreen.tsx` exactly as specified.
- [x] §Deliverables — all 8 deliverables have a task that produces them.
- [x] §Acceptance — Task 11 validates each acceptance criterion.
- [x] §Non-goals — not breached by any task.

### Placeholder scan
- [x] No "TBD" / "TODO" in the plan.
- [x] No "add error handling" hand-waves — specific behavior (warn + return `null`) is coded in Task 4.
- [x] Every code step shows complete code.
- [x] `<N>` in the metadata template is a deliberate placeholder filled from measured image widths at Task 10 Step 3 — documented inline.

### Type consistency
- [x] `ActorRendererImpl`, `ActorRenderHandle` — single source in `src/rendering/actorRenderer.ts`, imported in Task 3 and Task 5.
- [x] `GuildSpriteSet`, `AnimationMetadata`, `SpriteSheet` — defined in Task 1, used consistently in Tasks 4 and 5.
- [x] `GuildId`, `AnimationId` — imported type-only from `src/simulation/types.ts` in Tasks 1, 2, 4.
- [x] `resolveAnimation` signature — `(requested, available) → AnimationId` — consistent between Task 2 (definition) and Task 5 (call).
- [x] `loadGuildSpriteSet(guildId) → Promise<GuildSpriteSet | null>` — consistent between Task 4 (definition) and Task 6 (call).
- [x] Feature flag key `'nannymud:sprites'` — same string in Task 6 (GameScreen) and Task 11 (verification).
