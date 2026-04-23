# Guild VFX Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add combat visual effects to all 15 guilds across three output tracks (in-game actor overlays, world-space impact sprites, UI ability previews) plus wire AbilityPreview into MoveList.

**Architecture:** Viking is the reference implementation. Three tracks per guild: Track A adds Phaser Graphics draw methods to `ActorView.ts`; Track B generates PNG sprite strips via PowerShell and wires them into `simulation.ts` / `VfxRegistry.ts`; Track C adds animated SVG overlays to `AbilityPreview.tsx`. Tracks touch different files within a guild and can be parallelised; guilds themselves are sequential because Tracks A and C share files.

**Tech Stack:** TypeScript, React, Phaser 3, PowerShell + System.Drawing, SVG, Vitest

---

## Model Assignments

| Phase | Model | Reason |
|---|---|---|
| Task 0 — MoveList wiring | **Sonnet** | Straightforward React layout change, one file |
| Track B — all 12 PS1 scripts | **Sonnet** | Mechanical scripting, follows Knight template exactly |
| Track A — ActorView additions | **Sonnet** | Pattern-following; Viking draw methods are the reference |
| Track C — AbilityPreview SVG | **Sonnet** | SVG following Viking PreviewOverlay pattern |

## Parallelism Strategy

**Within each guild — run all three tracks simultaneously** (they touch different files):

| Track | Files touched |
|---|---|
| A | `src/game/view/ActorView.ts` only |
| B | `scripts/generate_{g}_vfx.ps1`, `public/vfx/{g}/`, `simulation.ts`, `VfxRegistry.ts` |
| C | `src/ui/AbilityPreview.tsx` only |

**Across guilds — Track B is safe to fully parallelise** (creates new files only). Tracks A and C modify shared files and must apply sequentially guild-by-guild.

**Recommended execution order:**
1. **Task 0** — MoveList wiring (sync, Sonnet)
2. **Track B batch** — dispatch 12 Sonnet subagents simultaneously, one per guild, each creating its script + PNGs + metadata
3. **Tracks A + C per guild** — sequential: one guild at a time, A and C dispatched in parallel within each guild, then commit

---

## File Map

**Modified once:**
- `src/screens/MoveList.tsx` — add `AbilityPreview` preview column

**Modified per guild (sequential):**
- `src/game/view/ActorView.ts` — guild draw methods appended per iteration
- `src/ui/AbilityPreview.tsx` — guild preview cases appended per iteration
- `packages/shared/src/simulation/simulation.ts` — `getAbilityAssetKey()` entries per guild
- `src/game/view/VfxRegistry.ts` — `VFX_GUILDS` entry per guild

**Created per guild (parallel-safe):**
- `scripts/generate_{guildId}_vfx.ps1`
- `public/vfx/{guildId}/metadata.json`
- `public/vfx/{guildId}/*.png` (output of the PS1 script)
- `public/vfx/{guildId}/README.md`

---

## Task 0 — Wire AbilityPreview into MoveList

**Files:** Modify `src/screens/MoveList.tsx`

- [ ] **Step 1: Update imports**

Add to the top import block in `MoveList.tsx`:
```tsx
import type { GuildId } from '@nannymud/shared/simulation/types';
import { AbilityPreview } from '../ui/AbilityPreview';
```
(`GuildId` is already available via the existing `GUILDS` import chain, but add the explicit type import for the `MoveRow` props.)

- [ ] **Step 2: Update TABLE_COLS and MoveHeader**

```tsx
const TABLE_COLS = '100px 72px 180px 1fr 240px 110px 110px';

function MoveHeader() {
  const cell: React.CSSProperties = {
    fontFamily: theme.fontMono,
    fontSize: 12,
    color: theme.inkMuted,
    letterSpacing: 3,
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        gap: 14,
        padding: '14px 6px',
        borderBottom: `1px solid ${theme.lineSoft}`,
      }}
    >
      <span style={cell} />
      <span style={cell}>SLOT</span>
      <span style={cell}>COMBO</span>
      <span style={cell}>NAME / EFFECT</span>
      <span style={cell}>TAGS</span>
      <span style={cell}>CD</span>
      <span style={cell}>COST</span>
    </div>
  );
}
```

- [ ] **Step 3: Update MoveRow signature and add preview cell**

```tsx
function MoveRow({
  slot,
  ability,
  accent,
  guildId,
  abilityIndex,
}: {
  slot: string;
  ability: AbilityDef;
  accent: string;
  guildId: GuildId;
  abilityIndex: number;
}) {
  const animationId = abilityIndex >= 0
    ? `ability_${abilityIndex + 1}`
    : 'basic_attack';
  const cdLabel = ability.cooldownMs > 0
    ? `${(ability.cooldownMs / 1000).toFixed(ability.cooldownMs < 10000 ? 1 : 0)}s`
    : '—';
  const costLabel = ability.cost > 0 ? String(ability.cost) : '—';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: TABLE_COLS,
        gap: 14,
        padding: '14px 6px',
        borderBottom: `1px solid ${theme.lineSoft}`,
        alignItems: 'start',
      }}
    >
      <div style={{ width: 96, height: 96, flexShrink: 0 }}>
        <AbilityPreview
          guildId={guildId}
          abilityId={ability.id}
          animationId={animationId}
          spriteScale={0.9}
          vfxScale={1.1}
        />
      </div>
      <span style={{ fontFamily: theme.fontMono, fontSize: 22, color: accent, letterSpacing: 2, lineHeight: 1 }}>
        {slot}
      </span>
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <ComboDisplay combo={ability.combo} size={24} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 22, color: theme.ink, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
          {ability.name}
        </div>
        <div style={{ fontFamily: theme.fontBody, fontSize: 16, color: theme.inkDim, lineHeight: 1.5, marginTop: 4 }}>
          {ability.description || '—'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        {ability.baseDamage > 0 && <TagPill tone="warn">DMG · {ability.baseDamage}</TagPill>}
        {ability.isHeal && <TagPill tone="good">HEAL</TagPill>}
        {ability.isProjectile && <TagPill>PROJECTILE</TagPill>}
        {ability.isTeleport && <TagPill>BLINK</TagPill>}
        {ability.isChannel && <TagPill>CHANNEL</TagPill>}
        {ability.aoeRadius > 0 && <TagPill>AOE</TagPill>}
      </div>
      <span style={{ fontFamily: theme.fontMono, fontSize: 20, color: ability.cooldownMs > 0 ? theme.ink : theme.inkMuted, letterSpacing: 1 }}>
        {cdLabel}
      </span>
      <span style={{ fontFamily: theme.fontMono, fontSize: 20, color: ability.cost > 0 ? accent : theme.inkMuted, letterSpacing: 1 }}>
        {costLabel}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Update the two call sites in MoveList body**

Find the two `<MoveRow .../>` calls and add `guildId` and `abilityIndex`:
```tsx
{guild.abilities.map((a, i) => (
  <MoveRow key={a.id} slot={SLOT_LABELS[i]} ability={a} accent={accent} guildId={sel} abilityIndex={i} />
))}
<MoveRow slot="R" ability={guild.rmb} accent={accent} guildId={sel} abilityIndex={-1} />
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 6: Verify in browser**

```bash
npm run dev:client
```
Navigate to the Move List screen. Confirm each row shows a preview cell on the left, Viking rows show SVG overlays, other guilds show the sprite strip fallback (or just a blank cell if no sprite loaded). No layout overflow.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MoveList.tsx
git commit -m "feat: wire AbilityPreview into MoveList rows"
```

---

## Reference Pattern: Adventurer (Guild 1 of 12)

> **This task is the full reference implementation. Tasks for guilds 2–12 follow identical structure — only the palette, shapes, and ability names differ. Read this task in full before implementing any later guild.**

### Task 1A — Adventurer: ActorView.ts overlays

**Files:** Modify `src/game/view/ActorView.ts`

**Palette:** primary `#c9a961` (gold), accent `#fde68a` (light gold), energy `#f59e0b` (amber), heal `#22c55e` (green), adrenaline `#f97316` (orange)

