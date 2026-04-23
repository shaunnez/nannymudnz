# PixelLab VFX Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all procedurally-generated circle VFX sprites with production-quality PixelLab pixel art, and extend the VFX spawn system to animate single-frame images with a scale-in/hold/fade-out tween.

**Architecture:** Task 0 modifies `spawnGuildVfx` in `VfxRegistry.ts` to tween single-frame assets (scale 25%→100% then alpha 1→0), giving spark→peak→dissipate animation from one image. Tasks 1–5 are fully parallel PixelLab batches — each calls `create_map_object` for a guild group, polls for completion, saves PNGs to `public/vfx/{guild}/`, and updates `metadata.json` with `frames:1, frameDurationMs:450`.

**Tech Stack:** TypeScript, Phaser 3 tweens, PixelLab MCP (`create_map_object` / `get_map_object`)

## Execution Strategy

| Task | Model | Mode | Reason |
|---|---|---|---|
| Task 0 — tween code | **sonnet** | serial | TypeScript precision, typecheck, commit |
| Task 1 — knight/leper/viking | **haiku** | parallel | Mechanical MCP tool calls + JSON writes |
| Task 2 — adventurer/mage/druid | **haiku** | parallel | Mechanical MCP tool calls + JSON writes |
| Task 3 — monk/champion/hunter | **haiku** | parallel | Mechanical MCP tool calls + JSON writes |
| Task 4 — prophet/vampire/darkmage | **haiku** | parallel | Mechanical MCP tool calls + JSON writes |
| Task 5 — cultist/chef/master | **haiku** | parallel | Mechanical MCP tool calls + JSON writes |

**Dispatch order:** Task 0 → (on commit) → Tasks 1–5 all simultaneously.

---

## Size and metadata conventions

| Effect category | Width × Height | `scale` | `frameDurationMs` |
|---|---|---|---|
| Ultimate / large burst | 160 × 160 | 1.6 | 450 |
| Standard burst / aura | 96 × 96 | 1.5 | 400 |
| Minor impact / glow | 96 × 96 | 1.2 | 350 |

All PixelLab assets use:
- `frames: 1`
- `loop: false`
- `anchor: { x: half-width, y: half-height }` (centered)
- `view: "side"`
- `outline: "selective outline"`
- `shading: "medium shading"`
- `detail: "medium detail"` (96×96) or `"high detail"` (160×160)

---

## File map

**Modified once:**
- `src/game/view/VfxRegistry.ts` — `spawnGuildVfx` extended with tween path for `frames <= 1`

**Modified per guild (Tasks 1–5):**
- `public/vfx/{guild}/{effect}.png` — replaced with PixelLab image
- `public/vfx/{guild}/metadata.json` — updated to `frames:1` + scale values

---

## Task 0 — Extend spawnGuildVfx with tween animation

**Files:** Modify `src/game/view/VfxRegistry.ts`

Reference: existing `spawnGuildVfx` at line 95. The multi-frame path is unchanged. The single-frame path currently does `scene.time.delayedCall` then `sprite.destroy()`. Replace it with a tween chain.

- [ ] **Step 1: Replace the single-frame spawn path in `spawnGuildVfx`**

Find the current function (around line 95) and replace it entirely:

```typescript
export function spawnGuildVfx(scene: Phaser.Scene, event: VFXEvent, x: number, y: number): boolean {
  if (!event.guildId || !event.assetKey) return false;
  const entry = getGuildVfxAsset(event.guildId, event.assetKey);
  if (!entry) return false;

  const { asset, frameSize } = entry;
  const texKey = textureKey(event.guildId, event.assetKey);
  const animKey = animationKey(event.guildId, event.assetKey);
  if (!scene.textures.exists(texKey) || !scene.anims.exists(animKey)) return false;

  const originX = asset.anchor.x / frameSize.w;
  const originY = asset.anchor.y / frameSize.h;
  const sprite = scene.add
    .sprite(x, y, texKey, 0)
    .setOrigin(originX, originY)
    .setScale(asset.scale)
    .setDepth(y + 1000);

  if (event.facing === -1) sprite.setFlipX(true);

  if (asset.frames <= 1) {
    // Single-frame PixelLab assets: scale-in → hold → fade-out
    const totalMs = Math.max(asset.frameDurationMs, 200);
    const rampMs = totalMs * 0.35;
    const holdMs = totalMs * 0.25;
    const fadeMs = totalMs - rampMs - holdMs;
    sprite.setScale(asset.scale * 0.25);
    scene.tweens.add({
      targets: sprite,
      scaleX: asset.scale,
      scaleY: asset.scale,
      duration: rampMs,
      ease: 'Back.Out',
      onComplete: () => {
        scene.time.delayedCall(holdMs, () => {
          scene.tweens.add({
            targets: sprite,
            alpha: 0,
            duration: fadeMs,
            ease: 'Sine.In',
            onComplete: () => sprite.destroy(),
          });
        });
      },
    });
  } else {
    const lifetimeMs = Math.max(asset.frames * asset.frameDurationMs, 100);
    if (asset.loop) {
      scene.time.delayedCall(lifetimeMs, () => sprite.destroy());
    } else {
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.destroy());
    }
    sprite.play(animKey);
  }

  return true;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: only the 15 pre-existing `guildData.ts` strategy errors, zero new errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/view/VfxRegistry.ts
git commit -m "feat(vfx): tween scale-in/fade-out for single-frame PixelLab assets"
```

---

## Tasks 1–5 — PixelLab generation (all parallel after Task 0)

Tasks 1–5 are independent. Each touches only its own guild folders and metadata files. Dispatch all five simultaneously.

---

## Task 1 — Knight · Leper · Viking

**Files:** `public/vfx/knight/`, `public/vfx/leper/`, `public/vfx/viking/` — PNGs and metadata.json

### How to generate and save each asset

For each effect below:
1. Call `mcp__pixellab__create_map_object` with the given parameters → get `object_id`
2. Poll `mcp__pixellab__get_map_object(object_id)` until `status === "completed"`
3. Download the result image and save to the file path shown
4. Continue to the next effect

Dispatch all effects for a guild simultaneously, poll concurrently, then write metadata once all are ready.

### Knight effects

- [ ] **Generate knight/holy_rebuke_burst.png**
```json
{
  "description": "holy light explosion burst, radiating golden rays, divine cross shape, white glowing core, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/knight/holy_rebuke_burst.png`

- [ ] **Generate knight/taunt_shout.png**
```json
{
  "description": "battle shout shockwave, bold orange-gold concentric rings bursting outward, commanding aura burst, pixel art game VFX",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/knight/taunt_shout.png`

- [ ] **Generate knight/shield_wall_barrier.png**
```json
{
  "description": "glowing blue protective barrier dome, crystal shield energy pulse, electric blue ring, pixel art game VFX",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/knight/shield_wall_barrier.png`

- [ ] **Generate knight/last_stand_aura.png**
```json
{
  "description": "heroic golden aura explosion, bright gold and white light rays erupting outward, defiant power burst, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/knight/last_stand_aura.png`

- [ ] **Update public/vfx/knight/metadata.json**
```json
{
  "guildId": "knight",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "holy_rebuke_burst":    { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "valorous_strike_impact":{ "frames": 5, "frameDurationMs": 95, "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "taunt_shout":          { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.5 },
    "shield_wall_barrier":  { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "last_stand_aura":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 }
  }
}
```

### Leper effects

- [ ] **Generate leper/plague_vomit_burst.png**
```json
{
  "description": "toxic green bile splash explosion, diseased bubbles, sickly green splatter, putrid liquid burst, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/leper/plague_vomit_burst.png`

- [ ] **Generate leper/necrotic_embrace_drain.png**
```json
{
  "description": "dark green necrotic drain spiral, life force siphon swirl, rot tendrils converging inward, pixel art game VFX",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/leper/necrotic_embrace_drain.png`

- [ ] **Generate leper/contagion_mark.png**
```json
{
  "description": "glowing disease sigil, green infection rune circle, biohazard symbol in pixel art, transparent background",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/leper/contagion_mark.png`

- [ ] **Generate leper/rotting_tide_burst.png**
```json
{
  "description": "necrotic explosion, dark green rot and bone fragments blasting outward, undead plague eruption, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/leper/rotting_tide_burst.png`

- [ ] **Generate leper/miasma_aura.png**
```json
{
  "description": "toxic gas cloud puff, sickly green and yellow mist rings, poisonous vapor haze aura, pixel art game VFX",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/leper/miasma_aura.png`

