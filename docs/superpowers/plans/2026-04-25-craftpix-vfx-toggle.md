# Craftpix VFX Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Composite Craftpix slash and explosion sprite sequences into the existing VFX pipeline and add a Settings toggle to compare them against the current procedural VFX.

**Architecture:** A new `EffectsRegistry.ts` (generic, non-guild VFX) mirrors `VfxRegistry.ts` and loads from `public/vfx/effects/`. `consumeVfxEvents` reads a localStorage flag (`readUseNewVfx`) and branches `hit_spark` → random slash sprite and `aoe_pop` → random explosion sprite when enabled; old procedural code is the false branch. A Python script composites the individual Craftpix frames into horizontal strips first.

**Tech Stack:** Python + Pillow (compositing), Phaser 3 spritesheets, React localStorage settings, TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `scripts/composite-craftpix-vfx.py` | Reads Craftpix frame sequences, composites strips, writes `public/vfx/effects/` |
| Generate | `public/vfx/effects/*.png` + `metadata.json` | Runtime assets (run script) |
| Create | `src/game/view/EffectsRegistry.ts` | Load/register/spawn generic effect sprites |
| Modify | `src/game/scenes/BootScene.ts` | Queue + register effects VFX alongside guild VFX |
| Modify | `src/state/useDevSettings.ts` | Add `useNewVfx` field + `readUseNewVfx()` |
| Modify | `src/screens/SettingsScreen.tsx` | Add toggle under VIDEO section |
| Modify | `src/game/view/ParticleFX.ts` | Branch `hit_spark` and `aoe_pop` to sprite VFX |

---

## Task 1: Python compositing script

**Files:**
- Create: `scripts/composite-craftpix-vfx.py`

### Context

Slash pack: `public/craftpix/craftpix-net-825597-free-slash-effects-sprite-pack/slash{N}/png/`
- All 10 variants have a `png/` subdirectory with zero-padded filenames (sort alphabetically = correct order)
- Frame counts: 6–12 per variant; frame sizes: mostly 1280×720, slash5=568×395, slash10=662×506

Explosion pack: `public/craftpix/craftpix-net-840730-free-animated-explosion-sprite-pack/PNG/Explosion_{N}/`
- Variants 1,2,3,5,6,8,9,10 have PNG files; variants 4 and 7 are empty — skip them
- Frame names like `Explosion_1.png … Explosion_10.png` — must sort numerically (alphabetical puts 10 before 2)
- Frame sizes: 520–800px square (vary per variant), 10 frames each

Output: `public/vfx/effects/{slash_1..slash_10, explosion_1..explosion_10 (8 valid)}.png` + `metadata.json`.

Scale targets: slash → 200px visible width (`200 / frameW`); explosion → 250px visible width (`250 / frameW`).
Frame durations: slash 35ms/frame; explosion 60ms/frame.
Anchor: center of frame for both (`frameW // 2, frameH // 2`).

- [ ] **Step 1: Write the script**