- [ ] **Step 1: Add private draw methods**

Insert the following private methods before the `syncFrom` method in `ActorView`:

```typescript
private drawAdventurerRallyingCry(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.6 + Math.sin(visualTime * 4) * 0.25;
  this.auraFx.lineStyle(3, 0xf59e0b, 0.72 + pulse * 0.18);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.38, bodyHeight * 0.98);
  this.auraFx.lineStyle(1.5, 0xfde68a, 0.5);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.15, bodyHeight * 0.78);
  for (let i = 0; i < 3; i++) {
    const angle = visualTime * 3 + i * ((Math.PI * 2) / 3);
    this.auraFx.fillStyle(0xfbbf24, 0.88);
    this.auraFx.fillCircle(
      Math.cos(angle) * this.width * 0.72,
      -bodyHeight * 0.52 + Math.sin(angle) * bodyHeight * 0.5,
      2.5,
    );
  }
  this.auraFx.setVisible(true);
}

private drawAdventurerAdrenalineRush(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.55 + Math.sin(visualTime * 8) * 0.3;
  this.auraFx.fillStyle(0xf97316, 0.1 + pulse * 0.08);
  this.auraFx.fillEllipse(0, -bodyHeight * 0.52, this.width * 1.45, bodyHeight * 1.02);
  this.auraFx.lineStyle(4, 0xf97316, 0.82 + pulse * 0.14);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.32, bodyHeight * 0.92);
  this.auraFx.lineStyle(2, 0xfde68a, 0.65);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.72);
  for (let i = 0; i < 4; i++) {
    const angle = visualTime * 5 + i * ((Math.PI * 2) / 4);
    this.auraFx.fillStyle(0xfb923c, 0.82);
    this.auraFx.fillCircle(
      Math.cos(angle) * this.width * 0.68,
      -bodyHeight * 0.52 + Math.sin(angle) * bodyHeight * 0.46,
      2,
    );
  }
  this.auraFx.setVisible(true);
}

private drawAdventurerBandage(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.5 + Math.sin(visualTime * 6) * 0.3;
  this.auraFx.lineStyle(3, 0x22c55e, 0.7 + pulse * 0.22);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.28, bodyHeight * 0.92);
  for (let i = 0; i < 4; i++) {
    const t = (visualTime * 1.5 + i * 0.35) % 1;
    const x = (i % 2 === 0 ? 1 : -1) * this.width * 0.22;
    const y = -bodyHeight * 0.1 - t * bodyHeight * 0.82;
    this.auraFx.fillStyle(0x4ade80, (1 - t) * 0.88);
    this.auraFx.fillCircle(x, y, 2.5);
  }
  this.auraFx.setVisible(true);
}

private drawAdventurerSlash(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(5.5, 0xc9a961, 0.92);
  this.attackFx.beginPath();
  this.attackFx.arc(8, -bodyHeight * 0.52, 33, -1.1, 0.9, false);
  this.attackFx.strokePath();
  this.attackFx.lineStyle(2.5, 0xfde68a, 0.82);
  this.attackFx.beginPath();
  this.attackFx.arc(8, -bodyHeight * 0.52, 22, -0.9, 0.72, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfff7ed, 0.92);
  this.attackFx.fillCircle(32, -bodyHeight * 0.56, 3);
  this.attackFx.setVisible(true);
}
```

- [ ] **Step 2: Add state checks and dispatch calls in syncFrom**

Inside `syncFrom`, after the existing Viking block (around line 415), add:

```typescript
const isAdventurer = actor.guildId === 'adventurer';
const isRallyingCry = isAdventurer && actor.statusEffects.some(
  e => e.type === 'speed_boost' && Math.abs(e.magnitude - 0.15) < 0.01,
);
const isAdrenalineRush = isAdventurer && actor.statusEffects.some(
  e => e.type === 'attack_speed_boost' && e.magnitude === 0.4,
);
const isAdventurerChanneling = isAdventurer && actor.state === 'channeling';
const isAdventurerSlash = isAdventurer && actor.state === 'attacking' && actor.animationId === 'ability_2';

if (isRallyingCry) this.drawAdventurerRallyingCry(bodyHeight, visualTime);
if (isAdrenalineRush) this.drawAdventurerAdrenalineRush(bodyHeight, visualTime);
if (isAdventurerChanneling) this.drawAdventurerBandage(bodyHeight, visualTime);
if (isAdventurerSlash) this.drawAdventurerSlash(bodyHeight);
```

- [ ] **Step 3: Extend buffTint chain**

Find the line:
```typescript
const buffTint = isUndyingRage ? 0x7f1d1d : isBloodlust ? 0xb91c1c : null;
```
Replace with:
```typescript
const buffTint = isUndyingRage ? 0x7f1d1d
  : isBloodlust ? 0xb91c1c
  : isAdrenalineRush ? 0xc2410c
  : null;
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

---

### Task 1B — Adventurer: world-space impact sprites

**Files:** Create `scripts/generate_adventurer_vfx.ps1`, `public/vfx/adventurer/metadata.json`, `public/vfx/adventurer/README.md`. Run script to produce PNGs. Modify `simulation.ts` and `VfxRegistry.ts`.

- [ ] **Step 1: Write the generation script**

Create `scripts/generate_adventurer_vfx.ps1`:

```powershell
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\adventurer'
$frameSize = 96
$gridSize = 32
$upscale = [int]($frameSize / $gridSize)
$largeFrame = 160
$largeGrid = 40
$largeUpscale = [int]($largeFrame / $largeGrid)

if (-not (Test-Path -LiteralPath $outDir)) {
  New-Item -ItemType Directory -Path $outDir | Out-Null
}

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}

$pal = @{
  gold    = New-Color '#c9a961'
  lgold   = New-Color '#fde68a'
  amber   = New-Color '#f59e0b'
  orange  = New-Color '#f97316'
  green   = New-Color '#22c55e'
  lgreen  = New-Color '#86efac'
  white   = New-Color '#f8fafc'
  dark    = New-Color '#1c1917'
}

function New-Brush([System.Drawing.Color]$c) { return New-Object System.Drawing.SolidBrush($c) }
function New-Pen([System.Drawing.Color]$c,[float]$w=1) {
  $p = New-Object System.Drawing.Pen($c,$w)
  $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $p
}

