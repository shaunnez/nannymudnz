Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $repoRoot 'public\vfx\druid'
$frameSize = 96
$gridSize = 32
$largeFrame = 160
$largeGrid = 40

if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

function New-Color([string]$hex, [int]$alpha = 255) {
  $hex = $hex.TrimStart('#')
  return [System.Drawing.Color]::FromArgb($alpha,
    [Convert]::ToInt32($hex.Substring(0,2),16),
    [Convert]::ToInt32($hex.Substring(2,2),16),
    [Convert]::ToInt32($hex.Substring(4,2),16))
}

$pal = @{
  green  = (New-Color '#4caf50')
  dark   = (New-Color '#65a30d')
  light  = (New-Color '#86efac')
  bright = (New-Color '#4ade80')
  bark   = (New-Color '#78350f')
  white  = (New-Color '#f0fdf4')
  deep   = (New-Color '#14532d')
}

function New-Brush($c) { return New-Object System.Drawing.SolidBrush($c) }
function New-Pen($c, [float]$w = 1) {
  $p = New-Object System.Drawing.Pen($c, $w)
  $p.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $p
}
function New-Frame([int]$size = $gridSize) {
  return New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}
function Scale-Frame([System.Drawing.Bitmap]$f, [int]$target = $frameSize) {
  $s = New-Object System.Drawing.Bitmap($target, $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($s)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    $g.DrawImage($f, 0, 0, $target, $target)
  } finally { $g.Dispose() }
  return $s
}
function Save-Strip([string]$name, $frames, [int]$target = $frameSize) {
  $strip = New-Object System.Drawing.Bitmap(($target * $frames.Count), $target, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($strip)
  try {
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    for ($i = 0; $i -lt $frames.Count; $i++) {
      $sc = Scale-Frame $frames[$i] $target
      try { $g.DrawImage($sc, $i * $target, 0, $target, $target) } finally { $sc.Dispose() }
    }
  } finally { $g.Dispose() }
  $path = Join-Path $outDir "$name.png"
  try { $strip.Save($path, [System.Drawing.Imaging.ImageFormat]::Png) } finally { $strip.Dispose() }
}
function Draw-Pixel($g, $c, [int]$x, [int]$y, [int]$w = 1, [int]$h = 1) {
  $b = New-Brush $c
  try { $g.FillRectangle($b, $x, $y, $w, $h) } finally { $b.Dispose() }
}
function Draw-Ring($g, $c, [int]$cx, [int]$cy, [int]$r, [int]$t = 1) {
  for ($o = 0; $o -lt $t; $o++) {
    $p = New-Pen $c 1
    try { $g.DrawEllipse($p, $cx-($r-$o), $cy-($r-$o), ($r-$o)*2, ($r-$o)*2) } finally { $p.Dispose() }
  }
}

# wild_growth_bloom — 160x160, 7 frames — green heal ring expanding
function Add-WildGrowthFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 7; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 2
      Draw-Ring $g $pal.green 20 20 $r 2
      Draw-Ring $g $pal.light 20 20 ($r - 2) 1
      for ($i = 0; $i -lt 4; $i++) {
        $angle = [Math]::PI / 2 * $i
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 2)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 2)))
        Draw-Pixel $g $pal.bright (20+$dx) (20+$dy) 2 2
      }
      Draw-Pixel $g $pal.white 19 17 2 6
      Draw-Pixel $g $pal.white 17 19 6 2
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# rejuvenate_glow — 96x96, 6 frames — soft inward heal ring
function Add-RejuvenateFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 10 - $idx
      if ($r -gt 2) { Draw-Ring $g $pal.light 16 16 $r 2 }
      Draw-Ring $g $pal.green 16 16 (4 + $idx) 1
      for ($i = 0; $i -lt ($idx + 1); $i++) {
        Draw-Pixel $g $pal.bright (8 + $i * 3) (6 + ($i % 2) * 3)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# cleanse_glow — 96x96, 6 frames — white+green cleanse burst
function Add-CleanseFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 6; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      Draw-Ring $g $pal.white 16 16 (3 + $idx * 2) 2
      Draw-Ring $g $pal.light 16 16 (2 + $idx * 2) 1
      Draw-Pixel $g $pal.green 15 10 2 12
      Draw-Pixel $g $pal.green 10 15 12 2
      for ($i = 0; $i -lt $idx; $i++) {
        Draw-Pixel $g $pal.bright (6 + $i * 4) (6 + ($i % 2) * 4)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# tranquility_pulse — 160x160, 8 frames — slow expanding double ring
function Add-TranquilityFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 8; $idx++) {
    $frame = New-Frame $largeGrid; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 5 + $idx * 2
      Draw-Ring $g $pal.green 20 20 $r 2
      Draw-Ring $g $pal.light 20 20 ($r + 3) 1
      for ($i = 0; $i -lt 6; $i++) {
        $angle = [Math]::PI * 2 / 6 * $i + $idx * 0.2
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 1)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 1)))
        Draw-Pixel $g $pal.bright (20+$dx) (20+$dy)
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

# shapeshift_burst — 96x96, 5 frames — quick ring burst
function Add-ShapeshiftFrames {
  $frames = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
  for ($idx = 0; $idx -lt 5; $idx++) {
    $frame = New-Frame; $g = [System.Drawing.Graphics]::FromImage($frame)
    try {
      $r = 4 + $idx * 3
      Draw-Ring $g $pal.dark 16 16 $r 2
      Draw-Ring $g $pal.green 16 16 ($r - 2) 1
      for ($i = 0; $i -lt 6; $i++) {
        $angle = [Math]::PI * 2 / 6 * $i
        $dx = [int]([Math]::Round([Math]::Cos($angle) * ($r + 2)))
        $dy = [int]([Math]::Round([Math]::Sin($angle) * ($r + 2)))
        Draw-Pixel $g $pal.bright (16+$dx) (16+$dy) 2 2
      }
      $frames.Add($frame)
    } finally { $g.Dispose() }
  }
  return $frames
}

$generated = @(
  @{ Name = 'wild_growth_bloom';  Frames = (Add-WildGrowthFrames);   Size = $largeFrame }
  @{ Name = 'rejuvenate_glow';    Frames = (Add-RejuvenateFrames);   Size = $frameSize  }
  @{ Name = 'cleanse_glow';       Frames = (Add-CleanseFrames);      Size = $frameSize  }
  @{ Name = 'tranquility_pulse';  Frames = (Add-TranquilityFrames);  Size = $largeFrame }
  @{ Name = 'shapeshift_burst';   Frames = (Add-ShapeshiftFrames);   Size = $frameSize  }
)
foreach ($e in $generated) {
  try { Save-Strip $e.Name $e.Frames $e.Size }
  finally { foreach ($f in $e.Frames) { $f.Dispose() } }
}
Write-Output "Wrote Druid VFX strips to $outDir"