```python
"""Composite Craftpix VFX frame sequences into horizontal strip PNGs.

Slash variants (slash, slash2..slash10) read from:
  public/craftpix/craftpix-net-825597-free-slash-effects-sprite-pack/<variant>/png/

Explosion variants (Explosion_1..Explosion_10, skipping empty 4 and 7) read from:
  public/craftpix/craftpix-net-840730-free-animated-explosion-sprite-pack/PNG/Explosion_<N>/

Outputs public/vfx/effects/<key>.png strips + metadata.json compatible with EffectsRegistry.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SLASH_SRC = REPO_ROOT / "public/craftpix/craftpix-net-825597-free-slash-effects-sprite-pack"
EXPLOSION_SRC = REPO_ROOT / "public/craftpix/craftpix-net-840730-free-animated-explosion-sprite-pack/PNG"
OUT_DIR = REPO_ROOT / "public/vfx/effects"

SLASH_FRAME_MS = 35
EXPLOSION_FRAME_MS = 60
SLASH_TARGET_PX = 200.0
EXPLOSION_TARGET_PX = 250.0


def load_frames_sorted(directory: Path, numeric: bool = False) -> list[Path]:
    frames = list(directory.glob("*.png"))
    if numeric:
        frames.sort(key=lambda p: int("".join(filter(str.isdigit, p.stem)) or "0"))
    else:
        frames.sort()
    return frames


def composite_strip(frame_paths: list[Path]) -> tuple[Image.Image, int, int]:
    frames = [Image.open(p).convert("RGBA") for p in frame_paths]
    w, h = frames[0].size
    strip = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        strip.paste(frame, (i * w, 0), frame)
    return strip, w, h


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}

    # --- Slash effects ---
    for i in range(1, 11):
        variant = "slash" if i == 1 else f"slash{i}"
        src = SLASH_SRC / variant / "png"
        if not src.exists():
            print(f"  skip {variant}: no png/ dir", file=sys.stderr)
            continue
        frames = load_frames_sorted(src, numeric=False)
        if not frames:
            print(f"  skip {variant}: empty", file=sys.stderr)
            continue

        strip, fw, fh = composite_strip(frames)
        key = f"slash_{i}"
        out = OUT_DIR / f"{key}.png"
        strip.save(out, format="PNG", optimize=True)
        scale = round(SLASH_TARGET_PX / fw, 3)
        assets[key] = {
            "frames": len(frames),
            "frameDurationMs": SLASH_FRAME_MS,
            "loop": False,
            "anchor": {"x": fw // 2, "y": fh // 2},
            "frameSize": {"w": fw, "h": fh},
            "scale": scale,
        }
        print(f"  {key}: {len(frames)} frames {fw}x{fh}  scale={scale}")

    # --- Explosion effects ---
    for i in range(1, 11):
        src = EXPLOSION_SRC / f"Explosion_{i}"
        if not src.exists():
            continue
        frames = load_frames_sorted(src, numeric=True)
        if not frames:
            print(f"  skip Explosion_{i}: empty", file=sys.stderr)
            continue

        strip, fw, fh = composite_strip(frames)
        key = f"explosion_{i}"
        out = OUT_DIR / f"{key}.png"
        strip.save(out, format="PNG", optimize=True)
        scale = round(EXPLOSION_TARGET_PX / fw, 3)
        assets[key] = {
            "frames": len(frames),
            "frameDurationMs": EXPLOSION_FRAME_MS,
            "loop": False,
            "anchor": {"x": fw // 2, "y": fh // 2},
            "frameSize": {"w": fw, "h": fh},
            "scale": scale,
        }
        print(f"  {key}: {len(frames)} frames {fw}x{fh}  scale={scale}")

    # Dummy top-level frameSize (every asset overrides it individually)
    metadata = {
        "frameSize": {"w": 96, "h": 96},
        "assets": assets,
    }
    meta_path = OUT_DIR / "metadata.json"
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n")
    print(f"\nWrote {len(assets)} effects to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Commit the script**

```bash
git add scripts/composite-craftpix-vfx.py
git commit -m "feat(vfx): add craftpix compositing script for slash+explosion effects"
```

---

## Task 2: Generate assets

**Files:**
- Generate: `public/vfx/effects/*.png` + `public/vfx/effects/metadata.json`

- [ ] **Step 1: Run the script**

```bash
python scripts/composite-craftpix-vfx.py
```

Expected output (18 lines, one per valid effect):
```
  slash_1: 12 frames 1280x720  scale=0.156
  slash_2: 9 frames 1280x720  scale=0.156
  ...
  explosion_1: 10 frames 550x550  scale=0.455
  explosion_2: 10 frames 520x520  scale=0.481
  ...
Wrote 18 effects to .../public/vfx/effects
```

- [ ] **Step 2: Verify output**

```bash
ls public/vfx/effects/
# Should list: slash_1.png..slash_10.png, explosion_1..explosion_10 (8 valid), metadata.json
python -c "import json; m=json.load(open('public/vfx/effects/metadata.json')); print(list(m['assets'].keys()))"
# Should list all asset keys
```

- [ ] **Step 3: Commit assets**

```bash
git add public/vfx/effects/
git commit -m "feat(vfx): generate craftpix slash+explosion composited strips"
```

---

## Task 3: EffectsRegistry.ts

**Files:**
- Create: `src/game/view/EffectsRegistry.ts`

### Context

This mirrors `VfxRegistry.ts` exactly but loads a single shared `metadata.json` (no per-guild split). The `spawnEffectVfx` function is the one `ParticleFX.ts` will call.

`GuildVfxAssetMetadata` shape (from VfxRegistry):
```ts
interface GuildVfxAssetMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  frameSize?: { w: number; h: number };
  scale: number;
}
```

- [ ] **Step 1: Create EffectsRegistry.ts**

```typescript
import Phaser from 'phaser';

interface EffectAssetMetadata {
  frames: number;
  frameDurationMs: number;
  loop: boolean;
  anchor: { x: number; y: number };
  frameSize: { w: number; h: number };
  scale: number;
}

interface EffectsMetadata {
  frameSize: { w: number; h: number };
  assets: Record<string, EffectAssetMetadata>;
}

const META_KEY = 'meta:effects';
let loadedMeta: EffectsMetadata | null = null;

function texKey(assetKey: string): string {
  return `tex:effects:${assetKey}`;
}

function animKey(assetKey: string): string {
  return `anim:effects:${assetKey}`;
}

export function queueEffectsVfx(scene: Phaser.Scene): void {
  scene.load.json(META_KEY, 'vfx/effects/metadata.json');
  scene.load.on(`filecomplete-json-${META_KEY}`, () => {
    const meta = scene.cache.json.get(META_KEY) as EffectsMetadata | undefined;
    if (!meta) return;
    loadedMeta = meta;
    for (const [key, asset] of Object.entries(meta.assets)) {
      const fs = asset.frameSize ?? meta.frameSize;
      scene.load.spritesheet(texKey(key), `vfx/effects/${key}.png`, {
        frameWidth: fs.w,
        frameHeight: fs.h,
      });
    }
  });
}

export function registerEffectsVfx(scene: Phaser.Scene): void {
  if (!loadedMeta) return;
  for (const [key, asset] of Object.entries(loadedMeta.assets)) {
    const ak = animKey(key);
    if (scene.anims.exists(ak)) continue;
    const tk = texKey(key);
    if (!scene.textures.exists(tk)) continue;
    const frameRate = 1000 / Math.max(1, asset.frameDurationMs);
    scene.anims.create({
      key: ak,
      frames: scene.anims.generateFrameNumbers(tk, { start: 0, end: asset.frames - 1 }),
      frameRate,
      repeat: asset.loop ? -1 : 0,
    });
  }
}

export function spawnEffectVfx(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  facing: 1 | -1 = 1,
): boolean {
  if (!loadedMeta) return false;
  const asset = loadedMeta.assets[key];
  if (!asset) return false;
  const tk = texKey(key);
  const ak = animKey(key);
  if (!scene.textures.exists(tk) || !scene.anims.exists(ak)) return false;

  const fs = asset.frameSize ?? loadedMeta.frameSize;
  const sprite = scene.add
    .sprite(x, y, tk, 0)
    .setOrigin(asset.anchor.x / fs.w, asset.anchor.y / fs.h)
    .setScale(asset.scale)
    .setDepth(y + 1000);
  if (facing === -1) sprite.setFlipX(true);
  sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
  sprite.play(ak);
  return true;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/view/EffectsRegistry.ts
git commit -m "feat(vfx): add EffectsRegistry for generic craftpix effect sprites"
```

---

## Task 4: Wire EffectsRegistry into BootScene

**Files:**
- Modify: `src/game/scenes/BootScene.ts`

Current `BootScene.ts` content:
```typescript
import { queueActorSprites, registerActorAnimations } from '../view/AnimationRegistry';
import { queueGuildVfx, registerGuildVfx } from '../view/VfxRegistry';
// ...
preload(): void {
  queueActorSprites(this);
  queueGuildVfx(this);
  // ...
}
create(): void {
  registerActorAnimations(this);
  registerGuildVfx(this);
  // ...
}
```

- [ ] **Step 1: Add import and calls**

Add to the import block at the top:
```typescript
import { queueEffectsVfx, registerEffectsVfx } from '../view/EffectsRegistry';
```

In `preload()`, add after `queueGuildVfx(this)`:
```typescript
    queueEffectsVfx(this);
```

In `create()`, add after `registerGuildVfx(this)`:
```typescript
    registerEffectsVfx(this);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/scenes/BootScene.ts
git commit -m "feat(vfx): wire EffectsRegistry into BootScene preload/create"
```

---

## Task 5: Extend useDevSettings with useNewVfx

**Files:**
- Modify: `src/state/useDevSettings.ts`

Current `DevSettings` interface:
```typescript
interface DevSettings {
  enemyHpScale: number;
}
```

`loadSettings` returns `{ enemyHpScale: 1 }` as default. The `readEnemyHpScale` pattern (direct localStorage read) is reused for `readUseNewVfx` so Phaser can read it without React.

- [ ] **Step 1: Update useDevSettings.ts**

Replace the full file with:
```typescript
import { useState } from 'react';

const STORAGE_KEY = 'nannymud_dev_settings';

interface DevSettings {
  enemyHpScale: number;
  useNewVfx: boolean;
}

function loadSettings(): DevSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enemyHpScale: 1, useNewVfx: false };
    return { enemyHpScale: 1, useNewVfx: false, ...JSON.parse(raw) as Partial<DevSettings> };
  } catch {
    return { enemyHpScale: 1, useNewVfx: false };
  }
}

function saveSettings(s: DevSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function readEnemyHpScale(): number {
  return loadSettings().enemyHpScale;
}

export function readUseNewVfx(): boolean {
  return loadSettings().useNewVfx;
}

export function useDevSettings() {
  const [settings, setSettings] = useState<DevSettings>(loadSettings);

  const setEnemyHpScale = (v: number) => {
    const next = { ...settings, enemyHpScale: v };
    saveSettings(next);
    setSettings(next);
  };

  const setUseNewVfx = (v: boolean) => {
    const next = { ...settings, useNewVfx: v };
    saveSettings(next);
    setSettings(next);
  };

  return {
    enemyHpScale: settings.enemyHpScale,
    setEnemyHpScale,
    useNewVfx: settings.useNewVfx,
    setUseNewVfx,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/useDevSettings.ts
git commit -m "feat(settings): add useNewVfx toggle to DevSettings"
```

---

## Task 6: Add toggle to SettingsScreen

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

`SettingsScreen` already imports `useDevSettings` and destructures `{ enemyHpScale, setEnemyHpScale }`. The `Toggle` component already exists in the file and is used for "Animate HUD". The VIDEO section starts at the `<SectionLabel kicker="VIDEO">` block near line 251.

- [ ] **Step 1: Destructure useNewVfx from the hook**

In `SettingsScreen`, find the line:
```typescript
  const { enemyHpScale, setEnemyHpScale } = useDevSettings();
```

Replace with:
```typescript
  const { enemyHpScale, setEnemyHpScale, useNewVfx, setUseNewVfx } = useDevSettings();
```

- [ ] **Step 2: Add the Toggle**

Find the existing VIDEO section in the JSX (around line 251–258):
```tsx
          <SectionLabel kicker="VIDEO">Terminal chrome theme</SectionLabel>
          <Toggle
            label="Animate HUD"
            sub="Pulse meters, glow combo text, flicker scanlines on hit"
            on={animateHud}
            onClick={onToggleAnimateHud}
          />
```

Add the new toggle immediately after the "Animate HUD" Toggle:
```tsx
          <Toggle
            label="New VFX"
            sub="Craftpix sprite effects instead of procedural sparks and rings"
            on={useNewVfx}
            onClick={() => setUseNewVfx(!useNewVfx)}
          />
```

- [ ] **Step 3: Verify TypeScript compiles and no unused-local errors**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat(settings): add New VFX toggle to Settings screen VIDEO section"
```

---

## Task 7: Branch hit_spark and aoe_pop in ParticleFX

**Files:**
- Modify: `src/game/view/ParticleFX.ts`

`consumeVfxEvents` is the entry point (line 205). It handles `hit_spark` (lines ~218–226) and `aoe_pop` (lines ~228–237). `spawnGuildVfx` is already called first (line 210) — keep that unchanged.

`readUseNewVfx` is a simple localStorage read — safe to call once per-batch (top of the function, not per-event).

Random slash/explosion selection uses `Math.floor(Math.random() * N)` — render layer, not simulation, so this is fine.

Valid slash keys: `slash_1` through `slash_10` (10 variants).  
Valid explosion keys: `explosion_1`, `explosion_2`, `explosion_3`, `explosion_5`, `explosion_6`, `explosion_8`, `explosion_9`, `explosion_10` (8 variants — 4 and 7 are empty).

- [ ] **Step 1: Add imports at the top of ParticleFX.ts**

Find the existing import block:
```typescript
import Phaser from 'phaser';
import type { VFXEvent } from '@nannymud/shared/simulation/types';
import { DEPTH_SCALE, worldYToScreenY, getScreenYBand, type ScreenYBand } from '../constants';
import { spawnGuildVfx } from './VfxRegistry';
```

Add two more imports:
```typescript
import { spawnEffectVfx } from './EffectsRegistry';
import { readUseNewVfx } from '../../state/useDevSettings';
```

- [ ] **Step 2: Add constants for valid effect keys**

After the imports, add:
```typescript
const SLASH_KEYS = ['slash_1','slash_2','slash_3','slash_4','slash_5','slash_6','slash_7','slash_8','slash_9','slash_10'] as const;
const EXPLOSION_KEYS = ['explosion_1','explosion_2','explosion_3','explosion_5','explosion_6','explosion_8','explosion_9','explosion_10'] as const;

function randomSlashKey(): string {
  return SLASH_KEYS[Math.floor(Math.random() * SLASH_KEYS.length)];
}

function randomExplosionKey(): string {
  return EXPLOSION_KEYS[Math.floor(Math.random() * EXPLOSION_KEYS.length)];
}
```

- [ ] **Step 3: Read the flag once at the top of consumeVfxEvents and branch the two cases**

Find `consumeVfxEvents` (line 205):
```typescript
export function consumeVfxEvents(scene: Phaser.Scene, events: VFXEvent[]): void {
  const band = getScreenYBand(scene);
  for (const event of events) {
```

Replace with:
```typescript
export function consumeVfxEvents(scene: Phaser.Scene, events: VFXEvent[]): void {
  const band = getScreenYBand(scene);
  const newVfx = readUseNewVfx();
  for (const event of events) {
```

Find the `hit_spark` case:
```typescript
      case 'hit_spark': {
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
          const speed = 80 + Math.random() * 120;
          const radius = 2 + Math.random() * 3;
          spawnBurstSpark(scene, x, y, angle, speed, radius, colorInt, 1, 300);
        }
        break;
      }
```

Replace with:
```typescript
      case 'hit_spark': {
        if (newVfx) {
          spawnEffectVfx(scene, randomSlashKey(), x, y, event.facing ?? 1);
        } else {
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
            const speed = 80 + Math.random() * 120;
            const radius = 2 + Math.random() * 3;
            spawnBurstSpark(scene, x, y, angle, speed, radius, colorInt, 1, 300);
          }
        }
        break;
      }
```

Find the `aoe_pop` case:
```typescript
      case 'aoe_pop': {
        const r = event.radius || 60;
        spawnExpandingRing(scene, x, y, r, 1.0, colorInt, 0.6, 0.2, 3, false, 400);
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const rx = x + Math.cos(angle) * r;
          const ry = y + Math.sin(angle) * r * 0.5;
          spawnBurstSpark(scene, rx, ry, angle, 40, 3, colorInt, 0.8, 300);
        }
        break;
      }
```

Replace with:
```typescript
      case 'aoe_pop': {
        if (newVfx) {
          spawnEffectVfx(scene, randomExplosionKey(), x, y, 1);
        } else {
          const r = event.radius || 60;
          spawnExpandingRing(scene, x, y, r, 1.0, colorInt, 0.6, 0.2, 3, false, 400);
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const rx = x + Math.cos(angle) * r;
            const ry = y + Math.sin(angle) * r * 0.5;
            spawnBurstSpark(scene, rx, ry, angle, 40, 3, colorInt, 0.8, 300);
          }
        }
        break;
      }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all pass (golden test still green — ParticleFX is render-only).

- [ ] **Step 6: Commit**

```bash
git add src/game/view/ParticleFX.ts
git commit -m "feat(vfx): branch hit_spark and aoe_pop to craftpix sprites when New VFX enabled"
```

---

## Task 8: Smoke test in-game

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify toggle appears in Settings**

Open the game → Settings → scroll to VIDEO section. Confirm "New VFX" toggle is visible below "Animate HUD".

- [ ] **Step 3: Test with Old VFX (default)**

Toggle OFF. Start a VS or Story match. Land hits and use AoE abilities. Confirm you see procedural sparks (colored circles) and expanding rings.

- [ ] **Step 4: Test with New VFX**

Toggle ON. Return to match. Land hits and use AoE abilities. Confirm you see:
- Slash sprites on `hit_spark` events (random animated slash instead of spark circles)
- Explosion sprites on `aoe_pop` events (animated explosion instead of ring)

- [ ] **Step 5: Verify toggle persists**

Reload the page. Confirm the New VFX setting is still ON (localStorage-backed).

- [ ] **Step 6: Commit smoke test sign-off**

If everything works:
```bash
git commit --allow-empty -m "chore: craftpix vfx toggle smoke-tested and working"
```