function New-Frame([int]$size=$gridSize) {
  return New-Object System.Drawing.Bitmap($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Scale-Frame([System.Drawing.Bitmap]$f,[int]$target=$frameSize) {
  $s = New-Object System.Drawing.Bitmap($target,$target,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($s)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $g.DrawImage($f,0,0,$target,$target)
  } finally { $g.Dispose() }
  return $s
}

function Save-Strip([string]$name,[System.Collections.Generic.List[System.Drawing.Bitmap]]$frames,[int]$target=$frameSize) {
  $strip = New-Object System.Drawing.Bitmap(($target*$frames.Count),$target,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($strip)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    for ($i = 0; $i -lt $frames.Count; $i++) {
      $sc = Scale-Frame $frames[$i] $target
      try { $g.DrawImage($sc,$i*$target,0,$target,$target) }
      finally { $sc.Dispose() }
    }
  } finally { $g.Dispose() }
  $path = Join-Path $outDir "$name.png"
  try { $strip.Save($path,[System.Drawing.Imaging.ImageFormat]::Png) }
  finally { $strip.Dispose() }
}

function Draw-Pixel([System.Drawing.Graphics]$g,[System.Drawing.Color]$c,[int]$x,[int]$y,[int]$w=1,[int]$h=1) {
  $b = New-Brush $c
  try { $g.FillRectangle($b,$x,$y,$w,$h) } finally { $b.Dispose() }
}

function Draw-Ring([System.Drawing.Graphics]$g,[System.Drawing.Color]$c,[int]$cx,[int]$cy,[int]$r,[int]$t=1) {
  for ($o = 0; $o -lt $t; $o++) {
    $p = New-Pen $c 1
    try { $g.DrawEllipse($p,$cx-($r-$o),$cy-($r-$o),($r-$o)*2,($r-$o)*2) }
    finally { $p.Dispose() }
  }
}

# ── rallying_cry_aura  (160×160, 8 frames) ─────────────────────────────────
function Add-RallyingCryFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 8; $idx++) {
    $frame = New-Frame $largeGrid
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 6 + $idx * 2
      Draw-Ring $g $pal.amber 20 20 $r 2
      Draw-Ring $g $pal.lgold 20 20 ($r-2) 1
      for ($i = 0; $i -lt 3; $i++) {
        $angle = [Math]::PI * 2 / 3 * $i + $idx * 0.5
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r+2)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r+2)))
        Draw-Pixel $g $pal.gold (20+$dx) (20+$dy) 2 2
      }
      Draw-Pixel $g $pal.white 19 17 2 2
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# ── slash_impact  (96×96, 5 frames) ────────────────────────────────────────
function Add-SlashImpactFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      for ($sl = 0; $sl -lt 3; $sl++) {
        $startX = 6 + $sl*3 + $idx*2
        $startY = 20 - $sl*4
        $pen = New-Pen $pal.gold 2
        $lite = New-Pen $pal.lgold 1
        try {
          $g.DrawLine($pen,$startX,$startY,$startX+12,$startY-12)
          $g.DrawLine($lite,$startX+1,$startY,$startX+11,$startY-11)
        } finally { $pen.Dispose(); $lite.Dispose() }
      }
      for ($sp = 0; $sp -le $idx; $sp++) {
        Draw-Pixel $g $pal.amber (20+$sp*2) (10+($sp%3)*3)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# ── bandage_glow  (96×96, 6 frames) ────────────────────────────────────────
function Add-BandageGlowFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.green 16 16 $r 2
      Draw-Ring $g $pal.lgreen 16 16 ($r-2) 1
      Draw-Pixel $g $pal.white 15 10 2 12
      Draw-Pixel $g $pal.white 10 15 12 2
      for ($dot = 0; $dot -lt ($idx+1); $dot++) {
        Draw-Pixel $g $pal.lgreen (8+$dot*3) (6+($dot%2)*3)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# ── adrenaline_rush_aura  (160×160, 7 frames) ──────────────────────────────
function Add-AdrenalineRushFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 7; $idx++) {
    $frame = New-Frame $largeGrid
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 5 + $idx * 2
      Draw-Ring $g $pal.orange 20 20 $r 2
      Draw-Ring $g $pal.amber  20 20 ($r-2) 1
      for ($i = 0; $i -lt 4; $i++) {
        $angle = [Math]::PI * 2 / 4 * $i + $idx * 0.4
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r+1)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r+1)))
        Draw-Pixel $g $pal.lgold (20+$dx) (20+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# ── second_wind_glow  (96×96, 5 frames) ────────────────────────────────────
function Add-SecondWindFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame
    $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 3 + $idx * 2
      Draw-Ring $g $pal.amber 16 16 $r 2
      for ($i = 0; $i -lt 6; $i++) {
        $angle = [Math]::PI * 2 / 6 * $i
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r+2)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r+2)))
        Draw-Pixel $g $pal.lgold (16+$dx) (16+$dy)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

$generated = @(
  @{ Name='rallying_cry_aura';    Frames=(Add-RallyingCryFrames);    Size=$largeFrame }
  @{ Name='slash_impact';         Frames=(Add-SlashImpactFrames);    Size=$frameSize  }
  @{ Name='bandage_glow';         Frames=(Add-BandageGlowFrames);    Size=$frameSize  }
  @{ Name='adrenaline_rush_aura'; Frames=(Add-AdrenalineRushFrames); Size=$largeFrame }
  @{ Name='second_wind_glow';     Frames=(Add-SecondWindFrames);     Size=$frameSize  }
)

foreach ($e in $generated) {
  try { Save-Strip $e.Name $e.Frames $e.Size }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}

Write-Output "Wrote Adventurer VFX strips to $outDir"
```

- [ ] **Step 2: Run the script**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate_adventurer_vfx.ps1
```
Expected: `Wrote Adventurer VFX strips to …/public/vfx/adventurer`
Verify five PNG files exist in `public/vfx/adventurer/`.

- [ ] **Step 3: Write metadata.json**

Create `public/vfx/adventurer/metadata.json`:
```json
{
  "guildId": "adventurer",
  "frameSize": { "w": 96, "h": 96 },
  "assets": {
    "rallying_cry_aura": {
      "frames": 8,
      "frameDurationMs": 120,
      "loop": false,
      "frameSize": { "w": 160, "h": 160 },
      "anchor": { "x": 80, "y": 80 },
      "scale": 1.45
    },
    "slash_impact": {
      "frames": 5,
      "frameDurationMs": 95,
      "loop": false,
      "anchor": { "x": 28, "y": 68 },
      "scale": 1.2
    },
    "bandage_glow": {
      "frames": 6,
      "frameDurationMs": 110,
      "loop": false,
      "anchor": { "x": 48, "y": 72 },
      "scale": 1.3
    },
    "adrenaline_rush_aura": {
      "frames": 7,
      "frameDurationMs": 125,
      "loop": false,
      "frameSize": { "w": 160, "h": 160 },
      "anchor": { "x": 80, "y": 80 },
      "scale": 1.5
    },
    "second_wind_glow": {
      "frames": 5,
      "frameDurationMs": 100,
      "loop": false,
      "anchor": { "x": 48, "y": 72 },
      "scale": 1.2
    }
  }
}
```

- [ ] **Step 4: Wire getAbilityAssetKey in simulation.ts**

In `packages/shared/src/simulation/simulation.ts`, inside the `getAbilityAssetKey` switch, add before the `default:` case:
```typescript
case 'rallying_cry':
  return eventType === 'aura_pulse' ? 'rallying_cry_aura' : undefined;
case 'slash':
  return eventType === 'hit_spark' ? 'slash_impact' : undefined;
case 'bandage':
  return eventType === 'heal_glow' ? 'bandage_glow' : undefined;
case 'adrenaline_rush':
  return eventType === 'aura_pulse' ? 'adrenaline_rush_aura' : undefined;
case 'second_wind':
  return eventType === 'aura_pulse' ? 'second_wind_glow' : undefined;
```

- [ ] **Step 5: Add to VFX_GUILDS in VfxRegistry.ts**

In `src/game/view/VfxRegistry.ts`, add `'adventurer'` to the `VFX_GUILDS` array:
```typescript
const VFX_GUILDS: GuildId[] = [
  'knight',
  'leper',
  'viking',
  'adventurer',
];
```

- [ ] **Step 6: Write README.md**

