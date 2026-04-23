# LF2-Style Tiled Stage Backdrops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace scattered individual prop sprites with continuous tiled backdrop images for all 9 stages, matching the LF2/LF2-Remastered visual structure (painted wall fills every pixel, no empty gaps).

**Architecture:** Each stage gets two Phaser `TileSprite` layers — a ~400px-wide backdrop image that tiles across the full 4000px world width at 0.25–0.30× parallax, and a thin horizon strip at 0.45–0.50× parallax. Both are created via `addBackdropTile()` (already in `BackgroundView.ts`). Individual prop sprites are removed except for 1–2 iconic accent pieces on Assembly Hall. PixelLab `create_map_object` generates all images (5 concurrent max); Playwright takes new preview screenshots after each stage is wired.

**Tech Stack:** PixelLab MCP (`create_map_object`, `get_map_object`), Phaser 3 `TileSprite`, Playwright MCP (`browser_run_code`), TypeScript

**Reference implementation:** Night Market — `public/world/market/backdrop.png` + `public/world/market/horizon.png`, `createMarketProps()` in `BackgroundView.ts`, `stage:market:backdrop` / `stage:market:horizon` keys in `manifest.ts`.

---

## PixelLab Batching Strategy

PixelLab allows ~5 concurrent jobs. Queue 5 at a time, poll until all complete, download, then queue the next 5. 16 images across 8 stages = 4 batches of (5 + 5 + 4 + 2).

**Model:** Claude Sonnet (current) — this is mechanical: generate, download, edit 2 files, screenshot, commit. No reasoning-heavy steps. Self-paced loop, one stage per iteration.

**Parallelism:** PixelLab generation is parallelised in batches of 5. Code changes are sequential (all touch the same two files). Playwright screenshots are sequential.

---

## Backdrop descriptions per stage

| Stage | backdrop.png description (400×200, side view) | horizon.png description (400×32, side view) |
|---|---|---|
| assembly | stone hall wall with tall arched panels, hanging heraldic banners, iron torch sconces, carved stonework details, packed edge to edge, pixel art seamlessly tileable | stone ledge with red carpet edge strip, seamlessly tileable |
| kitchen | dark soot-stained brick wall, iron hooks hanging from ceiling bar, crumbling plaster patches, grimy dungeon kitchen, packed edge to edge, pixel art seamlessly tileable | dark flagstone base strip, seamlessly tileable |
| tower | arcane stone wall with glowing blue rune panels, crystal sconces emitting purple light, carved magical symbols, packed edge to edge, pixel art seamlessly tileable | glowing arcane glass floor edge with blue rune line, seamlessly tileable |
| grove | dense moonlit forest treeline, ancient gnarled tree trunks packed side by side, bioluminescent undergrowth glowing blue-green, full frame, pixel art seamlessly tileable | moonlit grass and exposed root edge strip, seamlessly tileable |
| catacombs | dark cave stone wall with stalactites hanging from top edge, ancient carved arch outlines, algae streaks, cold grey stone, packed full frame, pixel art seamlessly tileable | wet dark stone ledge with water seep, seamlessly tileable |
| throne | dark crimson stone wall with gothic arched windows glowing red, iron torch brackets, carved gargoyle details, packed full frame, pixel art seamlessly tileable | dark polished stone slab edge strip, seamlessly tileable |
| docks | weathered timber warehouse wall, dock ropes hanging, iron rivets, foggy night harbour atmosphere, worn salt-bleached planks packed edge to edge, pixel art seamlessly tileable | wet dock plank edge strip with rope coil, seamlessly tileable |
| rooftops | monastery rooftop silhouettes against pale dawn blue sky, slate tiles, distant chimneys, bell tower tops, packed panoramic strip, pixel art seamlessly tileable | grey slate tile ridge edge strip, seamlessly tileable |

---

## Files Modified