- [ ] **Update public/vfx/leper/metadata.json**
```json
{
  "guildId": "leper",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "plague_vomit_burst":     { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "diseased_claw_impact":   { "frames": 5, "frameDurationMs": 95,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "necrotic_embrace_drain": { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "contagion_mark":         { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "rotting_tide_burst":     { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "rotting_tide_channel":   { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "miasma_aura":            { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

### Viking effects

- [ ] **Generate viking/whirlwind_burst.png**
```json
{
  "description": "spinning blade vortex explosion, orange-red axe arcs, berserker whirlwind, blade trails radiating outward, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/viking/whirlwind_burst.png`

- [ ] **Generate viking/bloodlust_aura.png**
```json
{
  "description": "blood-red rage aura burst, crimson berserker energy explosion, frenzy activation flash, pixel art game VFX",
  "width": 96, "height": 96,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "medium detail"
}
```
Save to: `public/vfx/viking/bloodlust_aura.png`

- [ ] **Generate viking/undying_rage_aura.png**
```json
{
  "description": "dark crimson unkillable power explosion, deep red energy field eruption, berserker cannot-die aura, pixel art game VFX",
  "width": 160, "height": 160,
  "view": "side", "outline": "selective outline",
  "shading": "medium shading", "detail": "high detail"
}
```
Save to: `public/vfx/viking/undying_rage_aura.png`

- [ ] **Update public/vfx/viking/metadata.json**
```json
{
  "guildId": "viking",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "whirlwind_burst":    { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "axe_swing_impact":   { "frames": 1, "frameDurationMs": 140, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.2 },
    "bloodlust_aura":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "shield_bash_impact": { "frames": 1, "frameDurationMs": 140, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "undying_rage_aura":  { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 }
  }
}
```

- [ ] **Commit Task 1**
```bash
git add public/vfx/knight/ public/vfx/leper/ public/vfx/viking/
git commit -m "feat(vfx): PixelLab sprites — knight, leper, viking"
```

---

## Task 2 — Adventurer · Mage · Druid

**Files:** `public/vfx/adventurer/`, `public/vfx/mage/`, `public/vfx/druid/`

### Adventurer effects

- [ ] **Generate adventurer/rallying_cry_aura.png**
```json
{ "description": "golden battle cry shockwave, amber concentric rings bursting, rallying energy burst, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate adventurer/bandage_glow.png**
```json
{ "description": "soft green healing glow, white cross symbol, gentle green light burst, heal effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate adventurer/adrenaline_rush_aura.png**
```json
{ "description": "orange fire adrenaline burst, blazing energy explosion, combat overdrive flame rings erupting outward, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate adventurer/second_wind_glow.png**
```json
{ "description": "amber stamina restore flash, golden energy sparkles, recovery burst with light rays, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/adventurer/metadata.json**
```json
{
  "guildId": "adventurer",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "rallying_cry_aura":    { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "slash_impact":         { "frames": 5, "frameDurationMs": 95,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "bandage_glow":         { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "adrenaline_rush_aura": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "second_wind_glow":     { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.2 }
  }
}
```

### Mage effects

- [ ] **Generate mage/ice_nova_burst.png**
```json
{ "description": "ice crystal explosion, sharp blue-white icicle shards radiating outward, frozen burst, jagged ice spikes, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate mage/meteor_impact.png**
```json
{ "description": "flaming meteor impact explosion, fire and smoke crater, glowing orange-red rock impact burst, scorched center, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Update public/vfx/mage/metadata.json**
```json
{
  "guildId": "mage",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "ice_nova_burst": { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "meteor_impact":  { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 }
  }
}
```

### Druid effects

- [ ] **Generate druid/wild_growth_bloom.png**
```json
{ "description": "nature bloom explosion, green flower petals and leaves erupting outward, healing growth burst, white-green floral burst, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate druid/rejuvenate_glow.png**
```json
{ "description": "soft green rejuvenate glow, gentle nature energy, small leaf sparkles, healing light pulse, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate druid/cleanse_glow.png**
```json
{ "description": "white-green purifying burst, cleansing light explosion, sparkle cross symbol, purify effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate druid/tranquility_pulse.png**
```json
{ "description": "large healing nature ring, green and white petals expanding outward, tranquil healing aura, lotus flower bloom, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate druid/shapeshift_burst.png**
```json
{ "description": "green transformation burst, nature energy explosion, druid shapeshift flash, animal form shift effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/druid/metadata.json**
```json
{
  "guildId": "druid",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "wild_growth_bloom": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "rejuvenate_glow":   { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "cleanse_glow":      { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.25 },
    "tranquility_pulse": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "shapeshift_burst":  { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

- [ ] **Commit Task 2**
```bash
git add public/vfx/adventurer/ public/vfx/mage/ public/vfx/druid/
git commit -m "feat(vfx): PixelLab sprites — adventurer, mage, druid"
```

---

## Task 3 — Monk · Champion · Hunter

**Files:** `public/vfx/monk/`, `public/vfx/champion/`, `public/vfx/hunter/`

### Monk effects

- [ ] **Generate monk/serenity_aura.png**
```json
{ "description": "golden chi energy burst, chi orbs exploding outward, serenity activation flash, yellow-gold inner peace explosion, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate monk/five_point_impact.png**
```json
{ "description": "chi pentagram detonation, five red-gold energy points, chi energy star explosion, martial arts power strike, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate monk/dragons_fury_pulse.png**
```json
{ "description": "orange-gold dragon fire burst, whirling flame channel explosion, dragon fury energy rings, swirling fire vortex, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate monk/parry_flash.png**
```json
{ "description": "bright white-gold parry flash, circular shockwave ring, perfect timing burst, blocking energy ripple, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/monk/metadata.json**
```json
{
  "guildId": "monk",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "serenity_aura":      { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.45 },
    "flying_kick_impact": { "frames": 5, "frameDurationMs": 90,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "jab_impact":         { "frames": 4, "frameDurationMs": 80,  "loop": false, "anchor": {"x":28,"y":48}, "scale": 1.1 },
    "five_point_impact":  { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "dragons_fury_pulse": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "parry_flash":        { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

### Champion effects

- [ ] **Generate champion/skullsplitter_burst.png**
```json
{ "description": "massive blood-red shockwave crack, ground split impact, brutal force explosion, dark red and gold impact burst, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate champion/tithe_glow.png**
```json
{ "description": "crimson blood power restore glow, red life force energy, bloodtally heal burst, dark red recovery sparkle, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate champion/challenge_mark.png**
```json
{ "description": "blood-red challenge sigil, red rune mark with crossed swords symbol, battle challenge aura mark, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/champion/metadata.json**
```json
{
  "guildId": "champion",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "charge_impact":       { "frames": 5, "frameDurationMs": 90,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "execute_impact":      { "frames": 5, "frameDurationMs": 95,  "loop": false, "anchor": {"x":48,"y":72}, "scale": 1.25 },
    "cleaver_impact":      { "frames": 5, "frameDurationMs": 90,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "skullsplitter_burst": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "tithe_glow":          { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "challenge_mark":      { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 }
  }
}
```

### Hunter effects

- [ ] **Generate hunter/disengage_burst.png**
```json
{ "description": "lime green smoke flash, escape burst, green-white smoke puff explosion, blinding flash pop, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate hunter/bear_trap_snap.png**
```json
{ "description": "mechanical trap snap burst, metal jaw clamp impact, steel spring explosion sparks, brown metal trap effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate hunter/rain_pulse.png**
```json
{ "description": "arrow rain channel indicator, lime-green arrows raining downward pattern, channel zone field marker, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/hunter/metadata.json**
```json
{
  "guildId": "hunter",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "disengage_burst": { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "bear_trap_snap":  { "frames": 1, "frameDurationMs": 350, "loop": false, "anchor": {"x":48,"y":60}, "scale": 1.2 },
    "rain_pulse":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.45 }
  }
}
```

- [ ] **Commit Task 3**
```bash
git add public/vfx/monk/ public/vfx/champion/ public/vfx/hunter/
git commit -m "feat(vfx): PixelLab sprites — monk, champion, hunter"
```

---

## Task 4 — Prophet · Vampire · Darkmage

**Files:** `public/vfx/prophet/`, `public/vfx/vampire/`, `public/vfx/darkmage/`

### Prophet effects

- [ ] **Generate prophet/prophetic_shield_aura.png**
```json
{ "description": "golden shield bubble activation, holy protection dome pulse, divine gold energy ring burst, shield formation flash, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate prophet/bless_aura.png**
```json
{ "description": "warm divine blessing burst, pale gold soft light, gentle holy sparkles, bless effect glow, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate prophet/curse_mark.png**
```json
{ "description": "violet hex sigil mark, purple rune curse circle, dark purple occult symbol, curse magic effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate prophet/divine_insight_burst.png**
```json
{ "description": "white radiant 8-ray star burst, divine revelation flash, all-seeing holy light explosion, bright white light rays, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate prophet/divine_intervention_aura.png**
```json
{ "description": "blinding white divine invulnerability flood, holy light explosion, pure white protection aura burst, angelic light eruption, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Update public/vfx/prophet/metadata.json**
```json
{
  "guildId": "prophet",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "prophetic_shield_aura":    { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "bless_aura":               { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "curse_mark":               { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "divine_insight_burst":     { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "divine_intervention_aura": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.65 }
  }
}
```

### Vampire effects

- [ ] **Generate vampire/blood_drain_glow.png**
```json
{ "description": "crimson blood drain spiral, inward-flowing blood droplets, life siphon swirl, dark red converging energy, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate vampire/fang_strike_impact.png**
```json
{ "description": "dual vampire fang puncture marks, blood droplets spattering, crimson bite wound impact effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate vampire/nocturne_aura.png**
```json
{ "description": "shadow darkness engulfing burst, dark crimson-black shadow explosion, predator night aura activation, dark veil eruption, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Update public/vfx/vampire/metadata.json**
```json
{
  "guildId": "vampire",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "blood_drain_glow":   { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.35 },
    "fang_strike_impact": { "frames": 1, "frameDurationMs": 380, "loop": false, "anchor": {"x":48,"y":60}, "scale": 1.25 },
    "nocturne_aura":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 }
  }
}
```

### Darkmage effects

- [ ] **Generate darkmage/darkness_burst.png**
```json
{ "description": "dark shadow smoke zone cloud, void darkness puff explosion, blinding dark cloud burst, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate darkmage/soul_leech_drain.png**
```json
{ "description": "violet soul siphon drain, purple life-force spiral, soul-stealing swirl, dark purple drain effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate darkmage/eternal_night_burst.png**
```json
{ "description": "shadow explosion purple darkness bloom, eternal night shockwave, dark purple and black void explosion, shadow zone eruption, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate darkmage/shadow_cloak_aura.png**
```json
{ "description": "shadow veil wrapping burst, dark purple shadow cloak activation, mist darkness engulf flash, stealth enter effect, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/darkmage/metadata.json**
```json
{
  "guildId": "darkmage",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "darkness_burst":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},   "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "soul_leech_drain":   { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},   "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "eternal_night_burst":{ "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "shadow_cloak_aura":  { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},   "anchor": {"x":48,"y":48}, "scale": 1.35 }
  }
}
```

- [ ] **Commit Task 4**
```bash
git add public/vfx/prophet/ public/vfx/vampire/ public/vfx/darkmage/
git commit -m "feat(vfx): PixelLab sprites — prophet, vampire, darkmage"
```

---

## Task 5 — Cultist · Chef · Master

**Files:** `public/vfx/cultist/`, `public/vfx/chef/`, `public/vfx/master/`

### Cultist effects

- [ ] **Generate cultist/summon_burst.png**
```json
{ "description": "void tear eldritch portal rip, dark teal dimensional rift explosion, eldritch horror summoning burst, tentacle suggestions in void, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate cultist/madness_burst.png**
```json
{ "description": "psychic madness wave distortion, dark teal psychic energy explosion, mind-warping burst, chaotic wave rings, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate cultist/tendril_burst.png**
```json
{ "description": "necrotic tendrils erupting from ground upward, dark green grasping tentacles, eldritch plant tendrils burst, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate cultist/gate_pulse.png**
```json
{ "description": "swirling void vortex, dark teal inward-pull spiral, eldritch gate opening, void whirlpool with arcane energy, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate cultist/gaze_aura.png**
```json
{ "description": "eldritch eye opening, void stare aura, dark teal pupil with arcane rays, abyss gaze activation, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Update public/vfx/cultist/metadata.json**
```json
{
  "guildId": "cultist",
  "frameSize": { "w": 160, "h": 160 },
  "assets": {
    "summon_burst":  { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "madness_burst": { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.6 },
    "tendril_burst": { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":72}, "scale": 1.35 },
    "gate_pulse":    { "frames": 1, "frameDurationMs": 450, "loop": false, "anchor": {"x":80,"y":80}, "scale": 1.65 },
    "gaze_aura":     { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96}, "anchor": {"x":48,"y":48}, "scale": 1.3 }
  }
}
```

### Chef effects

- [ ] **Generate chef/feast_burst.png**
```json
{ "description": "cheerful food sparkle burst, pink and gold cooking sparkles, feast magic explosion, food confetti burst, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate chef/hot_soup_glow.png**
```json
{ "description": "warm golden soup heal glow, steam wisps rising, cozy warm food healing light, amber-gold soft burst, pixel art game VFX", "width": 96, "height": 96, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "medium detail" }
```

- [ ] **Generate chef/signature_dish_pulse.png**
```json
{ "description": "elaborate signature dish reveal burst, pink and amber culinary magic explosion, master chef aura activation, food sparkle ring, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Update public/vfx/chef/metadata.json**
```json
{
  "guildId": "chef",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "feast_burst":          { "frames": 1, "frameDurationMs": 400, "loop": false, "frameSize": {"w":96,"h":96},   "anchor": {"x":48,"y":48}, "scale": 1.4 },
    "ladle_impact":         { "frames": 4, "frameDurationMs": 85,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.15 },
    "hot_soup_glow":        { "frames": 1, "frameDurationMs": 400, "loop": false, "anchor": {"x":48,"y":48}, "scale": 1.3 },
    "signature_dish_pulse": { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 }
  }
}
```

### Master effects

- [ ] **Generate master/chosen_nuke_burst.png**
```json
{ "description": "neutral silver-gold power burst, primed class energy explosion, white-silver radiant burst, class power release, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate master/eclipse_aura.png**
```json
{ "description": "prismatic colour-shifting ring burst, multi-colour aura activation, rainbow energy rings, shifting hue explosion, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Generate master/apotheosis_aura.png**
```json
{ "description": "transcendence white-gold flood, apotheosis peak power aura, divine white light golden rays erupting, peak mastery explosion, pixel art game VFX", "width": 160, "height": 160, "view": "side", "outline": "selective outline", "shading": "medium shading", "detail": "high detail" }
```

- [ ] **Update public/vfx/master/metadata.json**
```json
{
  "guildId": "master",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "chosen_strike_impact": { "frames": 5, "frameDurationMs": 90,  "loop": false, "anchor": {"x":28,"y":68}, "scale": 1.2 },
    "chosen_nuke_burst":    { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.55 },
    "eclipse_aura":         { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
    "apotheosis_aura":      { "frames": 1, "frameDurationMs": 450, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 }
  }
}
```

- [ ] **Commit Task 5**
```bash
git add public/vfx/cultist/ public/vfx/chef/ public/vfx/master/
git commit -m "feat(vfx): PixelLab sprites — cultist, chef, master"
```

---

## Parallelism summary

```
Task 0  (serial)   — tween system code change
    ↓
Tasks 1–5 (all parallel) — independent guild folders, no shared files
    ↓
Done — all 56 effects replaced, tween system active
```

Tasks 1–5 can be dispatched as five simultaneous subagents immediately after Task 0 commits.

## Note on existing multi-frame assets

Some effects in the metadata files above are left with their original multi-frame PS1 strips:
`valorous_strike_impact`, `diseased_claw_impact`, `slash_impact`, `flying_kick_impact`, `jab_impact`, `charge_impact`, `execute_impact`, `cleaver_impact`, `ladle_impact`, `chosen_strike_impact`.

**When writing metadata.json for any task:** read the current file first and preserve the exact `anchor`, `scale`, `frames`, and `frameDurationMs` values for any multi-frame asset not listed as a PixelLab replacement. The metadata.json entries shown in this plan are authoritative only for the PixelLab-generated assets (those with `"frames": 1`). Merge — do not replace the whole file blindly.