Create `public/vfx/adventurer/README.md`:
```markdown
# Adventurer VFX

## Active assets
- `rallying_cry_aura` — aura_pulse on rallying_cry
- `slash_impact` — hit_spark on slash
- `bandage_glow` — heal_glow on bandage
- `adrenaline_rush_aura` — aura_pulse on adrenaline_rush
- `second_wind_glow` — aura_pulse on second_wind

## Blocked
- `quickshot` — projectile_spawn; no projectile sprite asset yet
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

---

### Task 1C — Adventurer: AbilityPreview.tsx SVG overlays

**Files:** Modify `src/ui/AbilityPreview.tsx`

- [ ] **Step 1: Extend PreviewEffect union**

Find the `type PreviewEffect = ...` declaration and add Adventurer values:
```typescript
type PreviewEffect =
  | 'viking_whirlwind'
  | 'viking_harpoon'
  | 'viking_bloodlust'
  | 'viking_axe_swing'
  | 'viking_undying_rage'
  | 'viking_shield_bash'
  | 'adventurer_rallying_cry'
  | 'adventurer_slash'
  | 'adventurer_bandage'
  | 'adventurer_adrenaline_rush'
  | 'adventurer_second_wind';
```

- [ ] **Step 2: Add case to getAbilityPreviewSpec**

Inside the outer `switch (guildId)`, add after the `'viking'` case:
```typescript
case 'adventurer':
  switch (abilityId) {
    case 'rallying_cry':    return { effect: 'adventurer_rallying_cry' };
    case 'slash':           return { effect: 'adventurer_slash' };
    case 'bandage':         return { effect: 'adventurer_bandage' };
    case 'adrenaline_rush': return { effect: 'adventurer_adrenaline_rush' };
    case 'second_wind':     return { effect: 'adventurer_second_wind' };
    default:                return {};
  }
```

- [ ] **Step 3: Add sprite transform cases in getSpriteTransform**

Inside `getSpriteTransform`, add to the `switch (effect)`:
```typescript
case 'adventurer_rallying_cry':
  scale *= 1.0 + Math.sin(progress * TAU) * 0.02;
  y += 4;
  break;
case 'adventurer_slash':
  x = 2 + Math.sin(progress * TAU) * 2;
  y += 4;
  break;
case 'adventurer_bandage':
  scale *= 1.0 + Math.sin(progress * TAU * 2) * 0.015;
  y += 4;
  break;
case 'adventurer_adrenaline_rush':
  scale *= 1.06 + Math.sin(progress * TAU) * 0.03;
  y += 2;
  break;
case 'adventurer_second_wind':
  y += 4;
  break;
```

- [ ] **Step 4: Add tint cases**

Inside `AbilityPreview`, find the `tint` derivation and extend it:
```typescript
const tint =
  preview.effect === 'viking_bloodlust'
    ? 'drop-shadow(0 0 16px rgba(220,38,38,0.55)) sepia(1) saturate(6) hue-rotate(-38deg) brightness(0.88)'
    : preview.effect === 'viking_undying_rage'
      ? 'drop-shadow(0 0 18px rgba(127,29,29,0.6)) sepia(1) saturate(4) hue-rotate(-32deg) brightness(0.86)'
      : preview.effect === 'adventurer_adrenaline_rush'
        ? 'drop-shadow(0 0 14px rgba(249,115,22,0.5)) sepia(0.4) saturate(2) hue-rotate(8deg) brightness(1.05)'
        : 'none';
```

- [ ] **Step 5: Add SVG content to PreviewOverlay**

Inside `PreviewOverlay`'s `switch (effect)`, add after the last Viking case:
```tsx
case 'adventurer_rallying_cry':
  content = (
    <>
      <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#f59e0b" strokeWidth={4} opacity={0.72 + pulse * 0.2} />
      <ellipse cx="60" cy="60" rx="24" ry="28" fill="none" stroke="#fde68a" strokeWidth={2} opacity={0.58} />
      {[0, 1, 2].map(i => (
        <circle
          key={i}
          cx={60 + Math.cos(orbit + i * TAU / 3) * 36}
          cy={60 + Math.sin(orbit + i * TAU / 3) * 18}
          r="3"
          fill="#fbbf24"
          opacity={0.9}
        />
      ))}
    </>
  );
  break;
case 'adventurer_slash':
  content = (
    <>
      <path d={`M44 ${74 - sweep * 4} A26 26 0 0 1 90 44`} fill="none" stroke="#c9a961" strokeWidth={8} strokeLinecap="round" opacity="0.95" />
      <path d={`M50 ${68 - sweep * 3} A18 18 0 0 1 84 50`} fill="none" stroke="#fde68a" strokeWidth={4} strokeLinecap="round" opacity="0.9" />
      <circle cx={88} cy={44} r="3.5" fill="#fff7ed" opacity="0.92" />
    </>
  );
  break;
case 'adventurer_bandage':
  content = (
    <>
      <ellipse cx="60" cy="60" rx="28" ry="32" fill="#14532d" opacity={0.15 + pulse * 0.1} />
      <ellipse cx="60" cy="60" rx="32" ry="36" fill="none" stroke="#22c55e" strokeWidth={3} opacity={0.62 + pulse * 0.28} />
      <line x1="60" y1="44" x2="60" y2="76" stroke="#86efac" strokeWidth={3} opacity={0.78} />
      <line x1="44" y1="60" x2="76" y2="60" stroke="#86efac" strokeWidth={3} opacity={0.78} />
      {[0, 1, 2, 3].map(i => {
        const t = (progress * 1.5 + i * 0.3) % 1;
        return (
          <circle key={i} cx={52 + (i % 2) * 16} cy={72 - t * 32} r="2" fill="#4ade80" opacity={1 - t} />
        );
      })}
    </>
  );
  break;
case 'adventurer_adrenaline_rush':
  content = (
    <>
      <ellipse cx="60" cy="60" rx="30" ry="34" fill="#7c2d12" opacity={0.18 + pulse * 0.1} />
      <ellipse cx="60" cy="60" rx="38" ry="42" fill="none" stroke="#f97316" strokeWidth={5} opacity={0.84 + pulse * 0.13} />
      <ellipse cx="60" cy="60" rx="26" ry="30" fill="none" stroke="#fde68a" strokeWidth={2.5} opacity={0.68} />
      {[0, 1, 2, 3].map(i => (
        <circle
          key={i}
          cx={60 + Math.cos(orbit * 1.4 + i * TAU / 4) * 32}
          cy={60 + Math.sin(orbit * 1.4 + i * TAU / 4) * 16}
          r="2.5"
          fill="#fb923c"
          opacity={0.82}
        />
      ))}
    </>
  );
  break;
case 'adventurer_second_wind':
  content = (
    <>
      <ellipse cx="60" cy="60" rx="22" ry="26" fill="#78350f" opacity={0.16 + pulse * 0.12} />
      <ellipse cx="60" cy="60" rx="28" ry="32" fill="none" stroke="#f59e0b" strokeWidth={4} opacity={0.7 + pulse * 0.25} />
      {[0, 1, 2, 3, 4, 5].map(i => {
        const angle = i * TAU / 6;
        const r = 22 + pulse * 8;
        return (
          <circle key={i} cx={60 + Math.cos(angle) * r} cy={60 + Math.sin(angle) * r * 0.58} r="2" fill="#fde68a" opacity={0.7 + pulse * 0.25} />
        );
      })}
    </>
  );
  break;
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

- [ ] **Step 7: Verify in browser**

```bash
npm run dev:client
```
Navigate to `/dossier?guild=adventurer`. Confirm each ability card shows an animated SVG overlay. Check move list shows the same previews.

---

### Task 1D — Adventurer: commit

- [ ] **Commit all Adventurer tracks**

```bash
git add src/game/view/ActorView.ts \
        src/ui/AbilityPreview.tsx \
        scripts/generate_adventurer_vfx.ps1 \
        public/vfx/adventurer/ \
        packages/shared/src/simulation/simulation.ts \
        src/game/view/VfxRegistry.ts
git commit -m "feat: add adventurer VFX — actor overlays, impact strips, ability previews"
```