| File | Change |
|---|---|
| `src/game/assets/manifest.ts` | Add `backdrop` + `horizon` keys for each of 8 stages; remove old scattered prop keys |
| `src/game/view/BackgroundView.ts` | Replace `createXxxProps()` body for each of 8 stages with `addBackdropTile()` calls; keep 2 accent pillars for assembly |
| `public/world/{stage}/backdrop.png` | New PixelLab-generated tileable backdrop (not gitignored — lives outside `raw/`) |
| `public/world/{stage}/horizon.png` | New PixelLab-generated horizon strip (not gitignored) |
| `public/world/{stage}/preview.png` | Updated Playwright canvas screenshot showing new backdrop |

`raw/` subdirectories remain gitignored. `backdrop.png` and `horizon.png` live directly in `public/world/{stage}/` and ARE tracked.

---

## Task 1 — Generate backdrop + horizon images for Assembly + Kitchen + Tower (batch 1)

**Files:** `public/world/assembly/backdrop.png`, `public/world/assembly/horizon.png`, `public/world/kitchen/backdrop.png`, `public/world/kitchen/horizon.png`, `public/world/tower/backdrop.png`

- [ ] **Queue 5 PixelLab jobs simultaneously** via `create_map_object` (all width=400):

  ```
  assembly backdrop:  height=200, view=side, shading=detailed, outline=single color outline, detail=high detail
  desc: "stone hall wall with tall arched panels, hanging heraldic banners, iron torch sconces, carved stonework details, packed edge to edge, pixel art seamlessly tileable side view beat-em-up backdrop"

  assembly horizon:   height=32, same settings
  desc: "stone ledge with red carpet edge strip, seamlessly tileable, pixel art side view, fills full frame"

  kitchen backdrop:   height=200
  desc: "dark soot-stained brick wall, iron hooks hanging from ceiling bar, crumbling plaster patches, grimy dungeon kitchen, packed edge to edge, pixel art seamlessly tileable side view beat-em-up backdrop"

  kitchen horizon:    height=32
  desc: "dark flagstone base strip, seamlessly tileable, pixel art side view, fills full frame"

  tower backdrop:     height=200
  desc: "arcane stone wall with glowing blue rune panels, crystal sconces emitting purple light, carved magical symbols, packed edge to edge, pixel art seamlessly tileable side view beat-em-up backdrop"
  ```

- [ ] **Poll all 5** via `get_map_object` until all return ✅ (~2–3 min)

- [ ] **Download all 5:**
  ```bash
  curl --fail -o "public/world/assembly/backdrop.png" "<assembly_backdrop_url>"
  curl --fail -o "public/world/assembly/horizon.png"  "<assembly_horizon_url>"
  curl --fail -o "public/world/kitchen/backdrop.png"  "<kitchen_backdrop_url>"
  curl --fail -o "public/world/kitchen/horizon.png"   "<kitchen_horizon_url>"
  curl --fail -o "public/world/tower/backdrop.png"    "<tower_backdrop_url>"
  ```

---

## Task 2 — Generate remaining images (batch 2: tower horizon + grove + catacombs)

**Files:** `public/world/tower/horizon.png`, `public/world/grove/backdrop.png`, `public/world/grove/horizon.png`, `public/world/catacombs/backdrop.png`, `public/world/catacombs/horizon.png`

- [ ] **Queue 5 PixelLab jobs simultaneously:**

  ```
  tower horizon:      height=32
  desc: "glowing arcane glass floor edge with blue rune line, seamlessly tileable, pixel art side view, fills full frame"

  grove backdrop:     height=200
  desc: "dense moonlit forest treeline, ancient gnarled tree trunks packed side by side, bioluminescent undergrowth glowing blue-green, full frame, pixel art seamlessly tileable side view beat-em-up backdrop"

  grove horizon:      height=32
  desc: "moonlit grass and exposed root edge strip, seamlessly tileable, pixel art side view, fills full frame"

  catacombs backdrop: height=200
  desc: "dark cave stone wall with stalactites hanging from top edge, ancient carved arch outlines, algae streaks, cold grey stone, packed full frame, pixel art seamlessly tileable side view beat-em-up backdrop"

  catacombs horizon:  height=32
  desc: "wet dark stone ledge with water seep, seamlessly tileable, pixel art side view, fills full frame"
  ```