---

## Guild Template (Tasks 2–12)

> **For each guild below:** follow the identical four-task structure from Adventurer (1A → 1B → 1C → 1D). The guild-specific section provides all values needed. The PS1 script framework, metadata structure, ActorView pattern, and AbilityPreview pattern are identical — only palette, frame counts, shapes, and ability names differ.

---

## Task 2 — Mage

**Palette:** primary `#8e6dc8` (purple), frost `#93c5fd` (ice blue), arcane `#c084fc` (violet), deep `#1e1b4b` (dark blue), white `#f0f9ff`

### Track A — ActorView state checks
```typescript
const isMage = actor.guildId === 'mage';
const isMageBlinking = isMage && actor.state === 'channeling';
const isMageIcenova = isMage && actor.state === 'attacking' && actor.animationId === 'ability_1';
const isMageMeteorCast = isMage && actor.state === 'casting';
```

**draw methods to add:**

`drawMageIceNova(bodyHeight)` — `attackFx`: ring of ice-blue fragments radiating outward, 6 shards drawn at clock positions.
```typescript
private drawMageIceNova(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(4, 0x93c5fd, 0.9);
  this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 36);
  this.attackFx.lineStyle(2, 0xe0f2fe, 0.7);
  this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 24);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 / 6) * i;
    this.attackFx.fillStyle(0xbae6fd, 0.9);
    this.attackFx.fillTriangle(
      Math.cos(a) * 28, -bodyHeight * 0.5 + Math.sin(a) * 28,
      Math.cos(a + 0.25) * 38, -bodyHeight * 0.5 + Math.sin(a + 0.25) * 38,
      Math.cos(a - 0.25) * 38, -bodyHeight * 0.5 + Math.sin(a - 0.25) * 38,
    );
  }
  this.attackFx.setVisible(true);
}
```

`drawMageMeteorCast(bodyHeight, visualTime)` — `auraFx`: concentric red-hot rings pulsing, 3 orbiting ember dots.
```typescript
private drawMageMeteorCast(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.6 + Math.sin(visualTime * 6) * 0.3;
  this.auraFx.lineStyle(4, 0xef4444, 0.8 + pulse * 0.15);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.94);
  this.auraFx.lineStyle(2, 0xfca5a5, 0.6);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.1, bodyHeight * 0.74);
  for (let i = 0; i < 3; i++) {
    const a = visualTime * 4 + i * (Math.PI * 2 / 3);
    this.auraFx.fillStyle(0xf97316, 0.9);
    this.auraFx.fillCircle(Math.cos(a) * this.width * 0.66, -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46, 2.5);
  }
  this.auraFx.setVisible(true);
}
```

**syncFrom additions:**
```typescript
if (isMageIcenova) this.drawMageIceNova(bodyHeight);
if (isMageMeteorCast) this.drawMageMeteorCast(bodyHeight, visualTime);
```

### Track B — PS1 script (copy full framework from Adventurer; replace palette + these frame functions)

**Effects + sizes:**
| Asset key | Size | Frames | Hook |
|---|---|---|---|
| `ice_nova_burst` | 160×160 | 7 | `aoe_pop` on `ice_nova` |
| `meteor_impact` | 160×160 | 8 | `aoe_pop` on `meteor` |

**`Add-IceNovaBurstFrames` (7 frames, large grid 40×40):** Each frame: large ring expanding from center (radius 4+idx*2), 6 ice-shard pixels at ring edge in `#93c5fd`, small inner ring in `#e0f2fe`. Increasing radius each frame.

**`Add-MeteorImpactFrames` (8 frames, large grid 40×40):** Each frame: inner filled circle (radius idx, `#ef4444` 30% alpha), ring in `#f97316` expanding, outer ring in `#fca5a5` 2px behind, 4 debris pixels flying outward from ring edge.

**metadata.json entries:**
```json
"ice_nova_burst": { "frames": 7, "frameDurationMs": 115, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.5 },
"meteor_impact":  { "frames": 8, "frameDurationMs": 125, "loop": false, "frameSize": {"w":160,"h":160}, "anchor": {"x":80,"y":80}, "scale": 1.6 }
```

**simulation.ts additions:**
```typescript
case 'ice_nova': return eventType === 'aoe_pop' ? 'ice_nova_burst' : undefined;
case 'meteor':   return eventType === 'aoe_pop' ? 'meteor_impact'  : undefined;
```

### Track C — AbilityPreview SVG

**New PreviewEffect values:** `'mage_ice_nova' | 'mage_blink' | 'mage_meteor'`

**getAbilityPreviewSpec case:**
```typescript
case 'mage':
  switch (abilityId) {
    case 'ice_nova':   return { effect: 'mage_ice_nova' };
    case 'blink':      return { effect: 'mage_blink' };
    case 'meteor':     return { effect: 'mage_meteor' };
    default:           return {};
  }
```

**SVG content:**
```tsx
case 'mage_ice_nova':
  content = (
    <>
      <circle cx="60" cy="60" r="34" fill="none" stroke="#93c5fd" strokeWidth={4} opacity={0.82 + pulse * 0.14} />
      <circle cx="60" cy="60" r="24" fill="none" stroke="#e0f2fe" strokeWidth={2} opacity={0.6} />
      {[0,1,2,3,4,5].map(i => {
        const a = orbit * 0.5 + i * TAU / 6;
        return <polygon key={i} points={`${60+Math.cos(a)*30},${60+Math.sin(a)*30} ${60+Math.cos(a+0.28)*40},${60+Math.sin(a+0.28)*40} ${60+Math.cos(a-0.28)*40},${60+Math.sin(a-0.28)*40}`} fill="#bae6fd" opacity="0.88" />;
      })}
    </>
  );
  break;
case 'mage_blink':
  content = (
    <>
      {[0,1,2,3].map(i => {
        const t = (progress + i * 0.25) % 1;
        return <circle key={i} cx={60 - t * 30} cy={62} r={3 * (1-t)} fill="#c084fc" opacity={1-t} />;
      })}
      <circle cx="38" cy="62" r="4" fill="#818cf8" opacity={0.6 + pulse * 0.3} />
    </>
  );
  break;
case 'mage_meteor':
  content = (
    <>
      <ellipse cx="60" cy="60" rx="34" ry="38" fill="#450a0a" opacity={0.2 + pulse * 0.1} />
      <ellipse cx="60" cy="60" rx="38" ry="42" fill="none" stroke="#ef4444" strokeWidth={5} opacity={0.88} />
      <ellipse cx="60" cy="60" rx="26" ry="30" fill="none" stroke="#fca5a5" strokeWidth={2.5} opacity={0.68} />
      {[0,1,2].map(i => {
        const a = orbit * 2 + i * TAU / 3;
        return <circle key={i} cx={60+Math.cos(a)*30} cy={60+Math.sin(a)*15} r="3" fill="#f97316" opacity="0.85" />;
      })}
    </>
  );
  break;
```

**README blocked:** `frostbolt`, `arcane_shard` — projectile assets not yet generated.

---

## Task 3 — Druid

**Palette:** primary `#4caf50` (green), nature `#65a30d` (dark green), heal `#86efac` (light green), bark `#78350f` (brown), white `#f0fdf4`

### Track A state checks
```typescript
const isDruid = actor.guildId === 'druid';
const isDruidWildGrowth = isDruid && actor.state === 'attacking' && actor.animationId === 'ability_1';
const isDruidChanneling = isDruid && actor.state === 'channeling';
const isDruidShapeshift = isDruid && actor.shapeshiftForm != null;
```