- [ ] **Poll + download** all 5 to their respective `public/world/{stage}/` paths

---

## Task 3 — Generate remaining images (batch 3: throne + docks + rooftops)

**Files:** `public/world/throne/backdrop.png`, `public/world/throne/horizon.png`, `public/world/docks/backdrop.png`, `public/world/docks/horizon.png`, `public/world/rooftops/backdrop.png`

- [ ] **Queue 5 PixelLab jobs simultaneously:**

  ```
  throne backdrop:    height=200
  desc: "dark crimson stone wall with gothic arched windows glowing red, iron torch brackets, carved gargoyle details, packed full frame, pixel art seamlessly tileable side view beat-em-up backdrop"

  throne horizon:     height=32
  desc: "dark polished stone slab edge strip, seamlessly tileable, pixel art side view, fills full frame"

  docks backdrop:     height=200
  desc: "weathered timber warehouse wall, dock ropes hanging, iron rivets, foggy night harbour atmosphere, worn salt-bleached planks packed edge to edge, pixel art seamlessly tileable side view beat-em-up backdrop"

  docks horizon:      height=32
  desc: "wet dock plank edge strip with rope coil, seamlessly tileable, pixel art side view, fills full frame"

  rooftops backdrop:  height=200
  desc: "monastery rooftop silhouettes against pale dawn blue sky, slate tiles, distant chimneys, bell tower tops, packed panoramic strip, pixel art seamlessly tileable side view beat-em-up backdrop"
  ```

- [ ] **Poll + download** all 5

---

## Task 4 — Generate last image (batch 4)

- [ ] **Queue 1 job:**

  ```
  rooftops horizon:   height=32
  desc: "grey slate tile ridge edge strip, seamlessly tileable, pixel art side view, fills full frame"
  ```

- [ ] **Poll + download** to `public/world/rooftops/horizon.png`

---

## Task 5 — Update manifest.ts

**File:** `src/game/assets/manifest.ts`

- [ ] **Replace all 8 stage image arrays** — remove old scattered prop keys, add backdrop + horizon:

  ```typescript
  assembly: [
    { key: 'stage:assembly:backdrop', url: '/world/assembly/backdrop.png' },
    { key: 'stage:assembly:horizon',  url: '/world/assembly/horizon.png' },
    // Keep pillar for accent prop
    { key: 'stage:assembly:pillar',   url: '/world/assembly/raw/pillar_stone_knight_hall.png' },
  ],
  kitchen: [
    { key: 'stage:kitchen:backdrop', url: '/world/kitchen/backdrop.png' },
    { key: 'stage:kitchen:horizon',  url: '/world/kitchen/horizon.png' },
  ],
  tower: [
    { key: 'stage:tower:backdrop', url: '/world/tower/backdrop.png' },
    { key: 'stage:tower:horizon',  url: '/world/tower/horizon.png' },
  ],
  grove: [
    { key: 'stage:grove:backdrop', url: '/world/grove/backdrop.png' },
    { key: 'stage:grove:horizon',  url: '/world/grove/horizon.png' },
  ],
  catacombs: [
    { key: 'stage:catacombs:backdrop', url: '/world/catacombs/backdrop.png' },
    { key: 'stage:catacombs:horizon',  url: '/world/catacombs/horizon.png' },
  ],
  throne: [
    { key: 'stage:throne:backdrop', url: '/world/throne/backdrop.png' },
    { key: 'stage:throne:horizon',  url: '/world/throne/horizon.png' },
  ],
  docks: [
    { key: 'stage:docks:backdrop', url: '/world/docks/backdrop.png' },
    { key: 'stage:docks:horizon',  url: '/world/docks/horizon.png' },
  ],
  rooftops: [
    { key: 'stage:rooftops:backdrop', url: '/world/rooftops/backdrop.png' },
    { key: 'stage:rooftops:horizon',  url: '/world/rooftops/horizon.png' },
  ],
  ```