**draw methods:** `drawDruidWildGrowth(bodyHeight)` — `attackFx`: expanding green ring + 4 upward leaf-dot particles.  
`drawDruidChanneling(bodyHeight, visualTime)` — `auraFx`: soft green double ellipse with upward heal particles.  
`drawDruidShapeshift(bodyHeight, visualTime)` — `auraFx`: green aura pulse + scale 1.08 on sprite.

```typescript
private drawDruidWildGrowth(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(4, 0x4caf50, 0.88);
  this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 34);
  this.attackFx.lineStyle(2, 0x86efac, 0.7);
  this.attackFx.strokeCircle(0, -bodyHeight * 0.5, 22);
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i;
    this.attackFx.fillStyle(0x4ade80, 0.9);
    this.attackFx.fillCircle(Math.cos(a) * 30, -bodyHeight * 0.5 + Math.sin(a) * 30, 3);
  }
  this.attackFx.setVisible(true);
}

private drawDruidChanneling(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.55 + Math.sin(visualTime * 5) * 0.28;
  this.auraFx.lineStyle(3, 0x4caf50, 0.68 + pulse * 0.22);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.35, bodyHeight * 0.96);
  this.auraFx.lineStyle(1.5, 0x86efac, 0.5);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.12, bodyHeight * 0.76);
  for (let i = 0; i < 5; i++) {
    const t = (visualTime * 1.2 + i * 0.28) % 1;
    const x = (i % 2 === 0 ? 1 : -1) * this.width * 0.24;
    this.auraFx.fillStyle(0x4ade80, (1 - t) * 0.85);
    this.auraFx.fillCircle(x, -bodyHeight * 0.08 - t * bodyHeight * 0.78, 2.5);
  }
  this.auraFx.setVisible(true);
}

private drawDruidShapeshift(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const pulse = 0.6 + Math.sin(visualTime * 3) * 0.25;
  this.auraFx.lineStyle(4, 0x65a30d, 0.7 + pulse * 0.2);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.42, bodyHeight * 1.02);
  this.auraFx.lineStyle(2, 0x4caf50, 0.55);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.2, bodyHeight * 0.82);
  this.auraFx.setVisible(true);
  if (this.sprite) this.sprite.setScale(this.spriteScale * 1.08);
}
```

### Track B effects
| Asset key | Size | Frames | Hook |
|---|---|---|---|
| `wild_growth_bloom` | 160×160 | 7 | `heal_glow` on `wild_growth` |
| `rejuvenate_glow` | 96×96 | 6 | `heal_glow` on `rejuvenate` |
| `cleanse_glow` | 96×96 | 6 | `heal_glow` on `cleanse` |
| `tranquility_pulse` | 160×160 | 8 | `channel_pulse` on `tranquility` |
| `shapeshift_burst` | 96×96 | 5 | `aoe_pop` on `shapeshift` |

All use green palette. Bloom: ring + leaf-dot ring. Rejuvenate/Cleanse: inward ring with upward dots. Tranquility: double ring slow pulse. Shapeshift: quick ring burst with particle explosion.

### Track C SVG effects
`'druid_wild_growth'` — expanding green ring, 4 leaf dots at ring.  
`'druid_channeling'` — double soft green ellipse, upward rising dots.  
`'druid_shapeshift'` — quick burst ring, green sparks.

---

## Task 4 — Monk

**Palette:** primary `#d9a441` (gold), chi `#fcd34d` (yellow), body `#f59e0b` (amber), strike `#ef4444` (red-orange), white `#fffbeb`

### Track A state checks
```typescript
const isMonk = actor.guildId === 'monk';
const isMonkJab = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_3';
const isMonkFlyingKick = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_2';
const isMonkFivePoint = isMonk && actor.state === 'attacking' && actor.animationId === 'ability_4';
const isMonkSerenity = isMonk && actor.statusEffects.some(e => e.type === 'untargetable');
const isMonkDragonsFury = isMonk && actor.state === 'channeling';
```

**draw methods:**  
`drawMonkJab(bodyHeight)` — `attackFx`: small forward straight line + spark.  
`drawMonkFlyingKick(bodyHeight)` — `attackFx`: wide sweeping arc + 2 impact sparks.  
`drawMonkFivePoint(bodyHeight)` — `attackFx`: 5-dot pentagram around impact zone in red.  
`drawMonkSerenity(bodyHeight, visualTime)` — `auraFx`: chi orbs orbiting rapidly, gold ellipse.  
`drawMonkDragonsFury(bodyHeight, visualTime)` — `auraFx`: rotating orange ring, rapid chi sparks.

```typescript
private drawMonkJab(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(4, 0xfcd34d, 0.9);
  this.attackFx.beginPath();
  this.attackFx.arc(10, -bodyHeight * 0.5, 20, -0.6, 0.6, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfff7ed, 0.95);
  this.attackFx.fillCircle(24, -bodyHeight * 0.5, 2.5);
  this.attackFx.setVisible(true);
}

private drawMonkFlyingKick(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(6, 0xf59e0b, 0.92);
  this.attackFx.beginPath();
  this.attackFx.arc(10, -bodyHeight * 0.48, 38, -1.2, 1.0, false);
  this.attackFx.strokePath();
  this.attackFx.lineStyle(3, 0xfde68a, 0.8);
  this.attackFx.beginPath();
  this.attackFx.arc(10, -bodyHeight * 0.48, 26, -1.0, 0.8, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfff7ed, 0.95);
  this.attackFx.fillCircle(36, -bodyHeight * 0.52, 3);
  this.attackFx.fillCircle(28, -bodyHeight * 0.7, 2.5);
  this.attackFx.setVisible(true);
}

private drawMonkFivePoint(bodyHeight: number): void {
  this.attackFx.clear();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
    this.attackFx.fillStyle(0xef4444, 0.88);
    this.attackFx.fillCircle(10 + Math.cos(a) * 18, -bodyHeight * 0.5 + Math.sin(a) * 18, 3);
  }
  this.attackFx.fillStyle(0xfcd34d, 0.9);
  this.attackFx.fillCircle(10, -bodyHeight * 0.5, 4);
  this.attackFx.setVisible(true);
}

private drawMonkSerenity(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  const chiOrbs = Math.min(5, actor?.chiOrbs ?? 0); // note: pass chiOrbs via actor if available
  this.auraFx.lineStyle(2, 0xfcd34d, 0.72);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.3, bodyHeight * 0.92);
  for (let i = 0; i < 5; i++) {
    const a = visualTime * 6 + i * (Math.PI * 2 / 5);
    this.auraFx.fillStyle(i < chiOrbs ? 0xfcd34d : 0x44403c, i < chiOrbs ? 0.9 : 0.4);
    this.auraFx.fillCircle(Math.cos(a) * this.width * 0.66, -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46, 3);
  }
  this.auraFx.setVisible(true);
}

private drawMonkDragonsFury(bodyHeight: number, visualTime: number): void {
  this.auraFx.clear();
  this.auraFx.lineStyle(5, 0xf97316, 0.88);
  this.auraFx.beginPath();
  this.auraFx.arc(0, -bodyHeight * 0.52, 32, visualTime * 8, visualTime * 8 + 2.5, false);
  this.auraFx.strokePath();
  for (let i = 0; i < 4; i++) {
    const a = visualTime * 12 + i * (Math.PI / 2);
    this.auraFx.fillStyle(0xfcd34d, 0.9);
    this.auraFx.fillCircle(Math.cos(a) * 24, -bodyHeight * 0.52 + Math.sin(a) * 24, 2.5);
  }
  this.auraFx.setVisible(true);
}
```

> Note: `drawMonkSerenity` references `actor` which is not directly available in private methods. Pass `chiOrbs` as a parameter: `drawMonkSerenity(bodyHeight, visualTime, actor.chiOrbs ?? 0)`.

**syncFrom additions (and fix method signature):**
```typescript
if (isMonkSerenity) this.drawMonkSerenity(bodyHeight, visualTime, actor.chiOrbs ?? 0);
if (isMonkDragonsFury) this.drawMonkDragonsFury(bodyHeight, visualTime);
if (isMonkJab) this.drawMonkJab(bodyHeight);
if (isMonkFlyingKick) this.drawMonkFlyingKick(bodyHeight);
if (isMonkFivePoint) this.drawMonkFivePoint(bodyHeight);
```

### Track B effects
| Asset key | Size | Frames | Hook |
|---|---|---|---|
| `serenity_aura` | 160×160 | 7 | `aura_pulse` on `serenity` |
| `flying_kick_impact` | 96×96 | 5 | `hit_spark` on `flying_kick` |
| `jab_impact` | 96×96 | 4 | `hit_spark` on `jab` |
| `five_point_impact` | 96×96 | 6 | `hit_spark` on `five_point_palm` |
| `dragons_fury_pulse` | 160×160 | 7 | `channel_pulse` on `dragons_fury` |
| `parry_flash` | 96×96 | 5 | `aoe_pop` on `monk_parry` |

### Track C SVG: `'monk_jab'`, `'monk_flying_kick'`, `'monk_five_point'`, `'monk_serenity'`, `'monk_dragons_fury'`, `'monk_parry'`

---

## Task 5 — Champion

**Palette:** primary `#a71d2a` (blood red), tally `#dc2626` (red), dark `#450a0a` (near-black), gold `#fbbf24` (contrast), white `#fef2f2`

### Track A state checks
```typescript
const isChampion = actor.guildId === 'champion';
const isChargeAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_2';
const isExecuteAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_3';
const isCleaverAttack = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_4';
const isSkullsplitter = isChampion && actor.state === 'attacking' && actor.animationId === 'ability_5';
const isChampionChanneling = isChampion && actor.statusEffects.some(e => e.type === 'attack_speed_boost');
const bloodtally = (isChampion ? actor.mp : 0);
```

**draw methods:**  
`drawChampionChargeImpact(bodyHeight)` — `attackFx`: wide forward sweep arc in red.  
`drawChampionExecute(bodyHeight)` — `attackFx`: downward heavy chop lines with blood drops.  
`drawChampionCleaver(bodyHeight)` — `attackFx`: arc sweep + 3 particles.  
`drawChampionSkullsplitter(bodyHeight)` — `attackFx`: double thick arc + large impact sparks.  
`drawChampionTitheFx(bodyHeight, visualTime, tally)` — `auraFx`: tally count dots orbiting + red glow.

```typescript
private drawChampionChargeImpact(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(7, 0xdc2626, 0.92);
  this.attackFx.beginPath();
  this.attackFx.arc(12, -bodyHeight * 0.5, 36, -1.0, 0.8, false);
  this.attackFx.strokePath();
  this.attackFx.lineStyle(3, 0xfca5a5, 0.7);
  this.attackFx.beginPath();
  this.attackFx.arc(12, -bodyHeight * 0.5, 24, -0.8, 0.6, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfef2f2, 0.9);
  this.attackFx.fillCircle(38, -bodyHeight * 0.56, 3.5);
  this.attackFx.setVisible(true);
}

private drawChampionExecute(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(6, 0x7f1d1d, 0.95);
  this.attackFx.beginPath();
  this.attackFx.moveTo(-8, -bodyHeight * 0.8);
  this.attackFx.lineTo(16, -bodyHeight * 0.25);
  this.attackFx.strokePath();
  this.attackFx.lineStyle(3, 0xdc2626, 0.8);
  this.attackFx.beginPath();
  this.attackFx.moveTo(0, -bodyHeight * 0.78);
  this.attackFx.lineTo(20, -bodyHeight * 0.26);
  this.attackFx.strokePath();
  for (let i = 0; i < 3; i++) {
    this.attackFx.fillStyle(0xdc2626, 0.85);
    this.attackFx.fillCircle(8 + i * 6, -bodyHeight * 0.3 + i * 8, 2.5);
  }
  this.attackFx.setVisible(true);
}

private drawChampionCleaver(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(5, 0xa71d2a, 0.9);
  this.attackFx.beginPath();
  this.attackFx.arc(8, -bodyHeight * 0.52, 30, -1.05, 0.85, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfca5a5, 0.88);
  for (const [ox, oy] of [[24,-bodyHeight*0.72],[32,-bodyHeight*0.52],[26,-bodyHeight*0.32]] as [number,number][]) {
    this.attackFx.fillCircle(ox, oy, 2.5);
  }
  this.attackFx.setVisible(true);
}

private drawChampionSkullsplitter(bodyHeight: number): void {
  this.attackFx.clear();
  this.attackFx.lineStyle(8, 0x450a0a, 0.95);
  this.attackFx.beginPath();
  this.attackFx.arc(10, -bodyHeight * 0.5, 40, -1.15, 0.95, false);
  this.attackFx.strokePath();
  this.attackFx.lineStyle(4, 0xdc2626, 0.85);
  this.attackFx.beginPath();
  this.attackFx.arc(10, -bodyHeight * 0.5, 28, -1.0, 0.8, false);
  this.attackFx.strokePath();
  this.attackFx.fillStyle(0xfbbf24, 0.95);
  this.attackFx.fillCircle(38, -bodyHeight * 0.58, 4);
  this.attackFx.fillCircle(28, -bodyHeight * 0.76, 3);
  this.attackFx.setVisible(true);
}

private drawChampionTitheFx(bodyHeight: number, visualTime: number, tally: number): void {
  this.auraFx.clear();
  if (tally === 0) return;
  const pulse = 0.55 + Math.sin(visualTime * 5) * 0.28;
  this.auraFx.lineStyle(3, 0xdc2626, 0.65 + pulse * 0.2);
  this.auraFx.strokeEllipse(0, -bodyHeight * 0.52, this.width * 1.32, bodyHeight * 0.94);
  for (let i = 0; i < Math.min(10, tally); i++) {
    const a = visualTime * 3 + i * (Math.PI * 2 / 10);
    this.auraFx.fillStyle(i < tally ? 0xdc2626 : 0x44403c, i < tally ? 0.85 : 0.3);
    this.auraFx.fillCircle(Math.cos(a) * this.width * 0.68, -bodyHeight * 0.52 + Math.sin(a) * bodyHeight * 0.46, 2.5);
  }
  this.auraFx.setVisible(true);
}
```

**syncFrom additions:**
```typescript
if (isChargeAttack) this.drawChampionChargeImpact(bodyHeight);
if (isExecuteAttack) this.drawChampionExecute(bodyHeight);
if (isCleaverAttack) this.drawChampionCleaver(bodyHeight);
if (isSkullsplitter) this.drawChampionSkullsplitter(bodyHeight);
if (isChampionChanneling) this.drawChampionTitheFx(bodyHeight, visualTime, bloodtally);
```

### Track B effects
| Asset key | Size | Frames | Hook |
|---|---|---|---|
| `charge_impact` | 96×96 | 5 | `hit_spark` on `berserker_charge` |
| `execute_impact` | 96×96 | 5 | `hit_spark` on `execute` |
| `cleaver_impact` | 96×96 | 5 | `hit_spark` on `cleaver` |
| `skullsplitter_burst` | 160×160 | 8 | `aoe_pop` on `skullsplitter` |
| `tithe_glow` | 96×96 | 6 | `heal_glow` on `tithe_of_blood` |
| `challenge_mark` | 96×96 | 5 | `aoe_pop` on `challenge` |