- [ ] **Verify typecheck passes:**
  ```bash
  npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v guildData | grep error
  ```
  Expected: no output (no new errors)

---

## Task 6 — Update BackgroundView.ts — all 8 stage createXxxProps() methods

**File:** `src/game/view/BackgroundView.ts`

Replace each `createXxxProps()` body. The `addBackdropTile(key, y, height, parallax, depth)` helper is already present.

- [ ] **Replace `createAssemblyProps()`** — keep 2 accent pillars, add backdrop wall behind:

  ```typescript
  private createAssemblyProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:assembly:backdrop', 0, g, 0.25, -701);
    this.addBackdropTile('stage:assembly:horizon',  g - 16, 32, 0.45, -700);
    // Iconic pillars as accent pieces on top of the backdrop wall
    for (let wx = -600; wx <= 3600; wx += 600)
      this.sp('stage:assembly:pillar', wx, g + 14, 0.60, -600, 0.62, 0.95);
  }
  ```

- [ ] **Replace `createKitchenProps()`:**

  ```typescript
  private createKitchenProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:kitchen:backdrop', 0, g, 0.28, -701);
    this.addBackdropTile('stage:kitchen:horizon',  g - 16, 32, 0.48, -700);
  }
  ```

- [ ] **Replace `createTowerProps()`:**

  ```typescript
  private createTowerProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:tower:backdrop', 0, g, 0.25, -701);
    this.addBackdropTile('stage:tower:horizon',  g - 16, 32, 0.45, -700);
  }
  ```

- [ ] **Replace `createGroveProps()`:**

  ```typescript
  private createGroveProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:grove:backdrop', 0, g, 0.30, -701);
    this.addBackdropTile('stage:grove:horizon',  g - 16, 32, 0.50, -700);
  }
  ```

- [ ] **Replace `createCatacombsProps()`:**

  ```typescript
  private createCatacombsProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:catacombs:backdrop', 0, g, 0.25, -701);
    this.addBackdropTile('stage:catacombs:horizon',  g - 16, 32, 0.45, -700);
  }
  ```

- [ ] **Replace `createThroneProps()`:**

  ```typescript
  private createThroneProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:throne:backdrop', 0, g, 0.25, -701);
    this.addBackdropTile('stage:throne:horizon',  g - 16, 32, 0.45, -700);
  }
  ```

- [ ] **Replace `createDocksProps()`:**

  ```typescript
  private createDocksProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:docks:backdrop', 0, g, 0.30, -701);
    this.addBackdropTile('stage:docks:horizon',  g - 16, 32, 0.50, -700);
  }
  ```

- [ ] **Replace `createRooftopsProps()`:**

  ```typescript
  private createRooftopsProps(): void {
    const g = this.groundTopScreen;
    this.addBackdropTile('stage:rooftops:backdrop', 0, g, 0.30, -701);
    this.addBackdropTile('stage:rooftops:horizon',  g - 16, 32, 0.50, -700);
  }
  ```

- [ ] **Verify typecheck:**
  ```bash
  npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -v guildData | grep error
  ```
  Expected: no output

---

## Task 7 — Retake all preview screenshots via Playwright

**Files:** `public/world/{stage}/preview.png` for all 9 stages

The current previews were taken with scattered props and are now stale.

- [ ] **Ensure dev server is running:**
  ```bash
  curl -s http://localhost:5173 > /dev/null && echo "up" || npm run dev:client &
  ```