### Track C SVG: `'champion_charge'`, `'champion_execute'`, `'champion_cleaver'`, `'champion_skullsplitter'`, `'champion_tithe'`, `'champion_challenge'`

---

## Tasks 6–12 — Remaining Guilds (abbreviated)

> These guilds follow identical structure. Track B script, metadata, and Track C SVG follow the Adventurer reference pattern. State checks and draw methods follow the Viking/Adventurer ActorView pattern.

### Task 6 — Hunter
**Palette:** `#8d6e63` brown, `#a3e635` lime, `#fbbf24` amber, `#1c1917` dark
**Track A:** `drawHunterDisengage(bodyHeight)` — smoke ring burst, lime. `drawHunterRainChannel(bodyHeight, visualTime)` — downward arrow rain dots. `drawHunterBearTrapSet(bodyHeight)` — brief gold flash arc.
**Track B:** `disengage_burst` 96px 6f `aoe_pop`, `bear_trap_snap` 96px 5f `aoe_pop`, `rain_pulse` 160px 7f `channel_pulse`
**Track C:** `'hunter_disengage'`, `'hunter_rain'`, `'hunter_trap'`
**Blocked:** `piercing_volley`, `aimed_shot` — projectile assets

### Task 7 — Prophet
**Palette:** `#f7e8a4` gold-white, `#fde68a` pale gold, `#fbbf24` bright gold, `#7c3aed` curse violet, `#f8fafc` white
**Track A:** `drawProphetShieldAura(bodyHeight, visualTime)` — holy ring with cross glints. `drawProphetBlessAura(bodyHeight, visualTime)` — warm gold double ring. `drawProphetDivineIntervention(bodyHeight)` — bright white flood ring.
**Track B:** `prophetic_shield_aura` 160px 8f `aura_pulse`, `bless_aura` 160px 7f `aura_pulse`, `curse_mark` 96px 5f `aoe_pop`, `divine_insight_burst` 160px 6f `aoe_pop`, `divine_intervention_aura` 160px 8f `aura_pulse`
**Track C:** `'prophet_shield'`, `'prophet_bless'`, `'prophet_curse'`, `'prophet_divine'`
**Blocked:** `smite` — projectile asset

### Task 8 — Vampire
**Palette:** `#7a1935` deep crimson, `#dc2626` blood red, `#fca5a5` pale red, `#1e1b4b` shadow, `#f8fafc` white
**Track A:** `drawVampireBloodDrain(bodyHeight, visualTime)` — crimson inward spiral draw. `drawVampireNocturne(bodyHeight, visualTime)` — shadow dissolve ring + slow speed tint. `drawVampireFangStrike(bodyHeight)` — two slash lines crossing at impact point.
**Track B:** `blood_drain_glow` 96px 6f `heal_glow`, `fang_strike_impact` 96px 5f `hit_spark`, `nocturne_aura` 160px 8f `aura_pulse`
**Track C:** `'vampire_blood_drain'`, `'vampire_nocturne'`, `'vampire_fang_strike'`, `'vampire_shadow_step'`
**Blocked:** `hemorrhage` — projectile

### Task 9 — Darkmage
**Palette:** `#4a1458` deep purple, `#6d28d9` violet, `#a855f7` bright violet, `#1e1b4b` dark blue, `#030712` near-black
**Track A:** `drawDarkmageDarkness(bodyHeight)` — black fog ring on attackFx. `drawDarkmageSoulLeech(bodyHeight, visualTime)` — violet inward drain ring. `drawDarkmageEternalNight(bodyHeight, visualTime)` — expanding dark zone pulse, slow orbit.
**Track B:** `darkness_burst` 160px 7f `aoe_pop`, `soul_leech_drain` 96px 6f `heal_glow`, `eternal_night_burst` 160px 8f `aoe_pop`, `shadow_cloak_aura` 160px 7f `aura_pulse`
**Track C:** `'darkmage_darkness'`, `'darkmage_soul_leech'`, `'darkmage_eternal_night'`, `'darkmage_shadow_cloak'`
**Blocked:** `grasping_shadow`, `shadow_bolt` — projectile assets

### Task 10 — Cultist
**Palette:** `#2e4c3a` deep teal, `#134e4a` dark teal, `#065f46` forest, `#166534` mid green, `#000000` void black
**Track A:** `drawCultistMadness(bodyHeight, visualTime)` — chaotic pulsing multi-ring, unstable rotation. `drawCultistGateChannel(bodyHeight, visualTime)` — rotating void rings with inward pull arc. `drawCultistGazeAura(bodyHeight, visualTime)` — deep green slow ring.
**Track B:** `summon_burst` 160px 8f `aoe_pop`, `madness_burst` 160px 7f `aoe_pop`, `tendril_burst` 96px 6f `aoe_pop`, `gate_pulse` 160px 8f `channel_pulse`, `gaze_aura` 160px 7f `aura_pulse`
**Track C:** `'cultist_madness'`, `'cultist_gate'`, `'cultist_gaze'`, `'cultist_summon'`
**Blocked:** `whispers` — projectile asset

### Task 11 — Chef
**Palette:** `#f48fb1` pink, `#f9a8d4` light pink, `#fde68a` warm gold, `#fbbf24` amber, `#f8fafc` white
**Track A:** `drawChefFeast(bodyHeight, visualTime)` — pink ring with 4 food-dot orbits. `drawChefSignatureDish(bodyHeight, visualTime)` — stacked rings (2 layers) in pink + gold. `drawChefLadleBash(bodyHeight)` — comedic short impact arc.
**Track B:** `feast_burst` 160px 7f `aoe_pop`, `ladle_impact` 96px 4f `hit_spark`, `hot_soup_glow` 96px 6f `heal_glow`, `signature_dish_pulse` 160px 8f `channel_pulse`
**Track C:** `'chef_feast'`, `'chef_ladle'`, `'chef_soup'`, `'chef_signature'`
**Blocked:** `spice_toss` — projectile asset

### Task 12 — Master
**Palette:** `#e0e0e0` silver, `#d1d5db` light grey, `#9ca3af` mid grey, `#6b7280` dark grey, `#f9fafb` near-white
**Track A:** `drawMasterEclipse(bodyHeight, visualTime)` — cycling colour ring (hue shifts through grey/gold/blue each 2s). `drawMasterApotheosis(bodyHeight, visualTime)` — double ring, white flood glow, upward particles.
**Track B:** `chosen_strike_impact` 96px 5f `hit_spark`, `chosen_nuke_burst` 160px 7f `aoe_pop`, `eclipse_aura` 160px 7f `aura_pulse`, `apotheosis_aura` 160px 8f `aura_pulse`
**Track C:** `'master_eclipse'`, `'master_apotheosis'`, `'master_chosen_strike'`, `'master_chosen_nuke'`

---

## Self-Review Notes

- All 12 guilds have Track A state checks, draw methods, Track B asset tables, and Track C effect names defined
- MoveList Task 0 has complete code — no placeholders
- Adventurer (Task 1) has complete code for all three tracks — full reference
- Tasks 2–5 (Mage, Druid, Monk, Champion) have complete draw method code for Track A
- Tasks 6–12 have abbreviated Track A descriptions with shape intent — subagent should follow Adventurer/Champion pattern exactly for those draw methods
- `drawMonkSerenity` requires `chiOrbs` passed as parameter — noted in task
- `drawDruidShapeshift` references `actor.shapeshiftForm` — valid field per `types.ts` Actor struct per CLAUDE.md
- buffTint chain grows with each guild — prefer extracting to `let buffTint: number | null = null` after Champion is done and the chain exceeds 5 entries
- Track B scripts for guilds 2–12 all follow `generate_adventurer_vfx.ps1` framework exactly — copy the header + helpers, replace the `$pal` block and effect functions