- [ ] **Run screenshot loop via Playwright `browser_run_code`:**

  ```javascript
  async (page) => {
    const stages = ['assembly','market','kitchen','tower','grove','catacombs','throne','docks','rooftops'];
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(1500);

    // Wire dispatch helper
    await page.evaluate(() => {
      const root = document.getElementById('root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
      let f = root[key]?.child;
      const q = [f];
      while (q.length) {
        const n = q.shift();
        if (!n) continue;
        if (n.type?.name === 'App' && n.memoizedState?.queue?.dispatch) {
          window.__appDispatch = p => n.memoizedState.queue.dispatch(s => ({ ...s, ...p }));
          return;
        }
        if (n.child) q.push(n.child);
        if (n.sibling) q.push(n.sibling);
      }
    });

    for (const stageId of stages) {
      await page.evaluate(sid =>
        window.__appDispatch({ screen: 'game', stageId: sid, p1: 'adventurer', p2: 'knight', mode: 'vs' }),
        stageId
      );
      await page.waitForTimeout(6000);
      await page.locator('canvas').first().screenshot({ path: `public/world/${stageId}/preview.png` });
      await page.evaluate(() => window.__appDispatch({ screen: 'menu' }));
      await page.waitForTimeout(1500);
    }
    return stages.map(s => s + ' ✓');
  }
  ```

  Expected result: `["assembly ✓", "market ✓", "kitchen ✓", ...]`

---

## Task 8 — Commit everything

- [ ] **Stage all changed files:**
  ```bash
  git add \
    src/game/assets/manifest.ts \
    src/game/view/BackgroundView.ts \
    public/world/assembly/backdrop.png \
    public/world/assembly/horizon.png \
    public/world/assembly/preview.png \
    public/world/kitchen/backdrop.png \
    public/world/kitchen/horizon.png \
    public/world/kitchen/preview.png \
    public/world/tower/backdrop.png \
    public/world/tower/horizon.png \
    public/world/tower/preview.png \
    public/world/grove/backdrop.png \
    public/world/grove/horizon.png \
    public/world/grove/preview.png \
    public/world/catacombs/backdrop.png \
    public/world/catacombs/horizon.png \
    public/world/catacombs/preview.png \
    public/world/throne/backdrop.png \
    public/world/throne/horizon.png \
    public/world/throne/preview.png \
    public/world/docks/backdrop.png \
    public/world/docks/horizon.png \
    public/world/docks/preview.png \
    public/world/rooftops/backdrop.png \
    public/world/rooftops/horizon.png \
    public/world/rooftops/preview.png \
    public/world/market/preview.png
  ```

- [ ] **Commit and push:**
  ```bash
  git commit -m "feat(world): LF2-style tiled backdrops for all 9 stages

  Replace scattered prop sprites with continuous tiled backdrop images:
  - backdrop.png: ~400px wide wall scene tiling across full world width
  - horizon.png: thin strip at ground seam
  Both use Phaser TileSprite with tilePositionX parallax scrolling.
  Assembly keeps 2 accent pillars on top of the wall backdrop.
  All 9 stage preview screenshots retaken.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

  git push origin feat/vs-mode-hud
  ```

---

## Self-Review

**Spec coverage:**
- ✅ All 8 remaining stages get backdrop + horizon tiles
- ✅ Night Market already done, included in screenshot retake
- ✅ manifest.ts updated (old scattered prop keys removed)
- ✅ BackgroundView.ts createXxxProps() replaced for all 8 stages
- ✅ Playwright previews retaken for all 9 stages
- ✅ Stage select will show new previews (uses `stage.preview` path, unchanged)
- ✅ Assembly special case: keeps 2 accent pillars
- ✅ Batching strategy handles PixelLab 5-job limit
- ✅ Commit covers all asset + code changes

**Parallax rates chosen:**
- Daytime/open stages (rooftops, grove): 0.30× — more scroll visible
- Indoor/dark stages (assembly, tower, catacombs, throne): 0.25× — slower, walls feel solid
- Water/fog stages (docks, kitchen): 0.28–0.30×

**No placeholders detected.** All code blocks are complete and consistent with existing `BackgroundView.ts` API.
